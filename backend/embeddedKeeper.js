import { ethers } from 'ethers';

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

const keeperState = {
  initialized: false,
  healthy: true,
  lastRunAt: null,
  activeTendersCount: 0,
  lastAction: 'Service initialized',
  totalActions: 0,
  errorCount: 0,
  lastError: null
};

const activeTenders = new Map();
const inFlightTenders = new Set();
let isPolling = false;
let lastIndexedBlockCursor = 0;
let contract = null;
let provider = null;
let keeperWallet = null;

async function getDynamicGasOverrides(methodName, args = []) {
  const overrides = {};
  try {
    const estimated = await contract[methodName].estimateGas(...args);
    overrides.gasLimit = (estimated * 120n) / 100n;
  } catch (estErr) {
    overrides.gasLimit = 500000n;
  }

  try {
    const feeData = await provider.getFeeData();
    if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
      overrides.maxFeePerGas = feeData.maxFeePerGas;
      overrides.maxPriorityFeePerGas = feeData.maxPriorityFeePerGas;
    } else if (feeData.gasPrice) {
      overrides.gasPrice = feeData.gasPrice;
    }
  } catch (feeErr) {}

  return overrides;
}

async function executeWithRetry(operationName, fn, maxRetries = 3, initialDelayMs = 1000) {
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      return await fn();
    } catch (err) {
      attempt++;
      if (attempt >= maxRetries) {
        keeperState.errorCount++;
        keeperState.lastError = `${operationName} failed: ${err.message}`;
        throw err;
      }
      const delay = initialDelayMs * Math.pow(2, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

async function syncEventCursor(currentBlock) {
  try {
    const fromBlock = lastIndexedBlockCursor > 0 ? lastIndexedBlockCursor + 1 : currentBlock - 50;
    if (fromBlock > currentBlock) return;

    // Small range query to avoid RPC limits
    const safeFrom = Math.max(fromBlock, currentBlock - 500);
    const logs = await contract.queryFilter("*", safeFrom, currentBlock);

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
        } else if (name === 'BidsOpened') {
          const tracked = activeTenders.get(tenderId);
          if (tracked) tracked.status = 1;
        } else if (name === 'TenderAwarded') {
          const t = await contract.tenders(tenderId);
          activeTenders.set(tenderId, {
            id: tenderId,
            status: Number(t.status),
            openingTime: Number(t.openingTime),
            appealDeadline: Number(t.appealDeadline)
          });
        } else if (name === 'DisputeFiled') {
          const tracked = activeTenders.get(tenderId);
          if (tracked) tracked.status = 3;
        } else if (name === 'DisputeResolved') {
          const t = await contract.tenders(tenderId);
          activeTenders.set(tenderId, {
            id: tenderId,
            status: args.upheld ? 1 : 4,
            openingTime: Number(t.openingTime),
            appealDeadline: args.upheld ? 0 : Number(t.appealDeadline)
          });
        } else if (name === 'TenderFinalized' || name === 'TenderCancelled') {
          activeTenders.delete(tenderId);
        }
      } catch (e) {}
    }

    lastIndexedBlockCursor = currentBlock;
  } catch (err) {
    // Ignore transient cursor error
  }
}

async function pollCycle() {
  if (isPolling) return;
  isPolling = true;
  keeperState.lastRunAt = new Date().toISOString();

  try {
    const block = await provider.getBlock('latest');
    if (!block) {
      isPolling = false;
      return;
    }

    const blockTime = block.timestamp;
    await syncEventCursor(block.number);
    keeperState.activeTendersCount = activeTenders.size;

    for (const [tenderIdNum, tender] of activeTenders.entries()) {
      if (inFlightTenders.has(tenderIdNum)) continue;

      // Condition 1: Auto-Open Bids when openingTime reached
      if (tender.status === 0 && blockTime >= tender.openingTime) {
        inFlightTenders.add(tenderIdNum);
        try {
          await executeWithRetry(`openBids(${tenderIdNum})`, async () => {
            const overrides = await getDynamicGasOverrides('openBids', [tenderIdNum]);
            const tx = await contract.openBids(tenderIdNum, overrides);
            console.log(`[EMBEDDED KEEPER] Sent openBids for Tender #${tenderIdNum}: ${tx.hash}`);
            const receipt = await tx.wait(1);
            if (receipt.status === 1) {
              tender.status = 1;
              keeperState.totalActions++;
              keeperState.lastAction = `Opened bids for Tender #${tenderIdNum} (Block #${receipt.blockNumber})`;
              console.log(`[EMBEDDED KEEPER] Bids opened for Tender #${tenderIdNum}`);
            }
          });
        } catch (e) {
          console.warn(`[EMBEDDED KEEPER] openBids(#${tenderIdNum}) notice:`, e.message);
        } finally {
          inFlightTenders.delete(tenderIdNum);
        }
      }

      // Condition 2: Auto-Finalize Tender when 7-day appeal deadline expired
      else if ((tender.status === 2 || tender.status === 4) && tender.appealDeadline > 0 && blockTime > tender.appealDeadline) {
        inFlightTenders.add(tenderIdNum);
        try {
          await executeWithRetry(`finalizeTender(${tenderIdNum})`, async () => {
            const overrides = await getDynamicGasOverrides('finalizeTender', [tenderIdNum]);
            const tx = await contract.finalizeTender(tenderIdNum, overrides);
            console.log(`[EMBEDDED KEEPER] Sent finalizeTender for Tender #${tenderIdNum}: ${tx.hash}`);
            const receipt = await tx.wait(1);
            if (receipt.status === 1) {
              activeTenders.delete(tenderIdNum);
              keeperState.totalActions++;
              keeperState.lastAction = `Finalized Tender #${tenderIdNum} (Block #${receipt.blockNumber})`;
              console.log(`[EMBEDDED KEEPER] Tender #${tenderIdNum} finalized.`);
            }
          });
        } catch (e) {
          console.warn(`[EMBEDDED KEEPER] finalizeTender(#${tenderIdNum}) notice:`, e.message);
        } finally {
          inFlightTenders.delete(tenderIdNum);
        }
      }
    }

    keeperState.healthy = true;
  } catch (err) {
    keeperState.healthy = false;
    keeperState.errorCount++;
    keeperState.lastError = err.message;
  } finally {
    isPolling = false;
  }
}

export async function startEmbeddedKeeper({
  provider: prov,
  contractAddress,
  keeperPrivateKey,
  pollIntervalSeconds = 20
}) {
  if (!keeperPrivateKey) {
    console.warn('[EMBEDDED KEEPER] KEEPER_PRIVATE_KEY not set. Autonomous keeper loop disabled.');
    keeperState.healthy = true;
    keeperState.lastAction = 'Disabled: KEEPER_PRIVATE_KEY missing';
    return;
  }

  provider = prov;
  keeperWallet = new ethers.Wallet(keeperPrivateKey, provider);
  contract = new ethers.Contract(contractAddress, CONTRACT_ABI, keeperWallet);

  console.log(`[EMBEDDED KEEPER] Initializing keeper loop (Wallet: ${keeperWallet.address}, Interval: ${pollIntervalSeconds}s)...`);

  // Initial scan to populate active tenders
  try {
    const totalCount = await contract.tenderCounter();
    for (let id = 1n; id <= totalCount; id++) {
      try {
        const t = await contract.tenders(id);
        const status = Number(t.status);
        if (status === 0 || status === 2 || status === 4) {
          activeTenders.set(Number(id), {
            id: Number(id),
            status,
            openingTime: Number(t.openingTime),
            appealDeadline: Number(t.appealDeadline)
          });
        }
      } catch (e) {}
    }
    const currentBlock = await provider.getBlock('latest');
    if (currentBlock) lastIndexedBlockCursor = currentBlock.number;
    keeperState.activeTendersCount = activeTenders.size;
    keeperState.initialized = true;
    console.log(`[EMBEDDED KEEPER] Watching ${activeTenders.size} active tenders.`);
  } catch (err) {
    console.warn('[EMBEDDED KEEPER] Initial scan notice:', err.message);
  }

  // Interval timer (poll no faster than every 15-30s)
  const intervalMs = Math.max(15, Math.min(30, pollIntervalSeconds)) * 1000;
  setInterval(pollCycle, intervalMs);

  // Run immediate first pass
  pollCycle().catch(() => {});
}

export function getKeeperStatus() {
  return {
    ...keeperState,
    activeTenders: activeTenders.size
  };
}
