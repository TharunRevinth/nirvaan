import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import ConfirmationModal from '../components/ConfirmationModal';
import { useAuth } from '../context/AuthContext';
import { CONTRACT_ADDRESS, RPC_URL } from '../config';
import { uploadDocumentToIpfs } from '../utils/ipfs';
import { ensureCorrectChain, decodeContractError } from '../utils/chain';

export default function DisputeFiling({ triggerToast, tenders = [] }) {
  const { walletAddress } = useAuth();

  const [selectedTenderId, setSelectedTenderId] = useState(tenders[0]?.id || '');
  const [reason, setReason] = useState('Technical Specification Exclusion');
  const [description, setDescription] = useState('');
  const [evidenceFile, setEvidenceFile] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Dynamic on-chain dispute bond state (read from contract at runtime)
  const [bondEth, setBondEth] = useState('0.01');
  const [bondWei, setBondWei] = useState(ethers.parseEther('0.01'));
  const [loadingBond, setLoadingBond] = useState(true);

  // Read disputeBondAmount dynamically from on-chain contract
  useEffect(() => {
    let isMounted = true;
    async function loadDisputeBond() {
      if (!CONTRACT_ADDRESS) return;
      try {
        const provider = window.ethereum
          ? new ethers.BrowserProvider(window.ethereum)
          : new ethers.JsonRpcProvider(RPC_URL, undefined, { staticNetwork: true });
        const abi = ["function disputeBondAmount() external view returns (uint256)"];
        const contract = new ethers.Contract(CONTRACT_ADDRESS, abi, provider);
        const bond = await contract.disputeBondAmount();
        if (isMounted) {
          setBondWei(bond);
          setBondEth(ethers.formatEther(bond));
          setLoadingBond(false);
        }
      } catch (err) {
        console.warn('Could not read disputeBondAmount from on-chain contract:', err.message);
        if (isMounted) setLoadingBond(false);
      }
    }
    loadDisputeBond();
    return () => { isMounted = false; };
  }, []);

  const currentTender = tenders.find(t => t.id === selectedTenderId) || tenders[0];
  const isAwarded = currentTender?.status === 'Awarded' || currentTender?.status === 'AWARDED';

  const winningVendorAddress = currentTender?.winnerAddress || '';
  const isWinningVendor = walletAddress && winningVendorAddress && walletAddress.toLowerCase() === winningVendorAddress.toLowerCase();

  const formatAppealDeadline = (t) => {
    if (!t) return 'Not available';
    if (!t.appealDeadline) {
      return isAwarded 
        ? '7-Day Standstill Window Active' 
        : 'Standstill not active (Tender not yet awarded)';
    }
    const val = t.appealDeadline;
    const d = typeof val === 'number' && val < 10000000000 
      ? new Date(val * 1000) 
      : new Date(val);
    return isNaN(d.getTime()) ? 'Not set' : d.toLocaleString();
  };

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

      // 2. Execute on-chain disputeTender with the real IPFS CID and dynamically read dispute bond
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const abi = [
        "function disputeTender(uint256 _tenderId, string memory _reasonIpfsHash) external payable",
        "function disputeBondAmount() external view returns (uint256)"
      ];
      const contract = new ethers.Contract(CONTRACT_ADDRESS, abi, signer);

      let requiredBond = bondWei;
      try {
        requiredBond = await contract.disputeBondAmount();
        setBondWei(requiredBond);
        setBondEth(ethers.formatEther(requiredBond));
      } catch (bondErr) {
        console.warn('Could not re-read disputeBondAmount, using loaded state:', bondErr.message);
      }

      const tx = await contract.disputeTender(
        Number(currentTender.onChainId),
        realCid,
        { value: requiredBond }
      );

      triggerToast(`Dispute transaction submitted: ${tx.hash.substring(0, 18)}…`, 'info');
      const receipt = await tx.wait();

      setIsSubmitting(false);
      setModalOpen(false);
      triggerToast(`Dispute filed on-chain for Tender #${currentTender.onChainId}. ${ethers.formatEther(requiredBond)} ETH bond locked in escrow (Block #${receipt.blockNumber}). Evidence CID: ${realCid}`, 'success');
    } catch (err) {
      setIsSubmitting(false);
      setModalOpen(false);
      console.error("Dispute filing error:", err);
      triggerToast(`Dispute filing error: ${decodeContractError(err)}`, 'error');
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

        <div className="text-left sm:text-right font-mono text-xs tabular-nums space-y-0.5">
          <div>
            <span className="text-[#71716D]">Appeal Status: </span>
            <span className={`font-semibold ${currentTender?.appealWindowClosed ? 'text-red-700' : isAwarded ? 'text-emerald-700' : 'text-amber-800'}`}>
              {currentTender?.appealWindowClosed ? 'Closed (Expired)' : isAwarded ? 'Open For Dispute' : 'Pending Tender Award'}
            </span>
          </div>
          <div>
            <span className="text-[#71716D]">Appeal Deadline: </span>
            <span className="font-semibold text-[#1A1A18]">{formatAppealDeadline(currentTender)}</span>
          </div>
        </div>
      </div>

      {isWinningVendor && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-xs text-red-900 font-medium">
          Ineligible to Dispute: Your wallet is registered as the awarded L1 Winner for this contract. Winning vendors cannot appeal their own awarded contracts.
        </div>
      )}

      {/* Escrow Mechanism Note */}
      <div className="bg-[#FAFAF9] border border-[#E8E6E1] rounded-xl p-4 text-xs space-y-2">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-1">
          <h3 className="font-semibold text-[#1A1A18] text-xs">
            Dispute Escrow Smart Contract Mechanism
          </h3>
          <span className="font-mono text-xs font-bold text-amber-900 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
            Required Dispute Bond: {loadingBond ? 'Loading…' : `${bondEth} ETH`}
          </span>
        </div>
        <p className="text-[#575753] leading-relaxed">
          Filing a dispute triggers an immediate standstill hold on tender finalization on the blockchain. A refundable Dispute Bond of <strong className="text-amber-900 font-mono">{loadingBond ? '...' : `${bondEth} ETH`}</strong> is locked in smart contract escrow during Central Vigilance Commission (CVC) review.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1 border-t border-[#E8E6E1]">
          <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-950">
            <span className="font-bold block text-[11px] uppercase tracking-wider text-emerald-900">Bond Refund Terms</span>
            <span className="text-[11px] leading-snug block">Refunded in full to the challenger wallet via pull payment if the dispute is upheld by the CVC Auditor or if the CVC resolution times out after 14 days.</span>
          </div>
          <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-950">
            <span className="font-bold block text-[11px] uppercase tracking-wider text-rose-900">Bond Forfeiture Terms</span>
            <span className="text-[11px] leading-snug block">Forfeited and permanently transferred to the government treasury if the dispute is formally dismissed by the CVC Auditor.</span>
          </div>
        </div>
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
            Required Escrow Bond: <strong className="text-amber-900">{loadingBond ? 'Loading…' : `${bondEth} ETH`}</strong>
          </div>

          <button
            type="button"
            disabled={isSubmitting || isWinningVendor || currentTender?.appealWindowClosed}
            onClick={handlePreSubmitValidation}
            className="w-full sm:w-auto bg-[#A13D2B] hover:bg-[#8A3323] disabled:bg-[#A8A7A1] text-white font-semibold text-xs px-6 py-2.5 rounded-lg transition-colors cursor-pointer"
          >
            Review &amp; Lock {bondEth} ETH Dispute Bond →
          </button>
        </div>
      </div>

      <ConfirmationModal
        isOpen={modalOpen}
        title="Confirm Dispute Filing & Escrow Deposit"
        message={`Upload evidence to IPFS and lock ${bondEth} ETH dispute bond in smart contract escrow for Tender #${currentTender?.onChainId}? This triggers a formal CVC investigation.`}
        onConfirm={handleSubmit}
        onCancel={() => setModalOpen(false)}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}
