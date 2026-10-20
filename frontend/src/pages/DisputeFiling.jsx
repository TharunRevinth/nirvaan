import React, { useState } from 'react';
import { ethers } from 'ethers';
import ConfirmationModal from '../components/ConfirmationModal';
import { useAuth } from '../context/AuthContext';
import { CONTRACT_ADDRESS } from '../config';
import { uploadDocumentToIpfs } from '../utils/ipfs';
import { ensureCorrectChain } from '../utils/chain';

export default function DisputeFiling({ triggerToast, tenders = [] }) {
  const { walletAddress } = useAuth();

  const [selectedTenderId, setSelectedTenderId] = useState(tenders[0]?.id || '');
  const [reason, setReason] = useState('Technical Specification Exclusion');
  const [description, setDescription] = useState('');
  const [evidenceFile, setEvidenceFile] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentTender = tenders.find(t => t.id === selectedTenderId) || tenders[0];

  const winningVendorAddress = currentTender?.winnerAddress || '';
  const isWinningVendor = walletAddress && winningVendorAddress && walletAddress.toLowerCase() === winningVendorAddress.toLowerCase();

  const handlePreSubmitValidation = () => {
    if (!walletAddress) {
      triggerToast('Please connect your authorized Web3 wallet first.', 'error');
      return;
    }

    if (!currentTender?.onChainId) {
      triggerToast('Please select a valid tender package.', 'error');
      return;
    }

    if (isWinningVendor) {
      triggerToast('Ineligible: Winning bidders awarded contracts cannot file disputes against their own award.', 'error');
      return;
    }

    if (currentTender.appealWindowClosed) {
      triggerToast(`Dispute Window Closed: The statutory appeal window for Tender #${currentTender.onChainId} has expired.`, 'error');
      return;
    }

    if (!description.trim()) {
      triggerToast('Please provide detailed factual grounds for your appeal.', 'error');
      return;
    }

    setModalOpen(true);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      if (!window.ethereum) {
        throw new Error("Web3 wallet required: Disputes must be cryptographically signed and submitted directly by the vendor's own authorized wallet.");
      }

      await ensureCorrectChain();

      // 1. Upload Dispute Evidence to IPFS and obtain REAL CID
      let fileToUpload = evidenceFile;
      if (!fileToUpload) {
        const payload = {
          tenderId: currentTender.onChainId,
          tenderCode: currentTender.id,
          challenger: walletAddress,
          reasonCategory: reason,
          factualGrounds: description,
          timestamp: new Date().toISOString()
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        fileToUpload = new File([blob], `dispute-evidence-${currentTender.onChainId}.json`, { type: 'application/json' });
      }

      triggerToast('Uploading dispute evidence dossier to IPFS…', 'info');
      const ipfsResult = await uploadDocumentToIpfs(fileToUpload);
      const realCid = ipfsResult.hash;

      // 2. Execute on-chain disputeTender with the real IPFS CID and 1.0 ETH bond
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const abi = [
        "function disputeTender(uint256 _tenderId, string memory _reasonIpfsHash) external payable"
      ];
      const contract = new ethers.Contract(CONTRACT_ADDRESS, abi, signer);

      const tx = await contract.disputeTender(
        Number(currentTender.onChainId),
        realCid,
        { value: ethers.parseEther("1.0") }
      );

      triggerToast(`Dispute transaction submitted: ${tx.hash.substring(0, 18)}…`, 'info');
      const receipt = await tx.wait();

      setIsSubmitting(false);
      setModalOpen(false);
      triggerToast(`Dispute filed on-chain for Tender #${currentTender.onChainId}. 1.0 ETH bond locked in escrow (Block #${receipt.blockNumber}). Evidence CID: ${realCid}`, 'success');
    } catch (err) {
      setIsSubmitting(false);
      setModalOpen(false);
      console.error("Dispute filing error:", err);
      triggerToast(`Dispute filing error: ${err.reason || err.message}`, 'error');
    }
  };

  return (
    <div id="main-content" className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="border-b border-[#E8E6E1] pb-4 flex flex-col sm:flex-row justify-between sm:items-end gap-3">
        <div className="space-y-1">
          <span className="text-[11px] font-mono font-semibold uppercase text-[#71716D] tracking-wider">
            CVC Grievance Redressal • Statutory Appeals
          </span>
          <h1 className="text-2xl font-bold text-[#1A1A18] tracking-tight">
            File Tender Dispute &amp; Escrow Bond
          </h1>
          <p className="text-xs text-[#575753]">
            Governed under Central Vigilance Commission (CVC) Procurement Guidelines.
          </p>
        </div>

        <div className="text-left sm:text-right font-mono text-xs tabular-nums">
          <span className="text-[#71716D] block">Appeal Window:</span>
          <span className={`font-semibold ${currentTender?.appealWindowClosed ? 'text-red-700' : 'text-emerald-700'}`}>
            {currentTender?.appealWindowClosed ? 'Closed (Expired)' : 'Open For Dispute'}
          </span>
        </div>
      </div>

      {isWinningVendor && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-xs text-red-900 font-medium">
          Ineligible to Dispute: Your wallet is registered as the awarded L1 Winner for this contract. Winning vendors cannot appeal their own awarded contracts.
        </div>
      )}

      {/* Escrow Mechanism Note */}
      <div className="bg-[#FAFAF9] border border-[#E8E6E1] rounded-xl p-4 text-xs space-y-1">
        <h3 className="font-semibold text-[#1A1A18] text-xs">
          Dispute Escrow Smart Contract Mechanism
        </h3>
        <p className="text-[#575753] leading-relaxed">
          Filing a dispute triggers a standstill hold on tender finalization on the blockchain. A refundable Dispute Bond of 1.0 ETH is locked in escrow during CVC auditor review. If the dispute is upheld, the bond is refunded. If dismissed, it is forfeited to the consortium treasury.
        </p>
      </div>

      {/* Dispute Form */}
      <div className="bg-white border border-[#E8E6E1] rounded-2xl p-6 sm:p-8 space-y-6 shadow-xs">
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="dispute-tender-select" className="text-xs font-medium text-[#1A1A18]">
                Target Tender Reference *
              </label>
              <select
                id="dispute-tender-select"
                value={selectedTenderId}
                onChange={(e) => setSelectedTenderId(e.target.value)}
                className="w-full bg-white border border-[#E8E6E1] rounded-lg px-3 py-2 text-xs font-mono text-[#1A1A18] font-medium cursor-pointer focus-visible:ring-2 focus-visible:ring-[#A13D2B] focus-visible:outline-none"
              >
                {tenders.map(t => (
                  <option key={t.id} value={t.id}>
                    #{t.onChainId} — {t.id} — {t.title} ({t.appealWindowClosed ? 'CLOSED' : 'OPEN'})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="dispute-reason-select" className="text-xs font-medium text-[#1A1A18]">
                Dispute Ground / Category *
              </label>
              <select
                id="dispute-reason-select"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full bg-white border border-[#E8E6E1] rounded-lg px-3 py-2 text-xs text-[#1A1A18] cursor-pointer focus-visible:ring-2 focus-visible:ring-[#A13D2B] focus-visible:outline-none"
              >
                <option value="Technical Specification Exclusion">Technical Specification Exclusion</option>
                <option value="Unfair Evaluation / L1 Calculation Mismatch">Unfair Evaluation / L1 Calculation Mismatch</option>
                <option value="Procedural Deadline Irregularity">Procedural Deadline Irregularity</option>
                <option value="Bid Opening Collusion Suspicions">Bid Opening Collusion Suspicions</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="dispute-grounds-input" className="text-xs font-medium text-[#1A1A18]">
              Detailed Factual Grounds for Appeal *
            </label>
            <textarea
              id="dispute-grounds-input"
              required
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Specify technical or procedural clauses breached according to CVC manual…"
              className="w-full bg-white border border-[#E8E6E1] rounded-lg px-3 py-2 text-xs text-[#1A1A18] placeholder:text-[#A8A7A1] focus-visible:ring-2 focus-visible:ring-[#A13D2B] focus-visible:outline-none leading-relaxed"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#1A1A18]">
              Supporting Evidence Document (PDF Dossier)
            </label>
            <input
              type="file"
              accept=".pdf,.json,.txt,.png"
              onChange={(e) => setEvidenceFile(e.target.files[0] || null)}
              className="w-full text-xs text-[#575753] file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-[#1A1A18] file:text-white hover:file:bg-black cursor-pointer"
            />
            <span className="text-[11px] text-[#71716D] block">
              Evidence will be cryptographically anchored to IPFS and the real multihash submitted to the smart contract.
            </span>
          </div>
        </div>

        <div className="border-t border-[#E8E6E1] pt-4 flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="text-xs font-mono">
            Required Escrow Bond: <strong className="text-amber-900">1.0 ETH</strong>
          </div>

          <button
            type="button"
            disabled={isSubmitting || isWinningVendor || currentTender?.appealWindowClosed}
            onClick={handlePreSubmitValidation}
            className="w-full sm:w-auto bg-[#A13D2B] hover:bg-[#8A3323] disabled:bg-[#A8A7A1] text-white font-semibold text-xs px-6 py-2.5 rounded-lg transition-colors cursor-pointer"
          >
            Review &amp; Lock 1.0 ETH Dispute Bond →
          </button>
        </div>
      </div>

      <ConfirmationModal
        isOpen={modalOpen}
        title="Confirm Dispute Filing & Escrow Deposit"
        message={`Upload evidence to IPFS and lock 1.0 ETH dispute bond in smart contract escrow for Tender #${currentTender?.onChainId}? This triggers a formal CVC investigation.`}
        onConfirm={handleSubmit}
        onCancel={() => setModalOpen(false)}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}
