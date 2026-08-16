import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Login({ setPortalRole, walletAddress, setWalletAddress }) {
  const navigate = useNavigate();
  const [officerId, setOfficerId] = useState('88-X92-IOC');
  const [password, setPassword] = useState('');

  const handleOfficerLogin = (e) => {
    e.preventDefault();
    setPortalRole('PSU');
    navigate('/tenders');
  };

  const handleVendorConnect = () => {
    setPortalRole('Vendor');
    setWalletAddress('0xfe3b2075775791234567890abcdef1234567bd73');
    navigate('/tenders');
  };

  return (
    <div id="main-content" className="max-w-4xl mx-auto py-10 px-4 space-y-8">
      <div className="text-center space-y-2">
        <span className="text-xs font-mono text-slate bg-slate/10 px-2 py-0.5 border border-slate/20">
          GOVERNMENT OF INDIA E-PROCUREMENT AUTHENTICATION GATEWAY
        </span>
        <h1 className="text-2xl font-bold text-graphite uppercase tracking-tight">
          Select Official Access Portal
        </h1>
        <p className="text-xs text-graphite/70 max-w-xl mx-auto">
          Access to the Indian Oil PSUs Consortium E-Tendering Platform requires verified Class-3 Digital Signature Certificates (DSC) or PSU SSO credentials.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* PSU Officer Login Box */}
        <div className="bg-white border-2 border-graphite p-6 space-y-6">
          <div className="border-b border-graphite/15 pb-3">
            <h2 className="font-bold text-sm text-graphite uppercase tracking-wider flex items-center gap-2">
              <span></span> PSU Authorized Officer Login
            </h2>
            <p className="text-[11px] text-slate mt-0.5">
              For IOCL, HPCL, BPCL, ONGC, and GAIL Procurement Officers
            </p>
          </div>

          <form onSubmit={handleOfficerLogin} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-graphite">OFFICER / EMPLOYEE ID</label>
              <input
                type="text"
                required
                value={officerId}
                onChange={(e) => setOfficerId(e.target.value)}
                placeholder="e.g. 88-X92-IOC"
                className="w-full bg-offwhite border border-graphite/30 p-2.5 text-xs font-mono text-graphite"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-graphite">PASSWORD / GOV TOKEN</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full bg-offwhite border border-graphite/30 p-2.5 text-xs text-graphite"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                className="w-full bg-graphite text-white font-bold text-xs py-3 hover:bg-slate transition-colors uppercase"
              >
                Authenticate PSU Session →
              </button>
            </div>
          </form>

          <div className="text-[11px] text-graphite/60 font-mono border-t border-graphite/10 pt-3">
            SSO Integration: NIC Parichay / e-Pramaan Ready
          </div>
        </div>

        {/* Vendor Wallet Connect Box */}
        <div className="bg-white border-2 border-copper p-6 space-y-6">
          <div className="border-b border-graphite/15 pb-3">
            <h2 className="font-bold text-sm text-copper uppercase tracking-wider flex items-center gap-2">
              <span></span> Vendor Class-3 Web3 Wallet Authentication
            </h2>
            <p className="text-[11px] text-slate mt-0.5">
              For Registered Bidders & Commercial Suppliers
            </p>
          </div>

          <div className="space-y-4">
            <p className="text-xs text-graphite leading-relaxed">
              Connect your authorized Web3 cryptographic hardware token or browser wallet (MetaMask / Hardware Key) to sign bid commitments on the consortium blockchain.
            </p>

            <div className="bg-offwhite p-3 border border-graphite/15 text-xs font-mono space-y-1">
              <div className="text-graphite font-bold">Network: Indian Oil Consortium Besu</div>
              <div className="text-slate text-[11px]">Chain ID: 1337 // Gas Price: 0 Gwei</div>
            </div>

            <button
              onClick={handleVendorConnect}
              className="w-full bg-copper text-white font-bold text-xs py-3 hover:bg-copper-hover transition-colors uppercase flex items-center justify-center gap-2"
            >
              Connect Hardware Wallet (MetaMask) →
            </button>
          </div>

          <div className="text-[11px] text-graphite/60 font-mono border-t border-graphite/10 pt-3">
            New Vendor? <a href="/register" className="text-copper underline font-bold">Complete KYC Registration</a>
          </div>
        </div>
      </div>
    </div>
  );
}
