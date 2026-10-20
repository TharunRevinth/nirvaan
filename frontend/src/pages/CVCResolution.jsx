import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { useAuth } from '../context/AuthContext';
import { CONTRACT_ADDRESS } from '../config';
import { ensureCorrectChain } from '../utils/chain';

export default function CVCResolution({ triggerToast, tenders = [] }) {
  const { walletAddress } = useAuth();
  const disputedTenders = tenders.filter(t => t.status === 'Disputed' || t.status === 'DISPUTED');
  const [selectedTenderId, setSelectedTenderId] = useState(disputedTenders[0]?.onChainId || 1);
  const [disputeData, setDisputeData] = useState(null);
  const [loadingDispute, setLoadingDispute] = useState(false);
  const [cvcReason, setCvcReason] = useState('Comprehensive procedural review completed under CVC procurement manual.');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function loadDispute() {
      if (!window.ethereum || !selectedTenderId) return;
      setLoadingDispute(true);
      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const abi = [
          "function tenderDisputes(uint256 _tenderId) external view returns (uint256 tenderId, address challenger, string memory reasonIpfsHash, uint256 filedAt, bool isResolved, bool isUpheld, string memory cvcReasonIpfsHash, uint256 disputeBondDeposited)",
          "function cvcAuditorAddress() external view returns (address)"
        ];
        const contract = new ethers.Contract(CONTRACT_ADDRESS, abi, provider);
        const d = await contract.tenderDisputes(Number(selectedTenderId));
        setDisputeData({
          tenderId: Number(d.tenderId),
          challenger: d.challenger,
          reasonIpfsHash: d.reasonIpfsHash,
          filedAt: Number(d.filedAt),
          isResolved: d.isResolved,
          isUpheld: d.isUpheld,
          bondEth: ethers.formatEther(d.disputeBondDeposited)
        });
      } catch (err) {
        console.warn('Error loading dispute data:', err);
      } finally {
        setLoadingDispute(false);
      }
    }
    loadDispute();
  }, [selectedTenderId]);

  const handleResolve = async (upheld) => {
    if (!walletAddress) {
      triggerToast('Please connect your authorized CVC Auditor wallet.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      await ensureCorrectChain();

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const abi = [
        "function resolveDispute(uint256 _tenderId, bool _upheld, string memory _cvcReasonIpfsHash) external"
      ];
      const contract = new ethers.Contract(CONTRACT_ADDRESS, abi, signer);

      const cvcCid = `QmCVC-${upheld ? 'Upheld' : 'Dismissed'}-${Date.now()}`;
      const tx = await contract.resolveDispute(Number(selectedTenderId), upheld, cvcCid);
      triggerToast(`CVC ruling transaction sent: ${tx.hash.substring(0, 18)}…`, 'info');

      const receipt = await tx.wait();
      const verdict = upheld ? 'UPHELD (Winner state reset, bond refunded)' : 'DISMISSED (Bond forfeited to Treasury)';
      triggerToast(`Dispute #${selectedTenderId} successfully ruled: ${verdict} in Block #${receipt.blockNumber}.`, 'success');
    } catch (err) {
      console.error('CVC resolution error:', err);
      triggerToast(`CVC resolution failed: ${err.reason || err.message}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div id="main-content" className="max-w-3xl mx-auto space-y-6">
      <div className="border-b border-[#E8E6E1] pb-4">
        <span className="text-[11px] font-mono font-semibold uppercase text-[#71716D] tracking-wider">
          Central Vigilance Commission (CVC) • Sovereign Oversight
        </span>
        <h1 className="text-2xl font-bold text-[#1A1A18] tracking-tight mt-1">
          Dispute Adjudication &amp; Ruling Console
        </h1>
        <p className="text-xs text-[#575753] mt-1">
          Review formal vendor grievances, evaluate procedural grounds, and execute binding cryptographic rulings.
        </p>
      </div>

      <div className="bg-white border border-[#E8E6E1] rounded-2xl p-6 space-y-5 shadow-xs">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-[#1A1A18]">Disputed Procurement Package *</label>
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

        {/* Dispute Details Card */}
        <div className="bg-[#FAFAF9] border border-[#E8E6E1] rounded-xl p-4 text-xs space-y-3 font-mono">
          <div className="flex justify-between border-b border-[#E8E6E1] pb-2">
            <span className="text-[#71716D]">Challenger Wallet:</span>
            <span className="font-semibold text-[#1A1A18]">{disputeData?.challenger || 'Pending on-chain read…'}</span>
          </div>
          <div className="flex justify-between border-b border-[#E8E6E1] pb-2">
            <span className="text-[#71716D]">Dispute Bond in Escrow:</span>
            <span className="font-semibold text-amber-900">{disputeData?.bondEth ? `${disputeData.bondEth} ETH` : '1.0 ETH'}</span>
          </div>
          <div className="flex justify-between border-b border-[#E8E6E1] pb-2">
            <span className="text-[#71716D]">Evidence IPFS CID:</span>
            <span className="font-semibold text-blue-900 truncate max-w-xs">{disputeData?.reasonIpfsHash || 'N/A'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#71716D]">Dispute Status:</span>
            <span className="font-semibold text-red-700">{disputeData?.isResolved ? 'Resolved' : 'Active Grievance Standstill'}</span>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-[#1A1A18]">Formal CVC Auditor Ruling &amp; Findings *</label>
          <textarea
            rows={3}
            required
            value={cvcReason}
            onChange={(e) => setCvcReason(e.target.value)}
            className="w-full bg-white border border-[#E8E6E1] rounded-lg px-3 py-2 text-xs text-[#1A1A18] focus-visible:ring-2 focus-visible:ring-[#A13D2B] focus-visible:outline-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-4 pt-2">
          <button
            type="button"
            disabled={isSubmitting || disputeData?.isResolved}
            onClick={() => handleResolve(true)}
            className="w-full bg-emerald-800 hover:bg-emerald-900 disabled:bg-[#A8A7A1] text-white font-semibold text-xs py-3 rounded-xl transition-colors cursor-pointer"
          >
            {isSubmitting ? 'Ruling…' : '✔ Uphold Dispute (Reset Award)'}
          </button>

          <button
            type="button"
            disabled={isSubmitting || disputeData?.isResolved}
            onClick={() => handleResolve(false)}
            className="w-full bg-[#A13D2B] hover:bg-[#8A3323] disabled:bg-[#A8A7A1] text-white font-semibold text-xs py-3 rounded-xl transition-colors cursor-pointer"
          >
            {isSubmitting ? 'Ruling…' : '✕ Dismiss Dispute (Forfeit Bond)'}
          </button>
        </div>
      </div>
    </div>
  );
}
