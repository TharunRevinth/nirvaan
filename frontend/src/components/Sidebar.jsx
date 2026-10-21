import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Sidebar() {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { officerUser, walletAddress, selectedPSU, isVendorRegistered } = useAuth();

  const isOfficer = Boolean(officerUser);
  const isVendor = Boolean(walletAddress && !officerUser);
  const isUnauthenticated = !isOfficer && !isVendor;

  // Do not render portal sidebar on unauthenticated public landing and about pages
  if (location.pathname === '/' || location.pathname === '/about') {
    return null;
  }

  // Link sets scoped strictly to authenticated role
  const psuLinks = [
    { label: 'Active Tender Register', path: '/psu/dashboard' },
    { label: 'Notice Inviting Tender (NIT)', path: '/psu/create-tender' },
    { label: 'Vendor KYC Approvals', path: '/officer/vendors' },
    { label: 'Bid Evaluation & Award', path: '/psu/evaluation' },
    { label: 'CVC Dispute Resolution', path: '/cvc/disputes' },
  ];

  const vendorLinks = [
    { label: 'Tender Browse', path: '/vendor/dashboard' },
    { label: 'Corporate KYC Registration', path: '/vendor/kyc' },
    { label: 'Sealed Bid Submission', path: '/vendor/submit-bid' },
    { label: 'Bid Reveal (Stage 2)', path: '/vendor/reveal' },
    { label: 'Dispute Filing', path: '/vendor/dispute' },
    { label: 'EMD / Escrow Withdrawals', path: '/vendor/withdraw' },
  ];

  const publicLinks = [
    { label: 'Public Tender Register', path: '/tenders' },
    { label: 'About Consortium Platform', path: '/about' },
  ];

  const activeLinks = isOfficer ? psuLinks : isVendor ? vendorLinks : publicLinks;

  const officerDisplayId = officerUser?.officerId || officerUser?.id || officerUser?.username || 'OFFICER-AUTH';

  return (
    <>
      {/* Mobile Header Bar */}
      <div className="md:hidden bg-white text-[#1A1A18] px-4 py-3 flex justify-between items-center border-b border-[#E8E6E1]">
        <span className="font-semibold text-xs text-[#1A1A18]">
          {isOfficer 
            ? `PSU OFFICER PORTAL (${selectedPSU})` 
            : isVendor 
            ? 'VENDOR BIDDING PORTAL' 
            : 'PUBLIC PROCUREMENT PORTAL'}
        </span>
        <button 
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="text-[#1A1A18] bg-[#F5F4F0] border border-[#E8E6E1] px-3 py-1 rounded-md text-xs font-semibold focus-visible:ring-2 focus-visible:ring-[#A13D2B] focus-visible:outline-none"
          aria-label="Toggle Mobile Navigation Menu"
          aria-expanded={mobileMenuOpen}
        >
          {mobileMenuOpen ? '✕ Close' : '☰ Menu'}
        </button>
      </div>

      {/* Main Sidebar Container */}
      <aside 
        aria-label="Sidebar Navigation"
        className={`${mobileMenuOpen ? 'block' : 'hidden'} md:block w-64 bg-white border-r border-[#E8E6E1] shrink-0 z-30 min-h-[calc(100vh-100px)]`}
      >
        {/* Header Badge */}
        <div className="p-4 border-b border-[#E8E6E1] bg-[#FAFAF9]">
          <div className="text-[10px] font-semibold text-[#71716D] uppercase tracking-wider mb-0.5">
            {isOfficer ? 'Authorized Entity' : isVendor ? 'Commercial Bidder' : 'Public Visitor'}
          </div>
          <h2 className="font-bold text-xs text-[#1A1A18] text-balance">
            {isOfficer 
              ? `${selectedPSU} Procurement Cell` 
              : isVendor 
              ? 'Registered Supplier Entity' 
              : 'Consortium E-Procurement'}
          </h2>
          <p className="font-mono text-[11px] text-[#71716D] mt-1 tabular-nums truncate">
            {isOfficer 
              ? `Officer ID: ${officerDisplayId}` 
              : isVendor 
              ? `Wallet: ${walletAddress.substring(0, 8)}…` 
              : 'Wallet: Not Connected'}
          </p>
        </div>

        {/* Primary Action CTA Button (Gated by Auth Role) */}
        <div className="p-3 border-b border-[#E8E6E1]">
          {isOfficer ? (
            <Link 
              to="/psu/create-tender"
              className="w-full bg-[#A13D2B] hover:bg-[#8A3323] text-white font-semibold text-xs py-2.5 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-colors block text-center focus-visible:ring-2 focus-visible:ring-[#A13D2B] focus-visible:outline-none"
            >
              + Create NIT Specification
            </Link>
          ) : isVendor ? (
            <Link 
              to="/vendor/submit-bid"
              className="w-full bg-[#A13D2B] hover:bg-[#8A3323] text-white font-semibold text-xs py-2.5 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-colors block text-center focus-visible:ring-2 focus-visible:ring-[#A13D2B] focus-visible:outline-none"
            >
              Submit Sealed Bid
            </Link>
          ) : (
            <Link 
              to="/"
              className="w-full bg-white hover:bg-[#FAFAF9] text-[#1A1A18] border border-[#E8E6E1] font-semibold text-xs py-2.5 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-colors block text-center focus-visible:ring-2 focus-visible:ring-[#A13D2B] focus-visible:outline-none shadow-xs"
            >
              Connect Wallet to Bid →
            </Link>
          )}
        </div>

        {/* Navigation List */}
        <nav className="p-2" aria-label="Portal section navigation">
          <ul className="flex flex-col gap-0.5 list-none p-0 m-0">
            {activeLinks.map((link) => {
              const isActive = location.pathname === link.path;
              return (
                <li key={link.path}>
                  <Link
                    to={link.path}
                    onClick={() => setMobileMenuOpen(false)}
                    aria-current={isActive ? 'page' : undefined}
                    className={`px-3 py-2 rounded-lg flex items-center justify-between text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-[#A13D2B] focus-visible:outline-none ${
                      isActive 
                        ? 'bg-[#F5F4F0] text-[#1A1A18] font-bold border-l-2 border-[#A13D2B] rounded-l-none' 
                        : 'text-[#575753] hover:bg-[#FAFAF9] hover:text-[#1A1A18]'
                    }`}
                  >
                    <span>{link.label}</span>
                    {isActive && <span className="w-1.5 h-1.5 rounded-full bg-[#A13D2B]"></span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Unauthenticated Prompt Box */}
        {isUnauthenticated && (
          <div className="p-3 mx-2 my-2 rounded-lg border border-[#E8E6E1] bg-[#FAFAF9] text-[11px] text-[#71716D] space-y-1">
            <div className="font-semibold text-[#1A1A18]">Authentication Required</div>
            <p className="leading-relaxed">Connect an authorized Web3 wallet to access Corporate KYC, sealed bid submission, and grievance filing.</p>
          </div>
        )}

        {/* Institutional Support Box */}
        <div className="p-3 mx-2 my-6 rounded-lg border border-[#E8E6E1] bg-[#FAFAF9] text-[11px] text-[#71716D]">
          <div className="font-semibold text-[#1A1A18] mb-0.5 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
            <span>CVC Directives Compliant</span>
          </div>
          <p className="leading-relaxed">Consortium Helpdesk: 1800-11-2024</p>
          <p className="font-mono text-[10px] mt-0.5 text-[#71716D] tabular-nums">QBFT Enterprise Consensus</p>
        </div>
      </aside>
    </>
  );
}
