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

  const handleVendorConnect = async () => {
    setPortalRole('Vendor');
    if (window.ethereum) {
      try {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        if (accounts && accounts.length > 0 && setWalletAddress) {
          setWalletAddress(accounts[0]);
        }
      } catch (e) {
        console.warn('Wallet connection request rejected:', e);
      }
    }
    navigate('/tenders');
  };

  return (
    <div id="main-content" className="max-w-5xl mx-auto py-8 px-4 space-y-8 animate-fade-in">
      <div className="text-center space-y-3">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold tracking-wider uppercase bg-amber-500/10 text-amber-400 border border-amber-500/30">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
          GOVERNMENT OF INDIA E-PROCUREMENT AUTHENTICATION GATEWAY
        </span>
        <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
          Select Official Sovereign Access Terminal
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 max-w-2xl mx-auto">
          Consortium entry requires verified Class-3 Digital Signature Certificates (DSC) or multi-factor PSU Officer SSO credentials.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
        {/* PSU Officer Login Box */}
        <div className="bezel-frame rounded-3xl p-1 bg-gradient-to-b from-amber-500/30 via-white/5 to-transparent shadow-2xl">
          <div className="bg-[#0b0e17]/95 backdrop-blur-xl rounded-[22px] p-6 sm:p-8 space-y-6 border border-white/10 h-full flex flex-col justify-between">
            <div className="space-y-4">
              <div className="border-b border-white/10 pb-4">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🏛️</span>
                  <h2 className="font-extrabold text-base text-white tracking-tight uppercase">
                    PSU Procurement Officer Terminal
                  </h2>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  For IOCL, HPCL, BPCL, ONGC, and GAIL Procurement Officers
                </p>
              </div>

              <form onSubmit={handleOfficerLogin} className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="officer-id-input" className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Officer / Employee ID *
                  </label>
                  <input
                    id="officer-id-input"
                    type="text"
                    required
                    autoComplete="username"
                    spellCheck={false}
                    value={officerId}
                    onChange={(e) => setOfficerId(e.target.value)}
                    placeholder="e.g. 88-X92-IOC"
                    className="w-full bg-[#07090e] border border-white/10 rounded-xl p-3.5 text-xs sm:text-sm font-mono text-amber-300 focus:border-amber-400/80 focus:ring-2 focus:ring-amber-400/20 focus:outline-none transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="officer-password-input" className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Password / Gov Token *
                  </label>
                  <input
                    id="officer-password-input"
                    type="password"
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full bg-[#07090e] border border-white/10 rounded-xl p-3.5 text-xs sm:text-sm text-white focus:border-amber-400/80 focus:ring-2 focus:ring-amber-400/20 focus:outline-none transition-all"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    className="w-full bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-black font-extrabold text-xs sm:text-sm py-3.5 rounded-xl shadow-[0_0_20px_rgba(245,158,11,0.25)] focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:outline-none transition-all uppercase tracking-wider"
                  >
                    Authenticate PSU Session →
                  </button>
                </div>
              </form>
            </div>

            <div className="text-[11px] text-slate-400 font-mono border-t border-white/10 pt-3 flex items-center justify-between">
              <span>SSO: NIC Parichay / e-Pramaan</span>
              <span className="text-emerald-400 font-bold">● ACTIVE</span>
            </div>
          </div>
        </div>

        {/* Vendor Wallet Connect Box */}
        <div className="bezel-frame rounded-3xl p-1 bg-gradient-to-b from-cyan-500/30 via-white/5 to-transparent shadow-2xl">
          <div className="bg-[#0b0e17]/95 backdrop-blur-xl rounded-[22px] p-6 sm:p-8 space-y-6 border border-white/10 h-full flex flex-col justify-between">
            <div className="space-y-4">
              <div className="border-b border-white/10 pb-4">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🦊</span>
                  <h2 className="font-extrabold text-base text-cyan-300 tracking-tight uppercase">
                    Commercial Vendor Web3 Terminal
                  </h2>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  For Registered Bidders & Industrial Suppliers
                </p>
              </div>

              <div className="space-y-4">
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  Connect your authorized Web3 cryptographic hardware token or browser wallet to encrypt and seal bids on the consortium blockchain.
                </p>

                <div className="bg-[#121624] p-4 rounded-xl border border-white/10 text-xs font-mono space-y-1.5">
                  <div className="text-white font-bold flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
                    Network: Indian Oil Consortium Besu
                  </div>
                  <div className="text-slate-400 text-[11px] tabular-nums">Chain ID: 1337 // Gas Price: 0 Gwei (Consortium Free)</div>
                </div>

                <button
                  type="button"
                  onClick={handleVendorConnect}
                  className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-extrabold text-xs sm:text-sm py-3.5 rounded-xl shadow-[0_0_20px_rgba(6,182,212,0.25)] focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none transition-all uppercase tracking-wider flex items-center justify-center gap-2"
                >
                  <span>🦊</span> Connect Web3 Wallet (MetaMask) →
                </button>
              </div>
            </div>

            <div className="text-[11px] text-slate-400 font-mono border-t border-white/10 pt-3 flex items-center justify-between">
              <span>New Vendor?</span>
              <a href="/register" className="text-amber-400 hover:text-amber-300 font-bold underline focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:outline-none rounded">
                Complete KYC Registration →
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
