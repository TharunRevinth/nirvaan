import React, { useEffect } from 'react';

export default function ConfirmationModal({ isOpen, title, message, onConfirm, onCancel, isSubmitting }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen && !isSubmitting) {
        onCancel();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, onCancel]);

  if (!isOpen) return null;

  return (
    <div 
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      aria-describedby="modal-desc"
      className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4"
    >
      <div className="bg-white border border-[#E8E6E1] max-w-md w-full p-6 rounded-2xl shadow-xl space-y-4">
        <div className="border-b border-[#E8E6E1] pb-3 flex justify-between items-center">
          <h3 id="modal-title" className="font-bold text-sm text-[#1A1A18] tracking-tight">
            {title || 'Confirmation Required'}
          </h3>
          <span className="text-[#A13D2B] text-[10px] font-mono font-semibold uppercase bg-[#A13D2B]/10 px-2 py-0.5 rounded">Permanent Record</span>
        </div>

        <p id="modal-desc" className="text-xs text-[#575753] leading-relaxed">
          {message || 'This action will be written to the blockchain consensus ledger and cannot be undone. Continue?'}
        </p>

        {isSubmitting && (
          <div className="bg-[#FFF9F2] border border-[#F3DFC1] p-3 rounded-lg text-xs font-mono text-[#7A4510] flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#A13D2B] animate-ping" aria-hidden="true"></span>
            <span>Broadcasting transaction to Ethereum Sepolia network…</span>
          </div>
        )}

        <div className="bg-[#FAFAF9] p-3 rounded-lg border border-[#E8E6E1] text-[11px] font-mono text-[#71716D] space-y-1 tabular-nums">
          <div>Network: Ethereum Sepolia (Chain ID 11155111)</div>
          <div>Consensus: Proof-of-Stake (PoS)</div>
        </div>

        <div className="flex justify-end gap-2.5 pt-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="border border-[#E8E6E1] bg-white text-[#575753] hover:text-[#1A1A18] hover:bg-[#FAFAF9] font-medium text-xs px-4 py-2 rounded-lg disabled:opacity-50 transition-colors focus-visible:ring-2 focus-visible:ring-[#A13D2B] focus-visible:outline-none"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
            className="bg-[#A13D2B] hover:bg-[#8A3323] text-white font-semibold text-xs px-4 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 focus-visible:ring-2 focus-visible:ring-[#A13D2B] focus-visible:outline-none"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-white animate-ping" aria-hidden="true"></span>
                Confirming…
              </span>
            ) : (
              'Confirm & Broadcast'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
