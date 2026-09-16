import React from 'react';

export default function ChainOfCustodyTimeline({ currentStage = 3, timelineData }) {
  const defaultStages = [
    { title: 'Tender Initiated & Signed', timestamp: '2026-10-24 09:00:14 UTC', block: 'Block #140,112', status: 'completed' },
    { title: 'Bidding Window Closed', timestamp: '2026-11-15 17:00:00 UTC', block: 'Block #142,500', status: 'completed' },
    { title: 'Public Bids Revealed', timestamp: '2026-11-16 10:00:45 UTC', block: 'Block #142,890', status: 'completed' },
    { 
      title: 'Technical Qualification & Award', 
      timestamp: currentStage >= 4 ? '2026-09-16 16:42:15 UTC' : 'Pending Finalization', 
      block: currentStage >= 4 ? 'Block #142,950' : 'Block TBD', 
      status: currentStage >= 4 ? 'completed' : 'pending' 
    },
  ];

  const stages = timelineData || defaultStages;

  return (
    <section aria-label="On-Chain Chain of Custody Timeline" className="rounded-xl p-5 space-y-4 bg-white border border-[#E8E6E1] shadow-xs">
      <div className="flex flex-wrap justify-between items-center border-b border-[#E8E6E1] pb-3 gap-2">
        <h3 className="font-semibold text-xs text-[#1A1A18] uppercase tracking-wider flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
          Chain of Custody Ledger
        </h3>
        <span className="font-mono text-[11px] text-[#71716D] bg-[#FAFAF9] px-2.5 py-0.5 rounded border border-[#E8E6E1]">
          Consensus Trail • Besu QBFT
        </span>
      </div>

      <ol className="grid grid-cols-1 md:grid-cols-4 gap-4 relative py-1 list-none p-0 m-0">
        {stages.map((stage, idx) => {
          const isCompleted = idx < currentStage;
          const isActive = idx === currentStage - 1;

          return (
            <li key={idx} className="flex flex-col items-start relative pl-4 md:pl-0 border-l-2 md:border-l-0 md:border-t-2 border-[#E8E6E1] pt-2 md:pt-3">
              <div 
                aria-hidden="true"
                className={`w-3 h-3 rounded-full mb-2 ${
                  isCompleted 
                    ? 'bg-emerald-600' 
                    : isActive 
                    ? 'bg-[#A13D2B] ring-3 ring-[#A13D2B]/20' 
                    : 'bg-[#E8E6E1]'
                }`}
              ></div>
              
              <div className="font-semibold text-xs text-[#1A1A18] leading-snug">
                {stage.title}
              </div>

              <div className="font-mono text-[11px] text-[#575753] mt-1 tabular-nums">
                {stage.timestamp}
              </div>

              <div className="font-mono text-[10px] text-[#71716D] mt-0.5 tabular-nums">
                {stage.block}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
