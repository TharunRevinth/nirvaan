import React from 'react';
import { Link } from 'react-router-dom';

export default function GovFooter() {
  return (
    <footer className="bg-white border-t border-[#E8E6E1] px-6 py-6 w-full text-xs text-[#71716D] mt-auto">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-1">
          <p className="font-semibold text-[#1A1A18] text-xs tracking-wide">
            Ministry of Petroleum &amp; Natural Gas, Government of India
          </p>
          <p className="text-[11px] text-[#71716D] max-w-xl leading-relaxed">
            Consortium E-Tendering &amp; Verification Platform for Indian Oil PSUs: IOCL, BPCL, HPCL, ONGC, and GAIL. Governed under Central Vigilance Commission (CVC) Procurement Directives.
          </p>
        </div>

        <nav aria-label="Footer Legal and Policy Links" className="flex flex-wrap items-center gap-4 text-xs font-medium text-[#71716D]">
          <Link 
            to="/about"
            className="hover:text-[#1A1A18] transition-colors focus-visible:ring-2 focus-visible:ring-[#A13D2B] focus-visible:outline-none rounded px-1"
          >
            About NIRVAAN
          </Link>
          <span className="text-[#E8E6E1]" aria-hidden="true">•</span>
          <a 
            href="#terms" 
            onClick={(e) => e.preventDefault()}
            className="hover:text-[#1A1A18] transition-colors focus-visible:ring-2 focus-visible:ring-[#A13D2B] focus-visible:outline-none rounded px-1"
          >
            Terms of Procurement
          </a>
          <span className="text-[#E8E6E1]" aria-hidden="true">•</span>
          <a 
            href="#cvc-guidelines" 
            onClick={(e) => e.preventDefault()}
            className="hover:text-[#1A1A18] transition-colors focus-visible:ring-2 focus-visible:ring-[#A13D2B] focus-visible:outline-none rounded px-1"
          >
            CVC Guidelines
          </a>
          <span className="text-[#E8E6E1]" aria-hidden="true">•</span>
          <a 
            href="#accessibility" 
            onClick={(e) => e.preventDefault()}
            className="hover:text-[#1A1A18] transition-colors focus-visible:ring-2 focus-visible:ring-[#A13D2B] focus-visible:outline-none rounded px-1"
          >
            Accessibility
          </a>
        </nav>
      </div>
    </footer>
  );
}
