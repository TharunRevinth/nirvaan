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
  const [ipfsCid, setIpfsCid] = useState('QmYwAPJzv5CZsnA625s3Xf2sm5DyaRtPu8...1A2B');
  
  const [modalOpen, setModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handlePublish = () => {
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setModalOpen(false);

      const newId = `TND-26-${Math.floor(1000 + Math.random() * 9000)}-N`;
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
        cid: ipfsCid
      };

      setTenders([newTenderObj, ...tenders]);
      triggerToast(`Notice Inviting Tender ${newId} published on-chain with IPFS CID ${ipfsCid.substring(0, 16)}...`, 'success');
      navigate('/tenders');
    }, 1800);
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
          <label className="text-xs font-bold text-graphite">SPECIFICATION DOCUMENTATION (IPFS ANCHOR)</label>
          <div className="border border-dashed border-graphite/30 bg-offwhite p-4 text-center">
            <p className="text-xs text-graphite">Specification file uploaded to IPFS decentralized storage</p>
          </div>
          <div className="bg-slate/10 p-3 border border-slate/20 text-xs font-mono text-slate flex justify-between items-center">
            <span>GENERATED IPFS CID: <strong className="text-copper">{ipfsCid}</strong></span>
            <span className="text-emerald-700 font-bold">[VERIFIED]</span>
          </div>
        </div>

        <div className="pt-4 border-t border-graphite/15 flex justify-end gap-3">
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            disabled={!title}
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
