import React from 'react';

export default function Toast({ toast, onClose }) {
  if (!toast) return null;

  const isSuccess = toast.type === 'success';

  return (
    <div 
      className={`fixed bottom-6 right-6 max-w-md w-full border-2 p-4 z-50 shadow-xl flex justify-between items-start ${
        isSuccess ? 'bg-white border-emerald-700 text-emerald-950' : 'bg-white border-red-700 text-red-950'
      }`}
    >
      <div className="space-y-1">
        <div className="font-bold text-xs uppercase tracking-wider font-mono">
          {isSuccess ? '[ON-CHAIN SUCCESS]' : '[TRANSACTION ERROR]'}
        </div>
        <p className="text-xs leading-normal font-medium">
          {toast.message}
        </p>
      </div>
      <button 
        onClick={onClose} 
        className="text-xs font-bold px-2 py-0.5 hover:bg-black/10 transition-colors"
        aria-label="Close notification toast"
      >
        ✕
      </button>
    </div>
  );
}
