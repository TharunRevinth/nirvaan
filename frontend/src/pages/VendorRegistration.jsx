import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { uploadDocumentToIpfs } from '../utils/ipfs';
import { API_URL } from '../config';

export default function VendorRegistration({ walletAddress: propWallet, triggerToast }) {
  const navigate = useNavigate();
  const { walletAddress: ctxWallet, activateVendorSession } = useAuth();
  const walletAddress = propWallet || ctxWallet;

  const [kycStatus, setKycStatus] = useState('LOADING'); // 'LOADING' | 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED'
  const [appDetails, setAppDetails] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [form, setForm] = useState({
    companyName: 'Reliance Offshore Logistics Pvt Ltd',
    gstin: '27AAACR1234F1Z5',
    pan: 'AAACR1234F',
    email: 'tenders@relianceoffshore.com',
  });

  const [kycIpfsCid, setKycIpfsCid] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchStatus = useCallback(async (address) => {
    if (!address) {
      setKycStatus('NONE');
      return;
    }
    try {
      const res = await fetch(`${API_URL}/api/vendors/status/${address}`);
      if (res.ok) {
        const data = await res.json();
        setKycStatus(data.status || 'NONE');
        setAppDetails(data);
        if (data.status === 'APPROVED' && activateVendorSession) {
          activateVendorSession(address);
        }
      } else {
        setKycStatus('NONE');
      }
    } catch (err) {
      console.warn('Could not fetch vendor KYC status:', err.message);
      setKycStatus('NONE');
    }
  }, [activateVendorSession]);

  useEffect(() => {
    if (walletAddress) {
      setKycStatus('LOADING');
      fetchStatus(walletAddress);
    } else {
      setKycStatus('NONE');
    }
  }, [walletAddress, fetchStatus]);

  const handleRefresh = async () => {
    if (!walletAddress) return;
    setIsRefreshing(true);
    await fetchStatus(walletAddress);
    setIsRefreshing(false);
    triggerToast?.('Status refreshed from blockchain & registry.', 'info');
  };

  const handleIpfsFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setSelectedFileName(file.name);
    setIsUploading(true);

    try {
      const result = await uploadDocumentToIpfs(file);
      setKycIpfsCid(result.hash);
      triggerToast?.(`KYC document verified & pinned to IPFS. CID: ${result.hash}`, 'success');
    } catch (err) {
      console.error('IPFS upload error:', err);
      triggerToast?.(`KYC upload failed: ${err.message}`, 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!walletAddress) {
      triggerToast?.('Please connect your Web3 wallet first before submitting application.', 'error');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch(`${API_URL}/api/vendors/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress,
          companyName: form.companyName.trim(),
          gstin: form.gstin.trim().toUpperCase(),
          pan: form.pan.trim().toUpperCase(),
          kycCid: kycIpfsCid || null
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit KYC application.');
      }

      setIsSubmitting(false);
      setKycStatus('PENDING');
      setAppDetails(data.application || {
        companyName: form.companyName,
        gstin: form.gstin,
        pan: form.pan,
        kycCid: kycIpfsCid
      });
      triggerToast?.('KYC application submitted successfully! Awaiting PSU Officer verification.', 'success');
    } catch (err) {
      setIsSubmitting(false);
      console.error('Vendor application submission error:', err);
      triggerToast?.(err.message, 'error');
    }
  };

  return (
    <div id="main-content" className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="border-b border-[#E8E6E1] pb-4 space-y-1">
        <span className="text-[11px] font-mono font-semibold uppercase text-[#71716D] tracking-wider">
          Vendor Onboarding • Statutory KYC Verification
        </span>
        <h1 className="text-2xl font-bold text-[#1A1A18] tracking-tight">
          Corporate KYC Registration
        </h1>
        <p className="text-xs text-[#575753]">
          Statutory verification under CVC Procurement Directives and IT Act 2000. Submit your credentials for PSU Officer on-chain approval.
        </p>
      </div>

      {/* No Wallet Warning */}
      {!walletAddress && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-amber-900 text-xs space-y-2">
          <p className="font-semibold text-sm">Web3 Wallet Connection Required</p>
          <p className="text-amber-800">
            Please connect your Ethereum wallet (MetaMask or Web3 provider) using the header bar before submitting or checking KYC status.
          </p>
        </div>
      )}

      {/* State 1: Loading Status */}
      {walletAddress && kycStatus === 'LOADING' && (
        <div className="bg-white border border-[#E8E6E1] rounded-2xl p-8 text-center space-y-3">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-[#A13D2B] border-t-transparent"></div>
          <p className="text-xs text-[#575753]">Verifying on-chain credentials &amp; registry status…</p>
        </div>
      )}

      {/* State 2: KYC APPROVED (Active) */}
      {walletAddress && kycStatus === 'APPROVED' && (
        <div className="bg-white border border-emerald-200 rounded-2xl p-6 sm:p-8 space-y-6 shadow-xs">
          <div className="flex items-center justify-between pb-4 border-b border-emerald-100">
            <div className="flex items-center space-x-3">
              <span className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-lg">
                ✓
              </span>
              <div>
                <h2 className="text-base font-bold text-emerald-950">KYC Verified &amp; Active On-Chain</h2>
                <p className="text-xs text-emerald-700">Authorized for sealed bidding across Indian Oil PSUs</p>
              </div>
            </div>
            <span className="bg-emerald-100 text-emerald-900 font-mono text-[11px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
              APPROVED
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="bg-[#FAFAF9] p-3 rounded-lg border border-[#E8E6E1]">
              <span className="text-[#71716D] block font-mono text-[10px] uppercase">Registered Entity</span>
              <span className="font-semibold text-[#1A1A18] text-sm">{appDetails?.companyName || 'Verified Corporate Entity'}</span>
            </div>
            <div className="bg-[#FAFAF9] p-3 rounded-lg border border-[#E8E6E1]">
              <span className="text-[#71716D] block font-mono text-[10px] uppercase">Wallet Address</span>
              <span className="font-mono text-[#1A1A18] font-medium break-all">{walletAddress}</span>
            </div>
            {appDetails?.gstin && (
              <div className="bg-[#FAFAF9] p-3 rounded-lg border border-[#E8E6E1]">
                <span className="text-[#71716D] block font-mono text-[10px] uppercase">GSTIN (Verified)</span>
                <span className="font-mono font-semibold text-[#1A1A18]">{appDetails.gstin}</span>
              </div>
            )}
            {appDetails?.pan && (
              <div className="bg-[#FAFAF9] p-3 rounded-lg border border-[#E8E6E1]">
                <span className="text-[#71716D] block font-mono text-[10px] uppercase">PAN (Verified)</span>
                <span className="font-mono font-semibold text-[#1A1A18]">{appDetails.pan}</span>
              </div>
            )}
          </div>

          {appDetails?.txHash && (
            <div className="bg-[#FAFAF9] p-3 rounded-lg border border-[#E8E6E1] text-[11px] font-mono text-[#575753] flex justify-between items-center">
              <span>Registration Tx: {appDetails.txHash.slice(0, 16)}…{appDetails.txHash.slice(-8)}</span>
              <span className="text-emerald-700 font-bold">ON-CHAIN</span>
            </div>
          )}

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="text-xs text-[#575753] hover:text-[#1A1A18] font-medium transition-colors"
            >
              {isRefreshing ? 'Refreshing…' : '↻ Refresh Status'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/vendor/dashboard')}
              className="bg-[#A13D2B] hover:bg-[#8A3323] text-white font-semibold text-xs px-6 py-2.5 rounded-lg transition-all shadow-xs cursor-pointer"
            >
              Browse Active Tenders &amp; Submit Bids →
            </button>
          </div>
        </div>
      )}

      {/* State 3: KYC PENDING APPROVAL */}
      {walletAddress && kycStatus === 'PENDING' && (
        <div className="bg-white border border-amber-200 rounded-2xl p-6 sm:p-8 space-y-6 shadow-xs">
          <div className="flex items-center justify-between pb-4 border-b border-amber-100">
            <div className="flex items-center space-x-3">
              <span className="w-9 h-9 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-lg">
                ⏳
              </span>
              <div>
                <h2 className="text-base font-bold text-amber-950">Application Under Review</h2>
                <p className="text-xs text-amber-800">Submitted and pending approval by PSU Nodal Officer</p>
              </div>
            </div>
            <span className="bg-amber-100 text-amber-900 font-mono text-[11px] font-bold px-3 py-1 rounded-full uppercase tracking-wider animate-pulse">
              PENDING
            </span>
          </div>

          <p className="text-xs text-[#575753] leading-relaxed">
            Your statutory KYC documents have been submitted to the consortium registry. A designated PSU Officer will review your corporate documents and register your wallet on the smart contract. Once approved, your wallet will automatically be granted bidding access.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="bg-[#FAFAF9] p-3 rounded-lg border border-[#E8E6E1]">
              <span className="text-[#71716D] block font-mono text-[10px] uppercase">Entity Name</span>
              <span className="font-semibold text-[#1A1A18]">{appDetails?.companyName || form.companyName}</span>
            </div>
            <div className="bg-[#FAFAF9] p-3 rounded-lg border border-[#E8E6E1]">
              <span className="text-[#71716D] block font-mono text-[10px] uppercase">Wallet Address</span>
              <span className="font-mono text-[#1A1A18] font-medium break-all">{walletAddress}</span>
            </div>
            {appDetails?.gstin && (
              <div className="bg-[#FAFAF9] p-3 rounded-lg border border-[#E8E6E1]">
                <span className="text-[#71716D] block font-mono text-[10px] uppercase">GSTIN</span>
                <span className="font-mono text-[#1A1A18]">{appDetails.gstin}</span>
              </div>
            )}
            {appDetails?.pan && (
              <div className="bg-[#FAFAF9] p-3 rounded-lg border border-[#E8E6E1]">
                <span className="text-[#71716D] block font-mono text-[10px] uppercase">PAN</span>
                <span className="font-mono text-[#1A1A18]">{appDetails.pan}</span>
              </div>
            )}
          </div>

          {appDetails?.kycCid && (
            <div className="bg-[#FAFAF9] p-3 rounded-lg border border-[#E8E6E1] text-[11px] font-mono text-[#575753]">
              Pinned IPFS Document CID: <span className="text-[#1A1A18] font-semibold">{appDetails.kycCid}</span>
            </div>
          )}

          <div className="pt-2 flex items-center justify-between">
            <span className="text-[11px] text-[#71716D]">
              Submitted on: {appDetails?.createdAt ? new Date(appDetails.createdAt).toLocaleString('en-IN') : 'Recently'}
            </span>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="bg-[#FAFAF9] hover:bg-[#F5F4F0] border border-[#E8E6E1] text-[#1A1A18] font-semibold text-xs px-4 py-2 rounded-lg transition-colors cursor-pointer"
            >
              {isRefreshing ? 'Checking…' : '↻ Refresh Status'}
            </button>
          </div>
        </div>
      )}

      {/* State 4: KYC REJECTED */}
      {walletAddress && kycStatus === 'REJECTED' && (
        <div className="bg-white border border-rose-200 rounded-2xl p-6 sm:p-8 space-y-6 shadow-xs">
          <div className="flex items-center justify-between pb-4 border-b border-rose-100">
            <div className="flex items-center space-x-3">
              <span className="w-9 h-9 rounded-full bg-rose-100 text-rose-800 flex items-center justify-center font-bold text-lg">
                ✕
              </span>
              <div>
                <h2 className="text-base font-bold text-rose-950">Application Rejected</h2>
                <p className="text-xs text-rose-700">Your KYC submission did not meet verification criteria</p>
              </div>
            </div>
            <span className="bg-rose-100 text-rose-900 font-mono text-[11px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
              REJECTED
            </span>
          </div>

          <div className="bg-rose-50 border border-rose-200 rounded-lg p-4 text-xs text-rose-900 space-y-1">
            <span className="font-semibold block">Reason for Rejection:</span>
            <p>{appDetails?.rejectionReason || 'The submitted incorporation document or tax identification details could not be verified by the nodal officer.'}</p>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="button"
              onClick={() => {
                setKycStatus('NONE');
                setKycIpfsCid('');
                setSelectedFileName('');
              }}
              className="bg-[#A13D2B] hover:bg-[#8A3323] text-white font-semibold text-xs px-6 py-2.5 rounded-lg transition-all shadow-xs cursor-pointer"
            >
              Update Credentials &amp; Re-Apply →
            </button>
          </div>
        </div>
      )}

      {/* State 5: KYC Form (Initial or Re-Application) */}
      {walletAddress && kycStatus === 'NONE' && (
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
              Incorporation Certificate (IPFS Anchor)
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
                <span className="text-emerald-700 font-bold">[PINNED]</span>
              </div>
            ) : (
              <p className="text-[11px] text-[#71716D]">
                Upload an incorporation certificate to pin it to IPFS and attach to your KYC application.
              </p>
            )}
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
            <span className="text-xs text-[#71716D]">
              Submissions are recorded in the consortium ledger and verified by PSU Officers.
            </span>

            <button
              type="submit"
              disabled={isSubmitting}
              aria-disabled={isSubmitting}
              className={`font-semibold text-xs px-6 py-2.5 rounded-lg transition-all focus-visible:ring-2 focus-visible:ring-[#A13D2B] focus-visible:outline-none ${
                isSubmitting
                  ? 'bg-[#E8E6E1] text-[#71716D] border border-[#E8E6E1] cursor-not-allowed shadow-none'
                  : 'bg-[#A13D2B] hover:bg-[#8A3323] text-white shadow-xs cursor-pointer'
              }`}
            >
              {isSubmitting ? 'Submitting Application…' : 'Submit KYC Application →'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
