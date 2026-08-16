import React from 'react';

export default function TopBar({ selectedPSU, setSelectedPSU, portalRole, setPortalRole, walletAddress, setWalletAddress }) {
  return (
    <header className="bg-white border-b border-graphite/15 px-6 py-3.5 flex justify-between items-center w-full max-w-container-max mx-auto z-40">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-copper flex items-center justify-center font-bold text-white text-sm tracking-wider">
            {selectedPSU.substring(0, 2)}
          </div>
          <div>
            <h1 className="font-bold text-base text-graphite tracking-tight uppercase">
              {selectedPSU} E-PROCUREMENT PORTAL
            </h1>
            <p className="text-xs text-slate font-mono">
              Consortium Block Chain Network // Zero Gas Price
            </p>
          </div>
        </div>

        {/* PSU Selector Pills */}
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
      </div>

      <div className="flex items-center gap-4">
        {/* Connected Wallet Indicator */}
        {walletAddress ? (
          <div className="flex items-center gap-2 border border-graphite/15 bg-offwhite px-3 py-1 text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse"></span>
            <span className="font-mono text-graphite font-semibold">
              {walletAddress.substring(0, 6)}...{walletAddress.substring(walletAddress.length - 4)}
            </span>
            <span className="text-[10px] text-slate uppercase bg-slate/10 px-1.5 py-0.5 ml-1 font-mono">Class-3 DSC</span>
            <button 
              onClick={() => setWalletAddress('')} 
              className="text-copper hover:underline text-[11px] ml-2 font-bold"
              aria-label="Disconnect wallet"
            >
              Disconnect
            </button>
          </div>
        ) : (
          <button 
            onClick={() => setWalletAddress('0xfe3b2075775791234567890abcdef1234567bd73')}
            className="bg-copper text-white font-bold text-xs px-3 py-1.5 hover:bg-copper-hover transition-colors border border-copper"
            aria-label="Connect Web3 Wallet"
          >
            Connect Wallet
          </button>
        )}

        {/* Role Portal Switcher */}
        <button
          onClick={() => setPortalRole(portalRole === 'PSU' ? 'Vendor' : 'PSU')}
          className="border border-graphite text-graphite font-bold text-xs px-3 py-1.5 hover:bg-graphite hover:text-white transition-colors uppercase"
          aria-label={`Switch to ${portalRole === 'PSU' ? 'Vendor' : 'PSU'} Portal`}
        >
          {portalRole === 'PSU' ? 'Switch to Vendor Portal' : 'Switch to PSU Officer Portal'}
        </button>
      </div>
    </header>
  );
}
