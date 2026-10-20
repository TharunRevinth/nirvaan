import { ethers } from 'ethers';
import db from './db.js';

const CONTRACT_ABI = [
  "event TenderCreated(uint256 indexed tenderId, address indexed psu, uint256 deadline)",
  "event BidSubmitted(uint256 indexed tenderId, uint256 indexed bidId, address indexed vendor)",
  "event BidsOpened(uint256 indexed tenderId)",
  "event BidRevealed(uint256 indexed tenderId, uint256 indexed bidIndex, address indexed vendor, uint256 amount)",
  "event BidRejected(uint256 indexed tenderId, uint256 indexed bidId, address indexed vendor)",
  "event TechnicalScoreSet(uint256 indexed tenderId, uint256 indexed bidIndex, bool qualified, uint256 score)",
  "event TenderAwarded(uint256 indexed tenderId, address indexed winner, uint256 amount)",
  "event DisputeFiled(uint256 indexed tenderId, address indexed challenger)",
  "event DisputeResolved(uint256 indexed tenderId, bool upheld)",
  "event TenderFinalized(uint256 indexed tenderId)",
  "event TenderCancelled(uint256 indexed tenderId, string reason)",
  "function tenders(uint256) external view returns (uint256 id, address psuAddress, string memory ipfsHashDoc, uint256 submissionDeadline, uint256 openingTime, uint256 revealDeadline, uint256 appealDeadline, uint256 minEMDAmount, uint8 status, address winner, uint256 winningBidId, uint256 winningBidAmount)",
  "function tenderBids(uint256, uint256) external view returns (uint256 id, uint256 tenderId, address vendorAddress, string memory encryptedBidIpfsHash, bytes32 bidCommitment, uint256 submissionTime, uint256 bidAmount, uint8 status, bool isTechQualified, uint256 techScore, uint256 emdDeposited)",
  "function getTenderBidsCount(uint256) external view returns (uint256)"
];

const STATUS_NAMES = [
  'Created',
  'UnderEvaluation',
  'Awarded',
  'Disputed',
  'DisputeResolved',
  'Finalized',
  'Cancelled'
];

export class EventIndexer {
  constructor(provider, contractAddress) {
    this.provider = provider;
    this.contractAddress = contractAddress;
    this.contract = new ethers.Contract(contractAddress, CONTRACT_ABI, provider);
    this.isSyncing = false;

    // Cache latest block to avoid thrashing RPC provider (15s TTL)
    this.cachedBlock = null;
    this.cachedBlockTimestamp = 0;
    this.batchSize = parseInt(process.env.INDEXER_BATCH_SIZE || '500', 10);
  }

  async getLatestBlockNumber(forceFresh = false) {
    const now = Date.now();
    if (!forceFresh && this.cachedBlock !== null && (now - this.cachedBlockTimestamp) < 15000) {
      return this.cachedBlock;
    }
    try {
      this.cachedBlock = await this.provider.getBlockNumber();
      this.cachedBlockTimestamp = now;
      return this.cachedBlock;
    } catch (err) {
      if (this.cachedBlock !== null) return this.cachedBlock;
      throw err;
    }
  }

  getLastIndexedBlock() {
    const row = db.prepare("SELECT value FROM indexer_state WHERE key = 'last_block'").get();
    return row ? parseInt(row.value, 10) : 0;
  }

  setLastIndexedBlock(blockNum) {
    db.prepare(`
      INSERT INTO indexer_state (key, value) VALUES ('last_block', ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(String(blockNum));
  }

  /**
   * Helper to execute queryFilter with exponential backoff for free-tier RPC rate limits
   */
  async queryFilterWithBackoff(fromBlock, toBlock, maxRetries = 5) {
    let attempt = 0;
    while (attempt < maxRetries) {
      try {
        return await this.contract.queryFilter("*", fromBlock, toBlock);
      } catch (err) {
        attempt++;
        const isRateLimit = err.message && (
          err.message.includes('429') ||
          err.message.toLowerCase().includes('rate limit') ||
          err.message.toLowerCase().includes('exceeded') ||
          err.message.toLowerCase().includes('limit')
        );

        if (attempt >= maxRetries) {
          throw err;
        }

        const delayMs = (isRateLimit ? 1000 : 500) * Math.pow(2, attempt - 1);
        console.warn(`[INDEXER RPC] Rate limit/error fetching logs [${fromBlock}-${toBlock}], retrying in ${delayMs}ms (attempt ${attempt}/${maxRetries})...`);
        await new Promise(res => setTimeout(res, delayMs));
      }
    }
    return [];
  }

  /**
   * Synchronize all blockchain events from last indexed block / DEPLOY_BLOCK to current block
   */
  async syncFromChain({ isStartup = false } = {}) {
    if (this.isSyncing) return;
    this.isSyncing = true;

    try {
      const currentBlock = await this.getLatestBlockNumber(true);
      const deployBlock = parseInt(process.env.DEPLOY_BLOCK || '0', 10);
      const lastBlock = this.getLastIndexedBlock();

      let fromBlock;
      if (lastBlock === 0) {
        fromBlock = deployBlock;
      } else {
        fromBlock = Math.max(lastBlock + 1, deployBlock);
      }

      if (fromBlock > currentBlock) {
        this.isSyncing = false;
        return;
      }

      if (isStartup) {
        console.log(`[INDEXER BOOT] Reconstructing state from blocks ${fromBlock} to ${currentBlock} (Batch size: ${this.batchSize})...`);
      }

      // Batch queries in chunks to respect RPC block-range and rate limits
      let chunkStart = fromBlock;
      let totalLogsProcessed = 0;

      while (chunkStart <= currentBlock) {
        const chunkEnd = Math.min(chunkStart + this.batchSize - 1, currentBlock);
        const logs = await this.queryFilterWithBackoff(chunkStart, chunkEnd);

        for (const log of logs) {
          await this.handleLog(log);
          totalLogsProcessed++;
        }

        this.setLastIndexedBlock(chunkEnd);
        chunkStart = chunkEnd + 1;
      }

      if (isStartup || totalLogsProcessed > 0) {
        console.log(`[INDEXER] Synced up to Block #${currentBlock}. Processed ${totalLogsProcessed} events.`);
      }
    } catch (err) {
      console.warn('[INDEXER] Event sync notice:', err.message);
    } finally {
      this.isSyncing = false;
    }
  }

  async handleLog(log) {
    try {
      const parsed = this.contract.interface.parseLog(log);
      if (!parsed) return;

      const eventName = parsed.name;
      const args = parsed.args;

      if (eventName === 'TenderCreated') {
        const tenderId = Number(args.tenderId);
        await this.indexTenderFromChain(tenderId, log.transactionHash, log.blockNumber);
      } else if (eventName === 'BidsOpened') {
        const tenderId = Number(args.tenderId);
        db.prepare("UPDATE tenders SET status = 'UnderEvaluation' WHERE on_chain_id = ?").run(tenderId);
      } else if (eventName === 'BidSubmitted') {
        const tenderId = Number(args.tenderId);
        const bidId = Number(args.bidId);
        await this.indexBidFromChain(tenderId, bidId, log.transactionHash);
      } else if (eventName === 'BidRevealed') {
        const tenderId = Number(args.tenderId);
        const bidIndex = Number(args.bidIndex);
        const amountWei = args.amount.toString();
        const amountEth = ethers.formatEther(args.amount);
        db.prepare(`
          UPDATE bids SET amount_wei = ?, amount_eth = ?, status = 'Opened'
          WHERE tender_id = ? AND bid_index = ?
        `).run(amountWei, amountEth, tenderId, bidIndex);
      } else if (eventName === 'TechnicalScoreSet') {
        const tenderId = Number(args.tenderId);
        const bidIndex = Number(args.bidIndex);
        const qualified = args.qualified ? 1 : 0;
        const score = Number(args.score);
        db.prepare(`
          UPDATE bids SET is_qualified = ?, tech_score = ?
          WHERE tender_id = ? AND bid_index = ?
        `).run(qualified, score, tenderId, bidIndex);
      } else if (eventName === 'TenderAwarded') {
        const tenderId = Number(args.tenderId);
        const winner = args.winner;
        const amountEth = ethers.formatEther(args.amount);

        const block = await this.provider.getBlock(log.blockNumber);
        const blockTimestamp = block ? block.timestamp : Math.floor(Date.now() / 1000);
        const appealDeadlineIso = new Date((blockTimestamp + 7 * 86400) * 1000).toISOString();

        db.prepare(`
          UPDATE tenders SET
            status = 'Awarded',
            winner_address = ?,
            winning_amount = ?,
            award_tx_hash = ?,
            award_block = ?,
            appeal_deadline = ?
          WHERE on_chain_id = ?
        `).run(winner, `${amountEth} ETH`, log.transactionHash, `Block #${log.blockNumber}`, appealDeadlineIso, tenderId);
      } else if (eventName === 'DisputeFiled') {
        const tenderId = Number(args.tenderId);
        const challenger = args.challenger;
        db.prepare(`
          UPDATE tenders SET
            status = 'Disputed',
            dispute_active = 1,
            challenger = ?,
            dispute_tx_hash = ?
          WHERE on_chain_id = ?
        `).run(challenger, log.transactionHash, tenderId);
      } else if (eventName === 'DisputeResolved') {
        const tenderId = Number(args.tenderId);
        const upheld = args.upheld;
        if (upheld) {
          db.prepare(`
            UPDATE tenders SET
              status = 'UnderEvaluation',
              winner_address = NULL,
              winner_name = NULL,
              winning_amount = NULL,
              award_tx_hash = NULL,
              appeal_deadline = NULL,
              dispute_active = 0
            WHERE on_chain_id = ?
          `).run(tenderId);
        } else {
          db.prepare(`
            UPDATE tenders SET
              status = 'DisputeResolved',
              dispute_active = 0
            WHERE on_chain_id = ?
          `).run(tenderId);
        }
      } else if (eventName === 'TenderFinalized') {
        const tenderId = Number(args.tenderId);
        db.prepare("UPDATE tenders SET status = 'Finalized' WHERE on_chain_id = ?").run(tenderId);
      } else if (eventName === 'TenderCancelled') {
        const tenderId = Number(args.tenderId);
        db.prepare("UPDATE tenders SET status = 'Cancelled' WHERE on_chain_id = ?").run(tenderId);
      }
    } catch (parseErr) {
      console.warn('[INDEXER] Log handling error:', parseErr.message);
    }
  }

  async indexTenderFromChain(tenderId, txHash = '', blockNumber = 0) {
    try {
      const data = await this.contract.tenders(tenderId);
      const subDeadlineIso = new Date(Number(data.submissionDeadline) * 1000).toISOString();
      const openTimeIso = new Date(Number(data.openingTime) * 1000).toISOString();
      const revealDeadlineIso = data.revealDeadline
        ? new Date(Number(data.revealDeadline) * 1000).toISOString()
        : new Date(Number(data.openingTime) * 1000 + 86400000).toISOString();
      const appealDeadlineIso = data.appealDeadline > 0n
        ? new Date(Number(data.appealDeadline) * 1000).toISOString()
        : null;

      const minEmdWei = data.minEMDAmount.toString();
      const minEmdEth = ethers.formatEther(data.minEMDAmount);
      const statusCode = Number(data.status);
      const statusStr = STATUS_NAMES[statusCode] || 'Created';
      const tenderCode = `TND-26-${String(tenderId).padStart(4, '0')}-GEN`;

      db.prepare(`
        INSERT INTO tenders (
          on_chain_id, code, psu, category, title, description, budget,
          min_emd_wei, min_emd_eth, submission_deadline, opening_time,
          reveal_deadline, appeal_deadline, status, cid, tx_hash, block_number,
          winner_address, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(on_chain_id) DO UPDATE SET
          submission_deadline = excluded.submission_deadline,
          opening_time = excluded.opening_time,
          reveal_deadline = excluded.reveal_deadline,
          appeal_deadline = excluded.appeal_deadline,
          status = excluded.status,
          winner_address = excluded.winner_address
      `).run(
        tenderId,
        tenderCode,
        data.psuAddress,
        'Oil & Gas Infrastructure',
        `Procurement Package #${tenderId}`,
        '',
        '25.00',
        minEmdWei,
        minEmdEth,
        subDeadlineIso,
        openTimeIso,
        revealDeadlineIso,
        appealDeadlineIso,
        statusStr,
        data.ipfsHashDoc,
        txHash,
        blockNumber,
        data.winner !== ethers.ZeroAddress ? data.winner : null,
        new Date().toISOString()
      );
    } catch (err) {
      console.warn(`[INDEXER] Could not index tender ${tenderId} from chain:`, err.message);
    }
  }

  async indexBidFromChain(tenderId, bidId, txHash = '') {
    try {
      const count = await this.contract.getTenderBidsCount(tenderId);
      const total = Number(count);
      for (let i = 0; i < total; i++) {
        const bid = await this.contract.tenderBids(tenderId, i);
        if (Number(bid.id) === bidId) {
          const subTimeIso = new Date(Number(bid.submissionTime) * 1000).toISOString();
          const amountWei = bid.bidAmount.toString();
          const amountEth = ethers.formatEther(bid.bidAmount);
          const statusStr = bid.status === 1 ? 'Opened' : (bid.status === 2 ? 'Accepted' : (bid.status === 3 ? 'Rejected' : 'Submitted'));

          db.prepare(`
            INSERT INTO bids (
              id, tender_id, vendor_address, bid_index, vendor_name, vid,
              amount_wei, amount_eth, commitment_hash, cid, is_qualified,
              tech_score, status, submission_time, tx_hash
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              amount_wei = excluded.amount_wei,
              amount_eth = excluded.amount_eth,
              status = excluded.status,
              is_qualified = excluded.is_qualified,
              tech_score = excluded.tech_score
          `).run(
            `BID-${tenderId}-${bidId}`,
            tenderId,
            bid.vendorAddress,
            i,
            `Vendor (${bid.vendorAddress.slice(0, 6)}…${bid.vendorAddress.slice(-4)})`,
            `VEN-${bid.vendorAddress.slice(2, 6).toUpperCase()}-X`,
            amountWei,
            amountEth,
            bid.bidCommitment,
            bid.encryptedBidIpfsHash,
            bid.isTechQualified ? 1 : 0,
            Number(bid.techScore),
            statusStr,
            subTimeIso,
            txHash
          );
          break;
        }
      }
    } catch (err) {
      console.warn(`[INDEXER] Could not index bid ${bidId} for tender ${tenderId}:`, err.message);
    }
  }
}
