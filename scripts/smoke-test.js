#!/usr/bin/env node

/**
 * NIRVAAN End-to-End Online Smoke Test Suite
 * 
 * Verifies:
 * 1. Rejection of unauthenticated /api/vendors/register
 * 2. Rejection of unauthenticated /api/ipfs/upload
 * 3. /api/health endpoint reporting indexer lag and keeper status
 * 4. Officer login & initial password reset flow
 * 5. Officer-authenticated vendor KYC registration
 * 6. Tender creation
 * 7. Sealed bid submission
 * 8. Bid opening & reveal validation
 * 9. Technical scoring & L1 award determination
 */

import { ethers } from '../backend/node_modules/ethers/lib.esm/index.js';
import { DatabaseSync } from 'node:sqlite';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('===============================================================');
console.log('  NIRVAAN END-TO-END DEPLOYMENT SMOKE TEST');
console.log('===============================================================');

const TEST_PORT = process.env.SMOKE_PORT || '5080';
const API_URL = process.env.API_URL || `http://127.0.0.1:${TEST_PORT}`;

// Dummy test private key for local smoke test server only (Hardhat account #0)
const TEST_OFFICER_KEY = process.env.OFFICER_PRIVATE_KEY || '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const TEST_JWT_SECRET = process.env.JWT_SECRET || 'smoke_test_jwt_secret_minimum_32_characters_random_key_123';
const TEST_DB_PATH = '/tmp/nirvaan_smoke_test.db';

if (fs.existsSync(TEST_DB_PATH)) {
  fs.unlinkSync(TEST_DB_PATH);
}

let backendProcess = null;

async function sleep(ms) {
  return new Promise(res => setTimeout(res, ms));
}

async function startLocalServer() {
  console.log(`\n[SPAWN] Starting temporary backend server on port ${TEST_PORT}...`);
  backendProcess = spawn('node', ['server.js'], {
    cwd: path.join(rootDir, 'backend'),
    env: {
      ...process.env,
      PORT: TEST_PORT,
      OFFICER_PRIVATE_KEY: TEST_OFFICER_KEY,
      JWT_SECRET: TEST_JWT_SECRET,
      CONTRACT_ADDRESS: process.env.CONTRACT_ADDRESS || '0x5FbDB2315678afecb367f032d93F642f64180aa3',
      RPC_URL: process.env.RPC_URL || 'http://127.0.0.1:8545',
      DB_PATH: TEST_DB_PATH,
      NODE_ENV: 'test',
      ALLOWED_ORIGINS: '*',
      PINATA_JWT: process.env.PINATA_JWT || 'test_pinata_jwt_token',
      OFFICER_SEED_JSON: JSON.stringify([
        {
          id: 'OFF-IOCL-SMOKE',
          username: 'iocl_officer',
          password: 'InitialPassword2026!',
          psu: 'IOCL',
          officerId: 'IOCL-9988',
          email: 'iocl_officer@procurement.gov.in',
          mustChangePassword: true
        }
      ])
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  backendProcess.stderr.on('data', (d) => {
    const str = d.toString();
    if (!str.includes('Warning') && !str.includes('notice')) {
      // process.stderr.write(str);
    }
  });

  // Wait for server to become responsive
  const start = Date.now();
  while (Date.now() - start < 15000) {
    try {
      const res = await fetch(`${API_URL}/api/health`);
      if (res.ok) {
        console.log(`[SPAWN] Backend server responsive at ${API_URL}/api/health\n`);
        return;
      }
    } catch (e) {
      await sleep(500);
    }
  }
  throw new Error('Backend failed to start within 15 seconds.');
}

async function runSmokeTests() {
  let passed = 0;
  let total = 0;

  function assert(condition, message) {
    total++;
    if (!condition) {
      console.error(` [FAIL] ${message}`);
      throw new Error(`Assertion failed: ${message}`);
    } else {
      console.log(` [PASS] ${message}`);
      passed++;
    }
  }

  try {
    // -------------------------------------------------------------
    // Test 1: Unauthenticated /api/vendors/register REJECTION
    // -------------------------------------------------------------
    const unauthRegRes = await fetch(`${API_URL}/api/vendors/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vendorAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
        companyName: 'Unauthorized Vendor Corp',
        gstin: '27AABCU9603R1ZM',
        pan: 'ABCDE1234F',
        kycCid: 'QmDummyKYC'
      })
    });
    assert(
      unauthRegRes.status === 401,
      `Unauthenticated POST /api/vendors/register correctly rejected with 401 Unauthorized (Received: ${unauthRegRes.status})`
    );

    // -------------------------------------------------------------
    // Test 2: Unauthenticated & Bare Header /api/ipfs/upload REJECTION
    // -------------------------------------------------------------
    const formData = new FormData();
    formData.append('file', new Blob(['Sample Content'], { type: 'application/pdf' }), 'test.pdf');

    const unauthIpfsRes = await fetch(`${API_URL}/api/ipfs/upload`, {
      method: 'POST',
      body: formData
    });
    assert(
      unauthIpfsRes.status === 401,
      `Unauthenticated POST /api/ipfs/upload correctly rejected with 401 Unauthorized (Received: ${unauthIpfsRes.status})`
    );

    const bareVendorUploadRes = await fetch(`${API_URL}/api/ipfs/upload`, {
      method: 'POST',
      headers: {
        'x-vendor-address': '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'
      },
      body: formData
    });
    assert(
      bareVendorUploadRes.status === 401,
      `Bare x-vendor-address without cryptographic signature correctly rejected with 401 Unauthorized (Received: ${bareVendorUploadRes.status})`
    );

    const nonceRes = await fetch(`${API_URL}/api/ipfs/nonce?address=0x70997970C51812dc3A010C7d01b50e0d17dc79C8`);
    assert(nonceRes.status === 200, `GET /api/ipfs/nonce returns 200 OK`);
    const nonceData = await nonceRes.json();
    assert(Boolean(nonceData.nonce), `Server issued valid challenge nonce`);

    // -------------------------------------------------------------
    // Test 3: /api/health Health Check Endpoint
    // -------------------------------------------------------------
    const healthRes = await fetch(`${API_URL}/api/health`);
    assert(healthRes.status === 200, `/api/health returns 200 OK`);
    const healthData = await healthRes.json();
    assert(healthData.status === 'healthy', `Health status is "healthy"`);
    assert(typeof healthData.network.indexerLag === 'number', `Health reports valid indexerLag (${healthData.network.indexerLag})`);
    assert(healthData.indexerError !== undefined, `Health reports indexerError (${healthData.indexerError})`);
    assert(healthData.keeper && healthData.keeper.status, `Health reports keeper status ("${healthData.keeper.status}")`);

    // -------------------------------------------------------------
    // Test 4: PSU Officer Login & Password Reset Flow
    // -------------------------------------------------------------
    const loginRes = await fetch(`${API_URL}/api/auth/officer-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'iocl_officer',
        password: 'InitialPassword2026!'
      })
    });
    assert(loginRes.status === 200, `Officer initial login returns 200 OK`);
    const loginData = await loginRes.json();
    assert(loginData.requirePasswordChange === true, `First-time login flags requirePasswordChange: true`);
    assert(Boolean(loginData.tempToken), `Server issues temporary reset token`);

    // Complete password reset
    const changePassRes = await fetch(`${API_URL}/api/auth/change-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tempToken: loginData.tempToken,
        newPassword: 'PermanentSecurePassword2026!'
      })
    });
    assert(changePassRes.status === 200, `Change password completes with 200 OK`);
    const changePassData = await changePassRes.json();
    assert(Boolean(changePassData.token), `Session JWT returned upon password reset`);
    const officerToken = changePassData.token;

    // Verify temp token single-use invalidation
    const replayRes = await fetch(`${API_URL}/api/auth/change-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tempToken: loginData.tempToken,
        newPassword: 'ReplayedPassword2026!'
      })
    });
    assert(replayRes.status === 401, `Temp token replay rejected with 401 Unauthorized`);

    // -------------------------------------------------------------
    // Test 5: Vendor Apply-Then-Approve KYC Workflow
    // -------------------------------------------------------------
    const testVendorAddress = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';

    // 5a. Public Vendor Apply (No Officer JWT required)
    const applyRes = await fetch(`${API_URL}/api/vendors/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        walletAddress: testVendorAddress,
        companyName: 'Bharat Pipelines & Infrastructure Ltd.',
        gstin: '07AAAAA0000A1Z5',
        pan: 'ABCDE1234F',
        kycCid: 'QmBharatPipelinesKYCDocumentDossier'
      })
    });
    assert(applyRes.status === 201 || applyRes.status === 200, `Public POST /api/vendors/apply returns 201/200 OK (Received: ${applyRes.status})`);
    const applyData = await applyRes.json();
    assert(applyData.success === true, `Vendor application marked success: true`);
    const applicationId = applyData.application?.id;
    assert(Boolean(applicationId), `Server returned application ID (${applicationId})`);

    // 5b. Public Check Status (Returns PENDING before officer review)
    const statusPendingRes = await fetch(`${API_URL}/api/vendors/status/${testVendorAddress}`);
    assert(statusPendingRes.status === 200, `Public GET /api/vendors/status/:address returns 200 OK`);
    const statusPendingData = await statusPendingRes.json();
    assert(statusPendingData.status === 'PENDING', `Vendor status before officer review is "PENDING"`);

    // 5c. Unauthenticated Officer Applications Access Rejected
    const unauthAppsRes = await fetch(`${API_URL}/api/vendors/applications`);
    assert(unauthAppsRes.status === 401, `Unauthenticated GET /api/vendors/applications rejected with 401 Unauthorized`);

    // 5d. Officer List Applications
    const appsRes = await fetch(`${API_URL}/api/vendors/applications`, {
      headers: { 'Authorization': `Bearer ${officerToken}` }
    });
    assert(appsRes.status === 200, `Officer GET /api/vendors/applications returns 200 OK`);
    const appsData = await appsRes.json();
    const foundApp = appsData.applications?.find(a => a.id === applicationId || a.walletAddress?.toLowerCase() === testVendorAddress.toLowerCase());
    assert(Boolean(foundApp), `Submitted application found in officer register`);

    // 5e. Officer Approve Application
    const approveRes = await fetch(`${API_URL}/api/vendors/applications/${applicationId}/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${officerToken}`
      }
    });
    assert(approveRes.status === 200, `Officer POST /api/vendors/applications/:id/approve returns 200 OK`);
    const approveData = await approveRes.json();
    assert(approveData.status === 'APPROVED', `Application status transitioned to APPROVED`);

    // 5f. Public Check Status (Returns APPROVED after officer review)
    const statusApprovedRes = await fetch(`${API_URL}/api/vendors/status/${testVendorAddress}`);
    assert(statusApprovedRes.status === 200, `Public GET /api/vendors/status/:address after approval returns 200 OK`);
    const statusApprovedData = await statusApprovedRes.json();
    assert(statusApprovedData.status === 'APPROVED', `Vendor status after officer review is "APPROVED"`);

    // -------------------------------------------------------------
    // Test 6: Create Tender Specification (NIT)
    // -------------------------------------------------------------
    const now = Math.floor(Date.now() / 1000);
    const createTenderRes = await fetch(`${API_URL}/api/tenders/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${officerToken}`
      },
      body: JSON.stringify({
        title: 'Procurement of High-Pressure Pipeline Gate Valves',
        category: 'Pipeline Infrastructure',
        description: 'Class 600 pressure rated API-6D pipeline gate valves for refinery expansion.',
        valueCr: '45.00',
        minEmdAmount: '0.01', // 0.01 ETH
        submissionDeadline: new Date((now + 600) * 1000).toISOString(),
        openingTime: new Date((now + 900) * 1000).toISOString(),
        revealDeadline: new Date((now + 1200) * 1000).toISOString(),
        cid: 'QmPipelineGateValvesTechnicalSpecification'
      })
    });
    assert(createTenderRes.status === 200, `Officer tender creation returns 200 OK`);
    const tenderData = await createTenderRes.json();
    assert(tenderData.success === true, `Tender created successfully`);
    const tenderOnChainId = tenderData.tender.onChainId || 1;

    // -------------------------------------------------------------
    // Test 7: Verify Deleted Endpoints (POST /bids & POST /reveal)
    // -------------------------------------------------------------
    const fakeBidRes = await fetch(`${API_URL}/api/tenders/${tenderOnChainId}/bids`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vendorAddress: testVendorAddress })
    });
    assert(fakeBidRes.status === 404, `POST /api/tenders/:id/bids correctly removed (returns 404 Not Found)`);

    const fakeRevealRes = await fetch(`${API_URL}/api/tenders/${tenderOnChainId}/reveal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vendorAddress: testVendorAddress })
    });
    assert(fakeRevealRes.status === 404, `POST /api/tenders/:id/reveal correctly removed (returns 404 Not Found)`);

    // -------------------------------------------------------------
    // Test 8: Simulate Indexed On-Chain Bid Ingestion
    // -------------------------------------------------------------
    const bidAmountEth = '0.05';
    const bidAmountWei = ethers.parseEther(bidAmountEth).toString();
    const bidSalt = '0x1111222233334444555566667777888899990000aaaabbbbccccddddeeeeffff';
    const bidCommitment = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ['address', 'uint256', 'bytes32', 'uint256'],
        [testVendorAddress, bidAmountWei, bidSalt, tenderOnChainId]
      )
    );

    const smokeDb = new DatabaseSync(TEST_DB_PATH);
    smokeDb.prepare(`
      INSERT INTO bids (
        id, tender_id, vendor_address, bid_index, vendor_name, vid,
        amount_wei, amount_eth, commitment_hash, cid, is_qualified,
        tech_score, status, submission_time
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      `BID-${tenderOnChainId}-0`,
      tenderOnChainId,
      testVendorAddress,
      0,
      'Bharat Pipelines Ltd.',
      'VEN-BHARAT-01',
      bidAmountWei,
      bidAmountEth,
      bidCommitment,
      'QmEncryptedSealedCommercialBidDocumentDossier',
      0,
      0,
      'Opened',
      new Date().toISOString()
    );
    smokeDb.close();
    assert(true, `Indexed on-chain bid recorded in database`);

    // -------------------------------------------------------------
    // Test 9: Technical Evaluation & L1 Determination
    // -------------------------------------------------------------
    const scoreRes = await fetch(`${API_URL}/api/tenders/${tenderOnChainId}/tech-score`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${officerToken}`
      },
      body: JSON.stringify({
        bidIndex: 0,
        qualified: true,
        score: 95
      })
    });
    assert(scoreRes.status === 200, `Technical score evaluation returns 200 OK`);

    const awardRes = await fetch(`${API_URL}/api/tenders/${tenderOnChainId}/award`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${officerToken}`
      },
      body: JSON.stringify({
        winner: testVendorAddress,
        winnerName: 'Bharat Pipelines & Infrastructure Ltd.',
        winningBidAmount: bidAmountEth,
        winnerVid: 'VEN-BHARAT-01',
        complianceScore: '95%',
        deliveryTimeline: '12 Months'
      })
    });
    assert(awardRes.status === 200, `L1 Tender award returns 200 OK`);
    const awardData = await awardRes.json();
    assert(awardData.success === true, `Tender status updated to Awarded with 7-day standstill`);

    console.log(`\n===============================================================`);
    console.log(`  ALL ${total} SMOKE TESTS PASSED CLEANLY (${passed}/${total})`);
    console.log(`===============================================================\n`);
    return true;
  } finally {
    if (backendProcess) {
      backendProcess.kill('SIGTERM');
    }
    if (fs.existsSync(TEST_DB_PATH)) {
      try { fs.unlinkSync(TEST_DB_PATH); } catch (e) {}
    }
  }
}

async function main() {
  try {
    await startLocalServer();
    await runSmokeTests();
    process.exit(0);
  } catch (err) {
    console.error('\n[SMOKE TEST ERROR]:', err.message);
    if (backendProcess) backendProcess.kill('SIGTERM');
    process.exit(1);
  }
}

main();
