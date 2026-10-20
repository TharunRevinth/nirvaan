const { ethers } = require('ethers');
const http = require('http');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

console.log('===============================================================');
console.log('  NIRVAAN CONSORTIUM - AUTONOMOUS ORACLE KEEPER SERVICE');
console.log('  Enforcing CVC Timelines, Sealed Bid Openings & Finalizations');
console.log('===============================================================');

const RPC_URL = process.env.RPC_URL || process.env.BESU_RPC_URL || 'http://127.0.0.1:8545';
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || '0x5FbDB2315678afecb367f032d93F642f64180aa3';
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS || '10000', 10);
const KEEPER_HEALTH_PORT = parseInt(process.env.KEEPER_PORT || process.env.HEALTH_PORT || '5050', 10);

if (!process.env.KEEPER_PRIVATE_KEY) {
  console.error('\n[FATAL ERROR] KEEPER_PRIVATE_KEY environment variable is missing.');
  console.error('Please configure KEEPER_PRIVATE_KEY in keeper/.env before starting the keeper service.\n');
  process.exit(1);
}
const KEEPER_PRIVATE_KEY = process.env.KEEPER_PRIVATE_KEY;

const CONTRACT_ABI = [
  'function keeperAddress() external view returns (address)',
  'function tenderCounter() external view returns (uint256)',
  'function tenders(uint256) external view returns (uint256 id, address psuAddress, string memory ipfsHashDoc, uint256 submissionDeadline, uint256 openingTime, uint256 revealDeadline, uint256 appealDeadline, uint256 minEMDAmount, uint8 status, address winner, uint256 winningBidId, uint256 winningBidAmount)',
  'function openBids(uint256 _tenderId) external',
  'function finalizeTender(uint256 _tenderId) external',
  'event TenderCreated(uint256 indexed tenderId, address indexed psu, uint256 deadline)',
  'event BidsOpened(uint256 indexed tenderId)',
  'event TenderAwarded(uint256 indexed tenderId, address indexed winner, uint256 amount)',
  'event DisputeFiled(uint256 indexed tenderId, address indexed challenger)',
  'event DisputeResolved(uint256 indexed tenderId, bool upheld)',
  'event TenderFinalized(uint256 indexed tenderId)',
  'event TenderCancelled(uint256 indexed tenderId, string reason)'
];

const TENDER_STATUS = {
  0: 'Created',
  1: 'UnderEvaluation',
  2: 'Awarded',
  3: 'Disputed',
  4: 'DisputeResolved',
  5: 'Finalized',
  6: 'Cancelled'
};

const provider = new ethers.JsonRpcProvider(RPC_URL);
const keeperWallet = new ethers.Wallet(KEEPER_PRIVATE_KEY, provider);
const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, keeperWallet);

// -----------------------------------------------------------------------
// HEALTH METRICS & ALERTS
// -----------------------------------------------------------------------
const alerts = [];
let lastPollTimestamp = null;
let lastIndexedBlockCursor = 0;
let totalActionsExecuted = 0;

function recordAlert(level, message, metadata = {}) {
  const alert = {
    level,
    message,
    metadata,
    timestamp: new Date().toISOString()
  };
  alerts.push(alert);
  if (alerts.length > 50) alerts.shift();
  if (level === 'CRITICAL' || level === 'ERROR') {
    console.error(`[KEEPER ALERT - ${level}] ${message}`, metadata);
  } else {
    console.warn(`[KEEPER NOTICE - ${level}] ${message}`);
  }
}

// -----------------------------------------------------------------------
// CURSOR-BASED ACTIVE TENDER STATE TRACKING (NO 1..N FULL SCAN)
// -----------------------------------------------------------------------
// Map of tenderId -> { id, status, openingTime, appealDeadline }
const activeTenders = new Map();
const inFlightTenders = new Set();
let isPolling = false;

/**
 * Sync state changes using contract events cursor
 */
async function syncEventCursor(currentBlock) {
  try {
    const fromBlock = lastIndexedBlockCursor > 0 ? lastIndexedBlockCursor + 1 : 0;
    if (fromBlock > currentBlock) return;

    const logs = await contract.queryFilter("*", fromBlock, currentBlock);

    for (const log of logs) {
      try {
        const parsed = contract.interface.parseLog(log);
        if (!parsed) continue;

        const { name, args } = parsed;
        const tenderId = Number(args.tenderId);

        if (name === 'TenderCreated') {
          const t = await contract.tenders(tenderId);
          activeTenders.set(tenderId, {
            id: tenderId,
            status: Number(t.status),
            openingTime: Number(t.openingTime),
            appealDeadline: Number(t.appealDeadline)
          });
          console.log(`[Keeper Cursor] Tracked new tender #${tenderId} (Opening: ${Number(t.openingTime)})`);
        } else if (name === 'BidsOpened') {
          const tracked = activeTenders.get(tenderId);
          if (tracked) {
            tracked.status = 1; // UnderEvaluation
          }
        } else if (name === 'TenderAwarded') {
          const t = await contract.tenders(tenderId);
          activeTenders.set(tenderId, {
            id: tenderId,
            status: Number(t.status),
            openingTime: Number(t.openingTime),
            appealDeadline: Number(t.appealDeadline)
          });
          console.log(`[Keeper Cursor] Tender #${tenderId} awarded. Appeal deadline: ${Number(t.appealDeadline)}`);
        } else if (name === 'DisputeFiled') {
          const tracked = activeTenders.get(tenderId);
          if (tracked) {
            tracked.status = 3; // Disputed
          }
        } else if (name === 'DisputeResolved') {
          const t = await contract.tenders(tenderId);
          if (args.upheld) {
            activeTenders.set(tenderId, {
              id: tenderId,
              status: 1, // UnderEvaluation
              openingTime: Number(t.openingTime),
              appealDeadline: 0
            });
          } else {
            activeTenders.set(tenderId, {
              id: tenderId,
              status: 4, // DisputeResolved
              openingTime: Number(t.openingTime),
              appealDeadline: Number(t.appealDeadline)
            });
          }
        } else if (name === 'TenderFinalized' || name === 'TenderCancelled') {
          activeTenders.delete(tenderId);
          console.log(`[Keeper Cursor] Tender #${tenderId} finalized/cancelled. Removed from active watch.`);
        }
      } catch (err) {
        console.warn(`[Keeper Cursor] Failed parsing log: ${err.message}`);
      }
    }

    lastIndexedBlockCursor = currentBlock;
  } catch (err) {
    console.warn(`[Keeper Cursor] Query filter failed: ${err.message}`);
  }
}

/**
 * Determine gas settings with dynamic estimation + 20% margin
 */
async function getDynamicGasOverrides(methodName, args = []) {
  const overrides = {};

  try {
    const estimated = await contract[methodName].estimateGas(...args);
    // Add 20% safety margin (estimated * 120n / 100n)
    overrides.gasLimit = (estimated * 120n) / 100n;
  } catch (estErr) {
    console.warn(`[Keeper Gas] Dynamic estimateGas failed for ${methodName} (${estErr.message}). Using safe margin fallback.`);
    overrides.gasLimit = 500000n;
  }

  try {
    const feeData = await provider.getFeeData();
    if (process.env.ZERO_GAS === 'true' || process.env.GAS_PRICE === '0' || feeData.gasPrice === 0n) {
      overrides.gasPrice = 0n;
    } else if (process.env.GAS_PRICE) {
      overrides.gasPrice = BigInt(process.env.GAS_PRICE);
    } else if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
      overrides.maxFeePerGas = feeData.maxFeePerGas;
      overrides.maxPriorityFeePerGas = feeData.maxPriorityFeePerGas;
    } else if (feeData.gasPrice) {
      overrides.gasPrice = feeData.gasPrice;
    }
  } catch (feeErr) {
    console.warn(`[Keeper Gas] Could not read network feeData: ${feeErr.message}`);
  }

  return overrides;
}

/**
 * Exponential backoff retry wrapper
 */
async function executeWithRetry(operationName, fn, maxRetries = 3, initialDelayMs = 1000) {
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      return await fn();
    } catch (err) {
      attempt++;
      if (attempt >= maxRetries) {
        recordAlert('ERROR', `${operationName} failed after ${maxRetries} attempts: ${err.message}`);
        throw err;
      }
      const delay = initialDelayMs * Math.pow(2, attempt - 1);
      console.warn(`[Keeper Retry] ${operationName} attempt ${attempt} failed. Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

/**
 * Initial bootstrapping to populate active tenders cursor
 */
async function initializeKeeper() {
  try {
    const network = await provider.getNetwork();
    console.log(`[Keeper Init] Connected to Chain ID: ${network.chainId} (${RPC_URL})`);
    console.log(`[Keeper Init] Keeper Wallet: ${keeperWallet.address}`);
    console.log(`[Keeper Init] Contract Address: ${CONTRACT_ADDRESS}`);

    const onChainKeeper = await contract.keeperAddress();
    console.log(`[Keeper Init] On-Chain Keeper Address: ${onChainKeeper}`);

    if (keeperWallet.address.toLowerCase() !== onChainKeeper.toLowerCase()) {
      recordAlert('WARNING', `Keeper wallet mismatch! Local: ${keeperWallet.address}, On-Chain: ${onChainKeeper}`);
    } else {
      console.log(`[Keeper Auth] Status: AUTHORIZED\n`);
    }

    const currentBlock = await provider.getBlock('latest');
    const totalCount = await contract.tenderCounter();
    console.log(`[Keeper Init] Initializing cursor for ${totalCount} tenders...`);

    for (let id = 1n; id <= totalCount; id++) {
      try {
        const t = await contract.tenders(id);
        const status = Number(t.status);
        // Only track active tenders: Created (0), Awarded (2), DisputeResolved (4)
        if (status === 0 || status === 2 || status === 4) {
          activeTenders.set(Number(id), {
            id: Number(id),
            status,
            openingTime: Number(t.openingTime),
            appealDeadline: Number(t.appealDeadline)
          });
        }
      } catch (err) {
        // Skip uninitialized
      }
    }

    if (currentBlock) {
      lastIndexedBlockCursor = currentBlock.number;
    }
    console.log(`[Keeper Init] Discovered ${activeTenders.size} active tenders requiring keeper observation.`);
  } catch (err) {
    recordAlert('CRITICAL', `Keeper startup initialization failed: ${err.message}`);
  }
}

/**
 * Main polling iteration loop: checks only tracked active tenders
 */
async function checkDeadlines() {
  if (isPolling) return;
  isPolling = true;
  lastPollTimestamp = new Date().toISOString();

  try {
    const block = await provider.getBlock('latest');
    if (!block) {
      isPolling = false;
      return;
    }

    const blockTime = block.timestamp;

    // Sync cursor with recent events to update active watch list
    await syncEventCursor(block.number);

    console.log(`[Keeper Poll] Block #${block.number} | Chain Time: ${blockTime} | Watching ${activeTenders.size} active tenders`);

    for (const [tenderIdNum, tender] of activeTenders.entries()) {
      if (inFlightTenders.has(tenderIdNum)) continue;

      // Condition 1: Auto-Open Bids when openingTime reached
      if (tender.status === 0 /* Created */ && blockTime >= tender.openingTime) {
        console.log(`[KEEPER TRIGGER] Tender #${tenderIdNum} reached openingTime (${tender.openingTime}). Executing openBids...`);
        inFlightTenders.add(tenderIdNum);

        try {
          await executeWithRetry(`openBids(${tenderIdNum})`, async () => {
            const overrides = await getDynamicGasOverrides('openBids', [tenderIdNum]);
            const tx = await contract.openBids(tenderIdNum, overrides);
            console.log(`  -> [Tx Sent] openBids #${tenderIdNum}: ${tx.hash}`);
            const receipt = await tx.wait(1);
            if (receipt.status === 1) {
              console.log(`  -> [Success] Tender #${tenderIdNum} bids opened in Block #${receipt.blockNumber}`);
              tender.status = 1; // UnderEvaluation
              totalActionsExecuted++;
            } else {
              throw new Error(`Tx reverted with status 0`);
            }
          });
        } catch (execErr) {
          recordAlert('ERROR', `openBids(${tenderIdNum}) execution failed: ${execErr.message}`);
        } finally {
          inFlightTenders.delete(tenderIdNum);
        }
      }

      // Condition 2: Auto-Finalize Tender when 7-day appeal deadline expired
      else if ((tender.status === 2 /* Awarded */ || tender.status === 4 /* DisputeResolved */) && blockTime > tender.appealDeadline) {
        console.log(`[KEEPER TRIGGER] Tender #${tenderIdNum} appeal window expired (${tender.appealDeadline}). Executing finalizeTender...`);
        inFlightTenders.add(tenderIdNum);

        try {
          await executeWithRetry(`finalizeTender(${tenderIdNum})`, async () => {
            const overrides = await getDynamicGasOverrides('finalizeTender', [tenderIdNum]);
            const tx = await contract.finalizeTender(tenderIdNum, overrides);
            console.log(`  -> [Tx Sent] finalizeTender #${tenderIdNum}: ${tx.hash}`);
            const receipt = await tx.wait(1);
            if (receipt.status === 1) {
              console.log(`  -> [Success] Tender #${tenderIdNum} finalized in Block #${receipt.blockNumber}`);
              activeTenders.delete(tenderIdNum);
              totalActionsExecuted++;
            } else {
              throw new Error(`Tx reverted with status 0`);
            }
          });
        } catch (execErr) {
          recordAlert('ERROR', `finalizeTender(${tenderIdNum}) execution failed: ${execErr.message}`);
        } finally {
          inFlightTenders.delete(tenderIdNum);
        }
      }
    }
  } catch (err) {
    recordAlert('ERROR', `Keeper checkDeadlines cycle error: ${err.message}`);
  } finally {
    isPolling = false;
  }
}

// -----------------------------------------------------------------------
// HTTP HEALTH & ALERTS SERVER
// -----------------------------------------------------------------------
const healthServer = http.createServer((req, res) => {
  res.setHeader('Content-Type', 'application/json');

  if (req.url === '/health' || req.url === '/api/health') {
    res.writeHead(200);
    return res.end(JSON.stringify({
      status: alerts.some(a => a.level === 'CRITICAL') ? 'degraded' : 'healthy',
      service: 'nirvaan-oracle-keeper',
      uptimeSeconds: Math.floor(process.uptime()),
      lastPollTimestamp,
      lastIndexedBlockCursor,
      activeTrackedTendersCount: activeTenders.size,
      totalActionsExecuted,
      recentAlertsCount: alerts.length
    }, null, 2));
  }

  if (req.url === '/alerts' || req.url === '/api/alerts') {
    res.writeHead(200);
    return res.end(JSON.stringify({
      alerts,
      count: alerts.length
    }, null, 2));
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: 'Endpoint not found' }));
});

healthServer.listen(KEEPER_HEALTH_PORT, () => {
  console.log(`[Keeper Health] Health & Alert endpoint listening on http://localhost:${KEEPER_HEALTH_PORT}/health`);
});

// Bootstrap keeper
(async () => {
  await initializeKeeper();
  await checkDeadlines();
  setInterval(checkDeadlines, POLL_INTERVAL_MS);
})();
