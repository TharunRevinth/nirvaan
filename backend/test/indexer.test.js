import test from 'node:test';
import assert from 'node:assert/strict';
import { EventIndexer, parseRangeTooLargeError, getFullErrorMessage } from '../indexer.js';

test('parseRangeTooLargeError - recognizes Alchemy 10-block limit format', () => {
  const err = new Error('eth_getLogs is limited to a 10 block range');
  const result = parseRangeTooLargeError(err);
  assert.ok(result);
  assert.equal(result.isRangeTooLarge, true);
  assert.equal(result.suggestedBatchSize, 10);
});

test('parseRangeTooLargeError - parses Alchemy suggested hex block range', () => {
  const err = {
    message: 'query returned more than 10000 results. Try with this block range [0x10, 0x19]'
  };
  const result = parseRangeTooLargeError(err);
  assert.ok(result);
  assert.equal(result.isRangeTooLarge, true);
  // 0x19 (25) - 0x10 (16) + 1 = 10
  assert.equal(result.suggestedBatchSize, 10);
});

test('parseRangeTooLargeError - parses decimal block range [100, 109]', () => {
  const err = new Error('range too large. Try with this block range [100, 109]');
  const result = parseRangeTooLargeError(err);
  assert.ok(result);
  assert.equal(result.isRangeTooLarge, true);
  assert.equal(result.suggestedBatchSize, 10);
});

test('parseRangeTooLargeError - parses explicit maximum allowed block range', () => {
  const err = new Error('block range is too wide: 500. Maximum allowed: 10');
  const result = parseRangeTooLargeError(err);
  assert.ok(result);
  assert.equal(result.isRangeTooLarge, true);
  assert.equal(result.suggestedBatchSize, 10);
});

test('parseRangeTooLargeError - parses query exceeds max block range', () => {
  const err = new Error('query exceeds max block range 10');
  const result = parseRangeTooLargeError(err);
  assert.ok(result);
  assert.equal(result.isRangeTooLarge, true);
  assert.equal(result.suggestedBatchSize, 10);
});

test('parseRangeTooLargeError - parses response size exceeded without explicit number (suggestedBatchSize is null)', () => {
  const err = new Error('Log response size exceeded. You can make this request with smaller block range.');
  const result = parseRangeTooLargeError(err);
  assert.ok(result);
  assert.equal(result.isRangeTooLarge, true);
  assert.equal(result.suggestedBatchSize, null);
});

test('parseRangeTooLargeError - returns null for non-range errors', () => {
  const err = new Error('execution reverted: ERC20: transfer amount exceeds balance');
  const result = parseRangeTooLargeError(err);
  assert.equal(result, null);
});

test('EventIndexer - defaults INDEXER_BATCH_SIZE to 10', () => {
  const prevEnv = process.env.INDEXER_BATCH_SIZE;
  delete process.env.INDEXER_BATCH_SIZE;
  const dummyProvider = { getBlockNumber: async () => 100 };
  const indexer = new EventIndexer(dummyProvider, '0x0000000000000000000000000000000000000001');
  assert.equal(indexer.batchSize, 10);
  if (prevEnv) process.env.INDEXER_BATCH_SIZE = prevEnv;
});

test('EventIndexer - respects configured INDEXER_BATCH_SIZE env var', () => {
  const prevEnv = process.env.INDEXER_BATCH_SIZE;
  process.env.INDEXER_BATCH_SIZE = '25';
  const dummyProvider = { getBlockNumber: async () => 100 };
  const indexer = new EventIndexer(dummyProvider, '0x0000000000000000000000000000000000000001');
  assert.equal(indexer.batchSize, 25);
  if (prevEnv) process.env.INDEXER_BATCH_SIZE = prevEnv;
});

test('EventIndexer - fetchLogsWithFallback handles Alchemy 10-block limit with suggested range', async () => {
  const dummyProvider = { getBlockNumber: async () => 100 };
  const indexer = new EventIndexer(dummyProvider, '0x0000000000000000000000000000000000000001');
  indexer.batchSize = 50; // Start at 50

  let calls = [];
  // Mock contract queryFilter to simulate Alchemy: reject range > 10 blocks with Alchemy error message
  indexer.contract.queryFilter = async (filter, from, to) => {
    calls.push({ from, to });
    const range = to - from + 1;
    if (range > 10) {
      throw new Error('eth_getLogs is limited to a 10 block range');
    }
    return [{ blockNumber: from, transactionHash: '0xabc' }];
  };

  const { logs, endBlock } = await indexer.fetchLogsWithFallback(100, 200);

  // First call was [100, 149] (50 blocks) -> failed with Alchemy limit
  // Second call was [100, 109] (10 blocks) -> succeeded!
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0], { from: 100, to: 149 });
  assert.deepEqual(calls[1], { from: 100, to: 109 });
  assert.equal(endBlock, 109);
  assert.equal(logs.length, 1);
  assert.equal(indexer.batchSize, 10); // Batch size automatically adjusted down to 10
});

test('EventIndexer - fetchLogsWithFallback automatically halves batch size when range is too large without suggested size', async () => {
  const dummyProvider = { getBlockNumber: async () => 100 };
  const indexer = new EventIndexer(dummyProvider, '0x0000000000000000000000000000000000000001');
  indexer.batchSize = 32;

  let calls = [];
  // Mock contract queryFilter to simulate provider rejecting range > 8 blocks with generic "block range is too large"
  indexer.contract.queryFilter = async (filter, from, to) => {
    calls.push({ from, to });
    const range = to - from + 1;
    if (range > 8) {
      throw new Error('block range is too large');
    }
    return [{ blockNumber: from, transactionHash: '0x123' }];
  };

  const { logs, endBlock } = await indexer.fetchLogsWithFallback(1000, 2000);

  // Call 1: 32 blocks (1000 to 1031) -> fails
  // Call 2: halved to 16 blocks (1000 to 1015) -> fails
  // Call 3: halved to 8 blocks (1000 to 1007) -> succeeds!
  assert.equal(calls.length, 3);
  assert.deepEqual(calls[0], { from: 1000, to: 1031 });
  assert.deepEqual(calls[1], { from: 1000, to: 1015 });
  assert.deepEqual(calls[2], { from: 1000, to: 1007 });
  assert.equal(endBlock, 1007);
  assert.equal(indexer.batchSize, 8);
});

test('EventIndexer - records indexerError on fatal sync failure and clears on success', async () => {
  const dummyProvider = {
    getBlockNumber: async () => 50
  };
  const indexer = new EventIndexer(dummyProvider, '0x0000000000000000000000000000000000000001');
  indexer.setLastIndexedBlock(40);

  // Simulate persistent RPC network failure
  indexer.contract.queryFilter = async () => {
    throw new Error('RPC connection refused');
  };

  const failResult = await indexer.syncFromChain();
  assert.equal(failResult.success, false);
  assert.ok(indexer.getLastError().includes('RPC connection refused'));

  // Now simulate provider recovering
  indexer.contract.queryFilter = async () => [];
  const okResult = await indexer.syncFromChain();
  assert.equal(okResult.success, true);
  assert.equal(indexer.getLastError(), null);
});
