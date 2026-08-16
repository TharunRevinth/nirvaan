import React from 'react';
import { useNavigate } from 'react-router-dom';
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
    <header className="bg-white border-b border-graphite/15 px-6 py-3.5 flex justify-between items-center w-full max-w-container-max mx-auto z-40">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-copper flex items-center justify-center font-bold text-white text-sm tracking-wider">
            {officerUser ? selectedPSU.substring(0, 2) : 'GOI'}
          </div>
          <div>
            <h1 className="font-bold text-base text-graphite tracking-tight uppercase">
              {officerUser ? `${selectedPSU} E-PROCUREMENT PORTAL` : 'INDIAN OIL PSUs E-TENDERING SYSTEM'}
            </h1>
            <p className="text-xs text-slate font-mono">
              Consortium Blockchain Network // Zero Gas Price
            </p>
          </div>
        </div>

        {/* PSU Selector Pills (Visible only for PSU Officers) */}
        {officerUser && (
          <div className="hidden lg:flex border border-graphite/15 bg-offwhite">
            {['IOCL', 'BPCL', 'HPCL', 'ONGC', 'GAIL'].map((psu) => (
              <button
                key={psu}
                onClick={() => setSelectedPSU(psu)}
                aria-label={`Select ${psu}`}
                className={`px-2.5 py-1 text-xs font-bold transition-colors ${
                  selectedPSU === psu ? 'bg-graphite text-white' : 'text-graphite/70 hover:text-graphite'
                }`}
              >
                {psu}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-4">
        {/* Officer Active Session Indicator */}
        {officerUser && (
          <div className="flex items-center gap-2 border border-graphite/15 bg-offwhite px-3 py-1 text-xs">
            <span className="w-2 h-2 rounded-full bg-copper animate-pulse"></span>
            <span className="font-bold text-graphite">Officer: {officerUser.username}</span>
            <span className="font-mono text-[10px] text-slate uppercase bg-slate/10 px-1.5 py-0.5 ml-1">{officerUser.psu}</span>
            <button 
              onClick={() => {
                logoutOfficerSession();
                navigate('/');
              }} 
              className="text-copper hover:underline text-[11px] ml-2 font-bold"
              aria-label="Log out officer"
            >
              Sign Out
            </button>
          </div>
        )}

        {/* Vendor Wallet Session Indicator */}
        {walletAddress && !officerUser && (
          <div className="flex items-center gap-2 border border-graphite/15 bg-offwhite px-3 py-1 text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse"></span>
            <span className="font-mono text-graphite font-semibold">
              {walletAddress.substring(0, 6)}...{walletAddress.substring(walletAddress.length - 4)}
            </span>
            <span className={`text-[10px] font-mono px-1.5 py-0.5 ml-1 ${isVendorRegistered ? 'bg-emerald-100 text-emerald-800' : 'bg-amber/10 text-amber'}`}>
              {isVendorRegistered ? 'KYC VERIFIED' : 'KYC PENDING'}
            </span>
            <button 
              onClick={() => {
                disconnectVendorWallet();
                navigate('/');
              }} 
              className="text-copper hover:underline text-[11px] ml-2 font-bold"
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
