import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

export default function Sidebar({ portalRole, selectedPSU }) {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Separate Link Navigation Sets for PSU vs. Vendor
  const psuLinks = [
    { label: 'Active Tender Ledger', path: '/tenders' },
    { label: 'Notice Inviting Tender (NIT)', path: '/create-tender' },
    { label: 'Bid Evaluation & Award', path: '/evaluation' },
    { label: 'Dispute & Grievance Reviews', path: '/tenders/TND-24-9982-A' },
  ];

  const vendorLinks = [
    { label: 'Tender Browse', path: '/tenders' },
    { label: 'Vendor KYC Registration', path: '/register' },
    { label: 'Sealed Bid Submission', path: '/submit-bid' },
    { label: 'Dispute Filing', path: '/dispute' },
  ];

  const activeLinks = portalRole === 'PSU' ? psuLinks : vendorLinks;

  return (
    <>
      {/* Mobile Hamburger Header */}
      <div className="md:hidden bg-graphite text-white px-4 py-2 flex justify-between items-center border-b border-graphite/20">
        <span className="font-bold text-xs">
          {portalRole === 'PSU' ? `PSU OFFICER PORTAL (${selectedPSU})` : 'VENDOR PROCUREMENT PORTAL'}
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
        {/* Officer / Vendor Badge Header */}
        <div className="p-5 border-b border-graphite/15 bg-offwhite/50">
          <div className="text-[11px] font-bold text-slate uppercase tracking-wider mb-1">
            {portalRole === 'PSU' ? 'Authorized Entity' : 'Registered Vendor'}
          </div>
          <h2 className="font-bold text-base text-graphite">
            {portalRole === 'PSU' ? `${selectedPSU} Procurement Cell` : 'Registered Supplier'}
          </h2>
          <p className="font-mono text-xs text-graphite/70 mt-1">
            {portalRole === 'PSU' ? 'Officer ID: 88-X92-IOC' : 'GSTIN: 27AAAAA0000A1Z5'}
          </p>
        </div>

        {/* Primary Action CTA Button */}
        <div className="p-4 border-b border-graphite/15">
          {portalRole === 'PSU' ? (
            <Link 
              to="/create-tender"
              className="w-full bg-copper text-white font-bold text-xs py-2.5 px-3 flex items-center justify-center gap-2 hover:bg-copper-hover transition-colors border border-copper block text-center"
            >
              + Create New NIT Specification
            </Link>
          ) : (
            <Link 
              to="/submit-bid"
              className="w-full bg-slate text-white font-bold text-xs py-2.5 px-3 flex items-center justify-center gap-2 hover:bg-slate/90 transition-colors border border-slate block text-center"
            >
              🔒 Submit Sealed Bid
            </Link>
          )}
        </div>

        {/* Reused Navigation List */}
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

        {/* Government Portal Support Footer Box */}
        <div className="p-4 border-t border-graphite/15 mt-8 bg-offwhite/30 text-[11px] text-graphite/70">
          <div className="font-bold text-graphite mb-1">CVC Vigilance Helpdesk</div>
          <p className="leading-tight">Integrity Helpline: 1800-11-2024</p>
          <p className="font-mono text-[10px] mt-1 text-slate">Nodes Active: 7/7 (QBFT)</p>
        </div>
      </aside>
    </>
  );
}
