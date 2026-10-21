import test from 'node:test';
import assert from 'node:assert/strict';
import { ethers } from 'ethers';
import db from '../db.js';
import { EventIndexer } from '../indexer.js';

test('vendor_applications table - schema exists and accepts application rows', () => {
  const testAddress = ethers.getAddress('0x70997970C51812dc3A010C7d01b50e0d17dc79C8');
  const appId = `APP-TEST-${Date.now()}`;
  const nowIso = new Date().toISOString();

  db.prepare('DELETE FROM vendor_applications WHERE LOWER(wallet_address) = LOWER(?)').run(testAddress);

  db.prepare(`
    INSERT INTO vendor_applications (
      id, wallet_address, company_name, gstin, pan, kyc_cid, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?, ?)
  `).run(
    appId,
    testAddress,
    'Test Vendor Logistics Pvt Ltd',
    '27AAACR12341Z5',
    'AAACR1234F',
    'QmTestKYCDocCID12345',
    nowIso,
    nowIso
  );

  const row = db.prepare('SELECT * FROM vendor_applications WHERE id = ?').get(appId);
  assert.ok(row);
  assert.equal(row.wallet_address, testAddress);
  assert.equal(row.status, 'PENDING');
  assert.equal(row.company_name, 'Test Vendor Logistics Pvt Ltd');
});

test('vendor_applications - blocks duplicate insert for same wallet address via unique constraint', () => {
  const testAddress = ethers.getAddress('0x70997970C51812dc3A010C7d01b50e0d17dc79C8');
  const nowIso = new Date().toISOString();

  assert.throws(() => {
    db.prepare(`
      INSERT INTO vendor_applications (
        id, wallet_address, company_name, gstin, pan, kyc_cid, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?, ?)
    `).run(
      `APP-DUP-${Date.now()}`,
      testAddress,
      'Duplicate Corp',
      '27AAACR12341Z5',
      'AAACR1234F',
      'QmCID',
      nowIso,
      nowIso
    );
  });
});

test('vendor_applications - approval workflow updates status to APPROVED with txHash', () => {
  const testAddress = ethers.getAddress('0x70997970C51812dc3A010C7d01b50e0d17dc79C8');
  const mockTxHash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
  const nowIso = new Date().toISOString();

  db.prepare(`
    UPDATE vendor_applications SET
      status = 'APPROVED',
      tx_hash = ?,
      updated_at = ?
    WHERE LOWER(wallet_address) = LOWER(?)
  `).run(mockTxHash, nowIso, testAddress);

  const row = db.prepare('SELECT * FROM vendor_applications WHERE LOWER(wallet_address) = LOWER(?)').get(testAddress);
  assert.equal(row.status, 'APPROVED');
  assert.equal(row.tx_hash, mockTxHash);
});

test('vendor_applications - rejection workflow updates status to REJECTED with reason', () => {
  const rejectAddress = ethers.getAddress('0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC');
  const appId = `APP-REJ-${Date.now()}`;
  const nowIso = new Date().toISOString();

  db.prepare('DELETE FROM vendor_applications WHERE LOWER(wallet_address) = LOWER(?)').run(rejectAddress);

  db.prepare(`
    INSERT INTO vendor_applications (
      id, wallet_address, company_name, gstin, pan, kyc_cid, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?, ?)
  `).run(
    appId,
    rejectAddress,
    'Non-compliant Corp',
    '27AAACR99991Z1',
    'AAACR9999F',
    null,
    nowIso,
    nowIso
  );

  const reason = 'Invalid GSTIN or unverified incorporation certificate.';
  db.prepare(`
    UPDATE vendor_applications SET
      status = 'REJECTED',
      rejection_reason = ?,
      updated_at = ?
    WHERE id = ?
  `).run(reason, new Date().toISOString(), appId);

  const row = db.prepare('SELECT * FROM vendor_applications WHERE id = ?').get(appId);
  assert.equal(row.status, 'REJECTED');
  assert.equal(row.rejection_reason, reason);
});

test('EventIndexer - indexVendorRegisteredFromChain rebuilds approved vendor into SQLite', async () => {
  const chainAddress = ethers.getAddress('0x90F79bf6EB2c4f870365E785982E1f101E93b906');
  db.prepare('DELETE FROM vendor_applications WHERE LOWER(wallet_address) = LOWER(?)').run(chainAddress);

  const dummyProvider = { getBlockNumber: async () => 100 };
  const indexer = new EventIndexer(dummyProvider, '0x0000000000000000000000000000000000000001');

  // Mock contract to return mock KYC info
  indexer.contract.vendorKYC = async () => ({
    kycIpfsHash: 'QmRebuiltOnBootCID',
    registeredAt: 1700000000n
  });

  await indexer.indexVendorRegisteredFromChain(chainAddress, '0xmockchainregtxhash', 10);

  const row = db.prepare('SELECT * FROM vendor_applications WHERE LOWER(wallet_address) = LOWER(?)').get(chainAddress);
  assert.ok(row, 'Vendor must be restored in SQLite on chain event index');
  assert.equal(row.status, 'APPROVED');
  assert.equal(row.tx_hash, '0xmockchainregtxhash');
  assert.equal(row.kyc_cid, 'QmRebuiltOnBootCID');
});

test('Format Validation Rules - GSTIN and PAN regex parsing', () => {
  const gstinRegex = /^[0-9]{2}[A-Z]{4,5}[0-9]{4}[A-Z0-9]{1}[1-9A-Z]{1}[A-Z0-9]{1}[0-9A-Z]{1}$/i;
  const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/i;

  // Valid formats
  assert.equal(gstinRegex.test('27AABCU9603R1ZM'), true);
  assert.equal(gstinRegex.test('27AAACR1234F1Z5'), true);
  assert.equal(gstinRegex.test('07AAAAA0000A1Z5'), true);
  assert.equal(panRegex.test('AAACR1234F'), true);
  assert.equal(panRegex.test('ABCDE1234F'), true);

  // Invalid formats
  assert.equal(gstinRegex.test('invalid_gstin'), false);
  assert.equal(gstinRegex.test('27AAACR1234'), false);
  assert.equal(panRegex.test('12345ABCDE'), false);
  assert.equal(panRegex.test('ABCDE12345'), false);
});
