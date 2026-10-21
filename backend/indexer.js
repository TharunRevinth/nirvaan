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
  "event VendorRegistered(address indexed vendor, bytes32 gstinHash, uint256 timestamp)",
  "function tenders(uint256) external view returns (uint256 id, address psuAddress, string memory ipfsHashDoc, uint256 submissionDeadline, uint256 openingTime, uint256 revealDeadline, uint256 appealDeadline, uint256 minEMDAmount, uint8 status, address winner, uint256 winningBidId, uint256 winningBidAmount)",
  "function tenderBids(uint256, uint256) external view returns (uint256 id, uint256 tenderId, address vendorAddress, string memory encryptedBidIpfsHash, bytes32 bidCommitment, uint256 submissionTime, uint256 bidAmount, uint8 status, bool isTechQualified, uint256 techScore, uint256 emdDeposited)",
  "function getTenderBidsCount(uint256) external view returns (uint256)",
  "function registeredVendors(address) external view returns (bool)",
  "function vendorKYC(address) external view returns (bytes32 gstinHash, bytes32 panHash, string memory kycIpfsHash, uint256 registeredAt, bool isActive)"
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

/**
 * Extracts a unified error message string across various RPC client error wrappers.
 */
export function getFullErrorMessage(err) {
  if (!err) return '';
  if (typeof err === 'string') return err;
  const parts = [];
  if (err.message) parts.push(err.message);
  if (err.shortMessage) parts.push(err.shortMessage);
  if (err.reason) parts.push(err.reason);
  if (err.info?.error?.message) parts.push(err.info.error.message);
  if (err.error?.message) parts.push(err.error.message);
  if (err.response?.data?.error?.message) parts.push(err.response.data.error.message);
  if (typeof err.data === 'string') parts.push(err.data);
  if (err.data?.message) parts.push(err.data.message);
  return parts.join(' ');
}

/**
 * Parses block-range restriction errors from providers (e.g. Alchemy 10-block limit, Infura 10000 results).
 * Returns { isRangeTooLarge: true, suggestedBatchSize: number | null } or null.
 */
export function parseRangeTooLargeError(err) {
  if (!err) return null;
  const rawMsg = getFullErrorMessage(err);
  const msg = rawMsg.toLowerCase();

  const isRangeTooLarge =
    msg.includes('limited to a') ||
    msg.includes('range is too large') ||
    msg.includes('range is too wide') ||
    msg.includes('smaller block range') ||
    msg.includes('smaller range') ||
    msg.includes('more than 10000 results') ||
    msg.includes('try with this block range') ||
    msg.includes('response size') ||
    (msg.includes('exceed') && (msg.includes('range') || msg.includes('block'))) ||
    (msg.includes('range') && (msg.includes('limit') || msg.includes('maximum') || msg.includes('allowed') || msg.includes('within') || msg.includes('greater than')));

  if (!isRangeTooLarge) return null;

  // 1. Try to parse suggested hex range: [0x1a, 0x20]
  const hexRangeMatch = rawMsg.match(/\[(0x[0-9a-fA-F]+),\s*(0x[0-9a-fA-F]+)\]/);
  if (hexRangeMatch) {
    try {
      const start = BigInt(hexRangeMatch[1]);
      const end = BigInt(hexRangeMatch[2]);
      if (end >= start) {
        const diff = Number(end - start + 1n);
        if (diff > 0) return { isRangeTooLarge: true, suggestedBatchSize: diff };
      }
    } catch (_) {}
  }

  // 2. Try to parse suggested decimal range: [100, 109]
  const decRangeMatch = rawMsg.match(/\[([0-9]+),\s*([0-9]+)\]/);
  if (decRangeMatch) {
    try {
      const start = parseInt(decRangeMatch[1], 10);
      const end = parseInt(decRangeMatch[2], 10);
      if (end >= start) {
        const diff = end - start + 1;
        if (diff > 0) return { isRangeTooLarge: true, suggestedBatchSize: diff };
      }
    } catch (_) {}
  }

  // 3. Try to parse explicit block limit numbers (e.g. "limited to a 10 block range")
  const limitMatch =
    rawMsg.match(/limited to a[n]?\s+([0-9]+)\s*block/i) ||
    rawMsg.match(/max(?:imum)?\s*(?:allowed)?(?:\s*block)?(?:\s*range)?(?:\s*is)?(?::\s*|\s+)([0-9]+)/i) ||
    rawMsg.match(/within\s+([0-9]+)\s*blocks/i) ||
    rawMsg.match(/exceed(?:s|ed|ing)?\s*(?:max)?(?:\s*block)?\s*range\s*([0-9]+)/i) ||
    rawMsg.match(/greater\s+than\s+([0-9]+)/i);

  if (limitMatch && limitMatch[1]) {
    const parsedLimit = parseInt(limitMatch[1], 10);
    if (!isNaN(parsedLimit) && parsedLimit > 0) {
      return { isRangeTooLarge: true, suggestedBatchSize: parsedLimit };
    }
  }

  return { isRangeTooLarge: true, suggestedBatchSize: null };
}

export class EventIndexer {
  constructor(provider, contractAddress) {
    this.provider = provider;
    this.contractAddress = contractAddress;
    this.contract = new ethers.Contract(contractAddress, CONTRACT_ABI, provider);
    this.isSyncing = false;
    this.lastError = null;
    this.lastSyncSuccess = false;

    // Cache latest block to avoid thrashing RPC provider (15s TTL)
    this.cachedBlock = null;
    this.cachedBlockTimestamp = 0;
    const envBatchSize = parseInt(process.env.INDEXER_BATCH_SIZE || '10', 10);
    this.batchSize = !isNaN(envBatchSize) && envBatchSize > 0 ? envBatchSize : 10;
  }

  getLastError() {
    return this.lastError;
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
   * Helper to fetch logs for a block range with dynamic range halving / suggested range fallback
   * when the RPC provider rejects the range as too large (e.g. Alchemy free-tier 10-block limit).
   * Retries immediately on range reductions instead of failing after 5 attempts.
   */
  async fetchLogsWithFallback(fromBlock, maxTargetBlock) {
    let currentBatch = this.batchSize;
    let attempt = 0;
    const maxTransientRetries = 5;

    while (true) {
      const toBlock = Math.min(fromBlock + currentBatch - 1, maxTargetBlock);
      try {
        const logs = await this.contract.queryFilter("*", fromBlock, toBlock);
        return { logs, endBlock: toBlock };
      } catch (err) {
        const rangeError = parseRangeTooLargeError(err);

        if (rangeError && rangeError.isRangeTooLarge) {
          let newBatch;
          if (rangeError.suggestedBatchSize && rangeError.suggestedBatchSize < currentBatch) {
            newBatch = Math.max(1, rangeError.suggestedBatchSize);
          } else {
            newBatch = Math.max(1, Math.floor(currentBatch / 2));
          }

          if (newBatch < currentBatch) {
            console.warn(
              `[INDEXER] Range [${fromBlock}-${toBlock}] too large (${err.message}). ` +
              `Adjusting batch size from ${currentBatch} to ${newBatch} and retrying...`
            );
            this.batchSize = newBatch;
            currentBatch = newBatch;
            attempt = 0; // Reset transient retry counter
            continue; // Retry immediately with reduced range
          }
        }

        // Transient errors (rate limits 429, timeouts, connection drop)
        attempt++;
        const isRateLimit = err.message && (
          err.message.includes('429') ||
          err.message.toLowerCase().includes('rate limit') ||
          err.message.toLowerCase().includes('exceeded') ||
          err.message.toLowerCase().includes('limit')
        );

        if (attempt >= maxTransientRetries) {
          throw err;
        }

        const delayMs = process.env.NODE_ENV === 'test' ? 5 : ((isRateLimit ? 1000 : 500) * Math.pow(2, attempt - 1));
        console.warn(
          `[INDEXER RPC] Error fetching logs [${fromBlock}-${toBlock}]: ${err.message}. ` +
          `Retrying in ${delayMs}ms (attempt ${attempt}/${maxTransientRetries})...`
        );
        await new Promise(res => setTimeout(res, delayMs));
      }
    }
  }

  /**
   * Synchronize all blockchain events from last indexed block / DEPLOY_BLOCK to current block
   */
  async syncFromChain({ isStartup = false } = {}) {
    if (this.isSyncing) return { success: !this.lastError, inProgress: true };
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
        this.lastError = null;
        this.lastSyncSuccess = true;
        return { success: true, processedEvents: 0 };
      }

      if (isStartup) {
        console.log(`[INDEXER BOOT] Reconstructing state from blocks ${fromBlock} to ${currentBlock} (Batch size: ${this.batchSize})...`);
      }

      // Batch queries in chunks to respect RPC block-range and rate limits
      let chunkStart = fromBlock;
      let totalLogsProcessed = 0;

      while (chunkStart <= currentBlock) {
        const { logs, endBlock } = await this.fetchLogsWithFallback(chunkStart, currentBlock);

        for (const log of logs) {
          await this.handleLog(log);
          totalLogsProcessed++;
        }

        this.setLastIndexedBlock(endBlock);
        chunkStart = endBlock + 1;
      }

      this.lastError = null;
      this.lastSyncSuccess = true;

      if (isStartup || totalLogsProcessed > 0) {
        console.log(`[INDEXER] Synced up to Block #${currentBlock}. Processed ${totalLogsProcessed} events.`);
      }

      return { success: true, processedEvents: totalLogsProcessed };
    } catch (err) {
      this.lastError = err.message || 'Indexer sync failure';
      this.lastSyncSuccess = false;
      console.error(`[INDEXER ERROR] Event sync failure: ${this.lastError}`);
      return { success: false, error: this.lastError };
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
      } else if (eventName === 'VendorRegistered') {
        const vendorAddress = args.vendor;
        await this.indexVendorRegisteredFromChain(vendorAddress, log.transactionHash, log.blockNumber);
      }
    } catch (parseErr) {
      console.warn('[INDEXER] Log handling error:', parseErr.message);
    }
  }

  async indexVendorRegisteredFromChain(vendorAddress, txHash = '', blockNumber = 0) {
    try {
      const normalized = ethers.getAddress(vendorAddress);
      let kycCid = null;
      let registeredAtIso = new Date().toISOString();
      try {
        const kycData = await this.contract.vendorKYC(normalized);
        if (kycData && kycData.kycIpfsHash) {
          kycCid = kycData.kycIpfsHash;
        }
        if (kycData && kycData.registeredAt) {
          registeredAtIso = new Date(Number(kycData.registeredAt) * 1000).toISOString();
        }
      } catch (e) {}

      const existing = db.prepare('SELECT * FROM vendor_applications WHERE LOWER(wallet_address) = LOWER(?)').get(normalized);
      if (existing) {
        db.prepare(`
          UPDATE vendor_applications SET
            status = 'APPROVED',
            tx_hash = COALESCE(?, tx_hash),
            kyc_cid = COALESCE(kyc_cid, ?),
            updated_at = ?
          WHERE id = ?
        `).run(txHash || null, kycCid, new Date().toISOString(), existing.id);
      } else {
        const appId = `APP-CHAIN-${normalized.slice(2, 10).toUpperCase()}`;
        db.prepare(`
          INSERT INTO vendor_applications (
            id, wallet_address, company_name, gstin, pan, kyc_cid, status, tx_hash, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, 'APPROVED', ?, ?, ?)
          ON CONFLICT(wallet_address) DO UPDATE SET
            status = 'APPROVED',
            tx_hash = excluded.tx_hash,
            updated_at = excluded.updated_at
        `).run(
          appId,
          normalized,
          `Vendor (${normalized.slice(0, 6)}…${normalized.slice(-4)})`,
          'ON-CHAIN-VERIFIED',
          'VERIFIED',
          kycCid,
          txHash,
          registeredAtIso,
          new Date().toISOString()
        );
      }
    } catch (err) {
      console.warn(`[INDEXER] Could not index registered vendor ${vendorAddress}:`, err.message);
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
