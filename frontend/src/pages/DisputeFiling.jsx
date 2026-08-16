import React, { useState } from 'react';
import ConfirmationModal from '../components/ConfirmationModal';

export default function DisputeFiling({ triggerToast }) {
  const [tenderRef, setTenderRef] = useState('TND-24-9982-A');
  const [reason, setReason] = useState('Technical Specification Exclusion');
  const [description, setDescription] = useState('');
  const [bondAmount, setBondAmount] = useState('100,000');
  const [modalOpen, setModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = () => {
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setModalOpen(false);
      triggerToast(`Formal Dispute filed on-chain for ${tenderRef}. Dispute Bond of ₹${bondAmount} locked in escrow smart contract.`, 'success');
    }, 1800);
  };

  return (
    <div id="main-content" className="max-w-3xl mx-auto space-y-6">
      <div className="border-b border-graphite/15 pb-4 flex justify-between items-end">
        <div>
          <span className="text-xs font-mono text-slate bg-slate/10 px-2 py-0.5 border border-slate/20">
            CVC GRIEVANCE REDRESSAL // CONTRACT DISPUTE FORM
          </span>
          <h1 className="text-2xl font-bold text-graphite uppercase tracking-tight mt-2">
            File Statutory Tender Dispute / Appeal
          </h1>
          <p className="text-xs text-graphite/70 mt-1">
            Pursuant to Central Vigilance Commission (CVC) Procurement Guidelines 2026.
          </p>
        </div>
        <div className="text-right">
          <div className="text-[10px] font-bold text-slate uppercase">Appeal Window Remaining:</div>
          <div className="font-mono text-sm font-bold text-amber amber-flash">⏳ 06 Days 14 Hours</div>
        </div>
      </div>

      <div className="bg-white border-l-4 border-copper p-4 text-xs space-y-1.5 hairline-border">
        <h3 className="font-bold text-graphite uppercase">Dispute Mechanism Notice</h3>
        <p className="text-graphite/80 leading-relaxed">
          Filing a formal dispute triggers an automated 7-day hold on tender finalization on the smart contract. A mandatory Dispute Bond of ₹1,00,000 must be locked in the CVC Resolution Escrow. Frivolous disputes will result in bond forfeiture.
        </p>
      </div>

      <div className="bg-white border border-graphite/15 p-6 space-y-6">
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-graphite">TARGET TENDER REFERENCE ID *</label>
              <input
                type="text"
                required
                value={tenderRef}
                onChange={(e) => setTenderRef(e.target.value)}
                className="w-full bg-offwhite border border-graphite/30 p-2.5 text-xs font-mono text-graphite"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-graphite">DISPUTE GROUND / CATEGORY *</label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full bg-offwhite border border-graphite/30 p-2.5 text-xs text-graphite font-medium cursor-pointer"
              >
                <option value="Technical Specification Exclusion">Technical Specification Exclusion</option>
                <option value="Unfair Evaluation / L1 Calculation Mismatch">Unfair Evaluation / L1 Calculation Mismatch</option>
                <option value="Procedural Deadline Irregularity">Procedural Deadline Irregularity</option>
                <option value="Bid Opening Collusion Suspicions">Bid Opening Collusion Suspicions</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-graphite">DETAILED FACTUAL GROUNDS FOR APPEAL *</label>
            <textarea
              required
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="State precise technical or procedural clauses breached..."
              className="w-full bg-offwhite border border-graphite/30 p-2.5 text-xs text-graphite"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-graphite">SUPPORTING EVIDENTIARY DOSSIER (PDF)</label>
            <div className="border border-dashed border-graphite/30 bg-offwhite p-4 text-center">
              <p className="text-xs text-graphite">Drag & drop signed representation dossier here</p>
            </div>
          </div>

          <div className="bg-offwhite p-4 border border-graphite/15 flex justify-between items-center text-xs">
            <div>
              <span className="font-bold text-graphite block">Mandatory Dispute Bond Escrow:</span>
              <span className="text-slate text-[11px]">Refundable if dispute is upheld by CVC Auditor Node</span>
            </div>
            <span className="font-mono text-base font-bold text-copper">₹ {bondAmount} INR</span>
          </div>
        </div>

        <div className="pt-4 border-t border-graphite/15 flex justify-end">
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            disabled={!description}
            className="bg-copper text-white font-bold text-xs px-6 py-3 hover:bg-copper-hover disabled:opacity-50 transition-colors uppercase"
          >
            File Dispute & Lock Bond On-Chain →
          </button>
        </div>
      </div>

      <ConfirmationModal
        isOpen={modalOpen}
        title="Confirm Statutory Dispute Filing"
        message={`Are you sure you want to file a formal dispute against ${tenderRef} and lock ₹${bondAmount} in smart contract escrow?`}
        onConfirm={handleSubmit}
        onCancel={() => setModalOpen(false)}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}
