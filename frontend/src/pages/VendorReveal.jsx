import React, { useState } from 'react';
import { ethers } from 'ethers';
import { useAuth } from '../context/AuthContext';
import { CONTRACT_ADDRESS } from '../config';
import { ensureCorrectChain } from '../utils/chain';

export default function VendorReveal({ triggerToast, tenders = [] }) {
  const { walletAddress } = useAuth();
  const [selectedTenderId, setSelectedTenderId] = useState(tenders[0]?.onChainId || 1);
  const [bidIndex, setBidIndex] = useState(0);
  const [amountEth, setAmountEth] = useState('');
  const [salt, setSalt] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [txHash, setTxHash] = useState('');

  const currentTender = tenders.find(t => t.onChainId === Number(selectedTenderId)) || tenders[0];

  const handleJsonReceiptUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        if (data.salt) setSalt(data.salt);
        if (data.bidAmount) setAmountEth(data.bidAmount);
        if (data.onChainId) setSelectedTenderId(data.onChainId);
        triggerToast('Cryptographic salt receipt loaded successfully.', 'success');
      } catch (err) {
        triggerToast('Invalid salt receipt JSON file.', 'error');
      }
    };
    reader.readAsText(file);
  };

  const handleReveal = async (e) => {
    e.preventDefault();

    if (!walletAddress) {
      triggerToast('Please connect your authorized Web3 wallet first.', 'error');
      return;
    }
    if (!amountEth || !salt) {
      triggerToast('Please provide both revealed bid amount and secret salt.', 'error');
      return;
    }

    setIsSubmitting(true);
    setTxHash('');

    try {
      await ensureCorrectChain();

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      const abi = [
        "function revealBid(uint256 _tenderId, uint256 _bidIndex, uint256 _bidAmount, bytes32 _salt) external"
      ];
      const contract = new ethers.Contract(CONTRACT_ADDRESS, abi, signer);

      // Parse amount into wei
      const amountWei = ethers.parseEther(String(amountEth).trim());
      // Salt must be formatted as bytes32
      let saltBytes32 = salt.trim();
      if (!saltBytes32.startsWith('0x') || saltBytes32.length !== 66) {
        saltBytes32 = ethers.keccak256(ethers.toUtf8Bytes(saltBytes32));
      }

      const tx = await contract.revealBid(
        Number(selectedTenderId),
        Number(bidIndex),
        amountWei,
        saltBytes32
      );

      setTxHash(tx.hash);
      triggerToast(`Reveal transaction submitted: ${tx.hash.substring(0, 18)}…`, 'info');

      const receipt = await tx.wait();
      triggerToast(`Bid revealed on-chain in Block #${receipt.blockNumber}.`, 'success');
    } catch (err) {
      console.error('Bid reveal error:', err);
      triggerToast(`Reveal failed: ${err.reason || err.message}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div id="main-content" className="max-w-2xl mx-auto space-y-6">
      <div className="border-b border-[#E8E6E1] pb-4">
        <span className="text-[11px] font-mono font-semibold uppercase text-[#71716D] tracking-wider">
          Consortium Phase 2 • Cryptographic Opening
        </span>
        <h1 className="text-2xl font-bold text-[#1A1A18] tracking-tight mt-1">
          Reveal Sealed Commercial Bid
        </h1>
        <p className="text-xs text-[#575753] mt-1">
          Submit your cryptographic salt and unsealed quote to verify commitment hash on-chain before the reveal deadline.
        </p>
      </div>

      {/* Auto-fill from Receipt */}
      <div className="bg-[#FAFAF9] border border-[#E8E6E1] rounded-xl p-4 text-xs space-y-2">
        <div className="flex justify-between items-center">
          <span className="font-semibold text-[#1A1A18]">Fast-Fill from Salt Receipt File</span>
          <label className="cursor-pointer bg-white border border-[#E8E6E1] hover:bg-[#F5F4F0] px-3 py-1 rounded text-[11px] font-medium text-[#1A1A18] transition-colors">
            Upload .json Receipt
            <input type="file" accept=".json" onChange={handleJsonReceiptUpload} className="hidden" />
          </label>
        </div>
        <p className="text-[#71716D] text-[11px]">
          Upload the cryptographic receipt you downloaded during bid submission to automatically load your salt and exact quote.
        </p>
      </div>

      <form onSubmit={handleReveal} className="bg-white border border-[#E8E6E1] rounded-2xl p-6 space-y-4 shadow-xs">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-[#1A1A18]">Target Tender Package *</label>
          <select
            value={selectedTenderId}
            onChange={(e) => setSelectedTenderId(e.target.value)}
            className="w-full bg-white border border-[#E8E6E1] rounded-lg px-3 py-2 text-xs font-mono text-[#1A1A18] focus-visible:ring-2 focus-visible:ring-[#A13D2B] focus-visible:outline-none"
          >
            {tenders.map((t) => (
              <option key={t.onChainId} value={t.onChainId}>
                #{t.onChainId} — {t.id} ({t.title}) — Status: {t.status}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#1A1A18]">Bid Index (0 for first bid) *</label>
            <input
              type="number"
              min="0"
              required
              value={bidIndex}
              onChange={(e) => setBidIndex(e.target.value)}
              className="w-full bg-white border border-[#E8E6E1] rounded-lg px-3 py-2 text-xs font-mono text-[#1A1A18] focus-visible:ring-2 focus-visible:ring-[#A13D2B] focus-visible:outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#1A1A18]">Commercial Quote (in ETH) *</label>
            <input
              type="text"
              required
              placeholder="e.g. 0.45"
              value={amountEth}
              onChange={(e) => setAmountEth(e.target.value)}
              className="w-full bg-white border border-[#E8E6E1] rounded-lg px-3 py-2 text-xs font-mono text-[#1A1A18] focus-visible:ring-2 focus-visible:ring-[#A13D2B] focus-visible:outline-none"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-[#1A1A18]">Secret Salt (32-byte Hex or String) *</label>
          <input
            type="text"
            required
            placeholder="0x..."
            value={salt}
            onChange={(e) => setSalt(e.target.value)}
            className="w-full bg-white border border-[#E8E6E1] rounded-lg px-3 py-2 text-xs font-mono text-[#1A1A18] focus-visible:ring-2 focus-visible:ring-[#A13D2B] focus-visible:outline-none"
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting || !walletAddress}
          className="w-full bg-[#1A1A18] hover:bg-black disabled:bg-[#A8A7A1] text-white font-semibold text-xs py-2.5 rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-[#A13D2B] focus-visible:outline-none cursor-pointer"
        >
          {isSubmitting ? 'Verifying & Revealing On-Chain…' : 'Execute revealBid() On-Chain →'}
        </button>

        {txHash && (
          <div className="pt-2 text-[11px] font-mono text-emerald-800 break-all">
            Transaction Hash: {txHash}
          </div>
        )}
      </form>
    </div>
  );
}
