import React from 'react';

export default function GovIdentityStrip() {
  return (
    <div className="bg-canvas border-b border-line px-6 py-1.5 flex justify-between items-center text-[11px] text-muted font-normal">
      <div className="flex items-center gap-2.5">
        <span className="font-semibold text-primary">भारत सरकार / Government of India</span>
        <span className="text-subtle">•</span>
        <span>Ministry of Petroleum &amp; Natural Gas</span>
      </div>

      <div className="hidden sm:flex items-center gap-3 text-[11px]">
        <span>Central Vigilance Commission (CVC) Procurement Guidelines</span>
      </div>
    </div>
  );
}

