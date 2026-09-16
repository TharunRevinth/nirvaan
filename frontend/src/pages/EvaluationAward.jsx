import React, { useState } from 'react';
import ConfirmationModal from '../components/ConfirmationModal';

export default function EvaluationAward({ triggerToast, selectedPSU = 'IOCL', tenders = [], setTenders }) {
  const currentTender = tenders.find(t => t.id === 'TND-24-9982-A') || tenders[0];
  const [isAwarded, setIsAwarded] = useState(currentTender?.status === 'AWARDED');
  const [awardData, setAwardData] = useState(currentTender ? {
    txHash: currentTender.awardTxHash,
    blockNumber: currentTender.awardBlock
  } : null);

  const [bids, setBids] = useState([
    { 
      rank: 'L1', 
      vendor: 'Reliance Offshore Logistics Ltd.', 
      vid: 'RIL-4492-X', 
      qualified: currentTender?.status === 'AWARDED' || false, 
      hash: '0x8f2a71d8e903bc10294e1c2d3f4a5b6c7d8e9f0a1b2c3d4e8927189fa9b4e1c2', 
      amount: '₹ 45,20,00,000',
      complianceScore: '99.4%',
      deliveryTimeline: '14 Months',
      escrowBondStatus: 'VERIFIED'
    },
    { 
      rank: 'L2', 
      vendor: 'Larsen & Toubro Heavy Eng.', 
      vid: 'LT-8821-Y', 
      qualified: true, 
      hash: '0x3c1b899a1738d01f94d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a018274619b02716', 
      amount: '₹ 46,85,50,000',
      complianceScore: '98.8%',
      deliveryTimeline: '16 Months',
      escrowBondStatus: 'VERIFIED'
    },
    { 
      rank: 'L3', 
      vendor: 'Tata Projects Infrastructure', 
      vid: 'TP-1102-Z', 
      qualified: false, 
      hash: '0x7d9f2140a83e09181a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d9018471649201948', 
      amount: '₹ 48,00,00,000',
      complianceScore: '97.2%',
      deliveryTimeline: '18 Months',
      escrowBondStatus: 'VERIFIED'
    }
  ]);

  const [modalOpen, setModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const toggleQualify = (idx) => {
    if (isAwarded) {
      triggerToast('Tender is already awarded. Qualifications are locked on-chain.', 'warning');
      return;
    }
    const updated = [...bids];
    updated[idx].qualified = !updated[idx].qualified;
    setBids(updated);
    const newStatus = updated[idx].qualified ? 'Qualified' : 'Pending Verification';
    triggerToast(`${updated[idx].vendor} technical status set to: ${newStatus}`, 'info');
  };

  const handleAwardConfirm = async () => {
    setIsSubmitting(true);
    try {
      const token = localStorage.getItem('officer_token');
      const winnerAddress = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';

      const res = await fetch('http://localhost:5000/api/tenders/1/award', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          winner: winnerAddress,
          winningBidId: 1,
          winningBidAmount: "45.2"
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Contract award failed on server.');
      }

      setIsSubmitting(false);
      setModalOpen(false);
      setIsAwarded(true);
      setAwardData(data);

      if (setTenders) {
        setTenders(prev => prev.map(t => t.id === 'TND-24-9982-A' ? {
          ...t,
          status: 'AWARDED',
          winner: bids[0].vendor,
          winnerVid: bids[0].vid,
          winnerAddress: winnerAddress,
          winningAmount: bids[0].amount,
          awardTxHash: data.txHash,
          awardBlock: `Block #${data.blockNumber || 142950}`,
          complianceScore: bids[0].complianceScore,
          deliveryTimeline: bids[0].deliveryTimeline
        } : t));
      }

      triggerToast(`Contract awarded to L1 Bidder (${bids[0].vendor}). Tx: ${data.txHash.substring(0, 18)}…`, 'success');
    } catch (err) {
      setIsSubmitting(false);
      setModalOpen(false);
      console.error("Contract award error:", err);
      triggerToast(err.message, 'error');
    }
  };

  const isL1Qualified = bids[0].qualified;

  return (
    <div id="main-content" className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="border-b border-[#E8E6E1] pb-4 flex flex-col md:flex-row justify-between md:items-end gap-3">
        <div className="space-y-1">
          <span className="text-[11px] font-mono font-semibold uppercase text-[#71716D] tracking-wider">
            Evaluation Console • {selectedPSU} Cell
          </span>
          <h1 className="text-2xl font-bold text-[#1A1A18] tracking-tight">
            Revealed Bids Evaluation &amp; Award
          </h1>
          <p className="text-xs text-[#575753]">
            Tender Ref: <span className="font-mono font-semibold text-[#1A1A18]">TND-24-9982-A</span> • Offshore Pipeline Valves &amp; Actuators
          </p>
        </div>

        <div className="text-left sm:text-right font-mono text-xs text-[#71716D] tabular-nums">
          <div>Status: <span className={`font-semibold ${isAwarded ? 'text-emerald-700' : 'text-[#1A1A18]'}`}>{isAwarded ? 'Contract Awarded' : 'Bids Unsealed'}</span></div>
          <div>Consensus: <span className="text-emerald-700 font-semibold">7/7 Nodes Attested</span></div>
        </div>
      </div>

      {/* On-Chain Award Banner */}
      {isAwarded && (
        <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-4 flex flex-col sm:flex-row justify-between sm:items-center gap-3 text-xs shadow-2xs">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 shrink-0"></span>
            <div>
              <strong className="text-emerald-950 font-bold block text-sm">
                Contract Officially Awarded On-Chain to L1 Bidder: {bids[0].vendor}
              </strong>
              <span className="text-[#575753] text-[11px] block mt-0.5">
                Winning Quote: <span className="font-mono font-semibold text-[#1A1A18]">{bids[0].amount}</span> • Tx: <span className="font-mono font-medium text-emerald-900">{awardData?.txHash || '0x6e7b2a9f148c023d5e8901ba72018274619b02716b4e1c2d3f4a5b6c7d8e9f0a'}</span>
              </span>
            </div>
          </div>
          <span className="font-mono text-emerald-900 bg-emerald-100 border border-emerald-300 px-3 py-1 rounded text-[11px] font-semibold shrink-0">
            7-Day CVC Standstill Active
          </span>
        </div>
      )}

      {/* Evaluation Matrix Table */}
      <div className="bg-white border border-[#E8E6E1] rounded-xl overflow-hidden shadow-xs">
        <div className="p-4 border-b border-[#E8E6E1] flex justify-between items-center bg-[#FAFAF9]">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[#1A1A18]">
              Decrypted Commercial Bids
            </h2>
            <p className="text-[11px] text-[#71716D]">
              Evaluated under L1 least-cost sovereign procurement method. Review &amp; verify technical qualifications below.
            </p>
          </div>
          <span className="text-xs font-mono text-[#575753] bg-white border border-[#E8E6E1] px-2.5 py-1 rounded">
            3 Bids Unsealed
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#E8E6E1] bg-[#FAFAF9] text-[11px] font-semibold text-[#71716D] uppercase tracking-wider">
                <th scope="col" className="p-3.5 w-12 text-center">Rank</th>
                <th scope="col" className="p-3.5">Commercial Bidder</th>
                <th scope="col" className="p-3.5 text-center">Qualification Action</th>
                <th scope="col" className="p-3.5">Compliance</th>
                <th scope="col" className="p-3.5 font-mono">Commitment Hash</th>
                <th scope="col" className="p-3.5 text-right">Commercial Quote</th>
              </tr>
            </thead>
            <tbody className="text-xs text-[#1A1A18] divide-y divide-[#E8E6E1]">
              {bids.map((b, idx) => {
                const isL1 = b.rank === 'L1';
                return (
                  <tr key={idx} className={isL1 ? 'bg-[#FAFAF9]' : 'hover:bg-[#FAFAF9] transition-colors'}>
                    <td className="p-3.5 text-center font-bold font-mono text-[#1A1A18]">
                      {b.rank}
                    </td>
                    <td className="p-3.5">
                      <div className="font-semibold text-[#1A1A18] flex items-center gap-2">
                        {b.vendor}
                        {isL1 && (
                          <span className="px-2 py-0.5 text-[10px] font-mono uppercase rounded bg-[#A13D2B]/10 text-[#A13D2B] font-semibold">
                            L1 Lowest
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-[#71716D] font-mono">
                        VID: {b.vid} • Escrow: {b.escrowBondStatus}
                      </div>
                    </td>
                    <td className="p-3.5 text-center">
                      <button
                        type="button"
                        onClick={() => toggleQualify(idx)}
                        aria-label={`Toggle qualification status for ${b.vendor}. Current status: ${b.qualified ? 'Qualified' : 'Pending Verification'}`}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border flex items-center justify-center gap-1.5 mx-auto focus-visible:ring-2 focus-visible:ring-[#A13D2B] focus-visible:outline-none cursor-pointer ${
                          b.qualified 
                            ? 'bg-emerald-50 text-emerald-900 border-emerald-300 hover:bg-emerald-100 shadow-xs' 
                            : 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100 shadow-xs ring-1 ring-amber-400/30'
                        }`}
                      >
                        <span>{b.qualified ? '✓ Qualified' : '⏳ Verify Qualification'}</span>
                        <span className="text-[10px] text-[#71716D] font-normal font-mono">(Click to toggle)</span>
                      </button>
                    </td>
                    <td className="p-3.5">
                      <div className="font-mono font-medium text-[#1A1A18]">{b.complianceScore}</div>
                      <div className="text-[10px] text-[#71716D]">Timeline: {b.deliveryTimeline}</div>
                    </td>
                    <td className="p-3.5 font-mono text-[11px] text-[#71716D]">
                      <div className="truncate max-w-[140px]" title={b.hash}>
                        {b.hash.substring(0, 8)}…{b.hash.substring(b.hash.length - 6)}
                      </div>
                    </td>
                    <td className="p-3.5 text-right font-mono font-bold text-[#1A1A18] tabular-nums">
                      {b.amount}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Award Action Section */}
      <div className="bg-white border border-[#E8E6E1] rounded-xl p-6 text-center space-y-4 shadow-xs">
        <div className="space-y-1 max-w-lg mx-auto">
          <h2 className="text-sm font-semibold text-[#1A1A18]">
            Finalize Contract Award
          </h2>
          <p className="text-xs text-[#575753] leading-relaxed">
            Verify technical qualification for L1 bidder (<span className="font-semibold text-[#1A1A18]">{bids[0].vendor}</span>). Awarding executes an on-chain state transition to <span className="font-mono font-semibold">AWARDED</span> and initiates the 7-day standstill hold.
          </p>
        </div>

        <div className="flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            disabled={!isL1Qualified}
            aria-disabled={!isL1Qualified}
            className={`font-semibold text-xs px-6 py-2.5 rounded-lg transition-all focus-visible:ring-2 focus-visible:ring-[#A13D2B] focus-visible:outline-none flex items-center gap-2 ${
              isL1Qualified
                ? 'bg-[#A13D2B] hover:bg-[#8A3323] text-white shadow-xs cursor-pointer'
                : 'bg-[#E8E6E1] text-[#71716D] border border-[#E8E6E1] cursor-not-allowed shadow-none'
            }`}
          >
            <span>Award Contract to L1 Bidder On-Chain →</span>
          </button>

          {!isL1Qualified ? (
            <div className="bg-[#FFF9F2] border border-[#F3DFC1] rounded-lg p-3 text-xs text-[#7A4510] max-w-md flex flex-col sm:flex-row items-center justify-between gap-2 text-left">
              <span>
                <strong>Qualification Required:</strong> L1 Bidder ({bids[0].vendor}) must be qualified before award.
              </span>
              <button
                type="button"
                onClick={() => toggleQualify(0)}
                className="bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 px-3 py-1 rounded text-xs font-semibold shrink-0 cursor-pointer transition-colors"
              >
                Verify L1 Now
              </button>
            </div>
          ) : (
            <span className="text-xs text-emerald-800 font-medium flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
              L1 Bidder technical qualifications verified. Ready to execute on-chain award.
            </span>
          )}
        </div>
      </div>

      <ConfirmationModal
        isOpen={modalOpen}
        title="Confirm Contract Award Execution"
        message={`Are you sure you want to award the contract for TND-24-9982-A to L1 Bidder (${bids[0].vendor})? This will trigger an immutable on-chain record.`}
        onConfirm={handleAwardConfirm}
        onCancel={() => setModalOpen(false)}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}
