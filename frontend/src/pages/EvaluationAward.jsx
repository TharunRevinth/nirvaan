import React, { useState } from 'react';
import ConfirmationModal from '../components/ConfirmationModal';

export default function EvaluationAward({ triggerToast, selectedPSU }) {
  const [bids, setBids] = useState([
    { rank: 'L1', vendor: 'Reliance Offshore Logistics Ltd.', vid: 'RIL-4492-X', qualified: false, hash: '0x8f2a...9b4e1c2d3f4a5b6c7d8e9f0a1b2c3d4e', amount: '₹ 45,20,00,000' },
    { rank: 'L2', vendor: 'Larsen & Toubro Heavy Eng.', vid: 'LT-8821-Y', qualified: true, hash: '0x3c1b...4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a', amount: '₹ 46,85,50,000' },
    { rank: 'L3', vendor: 'Tata Projects Infrastructure', vid: 'TP-1102-Z', qualified: false, hash: '0x7d9f...1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d', amount: '₹ 48,00,00,000' }
  ]);

  const [modalOpen, setModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const toggleQualify = (idx) => {
    const updated = [...bids];
    updated[idx].qualified = !updated[idx].qualified;
    setBids(updated);
    triggerToast(`Technical qualification updated for ${updated[idx].vendor}`, 'success');
  };

  const handleAwardConfirm = () => {
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setModalOpen(false);
      triggerToast(`Contract awarded to L1 Bidder (${bids[0].vendor}). 7-day dispute appeal window opened on-chain.`, 'success');
    }, 1800);
  };

  return (
    <div id="main-content" className="max-w-5xl mx-auto space-y-6">
      <div className="border-b border-graphite/15 pb-4 flex justify-between items-end">
        <div>
          <span className="text-xs font-mono text-slate bg-slate/10 px-2 py-0.5 border border-slate/20">
            EVALUATION CONSOLE // {selectedPSU} CELL
          </span>
          <h1 className="text-2xl font-bold text-graphite uppercase tracking-tight mt-2">
            Revealed Bids Evaluation & Award Finalization
          </h1>
          <p className="text-xs text-graphite/70 mt-1">
            Tender Ref: TND-24-9982-A (Supply of Offshore Pipeline Valves & Actuators)
          </p>
        </div>
        <div className="text-right font-mono text-xs text-slate">
          <div>Status: <span className="font-bold text-copper">BIDS REVEALED</span></div>
          <div>Mode: <span className="text-graphite font-bold">L1 Evaluation</span></div>
        </div>
      </div>

      {/* Revealed Bids Grid Table */}
      <div className="bg-white border border-graphite/15 overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead className="bg-graphite text-white text-xs font-mono tracking-wider border-b border-graphite/20">
            <tr>
              <th className="p-3 w-12 text-center">RANK</th>
              <th className="p-3">BIDDER IDENTITY</th>
              <th className="p-3 w-44 text-center">TECH QUALIFICATION</th>
              <th className="p-3 font-mono w-64">COMMITMENT HASH</th>
              <th className="p-3 text-right w-44">BID AMOUNT (INR)</th>
            </tr>
          </thead>
          <tbody className="text-xs text-graphite">
            {bids.map((b, idx) => (
              <tr key={idx} className="border-b border-graphite/15 hover:bg-offwhite transition-colors">
                <td className="p-3 font-mono text-center font-bold text-slate bg-offwhite/50">{b.rank}</td>
                <td className="p-3">
                  <div className="font-bold text-graphite">{b.vendor}</div>
                  <div className="font-mono text-[11px] text-graphite/60">VID: {b.vid}</div>
                </td>
                <td className="p-3 text-center">
                  <button
                    onClick={() => toggleQualify(idx)}
                    className={`px-3 py-1 text-xs font-bold border transition-colors ${
                      b.qualified 
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300' 
                        : 'bg-amber/10 text-amber border-amber/30 hover:bg-amber/20'
                    }`}
                  >
                    {b.qualified ? '✓ QUALIFIED' : '⏳ PENDING'}
                  </button>
                </td>
                <td className="p-3 font-mono text-[11px] text-graphite/70 break-all">{b.hash}</td>
                <td className="p-3 font-mono text-right font-bold text-graphite">{b.amount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Finalize Award Box */}
      <div className="bg-white border border-graphite/15 p-6 flex flex-col items-center justify-center text-center space-y-4">
        <h3 className="font-bold text-sm text-graphite uppercase tracking-wide">
          Finalize Contract Award
        </h3>
        <p className="text-xs text-graphite/70 max-w-md">
          Ensure technical qualification is verified for the L1 bidder before signing contract award on-chain.
        </p>

        <button
          onClick={() => setModalOpen(true)}
          disabled={!bids[0].qualified}
          className="bg-copper text-white font-bold text-xs px-8 py-3.5 hover:bg-copper-hover disabled:opacity-50 transition-colors uppercase flex items-center gap-2"
        >
          <span>🔒</span> Award Contract to L1 Bidder On-Chain
        </button>

        {!bids[0].qualified && (
          <div className="font-mono text-[11px] text-red-700 font-semibold bg-red-50 p-2 border border-red-200">
            Notice: Technical qualification is pending for L1. Click "PENDING" in the table above to verify qualification before proceeding.
          </div>
        )}
      </div>

      <ConfirmationModal
        isOpen={modalOpen}
        title="Confirm Contract Award Execution"
        message={`Are you sure you want to award the contract for TND-24-9982-A to L1 Bidder (${bids[0].vendor})? This will trigger an immutable on-chain state update.`}
        onConfirm={handleAwardConfirm}
        onCancel={() => setModalOpen(false)}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}
