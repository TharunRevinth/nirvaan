import React from 'react';

export default function Toast({ toast, onClose }) {
  if (!toast) return null;

  const isSuccess = toast.type === 'success';
  const isInfo = toast.type === 'info';

  return (
    <div 
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className={`fixed bottom-6 right-6 max-w-md w-full border rounded-xl p-4 z-50 shadow-lg flex justify-between items-start ${
        isSuccess 
          ? 'bg-white border-emerald-300 text-emerald-950' 
          : isInfo 
          ? 'bg-white border-blue-300 text-slate-900'
          : 'bg-white border-red-300 text-red-950'
      }`}
    >
      <div className="space-y-1 pr-3">
        <div className="font-semibold text-xs uppercase tracking-wider font-mono flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${isSuccess ? 'bg-emerald-600' : isInfo ? 'bg-blue-600' : 'bg-red-600'}`}></span>
          <span>{isSuccess ? 'Transaction Confirmed' : isInfo ? 'Information' : 'Action Failed'}</span>
        </div>
        <p className="text-xs leading-relaxed text-[#575753]">
          {toast.message}
        </p>
      </div>
      <button 
        type="button"
        onClick={onClose} 
        className="text-xs text-[#71716D] hover:text-[#1A1A18] font-bold p-1 transition-colors focus-visible:ring-2 focus-visible:ring-[#A13D2B] focus-visible:outline-none rounded"
        aria-label="Close notification"
      >
        ✕
      </button>
    </div>
  );
}
