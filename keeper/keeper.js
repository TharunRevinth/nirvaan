const { ethers } = require('ethers');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

console.log('===============================================================');
console.log('  NIRVAAN CONSORTIUM - AUTONOMOUS ORACLE KEEPER SERVICE');
console.log('  Enforcing CVC Timelines, Sealed Bid Openings & Finalizations');
console.log('===============================================================');

const RPC_URL = process.env.RPC_URL || process.env.BESU_RPC_URL || 'http://127.0.0.1:8545';
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || '0x5FbDB2315678afecb367f032d93F642f64180aa3';
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS || '10000', 10);

// Dedicated Keeper Private Key (Hardhat Account #4)
// Distinct from PSU Officer (Account #0 / #1) and Vendors (Account #2 / #3)
const KEEPER_PRIVATE_KEY =
  process.env.KEEPER_PRIVATE_KEY ||
  '0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a';

const CONTRACT_ABI = [
  'function keeperAddress() external view returns (address)',
  'function tenderCounter() external view returns (uint256)',
  'function tenders(uint256) external view returns (uint256 id, address psuAddress, string memory ipfsHashDoc, uint256 submissionDeadline, uint256 openingTime, uint256 appealDeadline, uint256 minEMDAmount, uint8 status, address winner, uint256 winningBidId, uint256 winningBidAmount)',
  'function openBids(uint256 _tenderId) external',
  'function finalizeTender(uint256 _tenderId) external',
  'event TenderCreated(uint256 indexed tenderId, address indexed psu, uint256 deadline)',
  'event BidsOpened(uint256 indexed tenderId)',
  'event TenderFinalized(uint256 indexed tenderId)'
];

const TENDER_STATUS = {
  0: 'Created',
  1: 'Active',
  2: 'Closed',
  3: 'UnderEvaluation',
  4: 'Awarded',
  5: 'Disputed',
  6: 'DisputeResolved',
  7: 'Finalized',
  8: 'Cancelled'
};

const provider = new ethers.JsonRpcProvider(RPC_URL);
const keeperWallet = new ethers.Wallet(KEEPER_PRIVATE_KEY, provider);
const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, keeperWallet);

// Set to track tender IDs with active in-flight transactions
const inFlightTenders = new Set();
let isPolling = false;

/**
 * Determine gas settings for zero-gas consortium chains or local test networks.
 */
async function getGasOverrides() {
  const overrides = { gasLimit: 350000n };

  try {
    const feeData = await provider.getFeeData();

    if (process.env.ZERO_GAS === 'true' || process.env.GAS_PRICE === '0' || feeData.gasPrice === 0n) {
      // Zero-gas consortium mode (Hyperledger Besu / Anvil zero-gas)
      overrides.gasPrice = 0n;
    } else if (process.env.GAS_PRICE) {
      overrides.gasPrice = BigInt(process.env.GAS_PRICE);
    } else if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
      // EIP-1559 local network (Anvil / Hardhat default)
      overrides.maxFeePerGas = feeData.maxFeePerGas;
      overrides.maxPriorityFeePerGas = feeData.maxPriorityFeePerGas;
    } else if (feeData.gasPrice) {
      overrides.gasPrice = feeData.gasPrice;
    }
  } catch (err) {
    console.warn(`[Keeper Gas] Could not query feeData: ${err.message}. Using default limit.`);
  }

  return overrides;
}

/**
 * Startup health check and role verification
 */
async function initializeKeeper() {
  try {
    const network = await provider.getNetwork();
    console.log(`[Keeper Init] Connected to Chain ID: ${network.chainId} (${RPC_URL})`);
    console.log(`[Keeper Init] Keeper Wallet Address: ${keeperWallet.address}`);
    console.log(`[Keeper Init] Target Contract: ${CONTRACT_ADDRESS}`);

    const onChainKeeper = await contract.keeperAddress();
    console.log(`[Keeper Init] On-Chain keeperAddress: ${onChainKeeper}`);

    if (keeperWallet.address.toLowerCase() !== onChainKeeper.toLowerCase()) {
      console.warn(
        `\n[WARNING] Keeper wallet mismatch!\n` +
        `  Local Wallet:     ${keeperWallet.address}\n` +
        `  Contract Storage: ${onChainKeeper}\n` +
        `  Keeper transactions will revert with "Only keeper allowed" until matched.\n`
      );
    } else {
      console.log(`[Keeper Auth] Status: AUTHORIZED (Wallet address matches on-chain keeperAddress)\n`);
    }

    const initialCount = await contract.tenderCounter();
    console.log(`[Keeper Init] Discovered ${initialCount.toString()} existing tenders on-chain.`);
  } catch (err) {
    console.error(`[Keeper Init] Startup verification failed: ${err.message}`);
  }
}

/**
 * Main polling iteration loop
 */
async function checkDeadlines() {
  if (isPolling) {
    console.log(`[Keeper Status] Previous poll cycle still executing. Skipping concurrent run.`);
    return;
  }

  isPolling = true;

  try {
    const block = await provider.getBlock('latest');
    if (!block) {
      isPolling = false;
      return;
    }

    const blockTime = block.timestamp;
    const dateStr = new Date(blockTime * 1000).toISOString();
    const count = await contract.tenderCounter();

    console.log(
      `[${new Date().toLocaleTimeString()}] Block #${block.number} | Chain Time: ${blockTime} (${dateStr}) | Tenders: ${count}`
    );

    for (let id = 1n; id <= count; id++) {
      const tenderIdNum = Number(id);

      if (inFlightTenders.has(tenderIdNum)) {
        console.log(`  -> Tender #${tenderIdNum}: Action currently in-flight. Skipping.`);
        continue;
      }

      const tender = await contract.tenders(id);
      const status = Number(tender.status);
      const statusLabel = TENDER_STATUS[status] || `Unknown(${status})`;
      const openingTime = Number(tender.openingTime);
      const appealDeadline = Number(tender.appealDeadline);

      // Rule 1: Auto-Open Bids when openingTime is reached
      if (status === 0 /* Created */ && blockTime >= openingTime) {
        console.log(
          `\n[KEEPER TRIGGER] Tender #${tenderIdNum} (${statusLabel}) reached openingTime!\n` +
          `  Opening Time: ${openingTime} | Current Time: ${blockTime} | Delta: +${blockTime - openingTime}s\n` +
          `  Executing: contract.openBids(${tenderIdNum})...`
        );

        inFlightTenders.add(tenderIdNum);

        try {
          const overrides = await getGasOverrides();
          const tx = await contract.openBids(id, overrides);
          console.log(`  -> [Tx Submitted] Hash: ${tx.hash}`);

          const receipt = await tx.wait(1);
          if (receipt.status === 1) {
            console.log(
              `  -> [Tx Confirmed] Status: SUCCESS | Block #${receipt.blockNumber} | Gas Used: ${receipt.gasUsed.toString()}`
            );
            console.log(`  -> Tender #${tenderIdNum} state transitioned: Created -> UnderEvaluation\n`);
          } else {
            console.error(`  -> [Tx Reverted] Tender #${tenderIdNum} openBids failed with status 0! Hash: ${tx.hash}\n`);
          }
        } catch (txErr) {
          console.error(`  -> [Execution Error] openBids(${tenderIdNum}) failed: ${txErr.message}\n`);
        } finally {
          inFlightTenders.delete(tenderIdNum);
        }
      }

      // Rule 2: Auto-Finalize Tender when 7-day appeal window has elapsed
      else if ((status === 4 /* Awarded */ || status === 6 /* DisputeResolved */) && blockTime > appealDeadline) {
        console.log(
          `\n[KEEPER TRIGGER] Tender #${tenderIdNum} (${statusLabel}) appeal window expired!\n` +
          `  Appeal Deadline: ${appealDeadline} | Current Time: ${blockTime} | Delta: +${blockTime - appealDeadline}s\n` +
          `  Executing: contract.finalizeTender(${tenderIdNum})...`
        );

        inFlightTenders.add(tenderIdNum);

        try {
          const overrides = await getGasOverrides();
          const tx = await contract.finalizeTender(id, overrides);
          console.log(`  -> [Tx Submitted] Hash: ${tx.hash}`);

          const receipt = await tx.wait(1);
          if (receipt.status === 1) {
            console.log(
              `  -> [Tx Confirmed] Status: SUCCESS | Block #${receipt.blockNumber} | Gas Used: ${receipt.gasUsed.toString()}`
            );
            console.log(`  -> Tender #${tenderIdNum} state transitioned: ${statusLabel} -> Finalized`);
            console.log(`  -> Automated EMD refunds processed for all non-winning bidders.\n`);
          } else {
            console.error(`  -> [Tx Reverted] Tender #${tenderIdNum} finalizeTender failed with status 0! Hash: ${tx.hash}\n`);
          }
        } catch (txErr) {
          console.error(`  -> [Execution Error] finalizeTender(${tenderIdNum}) failed: ${txErr.message}\n`);
        } finally {
          inFlightTenders.delete(tenderIdNum);
        }
      }
    }
  } catch (err) {
    console.error(`[Keeper Status] Polling loop encountered error: ${err.message}`);
  } finally {
    isPolling = false;
  }
}

// Bootstrap keeper service
(async () => {
  await initializeKeeper();
  await checkDeadlines();
  setInterval(checkDeadlines, POLL_INTERVAL_MS);
})();
