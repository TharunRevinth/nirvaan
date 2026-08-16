import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Sidebar() {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { officerUser, walletAddress, selectedPSU } = useAuth();

  const isOfficer = Boolean(officerUser);

  // Link sets scoped strictly to role
  const psuLinks = [
    { label: 'Active Tender Register', path: '/psu/dashboard' },
    { label: 'Notice Inviting Tender (NIT)', path: '/psu/create-tender' },
    { label: 'Bid Evaluation & Award', path: '/psu/evaluation' },
  ];

  const vendorLinks = [
    { label: 'Tender Browse', path: '/vendor/dashboard' },
    { label: 'Corporate KYC Registration', path: '/vendor/kyc' },
    { label: 'Sealed Bid Submission', path: '/vendor/submit-bid' },
    { label: 'Dispute Filing', path: '/vendor/dispute' },
  ];

  const activeLinks = isOfficer ? psuLinks : vendorLinks;

  return (
    <>
      {/* Mobile Hamburger Header */}
      <div className="md:hidden bg-graphite text-white px-4 py-2 flex justify-between items-center border-b border-graphite/20">
        <span className="font-bold text-xs">
          {isOfficer ? `PSU OFFICER PORTAL (${selectedPSU})` : 'VENDOR BIDDING PORTAL'}
        </span>
        <button 
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="text-white p-1 focus:outline-none focus:ring-2 focus:ring-copper"
          aria-label="Toggle Mobile Navigation Menu"
        >
          {mobileMenuOpen ? '✕ Close' : '☰ Menu'}
        </button>
      </div>

      {/* Main Sidebar Container */}
      <aside className={`${mobileMenuOpen ? 'block' : 'hidden'} md:block w-64 bg-white border-r border-graphite/15 shrink-0 z-30`}>
        {/* Header Badge */}
        <div className="p-5 border-b border-graphite/15 bg-offwhite/50">
          <div className="text-[11px] font-bold text-slate uppercase tracking-wider mb-1">
            {isOfficer ? 'Authorized PSU Entity' : 'Registered Vendor Entity'}
          </div>
          <h2 className="font-bold text-base text-graphite">
            {isOfficer ? `${selectedPSU} Procurement Cell` : 'Commercial Supplier'}
          </h2>
          <p className="font-mono text-xs text-graphite/70 mt-1">
            {isOfficer ? `Officer ID: ${officerUser.officerId}` : walletAddress ? `Wallet: ${walletAddress.substring(0, 8)}...` : 'Not Connected'}
          </p>
        </div>

        {/* Primary Action CTA Button */}
        <div className="p-4 border-b border-graphite/15">
          {isOfficer ? (
            <Link 
              to="/psu/create-tender"
              className="w-full bg-copper text-white font-bold text-xs py-2.5 px-3 flex items-center justify-center gap-2 hover:bg-copper-hover transition-colors border border-copper block text-center"
            >
              + Create New NIT Specification
            </Link>
          ) : (
            <Link 
              to="/vendor/submit-bid"
              className="w-full bg-slate text-white font-bold text-xs py-2.5 px-3 flex items-center justify-center gap-2 hover:bg-slate/90 transition-colors border border-slate block text-center"
            >
              🔒 Submit Sealed Bid
            </Link>
          )}
        </div>

        {/* Navigation List */}
        <nav className="py-3">
          <ul className="flex flex-col">
            {activeLinks.map((link) => {
              const isActive = location.pathname === link.path;
              return (
                <li key={link.path}>
                  <Link
                    to={link.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`px-5 py-3 flex items-center gap-3 text-xs font-bold transition-colors border-l-4 ${
                      isActive 
                        ? 'bg-slate/10 text-copper border-copper' 
                        : 'text-graphite/80 hover:bg-offwhite hover:text-graphite border-transparent'
                    }`}
                  >
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Support Box */}
        <div className="p-4 border-t border-graphite/15 mt-8 bg-offwhite/30 text-[11px] text-graphite/70">
          <div className="font-bold text-graphite mb-1">CVC Vigilance Helpdesk</div>
          <p className="leading-tight">Integrity Helpline: 1800-11-2024</p>
          <p className="font-mono text-[10px] mt-1 text-slate">Consortium Nodes: 7/7 (QBFT)</p>
        </div>
      </aside>
    </>
  );
}
