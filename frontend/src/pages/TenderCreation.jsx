import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ConfirmationModal from '../components/ConfirmationModal';
import { uploadDocumentToIpfs } from '../utils/ipfs';

function toDatetimeLocal(date) {
  const pad = (n) => String(n).padStart(2, '0');
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const hh = pad(date.getHours());
  const mm = pad(date.getMinutes());
  return `${y}-${m}-${d}T${hh}:${mm}`;
}

function formatDisplayDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

function getDefaultDeadline(days = 14) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(18, 0, 0, 0);
  return toDatetimeLocal(d);
}

function getDefaultOpening(deadlineIso) {
  const base = deadlineIso ? new Date(deadlineIso) : new Date();
  const d = new Date(base.getTime());
  d.setDate(d.getDate() + 1);
  d.setHours(10, 0, 0, 0);
  return toDatetimeLocal(d);
}

export default function TenderCreation({ selectedPSU, triggerToast, setTenders, tenders }) {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Pipeline Infrastructure');
  const [desc, setDesc] = useState('');
  const [deadline, setDeadline] = useState(() => getDefaultDeadline(14));
  const [opening, setOpening] = useState(() => getDefaultOpening(getDefaultDeadline(14)));
  const [emd, setEmd] = useState('500000');
  const [budget, setBudget] = useState('45000000');
  const [ipfsCid, setIpfsCid] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState('');

  const handleIpfsFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setSelectedFileName(file.name);
    setIsUploading(true);

    try {
      const result = await uploadDocumentToIpfs(file);
      setIpfsCid(result.hash);
      const sourceLabel = result.source === 'kubo-ipfs-node' || result.source === 'direct-kubo-node'
        ? 'IPFS Node'
        : result.source === 'backend-relay' || result.source === 'local-vault'
          ? 'Secure Vault'
          : 'Cryptographic Multihash';
      triggerToast(`Specification uploaded & anchored (${sourceLabel}). CID: ${result.hash}`, 'success');
    } catch (err) {
      console.error('IPFS upload error:', err);
      triggerToast(`Document upload failed: ${err.message}`, 'error');
    } finally {
      setIsUploading(false);
    }
  };
  
  const [modalOpen, setModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const minDateString = toDatetimeLocal(new Date());

  const handleDeadlineChange = (e) => {
    const val = e.target.value;
    setDeadline(val);
    if (!opening || new Date(opening).getTime() <= new Date(val).getTime()) {
      setOpening(getDefaultOpening(val));
    }
  };

  const handlePublish = async () => {
    if (new Date(opening).getTime() <= new Date(deadline).getTime()) {
      triggerToast('Public bid opening must be after the submission deadline.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const token = localStorage.getItem('officer_token');

      const res = await fetch('http://localhost:5000/api/tenders/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          ipfsHash: ipfsCid,
          submissionDeadline: deadline,
          openingTime: opening,
          minEMD: "0.1"
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Tender creation failed on server.');
      }

      setIsSubmitting(false);
      setModalOpen(false);

      const newId = `TND-26-${data.tenderId}-N`;
      const newTenderObj = {
        id: newId,
        psu: selectedPSU,
        category,
        title,
        desc,
        valueCr: (Number(budget) / 10000000).toFixed(2),
        emd: `${Number(emd).toLocaleString()} INR`,
        deadline: formatDisplayDate(deadline),
        opening: formatDisplayDate(opening),
        status: 'OPEN',
        cid: ipfsCid,
        txHash: data.txHash
      };

      setTenders([newTenderObj, ...tenders]);
      triggerToast(`NIT published on-chain. Tx: ${data.txHash.substring(0, 18)}…`, 'success');
      navigate('/psu/dashboard');
    } catch (err) {
      setIsSubmitting(false);
      setModalOpen(false);
      console.error("Tender creation error:", err);
      triggerToast(err.message, 'error');
    }
  };

  return (
    <div id="main-content" className="max-w-3xl mx-auto space-y-6">
      <div className="border-b border-[#E8E6E1] pb-4">
        <span className="text-[11px] font-mono font-semibold uppercase text-[#71716D] tracking-wider">
          Procurement Cell • NIT Formulation
        </span>
        <h1 className="text-2xl font-bold text-[#1A1A18] tracking-tight mt-1">
          Create Notice Inviting Tender (NIT)
        </h1>
        <p className="text-xs text-[#575753] mt-0.5">
          Publishing on behalf of <strong className="text-[#1A1A18]">{selectedPSU} Procurement Cell</strong>
        </p>
      </div>

      <div className="bg-white border border-[#E8E6E1] rounded-2xl p-6 sm:p-8 space-y-6 shadow-xs">
        <div className="space-y-4 pb-6 border-b border-[#E8E6E1]">
          <div className="space-y-1.5">
            <label htmlFor="tender-title-input" className="text-xs font-medium text-[#1A1A18] block">
              Tender Title / Work Description *
            </label>
            <input
              id="tender-title-input"
              name="title"
              type="text"
              required
              autoComplete="off"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Supply and Commissioning of Offshore Pipeline Valves"
              className="w-full bg-white border border-[#E8E6E1] rounded-lg px-3 py-2.5 text-xs text-[#1A1A18] placeholder:text-[#A8A7A1] focus-visible:ring-2 focus-visible:ring-[#A13D2B] focus-visible:outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="tender-category-select" className="text-xs font-medium text-[#1A1A18] block">
              Procurement Category *
            </label>
            <select
              id="tender-category-select"
              name="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-white border border-[#E8E6E1] rounded-lg px-3 py-2.5 text-xs text-[#1A1A18] cursor-pointer focus-visible:ring-2 focus-visible:ring-[#A13D2B] focus-visible:outline-none"
            >
              <option value="Pipeline Infrastructure">Pipeline Infrastructure</option>
              <option value="Heavy Machinery">Heavy Machinery</option>
              <option value="Consulting">Consulting</option>
              <option value="IT Infrastructure">IT Infrastructure</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="technical-specs-textarea" className="text-xs font-medium text-[#1A1A18] block">
              Technical Specification Details *
            </label>
            <textarea
              id="technical-specs-textarea"
              name="desc"
              required
              rows={4}
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Enter technical parameters, BIS standards, delivery schedules…"
              className="w-full bg-white border border-[#E8E6E1] rounded-lg px-3 py-2.5 text-xs text-[#1A1A18] placeholder:text-[#A8A7A1] focus-visible:ring-2 focus-visible:ring-[#A13D2B] focus-visible:outline-none leading-relaxed"
            />
          </div>
        </div>

        {/* Schedule & Financial Parameters */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6 border-b border-[#E8E6E1]">
          <div className="space-y-3.5">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-xs text-[#1A1A18] uppercase tracking-wider">
                Schedule Constraints
              </h2>
              <span className="text-[10px] font-mono text-[#71716D] bg-[#FAFAF9] px-1.5 py-0.5 border border-[#E8E6E1] rounded">
                CVC Guidelines: Min 14 Days
              </span>
            </div>

            {/* Date & Time GUI Pickers */}
            <div className="space-y-1.5">
              <label htmlFor="submission-deadline-input" className="text-xs font-medium text-[#1A1A18] block">
                Submission Deadline Date &amp; Time *
              </label>
              <input
                id="submission-deadline-input"
                name="deadline"
                type="datetime-local"
                min={minDateString}
                value={deadline}
                onChange={handleDeadlineChange}
                className="w-full bg-white border border-[#E8E6E1] rounded-lg px-3 py-2 text-xs font-mono text-[#1A1A18] tabular-nums focus-visible:ring-2 focus-visible:ring-[#A13D2B] focus-visible:outline-none cursor-pointer"
              />
              <p className="text-[11px] text-[#575753] font-mono">
                Closing: <span className="font-semibold text-[#1A1A18]">{formatDisplayDate(deadline)}</span>
              </p>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="opening-time-input" className="text-xs font-medium text-[#1A1A18] block">
                Public Bid Opening Date &amp; Time *
              </label>
              <input
                id="opening-time-input"
                name="opening"
                type="datetime-local"
                min={deadline || minDateString}
                value={opening}
                onChange={(e) => setOpening(e.target.value)}
                className="w-full bg-white border border-[#E8E6E1] rounded-lg px-3 py-2 text-xs font-mono text-[#1A1A18] tabular-nums focus-visible:ring-2 focus-visible:ring-[#A13D2B] focus-visible:outline-none cursor-pointer"
              />
              <p className="text-[11px] text-[#575753] font-mono">
                Opening: <span className="font-semibold text-[#1A1A18]">{formatDisplayDate(opening)}</span>
              </p>
              {opening && deadline && new Date(opening).getTime() <= new Date(deadline).getTime() && (
                <p className="text-[11px] text-red-600 font-medium">
                  ⚠️ Opening time must be scheduled strictly after the submission deadline.
                </p>
              )}
            </div>
          </div>

          <div className="space-y-3.5">
            <h2 className="font-semibold text-xs text-[#1A1A18] uppercase tracking-wider">
              Financial Specifications
            </h2>
            <div className="space-y-1.5">
              <label htmlFor="emd-amount-input" className="text-xs font-medium text-[#575753] block">
                Earnest Money Deposit (EMD ₹) *
              </label>
              <input
                id="emd-amount-input"
                name="emd"
                type="number"
                value={emd}
                onChange={(e) => setEmd(e.target.value)}
                className="w-full bg-white border border-[#E8E6E1] rounded-lg px-3 py-2 text-xs font-mono text-[#1A1A18] text-right tabular-nums focus-visible:ring-2 focus-visible:ring-[#A13D2B] focus-visible:outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="budget-amount-input" className="text-xs font-medium text-[#575753] block">
                Estimated Budget Value (INR ₹) *
              </label>
              <input
                id="budget-amount-input"
                name="budget"
                type="number"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                className="w-full bg-white border border-[#E8E6E1] rounded-lg px-3 py-2 text-xs font-mono font-semibold text-[#1A1A18] text-right tabular-nums focus-visible:ring-2 focus-visible:ring-[#A13D2B] focus-visible:outline-none"
              />
            </div>
          </div>
        </div>

        {/* IPFS Upload Box */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-[#1A1A18] block">Specification Document (IPFS Anchor)</label>
          <div className="border border-dashed border-[#E8E6E1] bg-[#FAFAF9] rounded-xl p-5 text-center space-y-2">
            <input 
              type="file" 
              id="ipfs-file-input"
              name="specFile"
              accept=".pdf,.doc,.docx,.txt"
              onChange={handleIpfsFileUpload}
              className="sr-only" 
            />
            <label 
              htmlFor="ipfs-file-input"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  document.getElementById('ipfs-file-input')?.click();
                }
              }}
              className="cursor-pointer inline-block bg-white border border-[#E8E6E1] text-[#1A1A18] hover:bg-[#F5F4F0] px-4 py-2 rounded-lg text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-[#A13D2B] focus-visible:outline-none"
            >
              {isUploading ? 'Uploading to IPFS…' : 'Select Specification Document (PDF)'}
            </label>
            {selectedFileName && (
              <p className="text-xs text-[#575753]">Selected: {selectedFileName}</p>
            )}
          </div>
          {ipfsCid ? (
            <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-200 text-xs font-mono text-emerald-900 flex justify-between items-center">
              <span className="break-all">IPFS CID: <strong className="font-bold select-all">{ipfsCid}</strong></span>
              <span className="text-emerald-700 font-bold shrink-0">[STORED]</span>
            </div>
          ) : (
            <p className="text-[11px] text-[#71716D]">
              Upload a specification PDF to generate an IPFS CID before publishing.
            </p>
          )}
        </div>

        <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
          {!title ? (
            <span className="text-xs text-[#71716D]">
              Note: Enter tender title and upload specification PDF above to enable publishing.
            </span>
          ) : !ipfsCid ? (
            <span className="text-xs text-[#71716D]">
              Note: Upload specification document to IPFS to enable publishing.
            </span>
          ) : (
            <span className="text-xs text-emerald-800 font-medium">
              ✓ Specification anchored on IPFS. Ready to publish on-chain.
            </span>
          )}

          <button
            type="button"
            onClick={() => setModalOpen(true)}
            disabled={!title || !ipfsCid}
            aria-disabled={!title || !ipfsCid}
            className={`font-semibold text-xs px-6 py-2.5 rounded-lg transition-all focus-visible:ring-2 focus-visible:ring-[#A13D2B] focus-visible:outline-none ${
              !title || !ipfsCid
                ? 'bg-[#E8E6E1] text-[#71716D] border border-[#E8E6E1] cursor-not-allowed shadow-none'
                : 'bg-[#A13D2B] hover:bg-[#8A3323] text-white shadow-xs cursor-pointer'
            }`}
          >
            Publish NIT &amp; Broadcast On-Chain →
          </button>
        </div>
      </div>

      <ConfirmationModal
        isOpen={modalOpen}
        title="Confirm NIT Publication"
        message={`Are you sure you want to publish the Notice Inviting Tender for "${title}" under ${selectedPSU}?`}
        onConfirm={handlePublish}
        onCancel={() => setModalOpen(false)}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}
