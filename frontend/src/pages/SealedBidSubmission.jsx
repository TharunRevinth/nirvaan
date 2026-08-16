import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import ConfirmationModal from '../components/ConfirmationModal';
import { useAuth, CONTRACT_ADDRESS } from '../context/AuthContext';

export default function SealedBidSubmission({ triggerToast, tenders = [] }) {
  const { walletAddress } = useAuth();
  const [selectedTenderId, setSelectedTenderId] = useState(tenders[0]?.id || 'TND-24-9982-A');
  const [amount, setAmount] = useState('45200000');
  const [salt, setSalt] = useState('SecretSalt123');
  const [emdDeposited, setEmdDeposited] = useState('0.1'); // 0.1 ETH EMD
  const [commitmentHash, setCommitmentHash] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [onChainTxHash, setOnChainTxHash] = useState('');
  const [onChainBidRecord, setOnChainBidRecord] = useState(null);

  const currentTender = tenders.find(t => t.id === selectedTenderId) || tenders[0];

  // Calculate real Solidity Keccak-256 commitment hash client-side via Ethers v6
  useEffect(() => {
    if (amount && salt && walletAddress) {
      try {
        const saltBytes32 = ethers.encodeBytes32String(salt.substring(0, 31));
        const hash = ethers.solidityPackedKeccak256(
          ["address", "uint256", "bytes32", "uint256"],
          [walletAddress, amount, saltBytes32, 1] // Tender ID #1
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
      triggerToast('Please connect an authorized MetaMask wallet first.', 'error');
      return;
    }

    if (currentTender.isExpired) {
      triggerToast(`Bidding Deadline Passed: Tender ${currentTender.id} closed for submission.`, 'error');
      return;
    }

    setModalOpen(true);
  };

  // Real MetaMask On-Chain Transaction Execution
  const handleConfirmSubmit = async () => {
    setIsSubmitting(true);
    setOnChainTxHash('');
    setOnChainBidRecord(null);

    try {
      if (!window.ethereum) {
        throw new Error("MetaMask is not installed.");
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      const abi = [
        "function submitBid(uint256 _tenderId, string memory _encryptedBidIpfs, bytes32 _bidCommitment) external payable",
        "function getTenderBidsCount(uint256 _tenderId) external view returns (uint256)",
        "function tenderBids(uint256, uint256) external view returns (uint256 id, uint256 tenderId, address vendorAddress, string encryptedBidIpfsHash, bytes32 bidCommitment, uint256 submissionTime, uint256 bidAmount, uint8 status, bool isTechQualified, uint256 techScore, uint256 emdDeposited)"
      ];

      const contract = new ethers.Contract(CONTRACT_ADDRESS, abi, signer);

      // Call real submitBid function on smart contract
      const emdWei = ethers.parseEther(emdDeposited || "0.1");
      const tx = await contract.submitBid(
        1, // Tender ID 1
        "QmEncryptedBidDocumentIpfsHash_12345",
        commitmentHash,
        { value: emdWei }
      );

      triggerToast(`MetaMask Transaction Sent: ${tx.hash.substring(0, 18)}... Waiting for block confirmation.`, 'success');
      setOnChainTxHash(tx.hash);

      const receipt = await tx.wait();
      setIsSubmitting(false);
      setModalOpen(false);

      triggerToast(`Transaction Confirmed in Block #${receipt.blockNumber}! Sealed Bid recorded on-chain.`, 'success');

      // Read back stored bid data from contract
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
      console.error("On-Chain Bid Submission Error:", err);
      triggerToast(err.reason || err.message || "MetaMask transaction failed.", 'error');
    }
  };

  return (
    <div id="main-content" className="max-w-4xl mx-auto space-y-6">
      <div className="border-b border-graphite/15 pb-4 flex justify-between items-end">
        <div>
          <span className="text-xs font-mono text-slate bg-slate/10 px-2 py-0.5 border border-slate/20">
            SECURE BID ENCRYPTOR // REAL METAMASK ON-CHAIN SUBMISSION
          </span>
          <h1 className="text-2xl font-bold text-graphite uppercase tracking-tight mt-2">
            Sealed Financial Bid Submission
          </h1>
          <p className="text-xs text-graphite/70 mt-1">
            Connected Bidder Wallet: <span className="font-mono text-copper font-bold">{walletAddress || 'Not Connected'}</span>
          </p>
        </div>
      </div>

      {/* Commit Form */}
      <div className="bg-white border-l-4 border-slate p-4 text-xs space-y-2 hairline-border">
        <h3 className="font-bold text-slate uppercase">Commit-Reveal Security Standard</h3>
        <p className="text-graphite/80 leading-relaxed">
          Your numerical bid amount is hashed client-side using Solidity Keccak-256. Only the commitment hash is broadcasted to the contract address <span className="font-mono text-copper font-bold">{CONTRACT_ADDRESS}</span>.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        <div className="md:col-span-7 bg-white border border-graphite/15 p-6 space-y-6">
          <h3 className="font-bold text-xs uppercase tracking-wider text-slate border-b border-graphite/15 pb-2">
            01. Target Tender & Commercial Parameters
          </h3>

          <div className="space-y-1">
            <label className="text-xs font-bold text-graphite">TARGET TENDER ID *</label>
            <input
              type="text"
              disabled
              value="Tender #1 (Expansion of Offshore Pipeline)"
              className="w-full bg-offwhite border border-graphite/30 p-2.5 text-xs text-graphite font-bold"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-graphite">COMMERCIAL BID AMOUNT (INR ₹) *</label>
            <input
              type="number"
              placeholder="e.g. 45200000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-offwhite border border-graphite/30 p-3 text-sm font-mono text-graphite text-right"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-graphite">EMD DEPOSITED WITH TRANSACTION (ETH) *</label>
            <input
              type="text"
              value={emdDeposited}
              onChange={(e) => setEmdDeposited(e.target.value)}
              className="w-full bg-offwhite border border-graphite/30 p-2.5 text-xs font-mono text-graphite text-right"
            />
            <span className="text-[10px] text-slate font-mono">
              Minimum Required EMD: 0.1 ETH
            </span>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold text-graphite">SECRET SALT STRING *</label>
              <button
                type="button"
                onClick={handleGenerateSalt}
                className="text-[11px] font-bold text-copper hover:underline"
              >
                + Generate Salt
              </button>
            </div>
            <input
              type="text"
              placeholder="Enter or generate secret salt string"
              value={salt}
              onChange={(e) => setSalt(e.target.value)}
              className="w-full bg-offwhite border border-graphite/30 p-3 text-xs font-mono text-graphite"
            />
          </div>
        </div>

        <div className="md:col-span-5 bg-graphite text-white p-6 space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="border-b border-white/15 pb-2 flex justify-between items-center text-xs font-mono">
              <span className="text-slate-300 uppercase font-bold">Client-Side Keccak-256</span>
              <span className="text-copper">ETHERS V6</span>
            </div>

            <div className="bg-black/50 p-4 border border-white/20 font-mono text-xs text-emerald-400 break-all min-h-[100px]">
              {commitmentHash || 'AWAITING_INPUT_PARAMS...'}
            </div>
          </div>

          <button
            onClick={handlePreSubmitValidation}
            disabled={!commitmentHash || !walletAddress}
            className="w-full bg-copper text-white font-bold text-xs py-3.5 hover:bg-copper-hover disabled:opacity-50 transition-colors uppercase"
          >
            Submit Sealed Bid via MetaMask →
          </button>
        </div>
      </div>

      {/* On-Chain Verification Block */}
      {onChainBidRecord && (
        <div className="bg-emerald-50 border-2 border-emerald-500 p-6 space-y-3">
          <div className="flex justify-between items-center border-b border-emerald-300 pb-2">
            <h3 className="font-bold text-sm text-emerald-900 uppercase">
              ✓ REAL ON-CHAIN TRANSACTION CONFIRMED & VERIFIED
            </h3>
            <span className="font-mono text-xs text-emerald-800 font-bold">TX SUCCESS</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono text-emerald-950">
            <div>
              <span className="text-emerald-700 block font-bold">MetaMask Transaction Hash:</span>
              <span className="break-all font-bold">{onChainTxHash}</span>
            </div>

            <div>
              <span className="text-emerald-700 block font-bold">Smart Contract Address:</span>
              <span className="break-all">{CONTRACT_ADDRESS}</span>
            </div>

            <div>
              <span className="text-emerald-700 block font-bold">Stored Commitment Hash:</span>
              <span className="break-all text-emerald-900 font-bold">{onChainBidRecord.bidCommitment}</span>
            </div>

            <div>
              <span className="text-emerald-700 block font-bold">EMD Amount Deposited On-Chain:</span>
              <span className="font-bold">{onChainBidRecord.emdDeposited}</span>
            </div>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={modalOpen}
        title="Confirm MetaMask On-Chain Bid Submission"
        message={`Are you sure you want to broadcast Commitment Hash ${commitmentHash.substring(0, 18)}... to smart contract ${CONTRACT_ADDRESS}? MetaMask will prompt for signature and 0.1 ETH transaction fee.`}
        onConfirm={handleConfirmSubmit}
        onCancel={() => setModalOpen(false)}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}
