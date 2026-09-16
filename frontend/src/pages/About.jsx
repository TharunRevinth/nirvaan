import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function About() {
  const navigate = useNavigate();

  const psus = [
    { name: 'Indian Oil Corporation Ltd (IOCL)', role: 'Refining, Pipeline & Petrochemical Procurement', active: '42 Tenders', value: '₹ 94,200 Cr' },
    { name: 'Oil and Natural Gas Corporation (ONGC)', role: 'Offshore Exploration & Deepwater Drilling', active: '38 Tenders', value: '₹ 1,12,000 Cr' },
    { name: 'Bharat Petroleum Corporation Ltd (BPCL)', role: 'Refineries, Marketing & Green Energy', active: '26 Tenders', value: '₹ 38,500 Cr' },
    { name: 'Hindustan Petroleum Corporation Ltd (HPCL)', role: 'Lube Base Oils & Process Facility Upgrades', active: '21 Tenders', value: '₹ 22,800 Cr' },
    { name: 'GAIL (India) Ltd', role: 'National Gas Pipeline Grid & Cryogenic LNG', active: '15 Tenders', value: '₹ 17,000 Cr' }
  ];

  return (
    <div id="main-content" className="max-w-4xl mx-auto py-8 px-4 space-y-10">
      {/* Header */}
      <div className="border-b border-[#E8E6E1] pb-6 space-y-2">
        <span className="text-[11px] font-mono font-semibold uppercase text-[#71716D] tracking-wider">
          Platform Architecture &amp; Governance
        </span>
        <h1 className="text-2xl sm:text-3xl font-bold text-[#1A1A18] tracking-tight">
          About NIRVAAN
        </h1>
        <p className="text-sm text-[#575753] leading-relaxed max-w-2xl">
          National Indelible Record &amp; Verification Architecture for Autonomous Negotiation. A unified enterprise e-tendering platform designed for Indian Oil PSUs under Central Vigilance Commission (CVC) oversight.
        </p>
      </div>

      {/* Core Objectives */}
      <section className="space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-[#1A1A18]">
          Core Architecture &amp; Security Principles
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white border border-[#E8E6E1] rounded-xl p-5 space-y-2">
            <h3 className="font-semibold text-sm text-[#1A1A18]">Client-Side Sealed Bidding</h3>
            <p className="text-xs text-[#575753] leading-relaxed">
              Numerical commercial bids are salted and encrypted client-side using Solidity Keccak-256 before broadcast. Plaintext bid amounts remain completely secret until the official reveal window, eliminating pre-opening price leaks.
            </p>
          </div>

          <div className="bg-white border border-[#E8E6E1] rounded-xl p-5 space-y-2">
            <h3 className="font-semibold text-sm text-[#1A1A18]">Zero-Gas Besu QBFT Consensus</h3>
            <p className="text-xs text-[#575753] leading-relaxed">
              Operates on an enterprise Hyperledger Besu consortium blockchain with QBFT consensus across 7 validator nodes (5 PSUs, 1 CVC audit node, 1 Ministry node), ensuring zero gas fees and instant block finality.
            </p>
          </div>

          <div className="bg-white border border-[#E8E6E1] rounded-xl p-5 space-y-2">
            <h3 className="font-semibold text-sm text-[#1A1A18]">Statutory 7-Day Dispute Window</h3>
            <p className="text-xs text-[#575753] leading-relaxed">
              Every contract award undergoes a mandatory 7-day standstill hold. Aggrieved bidders may file formal appeals backed by a refundable escrow bond, automatically triggering an independent CVC auditor review.
            </p>
          </div>

          <div className="bg-white border border-[#E8E6E1] rounded-xl p-5 space-y-2">
            <h3 className="font-semibold text-sm text-[#1A1A18]">IPFS Technical Dossier Anchoring</h3>
            <p className="text-xs text-[#575753] leading-relaxed">
              All tender specifications, engineering drawings, and vendor KYC records are stored in content-addressed IPFS Kubo storage with immutable cryptographic CIDs recorded directly on-chain.
            </p>
          </div>
        </div>
      </section>

      {/* Consortium Members */}
      <section className="space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-[#1A1A18]">
          Consortium Member Corporations
        </h2>
        <div className="bg-white border border-[#E8E6E1] rounded-xl divide-y divide-[#E8E6E1]">
          {psus.map((psu) => (
            <div key={psu.name} className="p-4 flex flex-col sm:flex-row justify-between sm:items-center gap-2">
              <div>
                <h4 className="text-xs font-bold text-[#1A1A18]">{psu.name}</h4>
                <p className="text-[11px] text-[#71716D]">{psu.role}</p>
              </div>
              <div className="text-left sm:text-right text-xs font-mono text-[#575753] shrink-0">
                <span className="font-bold text-[#1A1A18]">{psu.active}</span>
                <span className="text-[#71716D] ml-2">({psu.value})</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Back to Login Action */}
      <div className="pt-4 border-t border-[#E8E6E1] flex justify-between items-center">
        <span className="text-xs text-[#71716D]">
          Ready to participate in procurement?
        </span>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="bg-[#A13D2B] hover:bg-[#8A3323] text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-[#A13D2B] focus-visible:outline-none"
        >
          Go to Sign In →
        </button>
      </div>
    </div>
  );
}
