import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ethers } from 'ethers';
import ChainOfCustodyTimeline from '../components/ChainOfCustodyTimeline';
import { useAuth } from '../context/AuthContext';
import { 
  normalizeTenderStatus, 
  isPostAward, 
  isPreAward,
  formatBlockNumber, 
  formatTenderDate, 
  isTenderDeadlineOver 
} from '../utils/tenderUtils';
import { API_URL } from '../config';

export default function TenderDetail({ tenders = [] }) {
  const { id } = useParams();
  const { walletAddress, officerUser } = useAuth();

  const [tender, setTender] = useState(() => {
    return (tenders || []).find(t => String(t.id) === String(id) || String(t.onChainId) === String(id)) || null;
  });
  const [loading, setLoading] = useState(!tender);

  // Sync if tenders prop updates and local tender is not yet loaded
  useEffect(() => {
    if ((!tender || !tender.status) && tenders && tenders.length > 0) {
      const match = tenders.find(t => String(t.id) === String(id) || String(t.onChainId) === String(id));
      if (match) {
        setTender(match);
        setLoading(false);
      }
    }
  }, [tenders, id, tender]);

  // Fetch canonical tender on mount and whenever window regains focus
  const fetchTenderData = useCallback(async () => {
    if (!id) return;
    try {
      // 1. Try single tender endpoint if numeric ID
      if (/^\d+$/.test(String(id).trim())) {
        const res = await fetch(`${API_URL}/api/tenders/${id}`);
        if (res.ok) {
          const data = await res.json();
          if (data?.tender) {
            setTender(data.tender);
            setLoading(false);
            return;
          }
        }
      }

      // 2. Fetch list from /api/tenders to match by alphanumeric code or onChainId
      const listRes = await fetch(`${API_URL}/api/tenders`);
      if (listRes.ok) {
        const listData = await listRes.json();
        const found = (listData?.tenders || []).find(
          t => String(t.id) === String(id) || String(t.onChainId) === String(id)
        );
        if (found) {
          setTender(found);
          setLoading(false);
          return;
        }
      }
    } catch (err) {
      console.warn('Backend tender sync standby:', err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchTenderData();

    const handleFocus = () => {
      fetchTenderData();
    };

    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [fetchTenderData]);

  if (loading && !tender) {
    return (
      <div id="main-content" className="max-w-xl mx-auto py-12 text-center space-y-4">
        <div className="w-8 h-8 border-2 border-[#A13D2B] border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p className="text-xs text-[#71716D]">Loading verified on-chain tender specification…</p>
      </div>
    );
  }

  if (!tender) {
    return (
      <div id="main-content" className="max-w-xl mx-auto py-12 text-center space-y-4">
        <h2 className="text-lg font-bold text-[#1A1A18]">Tender Not Found</h2>
        <p className="text-xs text-[#71716D]">No tender matching reference "{id}" exists in the procurement registry.</p>
        <Link to="/tenders" className="inline-block bg-[#A13D2B] text-white text-xs font-semibold px-4 py-2 rounded-lg">
          Back to Tender Register
        </Link>
      </div>
    );
  }

  const s = normalizeTenderStatus(tender.status);
  const isAwardCompleted = isPostAward(tender) || Boolean(tender.awardTxHash || tender.winnerAddress || tender.winner);
  const isDeadlineOver = isTenderDeadlineOver(tender);

  // Appeal Window Open/Closed calculation from real appealDeadline
  const now = Date.now();
  let isAppealOpen = false;
  if (tender.appealDeadline) {
    const deadlineMs = new Date(tender.appealDeadline).getTime();
    if (!isNaN(deadlineMs)) {
      isAppealOpen = deadlineMs > now;
    }
  } else if (tender.appealWindowClosed !== undefined) {
    isAppealOpen = !tender.appealWindowClosed;
  }

  const winningVendorAddress = tender.winnerAddress || tender.winner || '';
  const isWinningVendor = Boolean(
    walletAddress && 
    winningVendorAddress && 
    walletAddress.toLowerCase() === winningVendorAddress.toLowerCase() && 
    isAwardCompleted
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

          {!officerUser && !isDeadlineOver && !tender.isExpired && !isAwardCompleted && (
            <Link
              to="/vendor/submit-bid"
              className="bg-[#A13D2B] hover:bg-[#8A3323] text-white font-semibold text-xs px-4 py-2 rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-[#A13D2B] focus-visible:outline-none"
            >
              Submit Sealed Bid →
            </Link>
          )}

          {!officerUser && (isDeadlineOver || tender.isExpired) && !isAwardCompleted && (
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
      <ChainOfCustodyTimeline tender={tender} />

      {/* Official Contract Award & Winner Announcement (L1 Determination) */}
      {isAwardCompleted && (
        <div className="bg-emerald-50/60 border border-emerald-300/80 rounded-xl p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-emerald-200 pb-3">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 animate-pulse"></span>
              <span className="font-mono text-xs font-bold uppercase tracking-wider text-emerald-950">
                Official Contract Award Notice • L1 Sovereign Procurement Determination
              </span>
            </div>
            <span className="text-[11px] font-mono font-semibold px-2.5 py-1 rounded bg-emerald-100 text-emerald-900 border border-emerald-300 shrink-0">
              {s === 'awarded' 
                ? (isAppealOpen ? 'Statutory 7-Day Standstill Active' : 'Standstill Concluded')
                : s === 'disputed' 
                ? 'Dispute Under CVC Review'
                : s === 'disputeresolved' 
                ? 'Dispute Resolved by CVC'
                : s === 'finalized' 
                ? 'Contract Executed & Finalized'
                : 'Award Recorded'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            <div className="bg-white p-3.5 rounded-lg border border-emerald-200/80 shadow-2xs">
              <span className="text-[#71716D] block text-[11px] font-medium">Selected L1 Winner:</span>
              <span className="font-bold text-[#1A1A18] text-sm block mt-0.5">
                {tender.winner || (tender.winnerAddress ? `${tender.winnerAddress.substring(0, 10)}…` : 'Award Recorded On-Chain')}
              </span>
              <span className="text-[10px] font-mono text-[#71716D] block mt-0.5">
                VID: {tender.winnerVid || (tender.winnerAddress ? tender.winnerAddress.substring(0, 10) + '…' : 'N/A')} • Escrow: VERIFIED
              </span>
            </div>

            <div className="bg-white p-3.5 rounded-lg border border-emerald-200/80 shadow-2xs">
              <span className="text-[#71716D] block text-[11px] font-medium">Winning Commercial Quote:</span>
              <span className="font-mono text-base font-bold text-emerald-800 block mt-0.5 tabular-nums">
                {tender.winningAmount 
                  ? (String(tender.winningAmount).includes('ETH') ? tender.winningAmount : `${tender.winningAmount} ETH`)
                  : (tender.lowestBid ? `${tender.lowestBid} ETH` : 'Awarded')}
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
              {tender.awardTxHash ? (
                <a
                  href={`https://sepolia.etherscan.io/tx/${tender.awardTxHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-[11px] font-semibold text-blue-700 hover:text-blue-900 underline block mt-0.5 truncate"
                  title={tender.awardTxHash}
                >
                  {tender.awardTxHash.length > 20 ? `${tender.awardTxHash.substring(0, 16)}…` : tender.awardTxHash} ↗
                </a>
              ) : (
                <span className="font-mono text-[11px] font-semibold text-[#1A1A18] block mt-0.5">
                  Recorded on Blockchain
                </span>
              )}
              <span className="text-[10px] font-mono text-emerald-800 block mt-0.5">
                {tender.awardBlock ? formatBlockNumber(tender.awardBlock) : 'Mined on Sepolia'}
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
                IPFS CID: {tender.cid ? (
                  <a
                    href={`https://gateway.pinata.cloud/ipfs/${tender.cid}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-700 hover:text-blue-900 underline font-bold"
                  >
                    {tender.cid} ↗
                  </a>
                ) : (
                  <span className="text-[#1A1A18] font-bold">Not Anchored</span>
                )}
              </div>
              <div className="text-[#71716D]">
                Document: <span className="text-[#1A1A18] font-medium">{tender.fileName || `${tender.title || 'Technical_Specification'}.pdf`}</span>
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
              <span className="font-mono text-xs font-semibold text-[#1A1A18] tabular-nums">
                {tender.minEmdEth
                  ? `${tender.minEmdEth} ETH`
                  : (tender.emd?.includes('ETH')
                      ? tender.emd
                      : (tender.minEmdAmount
                          ? (String(tender.minEmdAmount).length > 10
                              ? `${ethers.formatEther(tender.minEmdAmount)} ETH`
                              : `${tender.minEmdAmount} ETH`)
                          : '0.001 ETH'))}
              </span>
            </div>

            <div>
              <span className="text-[#71716D] block">Submission Deadline:</span>
              <span className="font-mono font-medium text-[#1A1A18] tabular-nums">{tender.deadline}</span>
            </div>

            <div>
              <span className="text-[#71716D] block">Dispute Window Status:</span>
              {isPreAward(tender) && !isAwardCompleted ? (
                <span className="font-mono text-[11px] font-medium px-2 py-0.5 rounded border inline-block mt-1 bg-[#FAFAF9] text-[#71716D] border-[#E8E6E1]">
                  Not applicable
                </span>
              ) : s === 'awarded' || (isAwardCompleted && s !== 'disputed' && s !== 'disputeresolved' && s !== 'finalized' && s !== 'cancelled') ? (
                <div className="space-y-1 mt-1">
                  <span className={`font-mono text-[11px] font-medium px-2 py-0.5 rounded border inline-block ${
                    isAppealOpen 
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : 'bg-[#FAFAF9] text-[#71716D] border-[#E8E6E1]'
                  }`}>
                    {isAppealOpen ? 'APPEALS OPEN (7-DAY STANDSTILL)' : 'APPEAL WINDOW CLOSED'}
                  </span>
                  <div className="text-[11px] text-[#575753] font-mono">
                    Deadline: <strong className="text-[#1A1A18]">{tender.appealDeadline ? formatTenderDate(tender.appealDeadline) : 'N/A'}</strong> ({isAppealOpen ? 'Open' : 'Closed'})
                  </div>
                </div>
              ) : s === 'disputed' ? (
                <div className="space-y-1 mt-1">
                  <span className="font-mono text-[11px] font-medium px-2 py-0.5 rounded border inline-block bg-amber-50 text-amber-900 border-amber-300">
                    DISPUTE FILED • UNDER CVC REVIEW
                  </span>
                  {tender.appealDeadline && (
                    <div className="text-[11px] text-[#575753] font-mono">
                      Appeal Deadline: {formatTenderDate(tender.appealDeadline)} ({isAppealOpen ? 'Open' : 'Closed'})
                    </div>
                  )}
                </div>
              ) : s === 'disputeresolved' ? (
                <div className="space-y-1 mt-1">
                  <span className="font-mono text-[11px] font-medium px-2 py-0.5 rounded border inline-block bg-blue-50 text-blue-900 border-blue-300">
                    DISPUTE RESOLVED BY CVC
                  </span>
                  {tender.appealDeadline && (
                    <div className="text-[11px] text-[#575753] font-mono">
                      Appeal Deadline: {formatTenderDate(tender.appealDeadline)} ({isAppealOpen ? 'Open' : 'Closed'})
                    </div>
                  )}
                </div>
              ) : s === 'finalized' ? (
                <div className="space-y-1 mt-1">
                  <span className="font-mono text-[11px] font-medium px-2 py-0.5 rounded border inline-block bg-[#FAFAF9] text-[#71716D] border-[#E8E6E1]">
                    APPEAL WINDOW CLOSED • FINALIZED
                  </span>
                  {tender.appealDeadline && (
                    <div className="text-[11px] text-[#575753] font-mono">
                      Appeal Deadline: {formatTenderDate(tender.appealDeadline)} (Closed)
                    </div>
                  )}
                </div>
              ) : s === 'cancelled' ? (
                <div className="space-y-1 mt-1">
                  <span className="font-mono text-[11px] font-medium px-2 py-0.5 rounded border inline-block bg-red-50 text-red-900 border-red-200">
                    TENDER CANCELLED
                  </span>
                  {tender.appealDeadline && (
                    <div className="text-[11px] text-[#575753] font-mono">
                      Appeal Deadline: {formatTenderDate(tender.appealDeadline)} (Closed)
                    </div>
                  )}
                </div>
              ) : (
                <span className="font-mono text-[11px] font-medium px-2 py-0.5 rounded border inline-block mt-1 bg-[#FAFAF9] text-[#71716D] border-[#E8E6E1]">
                  Not applicable
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
