import React from 'react';
import { useParams, Link } from 'react-router-dom';
import ChainOfCustodyTimeline from '../components/ChainOfCustodyTimeline';
import { useAuth } from '../context/AuthContext';

export default function TenderDetail({ tenders }) {
  const { id } = useParams();
  const { walletAddress, officerUser } = useAuth();
  
  const tender = tenders.find(t => t.id === id) || tenders[0];

  // Mock winner check: 0xf17f52151ebef6c7334fad080c5704d77216b732 is Reliance Offshore Ltd
  const winningVendorAddress = '0xf17f52151ebef6c7334fad080c5704d77216b732';
  const isWinningVendor = walletAddress?.toLowerCase() === winningVendorAddress.toLowerCase() && tender.status === 'AWARDED';

  return (
    <div id="main-content" className="space-y-6">
      {/* Header */}
      <div className="border-b border-graphite/15 pb-4 flex justify-between items-end">
        <div>
          <span className="text-xs font-mono text-slate bg-slate/10 px-2 py-0.5 border border-slate/20">
            TENDER SPECIFICATION & CUSTODY LEDGER // {tender.id}
          </span>
          <h1 className="text-2xl font-bold text-graphite uppercase tracking-tight mt-2">
            {tender.title}
          </h1>
          <p className="text-xs text-graphite/70 mt-1">
            Issued by {tender.psu} — Ministry of Petroleum & Natural Gas Procurement Cell
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Hide Dispute option for winning vendor as per acceptance criteria */}
          {isWinningVendor ? (
            <span className="bg-emerald-100 text-emerald-800 text-xs font-mono font-bold px-3 py-1.5 border border-emerald-300">
              🏆 Awarded to Your Entity — Dispute Ineligible
            </span>
          ) : (
            !officerUser && (
              <Link
                to="/vendor/dispute"
                className="border border-red-700 text-red-800 font-bold text-xs px-4 py-2 hover:bg-red-50 transition-colors"
              >
                File CVC Dispute / Appeal
              </Link>
            )
          )}

          {!officerUser && !tender.isExpired && (
            <Link
              to="/vendor/submit-bid"
              className="bg-copper text-white font-bold text-xs px-4 py-2 hover:bg-copper-hover transition-colors"
            >
              Submit Sealed Bid →
            </Link>
          )}

          {officerUser && (
            <Link
              to="/psu/evaluation"
              className="bg-graphite text-white font-bold text-xs px-4 py-2 hover:bg-slate transition-colors font-mono"
            >
              Evaluation & Award Console →
            </Link>
          )}
        </div>
      </div>

      {/* Signature Element: Chain of Custody Timeline */}
      <ChainOfCustodyTimeline 
        currentStage={tender.status === 'AWARDED' ? 4 : tender.isExpired ? 3 : 1} 
      />

      {/* Metadata Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-white border border-graphite/15 p-6 space-y-4">
          <h3 className="font-bold text-sm text-slate uppercase border-b border-graphite/15 pb-2">
            Detailed Technical Specifications
          </h3>

          <p className="text-xs text-graphite leading-relaxed">
            {tender.desc || 'Comprehensive supply and maintenance contract for industrial grade pipelines, actuators, and high-pressure valve fittings. Compliant with Bureau of Indian Standards (BIS) and CVC E-Procurement Directives 2026.'}
          </p>

          <div className="space-y-2 pt-2">
            <h4 className="font-bold text-xs text-graphite">IPFS Network Anchor Dossier:</h4>
            <div className="bg-offwhite p-3 border border-graphite/15 text-xs font-mono space-y-1">
              <div>IPFS Hash (CID): <span className="text-copper font-bold">{tender.cid || 'QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco'}</span></div>
              <div>File Name: <span className="text-graphite">technical_specifications_v2.4.pdf</span> (4.8 MB)</div>
              <div>Digest Verification: <span className="text-emerald-700 font-bold">MATCH (SHA-256)</span></div>
            </div>
          </div>
        </div>

        <div className="bg-white border border-graphite/15 p-6 space-y-4">
          <h3 className="font-bold text-sm text-slate uppercase border-b border-graphite/15 pb-2">
            Statutory Financial Parameters
          </h3>

          <div className="space-y-3 text-xs">
            <div>
              <span className="text-slate block font-semibold">Estimated Contract Value:</span>
              <span className="font-mono text-base font-bold text-graphite">₹ {tender.valueCr} Crores</span>
            </div>

            <div>
              <span className="text-slate block font-semibold">Earnest Money Deposit (EMD):</span>
              <span className="font-mono text-sm font-bold text-copper">₹ {tender.emd || '500,000 INR'}</span>
            </div>

            <div>
              <span className="text-slate block font-semibold">Submission Deadline:</span>
              <span className="font-mono font-bold text-graphite">{tender.deadline}</span>
            </div>

            <div>
              <span className="text-slate block font-semibold">Dispute Resolution Status:</span>
              <span className={`font-mono font-bold px-2 py-0.5 border inline-block mt-0.5 ${
                tender.appealWindowClosed 
                  ? 'bg-slate/10 text-slate border-slate/30' 
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
              }`}>
                {tender.appealWindowClosed ? 'APPEAL WINDOW EXPIRED' : 'NO ACTIVE DISPUTES (APPEAL OPEN)'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
