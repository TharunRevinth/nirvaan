import React from 'react';
import { useParams, Link } from 'react-router-dom';
import ChainOfCustodyTimeline from '../components/ChainOfCustodyTimeline';
import { useAuth } from '../context/AuthContext';
import { isTenderDeadlineOver } from '../utils/tenderUtils';

export default function TenderDetail({ tenders }) {
  const { id } = useParams();
  const { walletAddress, officerUser } = useAuth();
  
  const tender = tenders.find(t => String(t.id) === String(id) || String(t.onChainId) === String(id));
  if (!tender) {
    return (
      <div id="main-content" className="max-w-xl mx-auto py-12 text-center space-y-4">
        <h2 className="text-lg font-bold text-[#1A1A18]">Tender Not Found</h2>
        <p className="text-xs text-[#71716D]">No tender matching reference "{id}" exists in the consortium registry.</p>
        <Link to="/tenders" className="inline-block bg-[#A13D2B] text-white text-xs font-semibold px-4 py-2 rounded-lg">
          Back to Tender Register
        </Link>
      </div>
    );
  }
  const isDeadlineOver = isTenderDeadlineOver(tender);

  const winningVendorAddress = tender.winnerAddress || tender.winner || '';
  const isWinningVendor = Boolean(
    walletAddress && 
    winningVendorAddress && 
    walletAddress.toLowerCase() === winningVendorAddress.toLowerCase() && 
    tender.status === 'AWARDED'
  );

  return (
    <div id="main-content" className="space-y-6">
      {/* Header */}
      <div className="border-b border-[#E8E6E1] pb-5 flex flex-col md:flex-row justify-between md:items-end gap-4">
        <div className="space-y-1">
          <span className="text-[11px] font-mono font-semibold uppercase text-[#71716D] tracking-wider">
            Tender Specification &amp; Custody Ledger • {tender.id}
          </span>
          <h1 className="text-2xl font-bold text-[#1A1A18] tracking-tight">
            {tender.title}
          </h1>
          <p className="text-xs text-[#575753]">
            Issued by <strong className="text-[#1A1A18]">{tender.psu}</strong> — Ministry of Petroleum &amp; Natural Gas Procurement Cell
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Hide Dispute option for winning vendor */}
          {isWinningVendor ? (
            <span className="bg-emerald-50 text-emerald-800 text-xs font-mono font-medium px-3 py-1.5 rounded-lg border border-emerald-200">
              Awarded to Your Entity — Dispute Ineligible
            </span>
          ) : (
            !officerUser && (
              <Link
                to="/vendor/dispute"
                className="border border-[#E8E6E1] bg-white text-[#575753] hover:text-[#1A1A18] hover:bg-[#FAFAF9] font-medium text-xs px-3.5 py-2 rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-[#A13D2B] focus-visible:outline-none"
              >
                File CVC Dispute / Appeal
              </Link>
            )
          )}

          {!officerUser && !isDeadlineOver && !tender.isExpired && (
            <Link
              to="/vendor/submit-bid"
              className="bg-[#A13D2B] hover:bg-[#8A3323] text-white font-semibold text-xs px-4 py-2 rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-[#A13D2B] focus-visible:outline-none"
            >
              Submit Sealed Bid →
            </Link>
          )}

          {!officerUser && (isDeadlineOver || tender.isExpired) && tender.status !== 'AWARDED' && (
            <span className="bg-amber-50 text-amber-900 border border-amber-200 text-xs font-mono font-medium px-3.5 py-2 rounded-lg">
              Bidding Closed • Under Evaluation
            </span>
          )}

          {officerUser && (
            <Link
              to={`/psu/evaluation?tender=${tender.id}`}
              className="bg-[#A13D2B] hover:bg-[#8A3323] text-white font-semibold text-xs px-4 py-2 rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-[#A13D2B] focus-visible:outline-none"
            >
              Evaluation &amp; Award Console →
            </Link>
          )}
        </div>
      </div>

      {/* Signature Element: Chain of Custody Timeline */}
      <ChainOfCustodyTimeline 
        currentStage={tender.status === 'AWARDED' ? 4 : (isDeadlineOver || tender.isExpired) ? 3 : 1} 
      />

      {/* Official Contract Award & Winner Announcement (L1 Determination) */}
      {tender.status === 'AWARDED' && (
        <div className="bg-emerald-50/60 border border-emerald-300/80 rounded-xl p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-emerald-200 pb-3">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 animate-pulse"></span>
              <span className="font-mono text-xs font-bold uppercase tracking-wider text-emerald-950">
                Official Contract Award Notice • L1 Sovereign Procurement Determination
              </span>
            </div>
            <span className="text-[11px] font-mono font-semibold px-2.5 py-1 rounded bg-emerald-100 text-emerald-900 border border-emerald-300 shrink-0">
              Statutory 7-Day Standstill Active
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            <div className="bg-white p-3.5 rounded-lg border border-emerald-200/80 shadow-2xs">
              <span className="text-[#71716D] block text-[11px] font-medium">Selected L1 Winner:</span>
              <span className="font-bold text-[#1A1A18] text-sm block mt-0.5">
                {tender.winner || 'Award Recorded On-Chain'}
              </span>
              <span className="text-[10px] font-mono text-[#71716D] block mt-0.5">
                VID: {tender.winnerVid || (tender.winnerAddress ? tender.winnerAddress.substring(0, 10) + '…' : 'N/A')} • Escrow: VERIFIED
              </span>
            </div>

            <div className="bg-white p-3.5 rounded-lg border border-emerald-200/80 shadow-2xs">
              <span className="text-[#71716D] block text-[11px] font-medium">Winning Commercial Quote:</span>
              <span className="font-mono text-base font-bold text-emerald-800 block mt-0.5 tabular-nums">
                {tender.winningAmount || (tender.lowestBid ? `${tender.lowestBid} ETH` : 'Awarded')}
              </span>
              <span className="text-[10px] text-[#71716D] block mt-0.5">
                Rank: L1 (Lowest Responsive Bidder)
              </span>
            </div>

            <div className="bg-white p-3.5 rounded-lg border border-emerald-200/80 shadow-2xs">
              <span className="text-[#71716D] block text-[11px] font-medium">Technical Compliance:</span>
              <span className="font-mono text-base font-bold text-[#1A1A18] block mt-0.5">
                {tender.complianceScore || 'Qualified'} <span className="text-xs font-normal text-emerald-700">✓ Qualified</span>
              </span>
              <span className="text-[10px] text-[#71716D] block mt-0.5">
                Timeline: {tender.deliveryTimeline || 'Per NIT Terms'}
              </span>
            </div>

            <div className="bg-white p-3.5 rounded-lg border border-emerald-200/80 shadow-2xs">
              <span className="text-[#71716D] block text-[11px] font-medium">On-Chain Award Hash:</span>
              <span className="font-mono text-[11px] font-semibold text-[#1A1A18] block mt-0.5 truncate" title={tender.awardTxHash || 'Recorded on Blockchain'}>
                {tender.awardTxHash ? `${tender.awardTxHash.substring(0, 16)}…` : 'Recorded on Blockchain'}
              </span>
              <span className="text-[10px] font-mono text-emerald-800 block mt-0.5">
                {tender.awardBlock || 'Consortium Block'} • Mined on Consortium
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Metadata Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-white border border-[#E8E6E1] rounded-xl p-6 space-y-4 shadow-xs">
          <h2 className="font-semibold text-xs text-[#1A1A18] uppercase tracking-wider border-b border-[#E8E6E1] pb-2">
            Technical Specification &amp; Scope of Work
          </h2>

          <p className="text-xs text-[#575753] leading-relaxed">
            {tender.desc || 'No detailed scope description provided.'}
          </p>

          <div className="space-y-2 pt-2">
            <h3 className="font-semibold text-xs text-[#1A1A18]">IPFS Specification Dossier</h3>
            <div className="bg-[#FAFAF9] p-3.5 rounded-lg border border-[#E8E6E1] text-xs font-mono space-y-1.5 tabular-nums">
              <div className="break-all text-[#575753]">
                IPFS CID: <span className="text-[#1A1A18] font-bold">{tender.cid || 'Not Anchored'}</span>
              </div>
              <div className="text-[#71716D]">
                Document: <span className="text-[#1A1A18] font-medium">technical_specifications_v2.4.pdf</span> (4.8 MB)
              </div>
              <div className="text-emerald-700 font-medium flex items-center gap-1.5 text-[11px]">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                <span>Cryptographic Digest Verified (Keccak-256)</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white border border-[#E8E6E1] rounded-xl p-6 space-y-4 shadow-xs">
          <h2 className="font-semibold text-xs text-[#1A1A18] uppercase tracking-wider border-b border-[#E8E6E1] pb-2">
            Statutory Parameters
          </h2>

          <div className="space-y-3.5 text-xs">
            <div>
              <span className="text-[#71716D] block">Estimated Value:</span>
              <span className="font-mono text-base font-bold text-[#1A1A18] tabular-nums">₹ {tender.valueCr} Crores</span>
            </div>

            <div>
              <span className="text-[#71716D] block">Earnest Money Deposit (EMD):</span>
              <span className="font-mono text-xs font-semibold text-[#1A1A18] tabular-nums">{tender.emd || '500,000 INR (0.1 ETH)'}</span>
            </div>

            <div>
              <span className="text-[#71716D] block">Submission Deadline:</span>
              <span className="font-mono font-medium text-[#1A1A18] tabular-nums">{tender.deadline}</span>
            </div>

            <div>
              <span className="text-[#71716D] block">Dispute Window Status:</span>
              <span className={`font-mono text-[11px] font-medium px-2 py-0.5 rounded border inline-block mt-1 ${
                tender.appealWindowClosed 
                  ? 'bg-[#FAFAF9] text-[#71716D] border-[#E8E6E1]' 
                  : 'bg-emerald-50 text-emerald-800 border-emerald-200'
              }`}>
                {tender.appealWindowClosed ? 'APPEAL WINDOW CLOSED' : 'APPEALS OPEN (7-DAY STANDSTILL)'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
