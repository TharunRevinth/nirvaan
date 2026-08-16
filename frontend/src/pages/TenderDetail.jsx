import React from 'react';
import { useParams, Link } from 'react-router-dom';
import ChainOfCustodyTimeline from '../components/ChainOfCustodyTimeline';

export default function TenderDetail({ tenders }) {
  const { id } = useParams();
  const tender = tenders.find(t => t.id === id) || tenders[0];

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
        <div className="flex gap-3">
          <Link
            to="/dispute"
            className="border border-red-700 text-red-800 font-bold text-xs px-4 py-2 hover:bg-red-50 transition-colors"
          >
            File CVC Dispute / Appeal
          </Link>
          <Link
            to="/submit-bid"
            className="bg-copper text-white font-bold text-xs px-4 py-2 hover:bg-copper-hover transition-colors"
          >
            Submit Sealed Bid →
          </Link>
        </div>
      </div>

      {/* Signature Element: Chain of Custody Timeline */}
      <ChainOfCustodyTimeline currentStage={3} />

      {/* Tender Metadata & Specifications Grid */}
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
              <div>IPFS Hash (CID): <span className="text-copper font-bold">{tender.cid || 'QmYwAPJzv5CZsnA625s3Xf2sm5DyaRtPu8...1A2B'}</span></div>
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
              <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 border border-emerald-200 inline-block mt-0.5">
                NO ACTIVE DISPUTES
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
