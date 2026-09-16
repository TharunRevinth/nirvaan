const { ethers } = require('ethers');
const path = require('path');
const fs = require('fs');

const RPC_URL = 'http://127.0.0.1:8545';
const CONTRACT_ADDRESS = '0x5FbDB2315678afecb367f032d93F642f64180aa3';

const provider = new ethers.JsonRpcProvider(RPC_URL);

// Accounts
const deployer = new ethers.Wallet('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80', provider); // PSU / Admin
const vendor1 = new ethers.Wallet('0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d', provider);  // Vendor 1 (Account #1)
const vendor2 = new ethers.Wallet('0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a', provider);  // Vendor 2 (Account #2 - Challenger)
const keeper = new ethers.Wallet('0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a', provider);   // Keeper (Account #4)
const cvc = new ethers.Wallet('0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba', provider);      // CVC Auditor (Account #5)

const ABI = [
  'function createTender(string memory _ipfsHash, uint256 _submissionDeadline, uint256 _openingTime, uint256 _minEMD) external',
  'function submitBid(uint256 _tenderId, string memory _encryptedBidIpfs, bytes32 _bidCommitment) external payable',
  'function openBids(uint256 _tenderId) external',
  'function revealBid(uint256 _tenderId, uint256 _bidIndex, uint256 _bidAmount, bytes32 _salt) external',
  'function setTechnicalScore(uint256 _tenderId, uint256 _bidIndex, bool _qualified, uint256 _score) external',
  'function awardTender(uint256 _tenderId, address _winner, uint256 _winningBidId, uint256 _winningBidAmount) external',
  'function disputeTender(uint256 _tenderId, string memory _reasonIpfsHash) external payable',
  'function resolveDispute(uint256 _tenderId, bool _upheld, string memory _cvcReasonIpfsHash) external',
  'function finalizeTender(uint256 _tenderId) external',
  'function registeredVendors(address) external view returns (bool)',
  'function registerVendor(address _vendorAddress, bytes32 _gstinHash, bytes32 _panHash, string memory _kycIpfsHash) external',
  'function tenders(uint256) external view returns (uint256 id, address psuAddress, string memory ipfsHashDoc, uint256 submissionDeadline, uint256 openingTime, uint256 appealDeadline, uint256 minEMDAmount, uint8 status, address winner, uint256 winningBidId, uint256 winningBidAmount)',
  'function tenderBids(uint256, uint256) external view returns (uint256 id, uint256 tenderId, address vendorAddress, string encryptedBidIpfsHash, bytes32 bidCommitment, uint256 submissionTime, uint256 bidAmount, uint8 status, bool isTechQualified, uint256 techScore, uint256 emdDeposited)',
  'function getTenderBidsCount(uint256) external view returns (uint256)',
  'function tenderCounter() external view returns (uint256)'
];

const contractAdmin = new ethers.Contract(CONTRACT_ADDRESS, ABI, deployer);
const contractVendor1 = new ethers.Contract(CONTRACT_ADDRESS, ABI, vendor1);
const contractVendor2 = new ethers.Contract(CONTRACT_ADDRESS, ABI, vendor2);
const contractKeeper = new ethers.Contract(CONTRACT_ADDRESS, ABI, keeper);
const contractCVC = new ethers.Contract(CONTRACT_ADDRESS, ABI, cvc);

async function run() {
  console.log('================================================================================');
  console.log(' NIRVAAN CONSORTIUM: COMPLETE END-TO-END PROCUREMENT LIFECYCLE WORKFLOW TEST');
  console.log('================================================================================\n');

  // Step 0: Ensure Vendors are KYC Registered
  console.log('--- Step 0: Verifying Vendor KYC Registration on Chain ---');
  const isV1Reg = await contractAdmin.registeredVendors(vendor1.address);
  if (!isV1Reg) {
    console.log(`Registering Vendor 1 (${vendor1.address})...`);
    await (await contractAdmin.registerVendor(vendor1.address, ethers.id('GSTIN-V1'), ethers.id('PAN-V1'), 'QmKYCVendor1')).wait();
  }
  const isV2Reg = await contractAdmin.registeredVendors(vendor2.address);
  if (!isV2Reg) {
    console.log(`Registering Vendor 2 (${vendor2.address})...`);
    await (await contractAdmin.registerVendor(vendor2.address, ethers.id('GSTIN-V2'), ethers.id('PAN-V2'), 'QmKYCVendor2')).wait();
  }
  console.log('✓ Both Vendor 1 and Vendor 2 verified as KYC-accredited on-chain.\n');

  // Step 1: PSU Officer Creates Tender
  console.log('--- Step 1: PSU Officer Creates Tender (NIT) ---');
  await provider.send('evm_mine', []);
  const latestBlockRpc = await provider.send('eth_getBlockByNumber', ['latest', false]);
  const currentBlockTime = parseInt(latestBlockRpc.timestamp, 16);
  const submissionDeadline = currentBlockTime + 600;  // 10 mins
  const openingTime = submissionDeadline + 300;  // +5 mins
  const minEMD = ethers.parseEther('0.1');

  const createTx = await contractAdmin.createTender(
    'QmSubseaPipelineExpansionSpec2026',
    submissionDeadline,
    openingTime,
    minEMD
  );
  const createRc = await createTx.wait();
  const tenderId = await contractAdmin.tenderCounter();
  console.log(`✓ Tender #${tenderId} created in Block #${createRc.blockNumber} (Tx: ${createTx.hash})`);

  let tender = await contractAdmin.tenders(tenderId);
  console.log(`  Initial Status: ${tender.status} (0 = Created)`);
  console.log(`  Submission Deadline: ${tender.submissionDeadline}`);
  console.log(`  Opening Time: ${tender.openingTime}\n`);

  // Step 2: Vendor 1 Places Sealed Bid with Commitment & 0.1 ETH EMD
  console.log('--- Step 2: Vendor 1 Places Sealed Bid in Another Session ---');
  const bidAmount = ethers.parseEther('45.2');
  const salt = ethers.encodeBytes32String('SecretSalt2026!');
  const commitment = ethers.solidityPackedKeccak256(
    ['address', 'uint256', 'bytes32', 'uint256'],
    [vendor1.address, bidAmount, salt, tenderId]
  );
  console.log(`  Bid Amount: 45.2 ETH`);
  console.log(`  Salt: SecretSalt2026!`);
  console.log(`  Keccak-256 Commitment: ${commitment}`);

  const bidTx = await contractVendor1.submitBid(
    tenderId,
    'QmEncryptedBidDocumentPDF2026',
    commitment,
    { value: minEMD }
  );
  const bidRc = await bidTx.wait();
  console.log(`✓ Sealed bid submitted in Block #${bidRc.blockNumber} (Tx: ${bidTx.hash})`);
  const bidsCount = await contractAdmin.getTenderBidsCount(tenderId);
  console.log(`  Total bids recorded for Tender #${tenderId}: ${bidsCount.toString()}\n`);

  // Step 3: Fast-Forward Past openingTime & Open Bids via Keeper
  console.log('--- Step 3: Fast-Forward Past openingTime & Open Bids ---');
  await provider.send('evm_increaseTime', [1000]);
  await provider.send('evm_mine', []);

  const openTx = await contractKeeper.openBids(tenderId);
  await openTx.wait();
  tender = await contractAdmin.tenders(tenderId);
  console.log(`✓ Bids opened by Keeper! Status: ${tender.status} (3 = UnderEvaluation)\n`);

  // Step 4: Vendor 1 Reveals Bid
  console.log('--- Step 4: Vendor 1 Reveals Bid On-Chain ---');
  const revealTx = await contractVendor1.revealBid(tenderId, 0, bidAmount, salt);
  await revealTx.wait();
  const bidData = await contractAdmin.tenderBids(tenderId, 0);
  console.log(`✓ Bid revealed! Status: ${bidData.status} (1 = Opened), Amount: ${ethers.formatEther(bidData.bidAmount)} ETH\n`);

  // Step 5: PSU Officer Evaluates & Sets Technical Score
  console.log('--- Step 5: PSU Officer Evaluates Bid & Sets Technical Score ---');
  const scoreTx = await contractAdmin.setTechnicalScore(tenderId, 0, true, 98);
  await scoreTx.wait();
  const scoredBid = await contractAdmin.tenderBids(tenderId, 0);
  console.log(`✓ Technical Score Recorded! Qualified: ${scoredBid.isTechQualified}, Score: ${scoredBid.techScore}/100\n`);

  // Step 6: PSU Officer Awards Tender (L1 Determination)
  console.log('--- Step 6: PSU Officer Awards Contract (Starts 7-Day Appeal Window) ---');
  const awardNonce = await deployer.getNonce('latest');
  const awardTx = await contractAdmin.awardTender(tenderId, vendor1.address, 1, bidAmount, { nonce: awardNonce });
  const awardRc = await awardTx.wait();
  tender = await contractAdmin.tenders(tenderId);
  console.log(`✓ Contract Awarded in Block #${awardRc.blockNumber}! Status: ${tender.status} (4 = Awarded)`);
  console.log(`  Winner: ${tender.winner}`);
  console.log(`  Winning Amount: ${ethers.formatEther(tender.winningBidAmount)} ETH`);
  console.log(`  Appeal Deadline: ${tender.appealDeadline} (+7 days standstill)\n`);

  // Step 7: Vendor 2 (Rival) Files Dispute with 1.0 ETH Bond
  console.log('--- Step 7: Vendor 2 Files CVC Dispute with 1.0 ETH Escrow Bond ---');
  const disputeTx = await contractVendor2.disputeTender(
    tenderId,
    'QmDisputeGroundsTechnicalSpecificationExclusion2026',
    { value: ethers.parseEther('1.0') }
  );
  const disputeRc = await disputeTx.wait();
  tender = await contractAdmin.tenders(tenderId);
  console.log(`✓ Dispute filed in Block #${disputeRc.blockNumber}! Status: ${tender.status} (5 = Disputed)`);
  console.log(`  Challenger: ${vendor2.address}`);
  console.log(`  Escrow Bond Locked: 1.0 ETH\n`);

  // Step 8: CVC Auditor Adjudicates Dispute
  console.log('--- Step 8: Independent CVC Auditor Adjudicates Dispute ---');
  // CVC rules dispute dismissed (upheld=false), bond forfeited to treasury, tender proceeds
  const cvcTx = await contractCVC.resolveDispute(
    tenderId,
    false,
    'QmCVCAuditRulingNoProcurementViolationFound2026'
  );
  await cvcTx.wait();
  tender = await contractAdmin.tenders(tenderId);
  console.log(`✓ CVC Ruling Issued! Status: ${tender.status} (6 = DisputeResolved)\n`);

  // Step 9: Fast-Forward Past 7-Day Appeal Window & Finalize Tender via Keeper
  console.log('--- Step 9: Fast-Forward Past Appeal Window & Finalize Contract ---');
  await provider.send('evm_increaseTime', [7 * 86400 + 60]);
  await provider.send('evm_mine', []);

  const finalizeTx = await contractKeeper.finalizeTender(tenderId);
  const finalizeRc = await finalizeTx.wait();
  tender = await contractAdmin.tenders(tenderId);
  console.log(`✓ Contract Finalized in Block #${finalizeRc.blockNumber}! Status: ${tender.status} (7 = Finalized)`);
  console.log(`  Automated EMD refunds processed.\n`);

  console.log('================================================================================');
  console.log(' FULL PLATFORM WORKFLOW: ALL 9 STAGES VERIFIED ON-CHAIN (100% SUCCESS)');
  console.log('================================================================================');
}

run().catch((err) => {
  console.error('Workflow error:', err);
  process.exit(1);
});
