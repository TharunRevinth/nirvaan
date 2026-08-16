import React, { useState, useEffect } from 'react';
import ConfirmationModal from '../components/ConfirmationModal';

export default function SealedBidSubmission({ triggerToast, walletAddress }) {
  const [amount, setAmount] = useState('');
  const [salt, setSalt] = useState('');
  const [commitmentHash, setCommitmentHash] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Live client-side commitment hash calculation (Keccak-256 simulator)
  useEffect(() => {
    if (amount || salt) {
      const combined = amount + ':' + salt + ':' + (walletAddress || '0xfe3b2075775791234567890abcdef1234567bd73');
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

  const handleConfirmSubmit = () => {
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setModalOpen(false);
      triggerToast(`Sealed Bid Commitment Hash ${commitmentHash.substring(0, 16)}... confirmed and recorded on-chain.`, 'success');
    }, 1800);
  };

  return (
    <div id="main-content" className="max-w-4xl mx-auto space-y-6">
      <div className="border-b border-graphite/15 pb-4">
        <span className="text-xs font-mono text-slate bg-slate/10 px-2 py-0.5 border border-slate/20">
          SECURE BID ENCRYPTOR // COMMIT-REVEAL PROTOCOL
        </span>
        <h1 className="text-2xl font-bold text-graphite uppercase tracking-tight mt-2">
          Sealed Financial Bid Submission
        </h1>
        <p className="text-xs text-graphite/70 mt-1">
          Target Tender: IOCL Pipeline Valves Expansion (Ref: TND-24-9982-A)
        </p>
      </div>

      {/* Plain Language Explanation of Commit-Reveal Concept */}
      <div className="bg-white border-l-4 border-slate p-4 text-xs space-y-2 hairline-border">
        <h3 className="font-bold text-slate uppercase">Understanding Sealed Commit-Reveal Mechanics</h3>
        <p className="text-graphite/80 leading-relaxed">
          To eliminate bid tampering and pre-opening insider peek risk, your actual bid amount is encrypted using a cryptographic salt. Only the SHA-256 / Keccak-256 commitment hash is submitted to the consortium blockchain during this phase. Your numerical bid remains completely secret until the official bid-opening timestamp.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Bid Form (7 cols) */}
        <div className="md:col-span-7 bg-white border border-graphite/15 p-6 space-y-6">
          <h3 className="font-bold text-xs uppercase tracking-wider text-slate border-b border-graphite/15 pb-2">
            01. Financial Bid Amount & Cryptographic Salt
          </h3>

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

          {/* Mandatory Warning Notice */}
          <div className="bg-amber/10 border border-amber/30 p-3 text-xs space-y-1">
            <div className="font-bold text-graphite flex items-center gap-1">
              <span>⚠️</span> MANDATORY REGULATORY WARNING
            </div>
            <p className="text-graphite/80 text-[11px]">
              You must save and retain your exact salt string. If you lose this salt string, your bid cannot be opened during the reveal phase and will be permanently disqualified under CVC guidelines.
            </p>
          </div>
        </div>

        {/* Live Commitment Hash Output Display (5 cols) */}
        <div className="md:col-span-5 bg-graphite text-white p-6 space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="border-b border-white/15 pb-2 flex justify-between items-center text-xs font-mono">
              <span className="text-slate-300 uppercase font-bold">Generated Hash</span>
              <span className="text-copper">KECCAK-256</span>
            </div>

            <p className="text-[11px] text-offwhite/70 italic">
              "This hash is what goes on-chain; your numerical amount stays sealed."
            </p>

            <div className="bg-black/50 p-4 border border-white/20 font-mono text-xs text-emerald-400 break-all min-h-[100px]">
              {commitmentHash || 'AWAITING_INPUT_PARAMS...'}
            </div>
          </div>

          <button
            onClick={() => setModalOpen(true)}
            disabled={!commitmentHash}
            className="w-full bg-copper text-white font-bold text-xs py-3.5 hover:bg-copper-hover disabled:opacity-50 transition-colors uppercase"
          >
            Submit Sealed Bid On-Chain →
          </button>
        </div>
      </div>

      {/* Confirmation Modal */}
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
