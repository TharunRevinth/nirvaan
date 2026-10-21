import React from 'react';

function formatDate(dateVal) {
  if (!dateVal) return 'Pending';
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return String(dateVal);
    return d.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    });
  } catch (e) {
    return String(dateVal);
  }
}

export default function ChainOfCustodyTimeline({ tender, timelineData }) {
  let stages = timelineData;

  if (!stages && tender) {
    const now = Date.now();
    const isDeadlinePassed = tender.deadline ? now >= new Date(tender.deadline).getTime() : false;
    const isOpeningPassed = tender.opening ? now >= new Date(tender.opening).getTime() : false;
    const isRevealPassed = tender.revealDeadline ? now >= new Date(tender.revealDeadline).getTime() : false;
    const isAwarded = tender.status === 'AWARDED' || tender.status === 'Finalized';

    stages = [
      {
        title: 'Tender Initiated & Anchored',
        timestamp: tender.blockNumber ? `Mined at Block #${tender.blockNumber}` : 'Recorded On-Chain',
        block: tender.blockNumber ? `Block #${tender.blockNumber}` : 'Confirmed',
        txHash: tender.txHash || null,
        status: 'completed'
      },
      {
        title: 'Bidding Submission Window',
        timestamp: tender.deadline ? (isDeadlinePassed ? `Closed: ${formatDate(tender.deadline)}` : `Open until: ${formatDate(tender.deadline)}`) : 'Date TBD',
        block: isDeadlinePassed ? 'Bidding Period Closed' : 'Accepting Sealed Bids',
        status: isDeadlinePassed || isAwarded ? 'completed' : 'active'
      },
      {
        title: 'Public Opening & Reveal',
        timestamp: tender.opening ? (isOpeningPassed ? `Opened: ${formatDate(tender.opening)}` : `Opening: ${formatDate(tender.opening)}`) : 'Date TBD',
        block: isRevealPassed || isAwarded ? 'Reveal Period Concluded' : (isOpeningPassed ? 'Reveal Active' : 'Pending Opening'),
        status: isRevealPassed || isAwarded ? 'completed' : (isOpeningPassed ? 'active' : 'pending')
      },
      {
        title: 'L1 Award & Standstill',
        timestamp: isAwarded ? `Awarded to ${tender.winner || (tender.winnerAddress ? tender.winnerAddress.substring(0, 10) + '…' : 'L1 Bidder')}` : 'Pending Evaluation',
        block: isAwarded ? (tender.awardBlock ? `Block #${tender.awardBlock}` : 'Mined On-Chain') : 'Pending L1 Award',
        txHash: isAwarded ? (tender.awardTxHash || null) : null,
        status: isAwarded ? 'completed' : 'pending'
      }
    ];
  }

  if (!stages) {
    stages = [];
  }

  return (
    <section aria-label="On-Chain Chain of Custody Timeline" className="rounded-xl p-5 space-y-4 bg-white border border-[#E8E6E1] shadow-xs">
      <div className="flex flex-wrap justify-between items-center border-b border-[#E8E6E1] pb-3 gap-2">
        <h3 className="font-semibold text-xs text-[#1A1A18] uppercase tracking-wider flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
          Chain of Custody Ledger
        </h3>
        <span className="font-mono text-[11px] text-[#71716D] bg-[#FAFAF9] px-2.5 py-0.5 rounded border border-[#E8E6E1]">
          Consensus Trail • Ethereum Sepolia
        </span>
      </div>

      <ol className="grid grid-cols-1 md:grid-cols-4 gap-4 relative py-1 list-none p-0 m-0">
        {stages.map((stage, idx) => {
          const isCompleted = stage.status === 'completed';
          const isActive = stage.status === 'active';

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

              {stage.txHash && (
                <a
                  href={`https://sepolia.etherscan.io/tx/${stage.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-[10px] text-blue-600 hover:text-blue-800 underline mt-1 truncate max-w-full block"
                  title={`View on Etherscan: ${stage.txHash}`}
                >
                  {stage.txHash.substring(0, 10)}…{stage.txHash.slice(-6)} ↗
                </a>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
