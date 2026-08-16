import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  // Vendor State (Wallet-Based)
  const [walletAddress, setWalletAddress] = useState(() => localStorage.getItem('vendor_wallet') || '');
  const [registeredVendors, setRegisteredVendors] = useState({
    '0xfe3b2075775791234567890abcdef1234567bd73': {
      companyName: 'Reliance Offshore Logistics Pvt Ltd',
      gstin: '27AAACR12341Z5',
      pan: 'AAACR1234F',
      isRegistered: true
    }
  });

  // PSU Officer State (JWT-Based)
  const [officerToken, setOfficerToken] = useState(() => localStorage.getItem('officer_token') || '');
  const [officerUser, setOfficerUser] = useState(() => {
    const saved = localStorage.getItem('officer_user');
    return saved ? JSON.parse(saved) : null;
  });

  // Active PSU Entity Context for PSU view
  const [selectedPSU, setSelectedPSU] = useState('IOCL');

  // Vendor Functions
  const connectVendorWallet = (address = '0xfe3b2075775791234567890abcdef1234567bd73') => {
    setWalletAddress(address);
    localStorage.setItem('vendor_wallet', address);
  };

  const disconnectVendorWallet = () => {
    setWalletAddress('');
    localStorage.removeItem('vendor_wallet');
  };

  const registerVendorRecord = (address, vendorData) => {
    setRegisteredVendors(prev => ({
      ...prev,
      [address]: { ...vendorData, isRegistered: true }
    }));
  };

  // Officer Functions
  const loginOfficerSession = (token, officerData) => {
    setOfficerToken(token);
    setOfficerUser(officerData);
    if (officerData?.psu) {
      setSelectedPSU(officerData.psu);
    }
    localStorage.setItem('officer_token', token);
    localStorage.setItem('officer_user', JSON.stringify(officerData));
  };

  const logoutOfficerSession = () => {
    setOfficerToken('');
    setOfficerUser(null);
    localStorage.removeItem('officer_token');
    localStorage.removeItem('officer_user');
  };

  const isVendorAuthenticated = Boolean(walletAddress);
  const isVendorRegistered = Boolean(walletAddress && registeredVendors[walletAddress]?.isRegistered);
  const isOfficerAuthenticated = Boolean(officerToken && officerUser);

  return (
    <AuthContext.Provider
      value={{
        walletAddress,
        registeredVendors,
        connectVendorWallet,
        disconnectVendorWallet,
        registerVendorRecord,
        officerToken,
        officerUser,
        loginOfficerSession,
        logoutOfficerSession,
        selectedPSU,
        setSelectedPSU,
        isVendorAuthenticated,
        isVendorRegistered,
        isOfficerAuthenticated
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
