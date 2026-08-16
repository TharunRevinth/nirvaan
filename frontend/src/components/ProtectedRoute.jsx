import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children, allowedRole, requiresRegistration = false, triggerToast }) {
  const { isVendorAuthenticated, isVendorRegistered, isOfficerAuthenticated } = useAuth();

  if (allowedRole === 'PSU') {
    if (!isOfficerAuthenticated) {
      if (triggerToast) {
        triggerToast('Access Denied: You do not have permission to access PSU Officer areas. Please log in as a PSU Officer.', 'error');
      }
      return <Navigate to="/" replace />;
    }
  }

  if (allowedRole === 'Vendor') {
    if (!isVendorAuthenticated) {
      if (triggerToast) {
        triggerToast('Access Denied: Please connect an authorized Web3 wallet to access vendor bidding areas.', 'error');
      }
      return <Navigate to="/" replace />;
    }

    if (requiresRegistration && !isVendorRegistered) {
      if (triggerToast) {
        triggerToast('KYC Verification Required: Your wallet address is not registered. Please complete Corporate KYC before bidding.', 'error');
      }
      return <Navigate to="/vendor/kyc" replace />;
    }
  }

  return children;
}
