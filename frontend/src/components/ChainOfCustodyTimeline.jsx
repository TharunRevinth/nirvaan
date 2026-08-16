import React from 'react';

export default function ChainOfCustodyTimeline({ currentStage = 3, timelineData }) {
  const defaultStages = [
    { title: 'Tender Initiated & Signed', timestamp: '2026-10-24 09:00:14 UTC', block: 'Block #140,112', status: 'completed' },
    { title: 'Bidding Window Closed', timestamp: '2026-11-15 17:00:00 UTC', block: 'Block #142,500', status: 'completed' },
    { title: 'Public Bids Revealed', timestamp: '2026-11-16 10:00:45 UTC', block: 'Block #142,890', status: 'active' },
    { title: 'Technical Qualification & Award', timestamp: 'Pending Finalization', block: 'Block TBD', status: 'pending' },
  ];

  const stages = timelineData || defaultStages;

  return (
    <div className="bg-white border border-graphite/15 p-6 space-y-4">
      <div className="flex justify-between items-center border-b border-graphite/15 pb-3">
        <h3 className="font-bold text-xs uppercase tracking-wider text-slate flex items-center gap-2">
          <span>⛓</span> ON-CHAIN CHAIN OF CUSTODY TIMELINE
        </h3>
        <span className="font-mono text-[11px] text-graphite/60 bg-offwhite px-2 py-0.5 border border-graphite/10">
          IMMUTABLE CONSENSUS TRAIL
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 relative py-2">
        {stages.map((stage, idx) => {
          const isCompleted = idx < currentStage;
          const isActive = idx === currentStage - 1;

          return (
            <div key={idx} className="flex flex-col items-start relative pl-4 md:pl-0 border-l-2 md:border-l-0 md:border-t-2 border-graphite/20 pt-2 md:pt-4">
              <div className={`w-3 h-3 ${isCompleted ? 'bg-graphite' : isActive ? 'bg-copper border-2 border-white' : 'bg-offwhite border border-graphite/30'} mb-2`}></div>
              
              <div className="font-bold text-xs text-graphite uppercase leading-snug">
                {stage.title}
              </div>

              <div className="font-mono text-[11px] text-copper font-semibold mt-1">
                {stage.timestamp}
              </div>

              <div className="font-mono text-[10px] text-slate/80 mt-0.5">
                {stage.block}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
