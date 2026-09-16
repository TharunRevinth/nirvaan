import React, { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children, allowedRole, requiresRegistration = false, triggerToast }) {
  const { isVendorAuthenticated, isVendorRegistered, isOfficerAuthenticated } = useAuth();

  useEffect(() => {
    if (allowedRole === 'PSU' && !isOfficerAuthenticated && triggerToast) {
      triggerToast('Access Denied: You do not have permission to access PSU Officer areas. Please log in as a PSU Officer.', 'error');
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
    if (!isVendorAuthenticated) {
      return <Navigate to="/" replace />;
    }

    if (requiresRegistration && !isVendorRegistered) {
      return <Navigate to="/vendor/kyc" replace />;
    }
  }

  return children;
}
