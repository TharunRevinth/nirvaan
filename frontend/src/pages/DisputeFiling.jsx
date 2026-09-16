import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { ethers } from 'ethers';
import ConfirmationModal from '../components/ConfirmationModal';
import { useAuth, CONTRACT_ADDRESS } from '../context/AuthContext';

export default function DisputeFiling({ triggerToast, tenders = [] }) {
  const { walletAddress, officerUser, isOfficerAuthenticated } = useAuth();

  const [selectedTenderId, setSelectedTenderId] = useState(tenders[0]?.id || 'TND-24-9982-A');
  const [reason, setReason] = useState('Technical Specification Exclusion');
  const [description, setDescription] = useState('');
  const [bondAmount] = useState('1,00,000');
  const [modalOpen, setModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentTender = tenders.find(t => t.id === selectedTenderId) || tenders[0] || { id: 'TND-24-9982-A', title: 'Supply of Offshore Pipeline Valves & Actuators', appealWindowClosed: false };

  const winningVendorAddress = currentTender.winnerAddress || '0xf17f52151ebef6c7334fad080c5704d77216b732';
  const isWinningVendor = walletAddress?.toLowerCase() === winningVendorAddress.toLowerCase();

  const handlePreSubmitValidation = () => {
    if (isWinningVendor) {
      triggerToast('Ineligible: Winning bidders awarded contracts cannot file disputes against their own award.', 'error');
      return;
    }

    if (currentTender.appealWindowClosed) {
      triggerToast(`Dispute Window Closed: The 7-day statutory appeal window for Tender ${currentTender.id} has expired.`, 'error');
      return;
    }

    setModalOpen(true);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const onChainId = currentTender?.onChainId || 1;
      let txHash = '';

      if (window.ethereum) {
        try {
          const provider = new ethers.BrowserProvider(window.ethereum);
          const signer = await provider.getSigner();
          const abi = [
            "function disputeTender(uint256 _tenderId, string memory _reasonIpfsHash) external payable"
          ];
          const contract = new ethers.Contract(CONTRACT_ADDRESS, abi, signer);
          const tx = await contract.disputeTender(
            onChainId,
            `QmDispute-${reason.substring(0, 10)}-${Date.now()}`,
            { value: ethers.parseEther("1.0") }
          );
          txHash = tx.hash;
          await tx.wait();
        } catch (web3Err) {
          console.warn("Direct Web3 dispute failed, attempting relay fallback:", web3Err.message);
        }
      }

      if (!txHash) {
        const res = await fetch(`http://localhost:5000/api/tenders/${onChainId}/dispute`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reasonIpfsHash: `QmDispute-${reason.substring(0, 10)}-${Date.now()}`,
            challengerAddress: walletAddress
          })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Server relay for dispute failed.');
        txHash = data.txHash;
      }

      setIsSubmitting(false);
      setModalOpen(false);
      triggerToast(`Dispute filed on-chain for ${selectedTenderId}. Escrow bond of 1.0 ETH locked. Tx: ${txHash.substring(0, 18)}…`, 'success');
    } catch (err) {
      setIsSubmitting(false);
      setModalOpen(false);
      console.error("Dispute filing error:", err);
      triggerToast(`Dispute filing error: ${err.message}`, 'error');
    }
  };

  return (
    <div id="main-content" className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="border-b border-[#E8E6E1] pb-4 flex flex-col sm:flex-row justify-between sm:items-end gap-3">
        <div className="space-y-1">
          <span className="text-[11px] font-mono font-semibold uppercase text-[#71716D] tracking-wider">
            CVC Grievance Redressal • Statutory Appeals
          </span>
          <h1 className="text-2xl font-bold text-[#1A1A18] tracking-tight">
            File Tender Dispute &amp; Escrow Bond
          </h1>
          <p className="text-xs text-[#575753]">
            Governed under Central Vigilance Commission (CVC) Procurement Guidelines.
          </p>
        </div>

        <div className="text-left sm:text-right font-mono text-xs tabular-nums">
          <span className="text-[#71716D] block">Appeal Window:</span>
          <span className={`font-semibold ${currentTender.appealWindowClosed ? 'text-red-700' : 'text-emerald-700'}`}>
            {currentTender.appealWindowClosed ? 'Closed (Expired)' : 'Open (06 Days Remaining)'}
          </span>
        </div>
      </div>

      {isWinningVendor && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-xs text-red-900 font-medium">
          Ineligible to Dispute: Your wallet is registered as the awarded L1 Winner for this contract. Winning vendors cannot appeal their own awarded contracts.
        </div>
      )}

      {/* Escrow Mechanism Note */}
      <div className="bg-[#FAFAF9] border border-[#E8E6E1] rounded-xl p-4 text-xs space-y-1">
        <h3 className="font-semibold text-[#1A1A18] text-xs">
          Dispute Escrow Smart Contract Mechanism
        </h3>
        <p className="text-[#575753] leading-relaxed">
          Filing a dispute triggers a 7-day standstill hold on tender finalization on the blockchain. A refundable Dispute Bond of ₹ 1,00,000 is locked in escrow during CVC auditor review.
        </p>
      </div>

      {/* Dispute Form */}
      <div className="bg-white border border-[#E8E6E1] rounded-2xl p-6 sm:p-8 space-y-6 shadow-xs">
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="dispute-tender-select" className="text-xs font-medium text-[#1A1A18]">
                Target Tender Reference *
              </label>
              <select
                id="dispute-tender-select"
                value={selectedTenderId}
                onChange={(e) => setSelectedTenderId(e.target.value)}
                className="w-full bg-white border border-[#E8E6E1] rounded-lg px-3 py-2 text-xs font-mono text-[#1A1A18] font-medium cursor-pointer focus-visible:ring-2 focus-visible:ring-[#A13D2B] focus-visible:outline-none"
              >
                {tenders.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.id} — {t.title} ({t.appealWindowClosed ? 'CLOSED' : 'OPEN'})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="dispute-reason-select" className="text-xs font-medium text-[#1A1A18]">
                Dispute Ground / Category *
              </label>
              <select
                id="dispute-reason-select"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full bg-white border border-[#E8E6E1] rounded-lg px-3 py-2 text-xs text-[#1A1A18] cursor-pointer focus-visible:ring-2 focus-visible:ring-[#A13D2B] focus-visible:outline-none"
              >
                <option value="Technical Specification Exclusion">Technical Specification Exclusion</option>
                <option value="Unfair Evaluation / L1 Calculation Mismatch">Unfair Evaluation / L1 Calculation Mismatch</option>
                <option value="Procedural Deadline Irregularity">Procedural Deadline Irregularity</option>
                <option value="Bid Opening Collusion Suspicions">Bid Opening Collusion Suspicions</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="dispute-grounds-input" className="text-xs font-medium text-[#1A1A18]">
              Detailed Factual Grounds for Appeal *
            </label>
            <textarea
              id="dispute-grounds-input"
              required
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Specify technical or procedural clauses breached according to CVC manual…"
              className="w-full bg-white border border-[#E8E6E1] rounded-lg px-3 py-2 text-xs text-[#1A1A18] placeholder:text-[#A8A7A1] focus-visible:ring-2 focus-visible:ring-[#A13D2B] focus-visible:outline-none leading-relaxed"
            />
          </div>

          <div className="bg-[#FAFAF9] p-4 rounded-xl border border-[#E8E6E1] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div>
              <span className="font-semibold text-[#1A1A18] block">Mandatory Dispute Bond Escrow:</span>
              <span className="text-[#71716D] text-[11px]">100% Refundable upon favorable CVC auditor determination</span>
            </div>
            <span className="font-mono text-base font-bold text-[#1A1A18] tabular-nums">
              ₹ {bondAmount} INR
            </span>
          </div>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
          {!description ? (
            <span className="text-xs text-[#71716D]">
              Note: Enter detailed factual grounds for appeal above to enable submission.
            </span>
          ) : currentTender.appealWindowClosed ? (
            <span className="text-xs text-red-700">
              Dispute window has expired for this tender.
            </span>
          ) : isWinningVendor ? (
            <span className="text-xs text-red-700">
              Awarded L1 winners cannot appeal their own award.
            </span>
          ) : (
            <span className="text-xs text-emerald-800 font-medium">
              ✓ Dispute grounds provided. Ready to submit and lock bond.
            </span>
          )}

          <button
            type="button"
            onClick={handlePreSubmitValidation}
            disabled={!description || currentTender.appealWindowClosed || isWinningVendor}
            aria-disabled={!description || currentTender.appealWindowClosed || isWinningVendor}
            className={`font-semibold text-xs px-6 py-2.5 rounded-lg transition-all focus-visible:ring-2 focus-visible:ring-[#A13D2B] focus-visible:outline-none ${
              !description || currentTender.appealWindowClosed || isWinningVendor
                ? 'bg-[#E8E6E1] text-[#71716D] border border-[#E8E6E1] cursor-not-allowed shadow-none'
                : 'bg-[#A13D2B] hover:bg-[#8A3323] text-white shadow-xs cursor-pointer'
            }`}
          >
            File Dispute &amp; Lock Bond On-Chain →
          </button>
        </div>
      </div>

      <ConfirmationModal
        isOpen={modalOpen}
        title="Confirm Dispute Filing"
        message={`Are you sure you want to file a formal dispute against ${selectedTenderId} and lock ₹${bondAmount} in escrow?`}
        onConfirm={handleSubmit}
        onCancel={() => setModalOpen(false)}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}
