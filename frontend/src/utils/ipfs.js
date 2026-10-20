/**
 * Resilient IPFS Document Uploader for NIRVAAN
 * 
 * Multi-Tier Strategy:
 * 1. Backend Relay (${API_URL}/api/ipfs/upload)
 * 2. Direct Kubo IPFS Daemon (${IPFS_RPC_URL}/api/v0/add)
 * 3. Client-side deterministic cryptographic CIDv0 generator via Web Crypto SHA-256 + Base58
 */

import { API_URL, IPFS_RPC_URL } from '../config';

const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function bufferToBase58(buffer) {
  let digits = [0];
  for (let i = 0; i < buffer.length; i++) {
    for (let j = 0; j < digits.length; j++) digits[j] <<= 8;
    digits[0] += buffer[i];
    let carry = 0;
    for (let j = 0; j < digits.length; ++j) {
      digits[j] += carry;
      carry = (digits[j] / 58) | 0;
      digits[j] %= 58;
    }
    while (carry) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }
  for (let i = 0; i < buffer.length && buffer[i] === 0; i++) digits.push(0);
  return digits.reverse().map(d => BASE58_ALPHABET[d]).join("");
}

export async function uploadDocumentToIpfs(file) {
  if (!file) {
    throw new Error('No file provided for upload.');
  }

  // Pin document via Backend IPFS Gateway (Pinata)
  if (!API_URL) {
    throw new Error('API_URL is not configured. Cannot reach IPFS pinning service.');
  }

  const formData = new FormData();
  formData.append('file', file);

  const headers = {};
  const officerToken = localStorage.getItem('officer_token');
  if (officerToken) {
    headers['Authorization'] = `Bearer ${officerToken}`;
  }
  const vendorWallet = localStorage.getItem('vendor_wallet');
  if (vendorWallet) {
    headers['x-vendor-address'] = vendorWallet;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  try {
    const res = await fetch(`${API_URL}/api/ipfs/upload`, {
      method: 'POST',
      headers,
      body: formData,
      signal: controller.signal
    });
    clearTimeout(timeout);

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'IPFS pinning service rejected file.');
    }

    if (!data.Hash) {
      throw new Error('IPFS pinning response did not contain a valid CID.');
    }

    return {
      hash: data.Hash,
      name: file.name,
      source: data.source || 'pinata-ipfs'
    };
  } catch (err) {
    clearTimeout(timeout);
    console.error('IPFS Upload Error:', err);
    throw new Error(`IPFS Upload Failed: ${err.message}. Never anchoring unpinned CID.`);
  }
}
