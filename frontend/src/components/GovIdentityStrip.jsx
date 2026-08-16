import React from 'react';

export default function GovIdentityStrip() {
  return (
    <div className="bg-white border-b border-graphite/15 px-4 py-1.5 flex justify-between items-center text-xs font-medium text-graphite uppercase tracking-wide z-50">
      <div className="flex items-center gap-3">
        {/* Ashoka Emblem Placeholder */}
        <div className="flex items-center gap-1.5">
          <div className="w-3.5 h-2.5 bg-gradient-to-b from-[#FF9933] via-white to-[#138808] border border-graphite/20"></div>
          <span className="font-bold">GOVERNMENT OF INDIA</span>
        </div>
        <span className="hidden sm:inline border-l border-graphite/15 pl-3 text-graphite/70">
          MINISTRY OF PETROLEUM AND NATURAL GAS
        </span>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-[11px] text-graphite/60 font-mono hidden md:inline">
          CVC COMPLIANT // GIGW V2.4
        </span>
      </div>
    </div>
  );
}
