import React from 'react';

export default function ConfirmationModal({ isOpen, title, message, onConfirm, onCancel, isSubmitting }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-graphite/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white border-2 border-graphite max-w-md w-full p-6 shadow-2xl space-y-4">
        <div className="border-b border-graphite/15 pb-3 flex justify-between items-center">
          <h3 className="font-bold text-sm uppercase text-graphite tracking-wide">
            {title || 'Confirmation Required'}
          </h3>
          <span className="text-copper text-xs font-mono font-bold">PERMANENT ACTION</span>
        </div>

        <p className="text-xs text-graphite leading-relaxed">
          {message || 'This action is permanent and cannot be undone on the blockchain consensus ledger. Continue?'}
        </p>

        {isSubmitting && (
          <div className="bg-amber/10 border border-amber/30 p-3 text-xs font-mono text-graphite flex items-center gap-2 animate-pulse">
            <span className="w-3 h-3 rounded-full bg-amber inline-block"></span>
            <span>Confirming on-chain — this may take a moment...</span>
          </div>
        )}

        <div className="bg-offwhite p-3 border border-graphite/15 text-[11px] font-mono text-slate space-y-1">
          <div>Gas Price: 0.00 Gwei (Consortium Free)</div>
          <div>Security Mechanism: QBFT Multi-Validator Consensus Sign-off</div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            onClick={onCancel}
            disabled={isSubmitting}
            className="border border-graphite text-graphite font-bold text-xs px-4 py-2 hover:bg-offwhite disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isSubmitting}
            className="bg-copper text-white font-bold text-xs px-5 py-2 hover:bg-copper-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-white animate-ping"></span>
                Confirming On-Chain...
              </span>
            ) : (
              'Confirm & Sign On-Chain'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
