#!/usr/bin/env node

/**
 * NIRVAAN CONSORTIUM - EVM TIME WARP HELPER
 * Fast-forwards Anvil / Hardhat blockchain clock past tender deadlines
 * for live Viva demonstration of Autonomous Oracle Keeper automation.
 */

const { ethers } = require('ethers');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const RPC_URL = process.env.RPC_URL || process.env.BESU_RPC_URL || 'http://127.0.0.1:8545';
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || '0x5FbDB2315678afecb367f032d93F642f64180aa3';

const CONTRACT_ABI = [
  'function tenders(uint256) external view returns (uint256 id, address psuAddress, string memory ipfsHashDoc, uint256 submissionDeadline, uint256 openingTime, uint256 appealDeadline, uint256 minEMDAmount, uint8 status, address winner, uint256 winningBidId, uint256 winningBidAmount)',
  'function tenderCounter() external view returns (uint256)'
];

const provider = new ethers.JsonRpcProvider(RPC_URL);
const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);

async function advanceTime(seconds) {
  const b1 = await provider.send('eth_getBlockByNumber', ['latest', false]);
  const initialTime = parseInt(b1.timestamp, 16);

  console.log(`[Time Warp] Advancing chain clock by ${seconds} seconds (${(seconds / 3600).toFixed(2)} hours / ${(seconds / 86400).toFixed(2)} days)...`);
  await provider.send('evm_increaseTime', [seconds]);
  await provider.send('evm_mine', []);

  const b2 = await provider.send('eth_getBlockByNumber', ['latest', false]);
  const newTime = parseInt(b2.timestamp, 16);

  console.log(`[Time Warp] Block #${parseInt(b2.number, 16)} mined.`);
  console.log(`[Time Warp] Previous Timestamp: ${initialTime} (${new Date(initialTime * 1000).toISOString()})`);
  console.log(`[Time Warp] Current Timestamp:  ${newTime} (${new Date(newTime * 1000).toISOString()})`);
  console.log(`[Time Warp] Elapsed: +${newTime - initialTime} seconds.`);
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'help';

  if (command === 'help' || !command) {
    console.log(`
NIRVAAN Fast-Forward Demo Script
================================
Usage:
  node fast-forward.js <seconds>              Add N seconds (e.g. node fast-forward.js 3600)
  node fast-forward.js 7d                     Add 7 days + 60s (e.g. 604860s for appeal window)
  node fast-forward.js 1h                     Add 1 hour (3600s)
  node fast-forward.js open <tenderId>        Fast-forward to exactly after tender openingTime
  node fast-forward.js finalize <tenderId>    Fast-forward to exactly after tender appealDeadline
  node fast-forward.js status                 Display current chain block time and tender deadlines
`);
    process.exit(0);
  }

  if (command === 'status') {
    const b = await provider.send('eth_getBlockByNumber', ['latest', false]);
    const blockTime = parseInt(b.timestamp, 16);
    const count = await contract.tenderCounter();
    console.log(`Current Block #${parseInt(b.number, 16)} | Timestamp: ${blockTime} (${new Date(blockTime * 1000).toISOString()})`);
    console.log(`Total Tenders on Chain: ${count}\n`);
    for (let i = 1n; i <= count; i++) {
      const t = await contract.tenders(i);
      console.log(`Tender #${i}: Status=${t.status} | OpeningTime=${t.openingTime} (delta: ${Number(t.openingTime) - blockTime}s) | AppealDeadline=${t.appealDeadline} (delta: ${Number(t.appealDeadline) - blockTime}s)`);
    }
    return;
  }

  if (command === 'open') {
    const tenderId = args[1] || '1';
    const t = await contract.tenders(tenderId);
    const b = await provider.send('eth_getBlockByNumber', ['latest', false]);
    const blockTime = parseInt(b.timestamp, 16);
    const openingTime = Number(t.openingTime);
    if (blockTime >= openingTime) {
      console.log(`[Status] Tender #${tenderId} openingTime (${openingTime}) is already in the past! Current: ${blockTime}`);
    } else {
      const diff = openingTime - blockTime + 10; // +10s buffer
      await advanceTime(diff);
    }
    return;
  }

  if (command === 'finalize') {
    const tenderId = args[1] || '1';
    const t = await contract.tenders(tenderId);
    const b = await provider.send('eth_getBlockByNumber', ['latest', false]);
    const blockTime = parseInt(b.timestamp, 16);
    const appealDeadline = Number(t.appealDeadline);
    if (appealDeadline === 0) {
      console.error(`[Error] Tender #${tenderId} has appealDeadline = 0 (Tender has not been Awarded yet).`);
      return;
    }
    if (blockTime > appealDeadline) {
      console.log(`[Status] Tender #${tenderId} appealDeadline (${appealDeadline}) is already in the past! Current: ${blockTime}`);
    } else {
      const diff = appealDeadline - blockTime + 10; // +10s buffer
      await advanceTime(diff);
    }
    return;
  }

  if (command === '7d') {
    await advanceTime(7 * 86400 + 60);
    return;
  }

  if (command === '1h') {
    await advanceTime(3600);
    return;
  }

  const sec = parseInt(command, 10);
  if (!isNaN(sec) && sec > 0) {
    await advanceTime(sec);
  } else {
    console.error(`Invalid argument: ${command}. Run "node fast-forward.js help" for usage.`);
  }
}

main().catch((err) => {
  console.error('[Time Warp Error]', err.message);
  process.exit(1);
});
