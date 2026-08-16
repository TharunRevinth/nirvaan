import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function VendorRegistration({ walletAddress, triggerToast }) {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    companyName: 'Reliance Offshore Logistics Pvt Ltd',
    gstin: '27AAACR12341Z5',
    pan: 'AAACR1234F',
    email: 'tenders@relianceoffshore.com',
    docName: 'mca21_incorporation_certificate.pdf',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    setTimeout(() => {
      setIsSubmitting(false);
      triggerToast('Vendor KYC Record verified and written to smart contract state (Transaction: 0x9f4a...b21c)', 'success');
      navigate('/tenders');
    }, 1500);
  };

  return (
    <div id="main-content" className="max-w-3xl mx-auto space-y-6">
      <div className="border-b border-graphite/15 pb-3">
        <span className="text-xs font-mono text-slate bg-slate/10 px-2 py-0.5 border border-slate/20">
          FORM // REGISTER-VENDOR-KYC-V1
        </span>
        <h1 className="text-2xl font-bold text-graphite uppercase tracking-tight mt-2">
          Vendor Onboarding & KYC Registration
        </h1>
        <p className="text-xs text-graphite/70 mt-1">
          Complete statutory verification under CVC Procurement Guidelines and Indian IT Act, 2000.
        </p>
      </div>

      {/* On-Chain Privacy & Identity Explanation Box */}
      <div className="bg-white border-l-4 border-copper p-4 text-xs space-y-1.5 hairline-border">
        <h3 className="font-bold text-graphite uppercase">Cryptographic Identity Verification Notice</h3>
        <p className="text-graphite/80 leading-relaxed">
          Your company GSTIN, PAN, and incorporation identity documents are verified against Government of India databases (GSTN & MCA21). A unique cryptographic hash of your corporate identity is stored immutably on the consortium blockchain state to prevent duplicate bidding and insider collusion.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white border border-graphite/15 p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1 md:col-span-2">
            <label className="text-xs font-bold text-graphite">COMPANY / LEGAL ENTITY NAME *</label>
            <input
              type="text"
              required
              value={form.companyName}
              onChange={(e) => setForm({ ...form, companyName: e.target.value })}
              className="w-full bg-offwhite border border-graphite/30 p-2.5 text-xs text-graphite font-medium"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-graphite">GSTIN (GOODS & SERVICES TAX NO.) *</label>
            <input
              type="text"
              required
              value={form.gstin}
              onChange={(e) => setForm({ ...form, gstin: e.target.value })}
              className="w-full bg-offwhite border border-graphite/30 p-2.5 text-xs font-mono text-graphite"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-graphite">PAN (PERMANENT ACCOUNT NO.) *</label>
            <input
              type="text"
              required
              value={form.pan}
              onChange={(e) => setForm({ ...form, pan: e.target.value })}
              className="w-full bg-offwhite border border-graphite/30 p-2.5 text-xs font-mono text-graphite"
            />
          </div>

          <div className="space-y-1 md:col-span-2">
            <label className="text-xs font-bold text-graphite">OFFICIAL NODAL EMAIL ADDRESS *</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full bg-offwhite border border-graphite/30 p-2.5 text-xs font-mono text-graphite"
            />
          </div>
        </div>

        {/* Document Upload Box */}
        <div className="space-y-2 pt-2 border-t border-graphite/15">
          <label className="text-xs font-bold text-graphite">CORPORATE INCORPORATION CERTIFICATE (PDF)</label>
          <div className="border border-dashed border-graphite/30 bg-offwhite p-4 text-center">
            <p className="text-xs text-graphite">Drag & drop verified document file here</p>
            <p className="text-[10px] text-slate font-mono mt-1">PDF format (Max 10MB)</p>
          </div>
          <div className="bg-slate/10 p-2 text-xs font-mono text-slate border border-slate/20">
            Selected: {form.docName}
          </div>
        </div>

        <div className="pt-4 border-t border-graphite/15 flex justify-end gap-3">
          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-copper text-white font-bold text-xs px-6 py-3 hover:bg-copper-hover disabled:opacity-50 transition-colors uppercase"
          >
            {isSubmitting ? 'Verifying & Registering On-Chain...' : 'Register Vendor & Sign On-Chain →'}
          </button>
        </div>
      </form>
    </div>
  );
}
