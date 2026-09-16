const { ethers } = require('ethers');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const RPC_URL = process.env.RPC_URL || 'http://127.0.0.1:8545';
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || '0x5FbDB2315678afecb367f032d93F642f64180aa3';
// Deployer / PSU Officer Account #0
const PSU_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
// Vendor Account #2
const VENDOR_ADDRESS = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC';

const CONTRACT_ABI = [
  'function createTender(string memory _ipfsHash, uint256 _submissionDeadline, uint256 _openingTime, uint256 _minEMD) external',
  'function awardTender(uint256 _tenderId, address _winner, uint256 _winningBidId, uint256 _winningBidAmount) external',
  'function tenders(uint256) external view returns (uint256 id, address psuAddress, string memory ipfsHashDoc, uint256 submissionDeadline, uint256 openingTime, uint256 appealDeadline, uint256 minEMDAmount, uint8 status, address winner, uint256 winningBidId, uint256 winningBidAmount)',
  'function tenderCounter() external view returns (uint256)'
];

const provider = new ethers.JsonRpcProvider(RPC_URL);
const psuWallet = new ethers.Wallet(PSU_PRIVATE_KEY, provider);
const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, psuWallet);

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  console.log('======================================================================');
  console.log(' STEP 1: PSU Officer Creates New Tender on Chain');
  console.log('======================================================================');

  const b1 = await provider.getBlock('latest');
  const submissionDeadline = b1.timestamp + 60;   // 1 minute
  const openingTime = b1.timestamp + 120;         // 2 minutes (in future)
  const minEMD = ethers.parseEther('0.05');

  console.log(`Current Block Timestamp: ${b1.timestamp}`);
  console.log(`Setting submissionDeadline: ${submissionDeadline}`);
  console.log(`Setting openingTime:        ${openingTime}`);

  const createTx = await contract.createTender(
    'QmNirvaanDemoTenderIPFSHashLiveViva2026',
    submissionDeadline,
    openingTime,
    minEMD
  );
  console.log(`createTender() tx submitted: ${createTx.hash}`);
  const createReceipt = await createTx.wait(1);
  console.log(`Tender created in block #${createReceipt.blockNumber}`);

  const tenderId = await contract.tenderCounter();
  console.log(`Assigned Tender ID: #${tenderId.toString()}`);

  let tender = await contract.tenders(tenderId);
  console.log(`Tender #${tenderId} Initial Status: ${tender.status} (0 = Created)`);

  console.log('\n======================================================================');
  console.log(' STEP 2: Fast-Forward Time Past openingTime (Simulating Viva Trigger)');
  console.log('======================================================================');
  const jump1 = (openingTime - b1.timestamp) + 15; // Past openingTime
  console.log(`Fast-forwarding clock by ${jump1} seconds...`);
  await provider.send('evm_increaseTime', [jump1]);
  await provider.send('evm_mine', []);

  const b2 = await provider.getBlock('latest');
  console.log(`New Block Timestamp: ${b2.timestamp} (openingTime was ${openingTime})`);
  console.log('Waiting 12 seconds for Keeper poll cycle to detect and trigger openBids()...');
  await sleep(12000);

  tender = await contract.tenders(tenderId);
  console.log(`Tender #${tenderId} Status after Keeper: ${tender.status} (Expected: 3 = UnderEvaluation)`);
  if (Number(tender.status) !== 3) {
    throw new Error(`Expected status 3 (UnderEvaluation), got ${tender.status}`);
  }

  console.log('\n======================================================================');
  console.log(' STEP 3: PSU Officer Awards Tender (Starting 7-Day Appeal Window)');
  console.log('======================================================================');
  const awardTx = await contract.awardTender(
    tenderId,
    VENDOR_ADDRESS,
    1,
    ethers.parseEther('25.5')
  );
  console.log(`awardTender() tx submitted: ${awardTx.hash}`);
  const awardReceipt = await awardTx.wait(1);
  console.log(`Tender awarded in block #${awardReceipt.blockNumber}`);

  tender = await contract.tenders(tenderId);
  console.log(`Tender #${tenderId} Status: ${tender.status} (4 = Awarded)`);
  console.log(`Tender #${tenderId} Appeal Deadline: ${tender.appealDeadline} (+7 days)`);

  console.log('\n======================================================================');
  console.log(' STEP 4: Fast-Forward Time Past 7-Day Appeal Window (604,800 seconds)');
  console.log('======================================================================');
  const sevenDays = 7 * 86400 + 60; // 7 days + 60s buffer
  console.log(`Fast-forwarding clock by ${sevenDays} seconds past appealDeadline...`);
  await provider.send('evm_increaseTime', [sevenDays]);
  await provider.send('evm_mine', []);

  const b3 = await provider.getBlock('latest');
  console.log(`New Block Timestamp: ${b3.timestamp} (appealDeadline was ${tender.appealDeadline})`);
  console.log('Waiting 12 seconds for Keeper poll cycle to detect and trigger finalizeTender()...');
  await sleep(12000);

  tender = await contract.tenders(tenderId);
  console.log(`Tender #${tenderId} Status after Keeper: ${tender.status} (Expected: 7 = Finalized)`);
  if (Number(tender.status) !== 7) {
    throw new Error(`Expected status 7 (Finalized), got ${tender.status}`);
  }

  console.log('\n======================================================================');
  console.log(' LIFECYCLE DEMONSTRATION COMPLETE - ALL INVARIANTS VERIFIED');
  console.log('======================================================================');
}

run().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
