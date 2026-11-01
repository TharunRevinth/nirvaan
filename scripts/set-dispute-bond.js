#!/usr/bin/env node

/**
 * scripts/set-dispute-bond.js
 * 
 * Configures the on-chain dispute bond amount on the deployed TenderProxy.
 * Reads the multisig/admin private key from ADMIN_PRIVATE_KEY or PRIVATE_KEY env.
 * The private key is NEVER printed, logged, or written to disk.
 * 
 * Usage:
 *   ADMIN_PRIVATE_KEY=0x... node scripts/set-dispute-bond.js [bondInEth]
 *   e.g.
 *   ADMIN_PRIVATE_KEY=0x... node scripts/set-dispute-bond.js 0.01
 */

import { ethers } from '../backend/node_modules/ethers/lib.esm/index.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

async function main() {
  const adminKey = process.env.ADMIN_PRIVATE_KEY || process.env.PRIVATE_KEY;
  if (!adminKey) {
    console.error('[ERROR] Missing admin private key. Provide ADMIN_PRIVATE_KEY or PRIVATE_KEY via environment variable.');
    console.error('Example: ADMIN_PRIVATE_KEY=0x... node scripts/set-dispute-bond.js 0.01');
    process.exit(1);
  }

  // Load deployed addresses
  const addressesPath = path.join(rootDir, 'contracts', 'deploy', 'addresses.json');
  let proxyAddress = process.env.CONTRACT_ADDRESS;
  if (!proxyAddress && fs.existsSync(addressesPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(addressesPath, 'utf8'));
      proxyAddress = data.proxyAddress;
    } catch (e) {}
  }

  if (!proxyAddress || !ethers.isAddress(proxyAddress)) {
    console.error('[ERROR] Valid proxy CONTRACT_ADDRESS not found in environment or contracts/deploy/addresses.json');
    process.exit(1);
  }

  const targetBondEth = process.argv[2] || process.env.DISPUTE_BOND_ETH || '0.01';
  let targetBondWei;
  try {
    targetBondWei = ethers.parseEther(targetBondEth);
  } catch (err) {
    console.error(`[ERROR] Invalid ETH amount "${targetBondEth}": ${err.message}`);
    process.exit(1);
  }

  const rpcUrl = process.env.RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com';
  const provider = new ethers.JsonRpcProvider(rpcUrl, undefined, { staticNetwork: true });

  const wallet = new ethers.Wallet(adminKey, provider);
  console.log(`[INFO] Connected to RPC: ${rpcUrl}`);
  console.log(`[INFO] Admin Caller Address: ${wallet.address}`);
  console.log(`[INFO] Target Proxy Address: ${proxyAddress}`);
  console.log(`[INFO] Target Dispute Bond: ${targetBondEth} ETH (${targetBondWei.toString()} Wei)`);

  const abi = [
    "function disputeBondAmount() external view returns (uint256)",
    "function multisigAdmin() external view returns (address)",
    "function setDisputeBondAmount(uint256 _newBond) external"
  ];

  const contract = new ethers.Contract(proxyAddress, abi, wallet);

  // Check current bond
  const currentBondWei = await contract.disputeBondAmount();
  console.log(`[INFO] Current On-Chain Bond: ${ethers.formatEther(currentBondWei)} ETH (${currentBondWei.toString()} Wei)`);

  if (currentBondWei === targetBondWei) {
    console.log(`[SUCCESS] On-chain disputeBondAmount is already ${targetBondEth} ETH. No transaction needed.`);
    return;
  }

  const adminOnChain = await contract.multisigAdmin();
  if (adminOnChain.toLowerCase() !== wallet.address.toLowerCase()) {
    console.error(`[ERROR] Admin address mismatch! Contract admin is ${adminOnChain}, but caller is ${wallet.address}. Transaction would revert with onlyAdmin.`);
    process.exit(1);
  }

  console.log('[TX] Broadcasting setDisputeBondAmount transaction...');
  const tx = await contract.setDisputeBondAmount(targetBondWei);
  console.log(`[TX] Submitted: ${tx.hash}`);
  const receipt = await tx.wait();
  console.log(`[TX] Confirmed in block #${receipt.blockNumber}!`);

  const updatedBondWei = await contract.disputeBondAmount();
  console.log(`[VERIFIED] New On-Chain Dispute Bond: ${ethers.formatEther(updatedBondWei)} ETH`);
}

main().catch((err) => {
  console.error('[FATAL ERROR]:', err.message);
  process.exit(1);
});
