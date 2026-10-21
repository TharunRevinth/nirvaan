import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import ConfirmationModal from '../components/ConfirmationModal';
import { useAuth } from '../context/AuthContext';
import { CONTRACT_ADDRESS, API_URL } from '../config';
import { uploadDocumentToIpfs } from '../utils/ipfs';
import { encryptFileClientSide } from '../utils/crypto';
import { isTenderDeadlineOver } from '../utils/tenderUtils';
import { ensureCorrectChain, decodeContractError } from '../utils/chain';

function getTenderEmdEth(tender) {
  if (!tender) return '0.001';
  if (tender.minEmdEth) return String(tender.minEmdEth);
  if (tender.emd && tender.emd.includes('ETH')) {
    return tender.emd.replace('ETH', '').trim();
  }
  if (tender.minEmdAmount) {
    const str = String(tender.minEmdAmount);
    if (str.length > 10) {
      try {
        return ethers.formatEther(str);
      } catch (e) {
        return str;
      }
    }
    return str;
  }
  return '0.001';
}

export default function SealedBidSubmission({ triggerToast, tenders = [] }) {
  const { walletAddress } = useAuth();
  const [selectedTenderId, setSelectedTenderId] = useState(tenders[0]?.id || '');
  const [amount, setAmount] = useState('');
  const [salt, setSalt] = useState('');
  const [saltDownloaded, setSaltDownloaded] = useState(false);
  const currentTender = tenders.find(t => t.id === selectedTenderId) || tenders[0];
  const [emdDeposited, setEmdDeposited] = useState(() => getTenderEmdEth(currentTender));
  const [commitmentHash, setCommitmentHash] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [onChainTxHash, setOnChainTxHash] = useState('');
  const [onChainBidRecord, setOnChainBidRecord] = useState(null);

  const isCurrentTenderClosed = currentTender ? (currentTender.isExpired || isTenderDeadlineOver(currentTender)) : false;

  // Prefill EMD dynamically from tender's minEmdAmount
  useEffect(() => {
    if (currentTender) {
      setEmdDeposited(getTenderEmdEth(currentTender));
    }
  }, [currentTender]);

  // Keccak256 commitment calculation with 32-byte salt (no truncation)
  useEffect(() => {
    if (amount && salt && walletAddress && currentTender?.onChainId) {
      try {
        const onChainId = currentTender.onChainId;
        const amountWei = ethers.parseEther(String(amount).trim());
        let saltBytes32 = salt.trim();
        if (!saltBytes32.startsWith('0x') || saltBytes32.length !== 66) {
          saltBytes32 = ethers.keccak256(ethers.toUtf8Bytes(saltBytes32));
        }

        const hash = ethers.solidityPackedKeccak256(
          ["address", "uint256", "bytes32", "uint256"],
          [walletAddress, amountWei, saltBytes32, onChainId]
        );
        setCommitmentHash(hash);
      } catch (err) {
        console.error("Keccak256 calculation error:", err);
      }
    } else {
      setCommitmentHash('');
    }
  }, [amount, salt, walletAddress, currentTender]);

  // Generate 32-byte cryptographically secure salt using window.crypto.getRandomValues
  const handleGenerateSalt = () => {
    const bytes = window.crypto.getRandomValues(new Uint8Array(32));
    const hex = '0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
    setSalt(hex);
    setSaltDownloaded(false);
    triggerToast('Generated 32-byte cryptographic salt. Download backup before submitting.', 'info');
  };

  // Download exportable Salt Receipt (Mandatory before submission)
  const handleDownloadSaltReceipt = () => {
    if (!amount || !salt) {
      triggerToast('Please provide commercial quote and generate salt first.', 'error');
      return;
    }

    const receipt = {
      tenderId: currentTender?.id,
      onChainId: currentTender?.onChainId,
      vendorAddress: walletAddress,
      bidAmountEth: amount,
      salt: salt,
      commitmentHash: commitmentHash,
      bidDocumentCid: bidDocumentCid,
      timestamp: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(receipt, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nirvaan-salt-receipt-tender-${currentTender?.onChainId || 'bid'}.json`;
    a.click();
    URL.revokeObjectURL(url);

    setSaltDownloaded(true);
    triggerToast('Cryptographic Salt Receipt downloaded. Keep this file safe for bid opening.', 'success');
  };

  const handlePreSubmitValidation = () => {
    if (!walletAddress) {
      triggerToast('Please connect an authorized wallet first.', 'error');
      return;
    }

    if (isCurrentTenderClosed) {
      triggerToast(`Bidding Deadline Passed: Tender ${currentTender?.id} is closed for bid submissions.`, 'error');
      return;
    }

    if (!saltDownloaded) {
      triggerToast('Mandatory: You must download your Cryptographic Salt Receipt before submitting your bid.', 'error');
      return;
    }

    setModalOpen(true);
  };

  const [bidDocumentCid, setBidDocumentCid] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState('');

  const handleIpfsBidFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setSelectedFileName(file.name);
    setIsUploading(true);

    try {
      // Client-side hardware AES-256-GCM encryption before upload
      const { encryptedFile } = await encryptFileClientSide(file);
      const result = await uploadDocumentToIpfs(encryptedFile);
      setBidDocumentCid(result.hash);
      triggerToast(`Bid document encrypted client-side (AES-256-GCM) & uploaded. CID: ${result.hash}`, 'success');
    } catch (err) {
      console.error('IPFS bid upload error:', err);
      triggerToast(`Bid upload failed: ${err.message}`, 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleConfirmSubmit = async () => {
    setIsSubmitting(true);
    setOnChainTxHash('');
    setOnChainBidRecord(null);

    try {
      if (!bidDocumentCid) {
        throw new Error("Please upload an encrypted bid document PDF first.");
      }

      if (!currentTender?.onChainId) {
        throw new Error("Invalid tender package selected.");
      }

      // Check and enforce wallet chain ID
      await ensureCorrectChain();

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      const abi = [
        "function submitBid(uint256 _tenderId, string memory _encryptedBidIpfs, bytes32 _bidCommitment) external payable",
        "function getTenderBidsCount(uint256 _tenderId) external view returns (uint256)",
        "function tenderBids(uint256, uint256) external view returns (uint256 id, uint256 tenderId, address vendorAddress, string encryptedBidIpfsHash, bytes32 bidCommitment, uint256 submissionTime, uint256 bidAmount, uint8 status, bool isTechQualified, uint256 techScore, uint256 emdDeposited)"
      ];

      const contract = new ethers.Contract(CONTRACT_ADDRESS, abi, signer);
      const emdWei = ethers.parseEther(emdDeposited || "0.1");
      const onChainId = currentTender.onChainId;

      const tx = await contract.submitBid(
        onChainId,
        bidDocumentCid,
        commitmentHash,
        { value: emdWei }
      );

      triggerToast(`Transaction sent: ${tx.hash.substring(0, 18)}… Waiting for block confirmation.`, 'success');
      setOnChainTxHash(tx.hash);

      const receipt = await tx.wait();
      setIsSubmitting(false);
      setModalOpen(false);

      triggerToast(`Confirmed in Block #${receipt.blockNumber}. Sealed bid recorded on-chain.`, 'success');

      const count = await contract.getTenderBidsCount(onChainId);
      const bidIdx = count > 0n ? Number(count) - 1 : 0;
      const bidData = await contract.tenderBids(onChainId, bidIdx);
      setOnChainBidRecord({
        id: bidData.id.toString(),
        tenderId: bidData.tenderId.toString(),
        vendorAddress: bidData.vendorAddress,
        encryptedBidIpfsHash: bidData.encryptedBidIpfsHash,
        bidCommitment: bidData.bidCommitment,
        emdDeposited: ethers.formatEther(bidData.emdDeposited) + " ETH",
        submissionTime: new Date(Number(bidData.submissionTime) * 1000).toLocaleString()
      });

      // Synchronize bid record to backend API
      try {
        await fetch(`${API_URL}/api/tenders/${currentTender.onChainId}/bids`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tenderId: currentTender.onChainId,
            vendor: `Registered Supplier (${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)})`,
            vid: `VEN-${walletAddress.slice(2, 6).toUpperCase()}-X`,
            vendorAddress: walletAddress,
            amount: amount,
            hash: commitmentHash,
            cid: bidDocumentCid,
            qualified: false
          })
        });
      } catch (postErr) {
        console.warn('Backend sync standby:', postErr);
      }

    } catch (err) {
      setIsSubmitting(false);
      setModalOpen(false);
      console.error("Bid Submission Error:", err);
      triggerToast(decodeContractError(err), 'error');
    }
  };

  return (
    <div id="main-content" className="max-w-4xl mx-auto space-y-6">
      <div className="border-b border-[#E8E6E1] pb-4 flex flex-col sm:flex-row justify-between sm:items-end gap-3">
        <div>
          <span className="text-[11px] font-mono font-semibold uppercase text-[#71716D] tracking-wider">
            Commercial Bidding • Commit-Reveal Protocol
          </span>
          <h1 className="text-2xl font-bold text-[#1A1A18] tracking-tight mt-1">
            Submit Sealed Encrypted Bid
          </h1>
          <p className="text-xs text-[#575753] mt-1">
            Commit-reveal scheme with on-chain cryptographic verification.
          </p>
        </div>

        <div className="text-left sm:text-right font-mono text-xs">
          <span className="text-[#71716D] block">Connected Wallet:</span>
          <span className="font-semibold text-[#1A1A18] truncate block max-w-xs">{walletAddress || 'Not Connected'}</span>
        </div>
      </div>

      {isCurrentTenderClosed && (
        <div className="bg-red-50 border border-red-200 text-red-900 rounded-xl p-4 text-xs font-medium">
          Bidding Window Closed: The submission deadline for this tender package has expired. New sealed bids will be rejected by smart contract logic.
        </div>
      )}

      <div className="bg-white border border-[#E8E6E1] rounded-2xl p-6 sm:p-8 space-y-6 shadow-xs">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left Column: Form Inputs */}
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#1A1A18]">Select Tender Package *</label>
              <select
                value={selectedTenderId}
                onChange={(e) => setSelectedTenderId(e.target.value)}
                className="w-full bg-white border border-[#E8E6E1] rounded-lg px-3 py-2 text-xs font-mono text-[#1A1A18] focus-visible:ring-2 focus-visible:ring-[#A13D2B] focus-visible:outline-none"
              >
                {tenders.map(t => (
                  <option key={t.id} value={t.id}>
                    #{t.onChainId} — {t.id} ({t.title})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#1A1A18]">Commercial Bid Quote (in ETH) *</label>
              <input
                type="text"
                required
                placeholder="e.g. 0.45"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full bg-white border border-[#E8E6E1] rounded-lg px-3 py-2 text-xs font-mono text-[#1A1A18] focus-visible:ring-2 focus-visible:ring-[#A13D2B] focus-visible:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-xs font-medium text-[#1A1A18]">Secret Salt (32 Bytes Cryptographic Hex) *</label>
                <button
                  type="button"
                  onClick={handleGenerateSalt}
                  className="text-[11px] text-[#A13D2B] hover:underline cursor-pointer"
                >
                  Generate 32-Byte Salt
                </button>
              </div>
              <input
                type="text"
                required
                placeholder="Click Generate to produce 32-byte secure salt"
                value={salt}
                onChange={(e) => {
                  setSalt(e.target.value);
                  setSaltDownloaded(false);
                }}
                className="w-full bg-white border border-[#E8E6E1] rounded-lg px-3 py-2 text-xs font-mono text-[#1A1A18] focus-visible:ring-2 focus-visible:ring-[#A13D2B] focus-visible:outline-none"
              />
            </div>

            {/* Mandatory Salt Receipt Download Button */}
            {salt && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-amber-900">
                    {saltDownloaded ? '✔ Salt Backup Confirmed' : '⚠ Action Required: Backup Salt'}
                  </span>
                  <button
                    type="button"
                    onClick={handleDownloadSaltReceipt}
                    className="bg-amber-900 hover:bg-amber-950 text-white text-[11px] font-medium px-3 py-1 rounded transition-colors cursor-pointer"
                  >
                    Download Receipt (.json)
                  </button>
                </div>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  You must download this file before submitting. Without this salt, you cannot reveal your commercial bid and your EMD deposit will be forfeited.
                </p>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#1A1A18] block">
                EMD Escrow Deposit (ETH) *
              </label>
              <div className="text-[11px] text-[#71716D] font-mono">
                Required On-Chain EMD: <span className="font-semibold text-[#1A1A18]">{getTenderEmdEth(currentTender)} ETH</span>
              </div>
              <input
                type="text"
                required
                value={emdDeposited}
                onChange={(e) => setEmdDeposited(e.target.value)}
                className="w-full bg-white border border-[#E8E6E1] rounded-lg px-3 py-2 text-xs font-mono text-[#1A1A18] focus-visible:ring-2 focus-visible:ring-[#A13D2B] focus-visible:outline-none"
              />
              <p className="text-[11px] text-[#71716D]">
                Prefilled with tender minimum EMD. Must meet or exceed minimum EMD on-chain.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#1A1A18]">Commercial Technical Specification Document (PDF) *</label>
              <input
                type="file"
                accept=".pdf,.json,.txt"
                onChange={handleIpfsBidFileUpload}
                className="w-full text-xs text-[#575753] file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-[#1A1A18] file:text-white hover:file:bg-black cursor-pointer"
              />
              {isUploading && <span className="text-[11px] text-[#A13D2B] block">Encrypting document client-side with AES-256-GCM…</span>}
              {bidDocumentCid && <span className="text-[11px] text-emerald-800 font-mono block">Encrypted CID: {bidDocumentCid}</span>}
            </div>
          </div>

          {/* Right Column: Cryptographic Preview */}
          <div className="bg-[#FAFAF9] border border-[#E8E6E1] rounded-xl p-5 space-y-4">
            <h3 className="font-bold text-xs uppercase tracking-wider text-[#1A1A18]">
              Cryptographic Commitment Preview
            </h3>

            <div className="space-y-2 text-xs font-mono">
              <div>
                <span className="text-[#71716D] block text-[11px]">Tender On-Chain ID:</span>
                <span className="text-[#1A1A18] font-semibold">{currentTender?.onChainId || 'N/A'}</span>
              </div>
              <div>
                <span className="text-[#71716D] block text-[11px]">Bidding Entity Address:</span>
                <span className="text-[#1A1A18] font-semibold truncate block">{walletAddress || 'None'}</span>
              </div>
              <div>
                <span className="text-[#71716D] block text-[11px]">Quote Value:</span>
                <span className="text-[#1A1A18] font-semibold">{amount ? `${amount} ETH` : 'Pending input'}</span>
              </div>
              <div>
                <span className="text-[#71716D] block text-[11px]">Computed keccak256 Commitment:</span>
                <span className="text-amber-900 font-semibold break-all text-[11px] block">{commitmentHash || 'Incomplete fields'}</span>
              </div>
            </div>

            <button
              type="button"
              disabled={isCurrentTenderClosed || !commitmentHash || !walletAddress || !bidDocumentCid || !saltDownloaded || isSubmitting}
              onClick={handlePreSubmitValidation}
              className="w-full bg-[#A13D2B] hover:bg-[#8A3323] disabled:bg-[#A8A7A1] text-white font-semibold text-xs py-3 rounded-xl transition-colors cursor-pointer"
            >
              Submit Sealed Bid On-Chain →
            </button>
          </div>
        </div>
      </div>

      <ConfirmationModal
        isOpen={modalOpen}
        title="Confirm Sealed Bid Submission"
        message={`Lock sealed commitment hash and deposit ${emdDeposited} ETH EMD into on-chain escrow for Tender #${currentTender?.onChainId}? This transaction is irreversible.`}
        onConfirm={handleConfirmSubmit}
        onCancel={() => setModalOpen(false)}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}
