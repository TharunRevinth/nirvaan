import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ConfirmationModal from '../components/ConfirmationModal';

export default function TenderCreation({ selectedPSU, triggerToast, setTenders, tenders }) {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Pipeline Infrastructure');
  const [desc, setDesc] = useState('');
  const [deadline, setDeadline] = useState('2026-12-01 18:00');
  const [opening, setOpening] = useState('2026-12-02 10:00');
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
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('http://127.0.0.1:5001/api/v0/add', {
        method: 'POST',
        body: formData
      });

      if (!res.ok) {
        throw new Error(`IPFS upload failed with status ${res.status}`);
      }

      const data = await res.json();
      setIpfsCid(data.Hash);
      triggerToast(`File uploaded to IPFS. Real CID: ${data.Hash}`, 'success');
    } catch (err) {
      console.error('IPFS upload error:', err);
      triggerToast(`IPFS Upload failed: ${err.message}`, 'error');
    } finally {
      setIsUploading(false);
    }
  };
  
  const [modalOpen, setModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handlePublish = async () => {
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
          minEMD: (Number(emd) / 10**18).toString() || "0.1" // converted for contract standard
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Tender creation failed on relay server.');
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
        deadline,
        opening,
        status: 'OPEN',
        cid: ipfsCid,
        txHash: data.txHash
      };

      setTenders([newTenderObj, ...tenders]);
      triggerToast(`Notice Inviting Tender published on-chain! Tx Hash: ${data.txHash.substring(0, 18)}...`, 'success');
      navigate('/tenders');
    } catch (err) {
      setIsSubmitting(false);
      setModalOpen(false);
      console.error("Tender creation error:", err);
      triggerToast(err.message, 'error');
    }
  };

  return (
    <div id="main-content" className="max-w-4xl mx-auto space-y-6">
      <div className="border-b border-graphite/15 pb-4">
        <span className="text-xs font-mono text-slate bg-slate/10 px-2 py-0.5 border border-slate/20">
          PSU PROCUREMENT CELL // FORMULATION PROTOCOL
        </span>
        <h1 className="text-2xl font-bold text-graphite uppercase tracking-tight mt-2">
          Formulate Notice Inviting Tender (NIT)
        </h1>
        <p className="text-xs text-graphite/70 mt-1">
          Authorized PSU Entity: {selectedPSU} Procurement Cell
        </p>
      </div>

      <div className="bg-white border border-graphite/15 p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 pb-6 border-b border-graphite/15">
          <div className="md:col-span-8 space-y-1">
            <label className="text-xs font-bold text-graphite">TENDER TITLE / WORK DESCRIPTION *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Procurement of Grade-A Offshore Pipeline Valves & Actuators"
              className="w-full bg-offwhite border border-graphite/30 p-2.5 text-xs text-graphite font-semibold"
            />
          </div>

          <div className="md:col-span-4 space-y-1">
            <label className="text-xs font-bold text-graphite">CATEGORY *</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-offwhite border border-graphite/30 p-2.5 text-xs text-graphite font-bold cursor-pointer"
            >
              <option value="Pipeline Infrastructure">Pipeline Infrastructure</option>
              <option value="Heavy Machinery">Heavy Machinery</option>
              <option value="Consulting">Consulting</option>
              <option value="IT Infrastructure">IT Infrastructure</option>
            </select>
          </div>

          <div className="md:col-span-12 space-y-1">
            <label className="text-xs font-bold text-graphite">TECHNICAL SPECIFICATION DETAILS *</label>
            <textarea
              required
              rows={4}
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Enter detailed technical standards, delivery scope, BIS benchmarks..."
              className="w-full bg-offwhite border border-graphite/30 p-2.5 text-xs text-graphite"
            />
          </div>
        </div>

        {/* Schedule & Financial Parameters */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6 border-b border-graphite/15">
          <div className="space-y-3">
            <h3 className="font-bold text-xs uppercase text-slate border-b border-graphite/15 pb-1">
              Schedule Constraints
            </h3>
            <div className="space-y-1">
              <label className="text-xs font-bold text-graphite">SUBMISSION DEADLINE (DATE & TIME) *</label>
              <input
                type="text"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full bg-offwhite border border-graphite/30 p-2.5 text-xs font-mono text-graphite"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-graphite">PUBLIC OPENING DATE & TIME *</label>
              <input
                type="text"
                value={opening}
                onChange={(e) => setOpening(e.target.value)}
                className="w-full bg-offwhite border border-graphite/30 p-2.5 text-xs font-mono text-graphite"
              />
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="font-bold text-xs uppercase text-slate border-b border-graphite/15 pb-1">
              Financial Specifications
            </h3>
            <div className="space-y-1">
              <label className="text-xs font-bold text-graphite">EARNEST MONEY DEPOSIT (EMD ₹) *</label>
              <input
                type="number"
                value={emd}
                onChange={(e) => setEmd(e.target.value)}
                className="w-full bg-offwhite border border-graphite/30 p-2.5 text-xs font-mono text-graphite text-right"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-graphite">ESTIMATED BUDGET VALUE (INR ₹) *</label>
              <input
                type="number"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                className="w-full bg-offwhite border border-graphite/30 p-2.5 text-xs font-mono text-graphite text-right"
              />
            </div>
          </div>
        </div>

        {/* IPFS Upload Box */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-graphite">SPECIFICATION DOCUMENTATION (REAL IPFS ANCHOR)</label>
          <div className="border border-dashed border-graphite/30 bg-offwhite p-4 text-center space-y-2">
            <input 
              type="file" 
              id="ipfs-file-input"
              accept=".pdf,.doc,.docx,.txt"
              onChange={handleIpfsFileUpload}
              className="hidden" 
            />
            <label 
              htmlFor="ipfs-file-input"
              className="cursor-pointer inline-block bg-graphite text-white px-4 py-2 text-xs font-bold hover:bg-slate transition-colors"
            >
              {isUploading ? 'Uploading to IPFS...' : 'Select Specification Document (PDF)'}
            </label>
            {selectedFileName && (
              <p className="text-xs text-graphite font-medium">Selected: {selectedFileName}</p>
            )}
          </div>
          {ipfsCid ? (
            <div className="bg-slate/10 p-3 border border-slate/20 text-xs font-mono text-slate flex justify-between items-center">
              <span>REAL IPFS CID: <strong className="text-copper font-bold select-all">{ipfsCid}</strong></span>
              <span className="text-emerald-700 font-bold">[STORED ON LOCAL KUBO IPFS]</span>
            </div>
          ) : (
            <div className="bg-amber/10 p-2.5 border border-amber/30 text-xs font-mono text-amber">
              ⚠️ Please upload a specification PDF to generate a real IPFS CID before publishing on-chain.
            </div>
          )}
        </div>

        <div className="pt-4 border-t border-graphite/15 flex justify-end gap-3">
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            disabled={!title || !ipfsCid}
            className="bg-copper text-white font-bold text-xs px-6 py-3 hover:bg-copper-hover disabled:opacity-50 transition-colors uppercase"
          >
            Publish NIT & Sign On-Chain →
          </button>
        </div>
      </div>

      <ConfirmationModal
        isOpen={modalOpen}
        title="Confirm NIT Publication"
        message={`Are you sure you want to sign and publish Notice Inviting Tender for "${title}" on-chain under ${selectedPSU}?`}
        onConfirm={handlePublish}
        onCancel={() => setModalOpen(false)}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}
