import React, { useState, useEffect } from 'react';
import ConfirmationModal from '../components/ConfirmationModal';
import { useAuth } from '../context/AuthContext';

export default function SealedBidSubmission({ triggerToast, tenders = [] }) {
  const { walletAddress } = useAuth();
  const [selectedTenderId, setSelectedTenderId] = useState(tenders[0]?.id || 'TND-24-9982-A');
  const [amount, setAmount] = useState('');
  const [salt, setSalt] = useState('');
  const [emdDeposited, setEmdDeposited] = useState('500000');
  const [commitmentHash, setCommitmentHash] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Verification Test Mode: Test Wrong Salt Reveal Simulator
  const [testRevealMode, setTestRevealMode] = useState(false);
  const [revealAmount, setRevealAmount] = useState('');
  const [revealSalt, setRevealSalt] = useState('');

  const currentTender = tenders.find(t => t.id === selectedTenderId) || tenders[0];

  // Live client-side commitment hash calculation (Keccak-256 simulator)
  useEffect(() => {
    if (amount || salt) {
      const combined = amount + ':' + salt + ':' + walletAddress;
      let hash = 0;
      for (let i = 0; i < combined.length; i++) {
        hash = (hash << 5) - hash + combined.charCodeAt(i);
        hash |= 0;
      }
      const hex = Math.abs(hash).toString(16).padStart(8, '0');
      const mockKeccak = '0x8f2a' + hex + '9b4e1c2d3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c';
      setCommitmentHash(mockKeccak.substring(0, 66));
    } else {
      setCommitmentHash('');
    }
  }, [amount, salt, walletAddress]);

  const handleGenerateSalt = () => {
    const randomSalt = Array.from({ length: 16 }, () => Math.random().toString(36)[2]).join('').toUpperCase();
    setSalt(randomSalt);
  };

  const handlePreSubmitValidation = () => {
    // 1. Check Deadline
    if (currentTender.isExpired) {
      triggerToast(`Bidding Deadline Passed: Tender ${currentTender.id} closed for submission. Bids can no longer be submitted on-chain.`, 'error');
      return;
    }

    // 2. Check EMD Minimum
    if (Number(emdDeposited) < currentTender.minEmdAmount) {
      triggerToast(`EMD Amount Insufficient: EMD deposited (₹${Number(emdDeposited).toLocaleString()}) is below the minimum required EMD (${currentTender.emd}) for this tender.`, 'error');
      return;
    }

    setModalOpen(true);
  };

  const handleConfirmSubmit = () => {
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setModalOpen(false);
      triggerToast(`Sealed Bid Commitment Hash ${commitmentHash.substring(0, 16)}... confirmed and recorded on-chain.`, 'success');
    }, 1800);
  };

  const handleVerifyReveal = () => {
    // Test Reveal Verification Scenario
    const originalHash = commitmentHash;
    const revealCombined = revealAmount + ':' + revealSalt + ':' + walletAddress;
    let hash = 0;
    for (let i = 0; i < revealCombined.length; i++) {
      hash = (hash << 5) - hash + revealCombined.charCodeAt(i);
      hash |= 0;
    }
    const hex = Math.abs(hash).toString(16).padStart(8, '0');
    const computedHash = ('0x8f2a' + hex + '9b4e1c2d3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c').substring(0, 66);

    if (computedHash !== originalHash) {
      triggerToast("Commitment hash mismatch — the amount or salt entered doesn't match your original submission.", 'error');
    } else {
      triggerToast("Commitment Hash Match Verified! Bid successfully revealed on-chain.", 'success');
    }
  };

  return (
    <div id="main-content" className="max-w-4xl mx-auto space-y-6">
      <div className="border-b border-graphite/15 pb-4 flex justify-between items-end">
        <div>
          <span className="text-xs font-mono text-slate bg-slate/10 px-2 py-0.5 border border-slate/20">
            SECURE BID ENCRYPTOR // COMMIT-REVEAL PROTOCOL
          </span>
          <h1 className="text-2xl font-bold text-graphite uppercase tracking-tight mt-2">
            Sealed Financial Bid Submission
          </h1>
          <p className="text-xs text-graphite/70 mt-1">
            Connected Bidder Wallet: <span className="font-mono text-copper font-bold">{walletAddress}</span>
          </p>
        </div>
        <button
          onClick={() => setTestRevealMode(!testRevealMode)}
          className="text-xs font-bold font-mono border border-slate text-slate px-3 py-1 hover:bg-slate hover:text-white"
        >
          {testRevealMode ? 'Switch to Bid Commit Form' : 'Test Reveal Mismatch Verification'}
        </button>
      </div>

      {!testRevealMode ? (
        <>
          {/* Commit Form */}
          <div className="bg-white border-l-4 border-slate p-4 text-xs space-y-2 hairline-border">
            <h3 className="font-bold text-slate uppercase">Commit-Reveal Security Standard</h3>
            <p className="text-graphite/80 leading-relaxed">
              Your numerical bid amount is hashed client-side using Keccak-256. Only the commitment hash is broadcasted to the consortium ledger.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            <div className="md:col-span-7 bg-white border border-graphite/15 p-6 space-y-6">
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate border-b border-graphite/15 pb-2">
                01. Target Tender & Commercial Parameters
              </h3>

              <div className="space-y-1">
                <label className="text-xs font-bold text-graphite">SELECT TARGET TENDER *</label>
                <select
                  value={selectedTenderId}
                  onChange={(e) => setSelectedTenderId(e.target.value)}
                  className="w-full bg-offwhite border border-graphite/30 p-2.5 text-xs text-graphite font-bold cursor-pointer"
                >
                  {tenders.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.id} — {t.title} ({t.status})
                    </option>
                  ))}
                </select>
              </div>

              {currentTender.isExpired && (
                <div className="bg-red-50 border border-red-300 p-3 text-xs text-red-800 font-bold">
                  ⚠️ NOTICE: Bidding window closed for this tender on {currentTender.deadline}. Submissions are blocked.
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-bold text-graphite">COMMERCIAL BID AMOUNT (INR ₹) *</label>
                <input
                  type="number"
                  placeholder="e.g. 45200000"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full bg-offwhite border border-graphite/30 p-3 text-sm font-mono text-graphite text-right"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-graphite">EARNEST MONEY DEPOSIT (EMD ₹) DEPOSITED *</label>
                <input
                  type="number"
                  value={emdDeposited}
                  onChange={(e) => setEmdDeposited(e.target.value)}
                  className="w-full bg-offwhite border border-graphite/30 p-2.5 text-xs font-mono text-graphite text-right"
                />
                <span className="text-[10px] text-slate font-mono">
                  Minimum Required EMD: {currentTender.emd}
                </span>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-graphite">SECRET SALT STRING *</label>
                  <button
                    type="button"
                    onClick={handleGenerateSalt}
                    className="text-[11px] font-bold text-copper hover:underline"
                  >
                    + Generate Random Salt
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="Enter or generate secret salt string"
                  value={salt}
                  onChange={(e) => setSalt(e.target.value)}
                  className="w-full bg-offwhite border border-graphite/30 p-3 text-xs font-mono text-graphite"
                />
              </div>

              <div className="bg-amber/10 border border-amber/30 p-3 text-xs space-y-1">
                <div className="font-bold text-graphite flex items-center gap-1">
                  <span>⚠️</span> MANDATORY REGULATORY WARNING
                </div>
                <p className="text-graphite/80 text-[11px]">
                  You must save and retain your exact salt string. If you lose this salt string, your bid cannot be opened during the reveal phase and will be permanently disqualified under CVC guidelines.
                </p>
              </div>
            </div>

            <div className="md:col-span-5 bg-graphite text-white p-6 space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="border-b border-white/15 pb-2 flex justify-between items-center text-xs font-mono">
                  <span className="text-slate-300 uppercase font-bold">Generated Hash</span>
                  <span className="text-copper">KECCAK-256</span>
                </div>

                <div className="bg-black/50 p-4 border border-white/20 font-mono text-xs text-emerald-400 break-all min-h-[100px]">
                  {commitmentHash || 'AWAITING_INPUT_PARAMS...'}
                </div>
              </div>

              <button
                onClick={handlePreSubmitValidation}
                disabled={!commitmentHash || currentTender.isExpired}
                className="w-full bg-copper text-white font-bold text-xs py-3.5 hover:bg-copper-hover disabled:opacity-50 transition-colors uppercase"
              >
                Submit Sealed Bid On-Chain →
              </button>
            </div>
          </div>
        </>
      ) : (
        /* Test Reveal Mode */
        <div className="bg-white border border-graphite/15 p-6 space-y-4 max-w-xl mx-auto">
          <h3 className="font-bold text-sm text-graphite uppercase border-b border-graphite/15 pb-2">
            Test Reveal Salt Mismatch Scenario
          </h3>
          <p className="text-xs text-graphite/70">
            Enter parameters to simulate public bid reveal verification against Commitment Hash:
            <span className="font-mono text-copper block font-bold mt-1">{commitmentHash || '0x8f2a...9b4e'}</span>
          </p>

          <div className="space-y-1">
            <label className="text-xs font-bold text-graphite">REVEAL AMOUNT (INR ₹)</label>
            <input
              type="number"
              value={revealAmount}
              onChange={(e) => setRevealAmount(e.target.value)}
              placeholder="e.g. 45200000"
              className="w-full bg-offwhite border border-graphite/30 p-2.5 text-xs font-mono text-graphite"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-graphite">REVEAL SALT STRING</label>
            <input
              type="text"
              value={revealSalt}
              onChange={(e) => setRevealSalt(e.target.value)}
              placeholder="Enter salt to test"
              className="w-full bg-offwhite border border-graphite/30 p-2.5 text-xs font-mono text-graphite"
            />
          </div>

          <button
            onClick={handleVerifyReveal}
            className="w-full bg-slate text-white font-bold text-xs py-3 hover:bg-slate/90 transition-colors uppercase"
          >
            Verify On-Chain Hash Reveal →
          </button>
        </div>
      )}

      <ConfirmationModal
        isOpen={modalOpen}
        title="Confirm Sealed Bid Submission"
        message={`Are you sure you want to record Commitment Hash ${commitmentHash.substring(0, 16)}... on the consortium blockchain? Ensure you have saved your salt string.`}
        onConfirm={handleConfirmSubmit}
        onCancel={() => setModalOpen(false)}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}
