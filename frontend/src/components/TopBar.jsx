import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function TopBar() {
  const navigate = useNavigate();
  const { 
    walletAddress, 
    disconnectVendorWallet, 
    officerUser, 
    logoutOfficerSession, 
    selectedPSU, 
    setSelectedPSU,
    isVendorRegistered
  } = useAuth();

  return (
    <header className="bg-white border-b border-[#E8E6E1] px-6 py-3.5 flex justify-between items-center w-full sticky top-0 z-40">
      <div className="flex items-center gap-6">
        <div 
          onClick={() => navigate('/')} 
          className="flex items-center gap-3 cursor-pointer group"
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter') navigate('/'); }}
          aria-label="NIRVAAN Home"
        >
          <div className="w-8 h-8 rounded-lg bg-[#1A1A18] text-white flex items-center justify-center font-bold text-xs tracking-wider">
            NVN
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm tracking-tight text-[#1A1A18]">
                NIRVAAN
              </span>
              <span className="text-[#E8E6E1]" aria-hidden="true">|</span>
              <span className="text-xs font-medium text-[#71716D]">
                {officerUser ? `${selectedPSU} Procurement Cell` : 'Unified E-Tendering Platform'}
              </span>
            </div>
            <p className="text-[11px] text-[#71716D] font-mono tabular-nums flex items-center gap-2">
              <span>Besu Consortium Chain</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
              <span className="text-emerald-700 font-medium">0.00 Gwei</span>
            </p>
          </div>
        </div>

        {/* PSU Selector Pills (Visible for PSU Officers) */}
        {officerUser && (
          <div className="hidden lg:flex p-0.5 rounded-lg bg-[#F5F4F0] border border-[#E8E6E1] gap-1" role="group" aria-label="Select PSU Entity">
            {['IOCL', 'BPCL', 'HPCL', 'ONGC', 'GAIL'].map((psu) => (
              <button
                key={psu}
                type="button"
                onClick={() => setSelectedPSU(psu)}
                aria-label={`Select ${psu}`}
                aria-pressed={selectedPSU === psu}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all focus-visible:ring-2 focus-visible:ring-[#A13D2B] focus-visible:outline-none ${
                  selectedPSU === psu 
                    ? 'bg-white text-[#1A1A18] shadow-sm font-bold border border-[#E8E6E1]' 
                    : 'text-[#71716D] hover:text-[#1A1A18]'
                }`}
              >
                {psu}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-4">
        <Link 
          to="/about"
          className="text-xs font-medium text-[#71716D] hover:text-[#1A1A18] transition-colors px-2 py-1 rounded focus-visible:ring-2 focus-visible:ring-[#A13D2B] focus-visible:outline-none"
        >
          About Platform
        </Link>

        {/* Officer Active Session Indicator */}
        {officerUser && (
          <div className="flex items-center gap-2.5 rounded-lg border border-[#E8E6E1] bg-[#FAFAF9] px-3 py-1.5 text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-600" aria-hidden="true"></span>
            <span className="text-[#575753]">Officer: <strong className="text-[#1A1A18]">{officerUser.username}</strong></span>
            <span className="font-mono text-[10px] text-[#1A1A18] bg-[#E8E6E1] font-bold px-1.5 py-0.5 rounded uppercase">{officerUser.psu}</span>
            <button 
              type="button"
              onClick={() => {
                logoutOfficerSession();
                navigate('/');
              }} 
              className="text-[#71716D] hover:text-red-700 text-xs ml-1 font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-[#A13D2B] focus-visible:outline-none px-1 rounded"
              aria-label="Sign out officer"
            >
              Sign Out
            </button>
          </div>
        )}

        {/* Vendor Wallet Session Indicator */}
        {walletAddress && !officerUser && (
          <div className="flex items-center gap-2.5 rounded-lg border border-[#E8E6E1] bg-[#FAFAF9] px-3 py-1.5 text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-600" aria-hidden="true"></span>
            <span className="font-mono text-[#1A1A18] font-medium tabular-nums">
              {walletAddress.substring(0, 6)}…{walletAddress.substring(walletAddress.length - 4)}
            </span>
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${isVendorRegistered ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-amber-50 text-amber-800 border border-amber-200'}`}>
              {isVendorRegistered ? 'KYC VERIFIED' : 'KYC PENDING'}
            </span>
            <button 
              type="button"
              onClick={() => {
                disconnectVendorWallet();
                navigate('/');
              }} 
              className="text-[#71716D] hover:text-red-700 text-xs ml-1 font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-[#A13D2B] focus-visible:outline-none px-1 rounded"
              aria-label="Disconnect vendor wallet"
            >
              Disconnect
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
