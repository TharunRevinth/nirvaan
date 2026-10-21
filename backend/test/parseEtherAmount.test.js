import test from 'node:test';
import assert from 'node:assert/strict';
import { ethers } from 'ethers';
import { parseEtherAmount } from '../server.js';

test('parseEtherAmount - parses valid ETH decimal string "0.001"', () => {
  const result = parseEtherAmount('0.001', 'EMD');
  assert.equal(result, ethers.parseEther('0.001'));
  assert.equal(result, 1000000000000000n);
});

test('parseEtherAmount - parses valid Bid amount with custom fieldName', () => {
  const result = parseEtherAmount('0.05', 'Bid');
  assert.equal(result, ethers.parseEther('0.05'));
});

test('parseEtherAmount - rejects out-of-range "500000" exceeding MAX_EMD_ETH', () => {
  assert.throws(
    () => parseEtherAmount('500000', 'EMD'),
    /EMD must be between 0\.0001 and 1 ETH on this network/
  );

  assert.throws(
    () => parseEtherAmount('500000', 'Bid'),
    /Bid must be between 0\.0001 and 1 ETH on this network/
  );
});

test('parseEtherAmount - rejects empty string ""', () => {
  assert.throws(
    () => parseEtherAmount('', 'EMD'),
    /EMD amount is required/
  );

  assert.throws(
    () => parseEtherAmount('   ', 'Bid'),
    /Bid amount is required/
  );
});

test('parseEtherAmount - rejects non-numeric invalid decimal "abc"', () => {
  assert.throws(
    () => parseEtherAmount('abc', 'EMD'),
    /Invalid EMD amount: 'abc'/
  );

  assert.throws(
    () => parseEtherAmount('abc', 'Bid'),
    /Invalid Bid amount: 'abc'/
  );
});

test('parseEtherAmount - respects configurable MAX_EMD_ETH environment variable', () => {
  const originalMax = process.env.MAX_EMD_ETH;
  try {
    process.env.MAX_EMD_ETH = '5';
    const result = parseEtherAmount('2.5', 'EMD');
    assert.equal(result, ethers.parseEther('2.5'));

    assert.throws(
      () => parseEtherAmount('6.0', 'EMD'),
      /EMD must be between 0\.0001 and 5 ETH on this network/
    );
  } finally {
    if (originalMax !== undefined) {
      process.env.MAX_EMD_ETH = originalMax;
    } else {
      delete process.env.MAX_EMD_ETH;
    }
  }
});
