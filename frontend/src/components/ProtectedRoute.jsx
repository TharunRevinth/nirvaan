import React, { useEffect } from 'react';
import { Navigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children, allowedRole, requiresRegistration = false, triggerToast }) {
  const location = useLocation();
  const { isVendorAuthenticated, isVendorRegistered, isOfficerAuthenticated, officerUser } = useAuth();

  useEffect(() => {
    if (allowedRole === 'PSU' && !isOfficerAuthenticated && triggerToast) {
      triggerToast('Access Denied: You do not have permission to access PSU Officer areas. Please log in as a PSU Officer.', 'error');
    } else if (allowedRole === 'Vendor' && isOfficerAuthenticated && triggerToast) {
      triggerToast('Access Denied: PSU Officers cannot access vendor bidding or dispute filing areas.', 'error');
    } else if (allowedRole === 'Vendor' && !isVendorAuthenticated && triggerToast) {
      triggerToast('Access Denied: Please connect an authorized Web3 wallet to access vendor bidding areas.', 'error');
    } else if (allowedRole === 'Vendor' && requiresRegistration && !isVendorRegistered && triggerToast) {
      triggerToast('KYC Verification Required: Your wallet address is not registered. Please complete Corporate KYC before bidding.', 'error');
    }
  }, [allowedRole, isOfficerAuthenticated, isVendorAuthenticated, requiresRegistration, isVendorRegistered, triggerToast]);

  if (allowedRole === 'PSU') {
    if (!isOfficerAuthenticated) {
      return <Navigate to="/" replace />;
    }
  }

  if (allowedRole === 'Vendor') {
    // Strictly block officers from accessing vendor-only routes with explicit Access Denied view
    if (isOfficerAuthenticated) {
      const officerDisplayId = officerUser?.officerId || officerUser?.id || officerUser?.username || '88-X92-IOC';
      const officerPSU = officerUser?.psu || 'IOCL';

      return (
        <div id="main-content" className="max-w-2xl mx-auto py-8 px-4 space-y-6 animate-fade-in">
          <div className="bg-red-50 border-2 border-red-300 rounded-2xl p-6 sm:p-8 space-y-5 shadow-sm">
            <div className="flex items-center gap-3.5 text-red-900 border-b border-red-200 pb-4">
              <div className="w-10 h-10 rounded-xl bg-red-600 text-white flex items-center justify-center font-bold text-lg shrink-0 shadow-xs">
                ✕
              </div>
              <div>
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-red-700 block">
                  Security Protocol 403 • Role Authorization Violation
                </span>
                <h1 className="text-xl font-bold text-red-950 tracking-tight mt-0.5">
                  Access Denied: PSU Officers Cannot Access Vendor Portals
                </h1>
              </div>
            </div>

            <p className="text-xs text-red-900 leading-relaxed">
              Dispute filing, commercial sealed bid submissions, and vendor KYC are strictly reserved for commercial bidder suppliers. As an authenticated PSU Procurement Officer, you cannot participate in vendor actions or file disputes against public tenders under CVC directives.
            </p>

            <div className="bg-white/90 border border-red-200 rounded-xl p-4 font-mono text-xs text-slate-800 space-y-2.5">
              <div className="flex justify-between items-center border-b border-red-100 pb-2">
                <span className="text-slate-500 font-sans">Authenticated Tenant:</span>
                <span className="font-bold text-[#A13D2B]">{officerPSU} Procurement Cell</span>
              </div>
              <div className="flex justify-between items-center border-b border-red-100 pb-2">
                <span className="text-slate-500 font-sans">Officer ID:</span>
                <span className="font-bold text-slate-900 bg-red-50 px-2 py-0.5 rounded border border-red-200">{officerDisplayId}</span>
              </div>
              <div className="flex justify-between items-center border-b border-red-100 pb-2">
                <span className="text-slate-500 font-sans">Attempted Route:</span>
                <span className="text-red-700 font-bold">{location.pathname}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-sans">CVC Directive:</span>
                <span className="text-emerald-700 font-semibold">Strict Role Separation Enforced</span>
              </div>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row gap-3">
              <Link
                to="/psu/dashboard"
                className="bg-[#A13D2B] hover:bg-[#8A3323] text-white font-semibold text-xs py-2.5 px-5 rounded-lg text-center transition-colors shadow-xs"
              >
                ← Return to {officerPSU} Officer Dashboard
              </Link>
              <Link
                to="/psu/evaluation"
                className="bg-white hover:bg-[#FAFAF9] text-[#1A1A18] border border-[#E8E6E1] font-semibold text-xs py-2.5 px-5 rounded-lg text-center transition-colors shadow-xs"
              >
                Go to Bid Evaluation Console →
              </Link>
            </div>
          </div>
        </div>
      );
    }

    if (!isVendorAuthenticated) {
      return <Navigate to="/" replace />;
    }

    if (requiresRegistration && !isVendorRegistered) {
      return <Navigate to="/vendor/kyc" replace />;
    }
  }

  return children;
}
