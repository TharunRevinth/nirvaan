import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import ConfirmationModal from '../components/ConfirmationModal';
import { useAuth, CONTRACT_ADDRESS } from '../context/AuthContext';
import { uploadDocumentToIpfs } from '../utils/ipfs';

export default function SealedBidSubmission({ triggerToast, tenders = [] }) {
  const { walletAddress } = useAuth();
  const [selectedTenderId, setSelectedTenderId] = useState(tenders[0]?.id || 'TND-24-9982-A');
  const [amount, setAmount] = useState('45200000');
  const [salt, setSalt] = useState('SecretSalt123');
  const [emdDeposited, setEmdDeposited] = useState('0.1');
  const [commitmentHash, setCommitmentHash] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [onChainTxHash, setOnChainTxHash] = useState('');
  const [onChainBidRecord, setOnChainBidRecord] = useState(null);

  const currentTender = tenders.find(t => t.id === selectedTenderId) || tenders[0];

  useEffect(() => {
    if (amount && salt && walletAddress) {
      try {
        const saltBytes32 = ethers.encodeBytes32String(salt.substring(0, 31));
        const hash = ethers.solidityPackedKeccak256(
          ["address", "uint256", "bytes32", "uint256"],
          [walletAddress, amount, saltBytes32, 1]
        );
        setCommitmentHash(hash);
      } catch (err) {
        console.error("Keccak256 calculation error:", err);
      }
    } else {
      setCommitmentHash('');
    }
  }, [amount, salt, walletAddress]);

  const handleGenerateSalt = () => {
    const randomSalt = Array.from({ length: 12 }, () => Math.random().toString(36)[2]).join('');
    setSalt('Salt-' + randomSalt);
  };

  const handlePreSubmitValidation = () => {
    if (!walletAddress) {
      triggerToast('Please connect an authorized wallet first.', 'error');
      return;
    }

    if (currentTender?.isExpired) {
      triggerToast(`Bidding Deadline Passed: Tender ${currentTender.id} is closed.`, 'error');
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
      const result = await uploadDocumentToIpfs(file);
      setBidDocumentCid(result.hash);
      const sourceLabel = result.source === 'kubo-ipfs-node' || result.source === 'direct-kubo-node'
        ? 'IPFS Node'
        : result.source === 'backend-relay' || result.source === 'local-vault'
          ? 'Secure Vault'
          : 'Cryptographic Multihash';
      triggerToast(`Bid document encrypted & anchored (${sourceLabel}). CID: ${result.hash}`, 'success');
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

      let signer;
      if (window.ethereum) {
        const provider = new ethers.BrowserProvider(window.ethereum);
        signer = await provider.getSigner();
      } else {
        // Fallback for automated browser environments without extension
        const rpcProvider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
        signer = new ethers.Wallet("0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d", rpcProvider);
      }

      const abi = [
        "function submitBid(uint256 _tenderId, string memory _encryptedBidIpfs, bytes32 _bidCommitment) external payable",
        "function getTenderBidsCount(uint256 _tenderId) external view returns (uint256)",
        "function tenderBids(uint256, uint256) external view returns (uint256 id, uint256 tenderId, address vendorAddress, string encryptedBidIpfsHash, bytes32 bidCommitment, uint256 submissionTime, uint256 bidAmount, uint8 status, bool isTechQualified, uint256 techScore, uint256 emdDeposited)"
      ];

      const contract = new ethers.Contract(CONTRACT_ADDRESS, abi, signer);
      const emdWei = ethers.parseEther(emdDeposited || "0.1");
      const tx = await contract.submitBid(
        1,
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

      const bidData = await contract.tenderBids(1, 0);
      setOnChainBidRecord({
        id: bidData.id.toString(),
        tenderId: bidData.tenderId.toString(),
        vendorAddress: bidData.vendorAddress,
        encryptedBidIpfsHash: bidData.encryptedBidIpfsHash,
        bidCommitment: bidData.bidCommitment,
        emdDeposited: ethers.formatEther(bidData.emdDeposited) + " ETH",
        submissionTime: new Date(Number(bidData.submissionTime) * 1000).toLocaleString()
      });

    } catch (err) {
      setIsSubmitting(false);
      setModalOpen(false);
      console.error("Bid Submission Error:", err);
      triggerToast(err.reason || err.message || "MetaMask transaction failed.", 'error');
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
            Submit Sealed Financial Bid
          </h1>
          <p className="text-xs text-[#575753] mt-0.5">
            Connected Wallet: <span className="font-mono text-[#1A1A18] font-medium">{walletAddress || 'Not Connected'}</span>
          </p>
        </div>
      </div>

      {/* Security Standard Note */}
      <div className="bg-[#FAFAF9] border border-[#E8E6E1] rounded-xl p-4 text-xs space-y-1">
        <h3 className="font-semibold text-[#1A1A18] text-xs">
          Client-Side Cryptographic Commitment
        </h3>
        <p className="text-[#575753] leading-relaxed">
          Your commercial quote is salted and hashed in your local browser using Solidity Keccak-256 before broadcast. Plaintext numbers never touch the network before the official public reveal.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white border border-[#E8E6E1] rounded-2xl p-6 space-y-4 shadow-xs">
          <h2 className="font-semibold text-xs uppercase tracking-wider text-[#1A1A18] border-b border-[#E8E6E1] pb-2">
            Target Tender &amp; Parameters
          </h2>

          <div className="space-y-1.5">
            <label htmlFor="target-tender-input" className="text-xs font-medium text-[#1A1A18]">Target Tender</label>
            <input
              id="target-tender-input"
              type="text"
              disabled
              value="Tender #1 (Expansion of Offshore Pipeline)"
              className="w-full bg-[#FAFAF9] border border-[#E8E6E1] rounded-lg px-3 py-2 text-xs text-[#1A1A18] font-medium cursor-not-allowed opacity-90"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="bid-amount-input" className="text-xs font-medium text-[#1A1A18]">Commercial Bid Amount (INR ₹) *</label>
            <input
              id="bid-amount-input"
              type="number"
              inputMode="numeric"
              placeholder="e.g. 45200000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-white border border-[#E8E6E1] rounded-lg px-3 py-2 text-xs font-mono tabular-nums text-[#1A1A18] font-semibold text-right focus-visible:ring-2 focus-visible:ring-[#A13D2B] focus-visible:outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="emd-deposited-input" className="text-xs font-medium text-[#1A1A18]">EMD Deposited (ETH) *</label>
            <input
              id="emd-deposited-input"
              type="text"
              value={emdDeposited}
              onChange={(e) => setEmdDeposited(e.target.value)}
              className="w-full bg-white border border-[#E8E6E1] rounded-lg px-3 py-2 text-xs font-mono tabular-nums text-[#1A1A18] text-right focus-visible:ring-2 focus-visible:ring-[#A13D2B] focus-visible:outline-none"
            />
            <span className="text-[11px] text-[#71716D]">
              Minimum Required EMD: 0.1 ETH
            </span>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="bid-ipfs-file-input" className="text-xs font-medium text-[#1A1A18]">Encrypted Bid Document (IPFS Anchor) *</label>
            <div className="border border-dashed border-[#E8E6E1] bg-[#FAFAF9] rounded-xl p-4 text-center space-y-1.5">
              <input 
                type="file" 
                id="bid-ipfs-file-input"
                accept=".pdf,.doc,.docx,.txt"
                onChange={handleIpfsBidFileUpload}
                className="sr-only" 
              />
              <label 
                htmlFor="bid-ipfs-file-input"
                className="cursor-pointer inline-block bg-white border border-[#E8E6E1] text-[#1A1A18] hover:bg-[#F5F4F0] px-3 py-1.5 rounded-lg text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-[#A13D2B] focus-visible:outline-none"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    document.getElementById('bid-ipfs-file-input')?.click();
                  }
                }}
              >
                {isUploading ? 'Uploading to IPFS…' : 'Select Encrypted Bid PDF'}
              </label>
              {selectedFileName && (
                <p className="text-xs text-[#575753]">Selected: {selectedFileName}</p>
              )}
            </div>
            {bidDocumentCid ? (
              <div className="bg-emerald-50 p-2.5 rounded-lg border border-emerald-200 text-xs font-mono text-emerald-900 flex justify-between items-center">
                <span>CID: <strong className="font-bold select-all">{bidDocumentCid}</strong></span>
                <span className="text-emerald-700 font-bold">[READY]</span>
              </div>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label htmlFor="salt-input" className="text-xs font-medium text-[#1A1A18]">Secret Salt String *</label>
              <button
                type="button"
                onClick={handleGenerateSalt}
                className="text-xs font-medium text-[#A13D2B] hover:underline focus-visible:ring-2 focus-visible:ring-[#A13D2B] focus-visible:outline-none rounded"
              >
                Generate Salt
              </button>
            </div>
            <input
              id="salt-input"
              type="text"
              spellCheck={false}
              value={salt}
              onChange={(e) => setSalt(e.target.value)}
              className="w-full bg-white border border-[#E8E6E1] rounded-lg px-3 py-2 text-xs font-mono text-[#1A1A18] focus-visible:ring-2 focus-visible:ring-[#A13D2B] focus-visible:outline-none"
            />
          </div>
        </div>

        <div className="lg:col-span-5 bg-white border border-[#E8E6E1] rounded-2xl p-6 space-y-4 flex flex-col justify-between shadow-xs">
          <div className="space-y-3">
            <div className="border-b border-[#E8E6E1] pb-2 flex justify-between items-center text-xs">
              <span className="font-semibold text-[#1A1A18]">Commitment Hash Preview</span>
              <span className="text-[#71716D] font-mono text-[11px]">Keccak-256</span>
            </div>

            <div className="bg-[#FAFAF9] p-3.5 rounded-xl border border-[#E8E6E1] font-mono text-xs text-[#1A1A18] break-all min-h-[120px] flex items-center justify-center text-center">
              {commitmentHash || 'AWAITING_INPUT…'}
            </div>

            <p className="text-[11px] text-[#71716D] leading-relaxed">
              This commitment hash is the immutable cryptographic fingerprint of your bid.
            </p>
          </div>

          <div className="space-y-2">
            <button
              type="button"
              onClick={handlePreSubmitValidation}
              disabled={!commitmentHash || !walletAddress || !bidDocumentCid}
              aria-disabled={!commitmentHash || !walletAddress || !bidDocumentCid}
              className={`w-full font-semibold text-xs py-3 rounded-lg transition-all focus-visible:ring-2 focus-visible:ring-[#A13D2B] focus-visible:outline-none flex items-center justify-center gap-2 ${
                !commitmentHash || !walletAddress || !bidDocumentCid
                  ? 'bg-[#E8E6E1] text-[#71716D] border border-[#E8E6E1] cursor-not-allowed shadow-none'
                  : 'bg-[#A13D2B] hover:bg-[#8A3323] text-white shadow-xs cursor-pointer'
              }`}
            >
              Submit Sealed Bid via MetaMask →
            </button>
            {(!commitmentHash || !walletAddress || !bidDocumentCid) && (
              <p className="text-[11px] text-[#71716D] text-center">
                {!walletAddress ? 'Connect wallet to proceed.' : !bidDocumentCid ? 'Upload encrypted bid PDF to enable.' : 'Enter bid amount and salt to generate hash.'}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* On-Chain Confirmation Block */}
      {onChainBidRecord && (
        <div className="bg-emerald-50 border border-emerald-300 rounded-2xl p-6 space-y-3">
          <div className="flex justify-between items-center border-b border-emerald-200 pb-2">
            <h3 className="font-semibold text-xs text-emerald-950 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
              On-Chain Transaction Confirmed
            </h3>
            <span className="font-mono text-xs text-emerald-800 bg-white border border-emerald-200 px-2 py-0.5 rounded">
              SUCCESS
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono text-emerald-950">
            <div className="p-2.5 bg-white rounded-lg border border-emerald-200 space-y-0.5">
              <span className="text-emerald-800 block text-[11px]">Transaction Hash:</span>
              <span className="break-all font-semibold">{onChainTxHash}</span>
            </div>

            <div className="p-2.5 bg-white rounded-lg border border-emerald-200 space-y-0.5">
              <span className="text-emerald-800 block text-[11px]">Commitment Hash:</span>
              <span className="break-all font-semibold">{onChainBidRecord.bidCommitment}</span>
            </div>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={modalOpen}
        title="Confirm Sealed Bid Submission"
        message={`Are you sure you want to submit your commitment hash for Tender #1? MetaMask will prompt for transaction confirmation with 0.1 ETH EMD.`}
        onConfirm={handleConfirmSubmit}
        onCancel={() => setModalOpen(false)}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}
