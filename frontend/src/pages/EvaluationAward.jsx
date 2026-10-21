import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ethers } from 'ethers';
import ConfirmationModal from '../components/ConfirmationModal';
import { useAuth } from '../context/AuthContext';
import { CONTRACT_ADDRESS, RPC_URL, API_URL } from '../config';
import { ensureCorrectChain, decodeContractError } from '../utils/chain';

const CONTRACT_ABI = [
  "function getTenderBidsCount(uint256 _tenderId) external view returns (uint256)",
  "function tenderBids(uint256 _tenderId, uint256 _bidIndex) external view returns (uint256 id, uint256 tenderId, address vendorAddress, string memory encryptedBidIpfsHash, bytes32 bidCommitment, uint256 submissionTime, uint256 bidAmount, uint8 status, bool isTechQualified, uint256 techScore, uint256 emdDeposited)",
  "function setTechnicalScore(uint256 _tenderId, uint256 _bidIndex, bool _qualified, uint256 _score) external",
  "function awardTender(uint256 _tenderId, address _winner, uint256 _winningBidId, uint256 _winningBidAmount) external",
  "function tenders(uint256) external view returns (uint256 id, address psuAddress, string memory ipfsHashDoc, uint256 submissionDeadline, uint256 openingTime, uint256 revealDeadline, uint256 appealDeadline, uint256 minEMDAmount, uint8 status, address winner, uint256 winningBidId, uint256 winningBidAmount)"
];

const BID_STATUS_LABELS = {
  0: 'Submitted (Sealed)',
  1: 'Opened (Revealed)',
  2: 'Accepted (Awarded)',
  3: 'Rejected (Forfeited)'
};

export default function EvaluationAward({ triggerToast, selectedPSU: propPsu, tenders = [], setTenders }) {
  const { officerUser, selectedPSU } = useAuth();
  const effectivePSU = officerUser?.psu || selectedPSU || propPsu || 'IOCL';

  const [searchParams] = useSearchParams();
  const queryTenderId = searchParams.get('tender');

  const availableTenders = officerUser
    ? tenders.filter(t => t.psu === effectivePSU)
    : tenders;

  const defaultTender = (queryTenderId && tenders.find(t => t.id === queryTenderId || String(t.onChainId) === queryTenderId))
    || availableTenders[0]
    || tenders[0];

  const [selectedTenderOnChainId, setSelectedTenderOnChainId] = useState(defaultTender?.onChainId || 1);
  const currentTender = tenders.find(t => t.onChainId === Number(selectedTenderOnChainId)) || defaultTender;

  const [bids, setBids] = useState([]);
  const [loadingBids, setLoadingBids] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [scoringIndex, setScoringIndex] = useState(null);

  const isAwarded = currentTender?.status === 'Awarded' || currentTender?.status === 'AWARDED';

  // Read REAL bids from contract on-chain
  const loadOnChainBids = async () => {
    if (!currentTender?.onChainId) return;
    setLoadingBids(true);

    try {
      const provider = window.ethereum
        ? new ethers.BrowserProvider(window.ethereum)
        : new ethers.JsonRpcProvider(RPC_URL);

      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
      const onChainId = Number(currentTender.onChainId);
      const count = await contract.getTenderBidsCount(onChainId);
      const total = Number(count);
      const loaded = [];

      for (let i = 0; i < total; i++) {
        const b = await contract.tenderBids(onChainId, i);
        const amountWei = b.bidAmount;
        const amountEth = ethers.formatEther(amountWei);

        loaded.push({
          index: i,
          id: Number(b.id),
          vendorAddress: b.vendorAddress,
          amountWei,
          amountEth,
          status: Number(b.status),
          statusLabel: BID_STATUS_LABELS[Number(b.status)] || 'Unknown',
          isQualified: b.isTechQualified,
          techScore: Number(b.techScore),
          emdEth: ethers.formatEther(b.emdDeposited),
          commitment: b.bidCommitment,
          encryptedCid: b.encryptedBidIpfsHash
        });
      }

      // Sort opened bids to determine L1, L2, etc.
      const openedBids = loaded.filter(b => b.status === 1 || b.status === 2);
      openedBids.sort((a, b) => (a.amountWei < b.amountWei ? -1 : a.amountWei > b.amountWei ? 1 : 0));

      const rankedBids = loaded.map(b => {
        const rankIdx = openedBids.findIndex(ob => ob.id === b.id);
        return {
          ...b,
          rank: rankIdx >= 0 ? `L${rankIdx + 1}` : 'Pending Opening'
        };
      });

      setBids(rankedBids);
    } catch (err) {
      console.warn('Error reading on-chain bids:', err.message);
      setBids([]);
    } finally {
      setLoadingBids(false);
    }
  };

  useEffect(() => {
    loadOnChainBids();
  }, [currentTender?.onChainId]);

  // Handle setting real technical score on-chain via backend officer relay
  const handleSetScore = async (bidIndex, qualified, score) => {
    const token = localStorage.getItem('nirvaan_token');
    if (!token) {
      triggerToast('PSU Officer authentication required. Please sign in.', 'error');
      return;
    }

    setScoringIndex(bidIndex);
    try {
      const res = await fetch(`${API_URL}/api/tenders/${currentTender.onChainId}/tech-score`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          bidIndex,
          qualified,
          score
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to record technical score on-chain');
      }

      triggerToast(`Technical score recorded on-chain for Bid #${bidIndex}. Tx: ${data.txHash ? data.txHash.substring(0, 18) + '…' : 'Confirmed'}`, 'success');
      await loadOnChainBids();
    } catch (err) {
      console.error('Technical qualification error:', err);
      triggerToast(`Technical score error: ${decodeContractError(err)}`, 'error');
    } finally {
      setScoringIndex(null);
    }
  };

  // Find lowest qualified bid (L1)
  const qualifiedOpenedBids = bids
    .filter(b => (b.status === 1 || b.status === 2) && b.isQualified)
    .sort((a, b) => (a.amountWei < b.amountWei ? -1 : 1));

  const l1Bid = qualifiedOpenedBids[0];

  // Award the contract to actual L1 bidder via backend officer relay
  const handleAwardConfirm = async () => {
    if (!l1Bid) {
      triggerToast('No qualified unsealed bids found to award.', 'error');
      return;
    }

    const token = localStorage.getItem('nirvaan_token');
    if (!token) {
      triggerToast('PSU Officer authentication required. Please sign in.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/tenders/${currentTender.onChainId}/award`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          winner: l1Bid.vendorAddress,
          winningBidId: l1Bid.id,
          winningBidAmount: l1Bid.amountEth || (l1Bid.amountWei ? ethers.formatEther(l1Bid.amountWei) : '0.05'),
          winnerName: l1Bid.vendorName || `Vendor (${l1Bid.vendorAddress.slice(0, 6)}…)`
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to execute contract award');
      }

      setIsSubmitting(false);
      setModalOpen(false);
      triggerToast(`Tender #${currentTender.onChainId} awarded on-chain to L1 bidder (Block #${data.blockNumber || 'confirmed'}). Tx: ${data.txHash ? data.txHash.substring(0, 18) + '…' : 'Mined'}`, 'success');

      await loadOnChainBids();
    } catch (err) {
      setIsSubmitting(false);
      setModalOpen(false);
      console.error('Award execution error:', err);
      triggerToast(`Award failed: ${decodeContractError(err)}`, 'error');
    }
  };

  return (
    <div id="main-content" className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="border-b border-[#E8E6E1] pb-4 flex flex-col sm:flex-row justify-between sm:items-end gap-3">
        <div className="space-y-1">
          <span className="text-[11px] font-mono font-semibold uppercase text-[#71716D] tracking-wider">
            {effectivePSU} Procurement Cell • On-Chain L1 Determination
          </span>
          <h1 className="text-2xl font-bold text-[#1A1A18] tracking-tight">
            Bid Evaluation &amp; Contract Award Console
          </h1>
          <p className="text-xs text-[#575753]">
            Verify technical qualifications, inspect opened quotes, and execute tamper-proof smart contract awards.
          </p>
        </div>

        <div className="text-left sm:text-right font-mono text-xs">
          <span className="text-[#71716D] block">Status:</span>
          <span className={`font-semibold ${isAwarded ? 'text-amber-800' : 'text-emerald-800'}`}>
            {currentTender?.status || 'UnderEvaluation'}
          </span>
        </div>
      </div>

      {/* Package Selector */}
      <div className="bg-white border border-[#E8E6E1] rounded-xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="space-y-1 w-full sm:w-auto">
          <label className="text-xs font-semibold text-[#1A1A18]">Select Tender Package for Commercial Evaluation</label>
          <select
            value={selectedTenderOnChainId}
            onChange={(e) => setSelectedTenderOnChainId(Number(e.target.value))}
            className="w-full bg-white border border-[#E8E6E1] rounded-lg px-3 py-1.5 text-xs font-mono text-[#1A1A18] cursor-pointer focus-visible:ring-2 focus-visible:ring-[#A13D2B] focus-visible:outline-none"
          >
            {availableTenders.map(t => (
              <option key={t.onChainId} value={t.onChainId}>
                #{t.onChainId} — {t.id} ({t.title})
              </option>
            ))}
          </select>
        </div>

        <div className="text-xs text-[#71716D] font-mono">
          Bids Submitted: <strong className="text-[#1A1A18]">{bids.length}</strong>
        </div>
      </div>

      {/* Bids Table */}
      <div className="bg-white border border-[#E8E6E1] rounded-2xl overflow-hidden shadow-xs">
        <div className="p-4 bg-[#FAFAF9] border-b border-[#E8E6E1] flex justify-between items-center">
          <h3 className="font-bold text-xs uppercase tracking-wider text-[#1A1A18]">
            On-Chain Commercial Submissions
          </h3>
          <button
            type="button"
            onClick={loadOnChainBids}
            className="text-xs text-[#A13D2B] hover:underline cursor-pointer"
          >
            ↻ Refresh Bids
          </button>
        </div>

        {loadingBids ? (
          <div className="p-8 text-center text-xs text-[#71716D] font-mono">
            Reading real bids from smart contract storage…
          </div>
        ) : bids.length === 0 ? (
          <div className="p-8 text-center text-xs text-[#71716D]">
            No bids submitted for this tender yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-[#FAFAF9] text-[#71716D] uppercase text-[10px] border-b border-[#E8E6E1]">
                <tr>
                  <th className="p-3">Rank</th>
                  <th className="p-3">Bidder Address</th>
                  <th className="p-3">EMD Paid</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Commercial Quote</th>
                  <th className="p-3">Tech Qualified</th>
                  <th className="p-3">Tech Score</th>
                  <th className="p-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E6E1]">
                {bids.map((b) => (
                  <tr key={b.id} className={b.rank === 'L1' && b.isQualified ? 'bg-amber-50/40' : ''}>
                    <td className="p-3 font-bold text-[#1A1A18]">
                      {b.rank}
                    </td>
                    <td className="p-3 font-semibold text-[#1A1A18]">
                      {b.vendorAddress.slice(0, 6)}…{b.vendorAddress.slice(-4)}
                    </td>
                    <td className="p-3 text-[#575753]">{b.emdEth} ETH</td>
                    <td className="p-3">{b.statusLabel}</td>
                    <td className="p-3 font-bold text-[#1A1A18]">
                      {b.status === 1 || b.status === 2 ? `${b.amountEth} ETH` : 'Sealed'}
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${b.isQualified ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                        {b.isQualified ? 'QUALIFIED' : 'DISQUALIFIED'}
                      </span>
                    </td>
                    <td className="p-3">{b.techScore}/100</td>
                    <td className="p-3">
                      {!isAwarded && (
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            disabled={scoringIndex === b.index}
                            onClick={() => handleSetScore(b.index, !b.isQualified, b.isQualified ? 0 : 90)}
                            className="bg-[#1A1A18] hover:bg-black text-white px-2 py-1 rounded text-[10px] transition-colors cursor-pointer"
                          >
                            {b.isQualified ? 'Disqualify' : 'Qualify'}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Award Execution Bar */}
      <div className="bg-white border border-[#E8E6E1] rounded-2xl p-6 flex flex-col sm:flex-row justify-between items-center gap-4 shadow-xs">
        <div className="space-y-1">
          <span className="text-[11px] font-mono text-[#71716D] uppercase block">
            Automated L1 Lowest-Cost Determination
          </span>
          <div className="text-sm font-bold text-[#1A1A18]">
            {l1Bid ? (
              <span>L1 Winner: {l1Bid.vendorAddress.slice(0, 8)}… at {l1Bid.amountEth} ETH</span>
            ) : (
              <span>No qualified revealed bidder available for award</span>
            )}
          </div>
        </div>

        <button
          type="button"
          disabled={!l1Bid || isAwarded || isSubmitting}
          onClick={() => setModalOpen(true)}
          className="bg-[#A13D2B] hover:bg-[#8A3323] disabled:bg-[#A8A7A1] text-white font-semibold text-xs px-6 py-3 rounded-xl transition-colors cursor-pointer"
        >
          {isAwarded ? 'Contract Already Awarded' : 'Execute L1 Award On-Chain →'}
        </button>
      </div>

      <ConfirmationModal
        isOpen={modalOpen}
        title="Confirm On-Chain Contract Award"
        message={`Execute binding award on smart contract to lowest qualified bidder (L1) ${l1Bid?.vendorAddress} for ${l1Bid?.amountEth} ETH? This triggers the statutory 7-day CVC appeal window.`}
        onConfirm={handleAwardConfirm}
        onCancel={() => setModalOpen(false)}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}
