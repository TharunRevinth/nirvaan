import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { uploadDocumentToIpfs } from '../utils/ipfs';

export default function VendorRegistration({ walletAddress, triggerToast }) {
  const navigate = useNavigate();
  const { activateVendorSession } = useAuth();
  const [form, setForm] = useState({
    companyName: 'Reliance Offshore Logistics Pvt Ltd',
    gstin: '27AAACR12341Z5',
    pan: 'AAACR1234F',
    email: 'tenders@relianceoffshore.com',
  });

  const [kycIpfsCid, setKycIpfsCid] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleIpfsFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setSelectedFileName(file.name);
    setIsUploading(true);

    try {
      const result = await uploadDocumentToIpfs(file);
      setKycIpfsCid(result.hash);
      const sourceLabel = result.source === 'kubo-ipfs-node' || result.source === 'direct-kubo-node'
        ? 'IPFS Node'
        : result.source === 'backend-relay' || result.source === 'local-vault'
          ? 'Secure Vault'
          : 'Cryptographic Multihash';
      triggerToast(`KYC document verified & stored (${sourceLabel}). CID: ${result.hash}`, 'success');
    } catch (err) {
      console.error('IPFS upload error:', err);
      triggerToast(`KYC upload failed: ${err.message}`, 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!kycIpfsCid) {
      triggerToast('Please upload a corporate incorporation PDF first.', 'error');
      return;
    }

    const activeWallet = walletAddress || '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';

    setIsSubmitting(true);

    try {
      const res = await fetch('http://localhost:5000/api/vendors/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendorAddress: activeWallet,
          gstin: form.gstin,
          pan: form.pan,
          kycIpfsHash: kycIpfsCid
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Vendor registration failed.');
      }

      setIsSubmitting(false);
      if (activateVendorSession) {
        activateVendorSession(activeWallet);
      } else {
        localStorage.setItem('vendor_registered', 'true');
        localStorage.setItem('vendor_wallet', activeWallet);
      }
      const successMsg = data.alreadyRegistered
        ? 'Vendor KYC verified & active on-chain.'
        : `Vendor KYC verified and recorded on-chain. Tx: ${data.txHash?.substring(0, 18) || ''}…`;
      triggerToast(successMsg, 'success');
      navigate('/vendor/dashboard');
    } catch (err) {
      setIsSubmitting(false);
      console.error("Vendor registration error:", err);
      triggerToast(err.message, 'error');
    }
  };

  return (
    <div id="main-content" className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="border-b border-[#E8E6E1] pb-4 space-y-1">
        <span className="text-[11px] font-mono font-semibold uppercase text-[#71716D] tracking-wider">
          Vendor Onboarding • Tier-1 KYC Verification
        </span>
        <h1 className="text-2xl font-bold text-[#1A1A18] tracking-tight">
          Corporate KYC Registration
        </h1>
        <p className="text-xs text-[#575753]">
          Statutory verification under CVC Procurement Directives and IT Act 2000.
        </p>
      </div>

      {/* Form Card */}
      <form onSubmit={handleSubmit} className="bg-white border border-[#E8E6E1] rounded-2xl p-6 sm:p-8 space-y-6 shadow-xs">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5 md:col-span-2">
            <label htmlFor="vendor-company-name" className="text-xs font-medium text-[#1A1A18]">
              Company / Legal Entity Name *
            </label>
            <input
              id="vendor-company-name"
              type="text"
              required
              autoComplete="organization"
              value={form.companyName}
              onChange={(e) => setForm({ ...form, companyName: e.target.value })}
              className="w-full bg-white border border-[#E8E6E1] rounded-lg px-3 py-2.5 text-xs text-[#1A1A18] focus-visible:ring-2 focus-visible:ring-[#A13D2B] focus-visible:outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="vendor-gstin" className="text-xs font-medium text-[#1A1A18]">
              GSTIN (Goods &amp; Services Tax No.) *
            </label>
            <input
              id="vendor-gstin"
              type="text"
              required
              spellCheck={false}
              value={form.gstin}
              onChange={(e) => setForm({ ...form, gstin: e.target.value })}
              className="w-full bg-white border border-[#E8E6E1] rounded-lg px-3 py-2 text-xs font-mono text-[#1A1A18] focus-visible:ring-2 focus-visible:ring-[#A13D2B] focus-visible:outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="vendor-pan" className="text-xs font-medium text-[#1A1A18]">
              PAN (Permanent Account No.) *
            </label>
            <input
              id="vendor-pan"
              type="text"
              required
              spellCheck={false}
              value={form.pan}
              onChange={(e) => setForm({ ...form, pan: e.target.value })}
              className="w-full bg-white border border-[#E8E6E1] rounded-lg px-3 py-2 text-xs font-mono text-[#1A1A18] focus-visible:ring-2 focus-visible:ring-[#A13D2B] focus-visible:outline-none"
            />
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <label htmlFor="vendor-email" className="text-xs font-medium text-[#1A1A18]">
              Official Nodal Email Address *
            </label>
            <input
              id="vendor-email"
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full bg-white border border-[#E8E6E1] rounded-lg px-3 py-2 text-xs text-[#1A1A18] focus-visible:ring-2 focus-visible:ring-[#A13D2B] focus-visible:outline-none"
            />
          </div>
        </div>

        {/* Document Upload Section */}
        <div className="space-y-2 pt-4 border-t border-[#E8E6E1]">
          <label className="text-xs font-medium text-[#1A1A18] block">
            Incorporation Certificate (IPFS Anchor) *
          </label>
          
          <div className="border border-dashed border-[#E8E6E1] bg-[#FAFAF9] rounded-xl p-5 text-center space-y-2">
            <input 
              type="file" 
              id="kyc-ipfs-file-input"
              accept=".pdf,.doc,.docx,.txt"
              onChange={handleIpfsFileUpload}
              className="sr-only" 
            />
            <label 
              htmlFor="kyc-ipfs-file-input"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  document.getElementById('kyc-ipfs-file-input')?.click();
                }
              }}
              className="cursor-pointer inline-block bg-white border border-[#E8E6E1] text-[#1A1A18] hover:bg-[#F5F4F0] px-4 py-2 rounded-lg text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-[#A13D2B] focus-visible:outline-none"
            >
              {isUploading ? 'Uploading to IPFS…' : 'Select Incorporation Certificate (PDF)'}
            </label>

            {selectedFileName && (
              <p className="text-xs text-[#575753]">Selected: {selectedFileName}</p>
            )}
          </div>

          {kycIpfsCid ? (
            <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-200 text-xs font-mono text-emerald-900 flex justify-between items-center">
              <span>IPFS CID: <strong className="font-bold select-all">{kycIpfsCid}</strong></span>
              <span className="text-emerald-700 font-bold">[STORED]</span>
            </div>
          ) : (
            <p className="text-[11px] text-[#71716D]">
              Upload an incorporation certificate to generate an IPFS CID before registering.
            </p>
          )}
        </div>

        <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
          {!kycIpfsCid ? (
            <span className="text-xs text-[#71716D]">
              Note: Select and anchor your incorporation PDF above to enable registration.
            </span>
          ) : (
            <span className="text-xs text-emerald-800 font-medium">
              ✓ Incorporation certificate anchored. Ready to register.
            </span>
          )}

          <button
            type="submit"
            disabled={isSubmitting || !kycIpfsCid}
            aria-disabled={isSubmitting || !kycIpfsCid}
            className={`font-semibold text-xs px-6 py-2.5 rounded-lg transition-all focus-visible:ring-2 focus-visible:ring-[#A13D2B] focus-visible:outline-none ${
              !kycIpfsCid || isSubmitting
                ? 'bg-[#E8E6E1] text-[#71716D] border border-[#E8E6E1] cursor-not-allowed shadow-none'
                : 'bg-[#A13D2B] hover:bg-[#8A3323] text-white shadow-xs cursor-pointer'
            }`}
          >
            {isSubmitting ? 'Registering On-Chain…' : 'Register Corporate KYC →'}
          </button>
        </div>
      </form>
    </div>
  );
}
