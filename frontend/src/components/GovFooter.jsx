import React from 'react';

export default function GovFooter() {
  return (
    <footer className="bg-white border-t border-graphite/15 px-6 py-6 w-full text-xs text-graphite/80 mt-auto">
      <div className="max-w-container-max mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-1">
          <p className="font-bold text-graphite text-sm">
            MINISTRY OF PETROLEUM AND NATURAL GAS, GOVERNMENT OF INDIA
          </p>
          <p className="text-[11px] text-graphite/70">
            Designed, developed, and hosted by National Informatics Centre (NIC) for Indian Oil PSUs (IOCL, HPCL, BPCL, ONGC, GAIL).
          </p>
          <p className="text-[10px] text-slate font-mono mt-1">
            Site last updated: 16-Aug-2026 // Consortium Blockchain Protocol V2.4
          </p>
        </div>

        <div className="flex flex-wrap gap-4 text-xs font-semibold">
          <a href="#" className="hover:text-copper underline focus:outline-none focus:ring-2 focus:ring-copper p-0.5">
            Security Policy
          </a>
          <span className="text-graphite/30">|</span>
          <a href="#" className="hover:text-copper underline focus:outline-none focus:ring-2 focus:ring-copper p-0.5">
            Terms of Use
          </a>
          <span className="text-graphite/30">|</span>
          <a href="#" className="hover:text-copper underline focus:outline-none focus:ring-2 focus:ring-copper p-0.5">
            Grievance & Vigilance Portal
          </a>
          <span className="text-graphite/30">|</span>
          <a href="#" className="hover:text-copper underline focus:outline-none focus:ring-2 focus:ring-copper p-0.5">
            Accessibility Statement
          </a>
        </div>
      </div>
    </footer>
  );
}
