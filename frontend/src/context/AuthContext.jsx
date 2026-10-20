import React, { createContext, useContext, useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { CONTRACT_ADDRESS, RPC_URL, CHAIN_ID, CHAIN_ID_HEX, API_URL } from '../config';

export { CONTRACT_ADDRESS, CHAIN_ID_HEX as REQUIRED_CHAIN_ID_HEX };

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [walletAddress, setWalletAddress] = useState(() => localStorage.getItem('vendor_wallet') || '');
  const [networkError, setNetworkError] = useState('');
  const [registeredVendors, setRegisteredVendors] = useState({});

  // PSU Officer State (JWT-Based)
  const [officerToken, setOfficerToken] = useState(() => localStorage.getItem('officer_token') || '');
  const [officerUser, setOfficerUser] = useState(() => {
    const saved = localStorage.getItem('officer_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [selectedPSU, setSelectedPSU] = useState('IOCL');

  // Verify officer session with backend API on mount
  useEffect(() => {
    if (!officerToken) return;
    async function verifyOfficerSession() {
      try {
        const res = await fetch(`${API_URL}/api/auth/me`, {
          headers: { Authorization: `Bearer ${officerToken}` }
        });
        if (!res.ok) {
          logoutOfficerSession();
        }
      } catch (e) {
        // API offline
      }
    }
    verifyOfficerSession();
  }, []);

  // Real MetaMask Account Listener
  useEffect(() => {
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', (accounts) => {
        if (accounts.length > 0) {
          setWalletAddress(accounts[0]);
          localStorage.setItem('vendor_wallet', accounts[0]);
        } else {
          disconnectVendorWallet();
        }
      });

      window.ethereum.on('chainChanged', () => {
        window.location.reload();
      });
    }
  }, []);

  // Read REAL on-chain vendor registration when wallet address changes (NOT trusting localStorage)
  useEffect(() => {
    async function checkRegistrationOnChain() {
      if (!walletAddress || !CONTRACT_ADDRESS) return;
      try {
        const provider = window.ethereum
          ? new ethers.BrowserProvider(window.ethereum)
          : new ethers.JsonRpcProvider(RPC_URL, undefined, { staticNetwork: true });

        const abi = ["function registeredVendors(address) view returns (bool)"];
        const contract = new ethers.Contract(CONTRACT_ADDRESS, abi, provider);
        const isReg = await contract.registeredVendors(walletAddress);
        setRegisteredVendors(prev => ({
          ...prev,
          [walletAddress.toLowerCase()]: { isRegistered: Boolean(isReg) }
        }));
      } catch (err) {
        console.warn("Could not read vendor registration directly from RPC node:", err.message);
      }
    }

    checkRegistrationOnChain();
  }, [walletAddress]);

  // Real MetaMask Connection Function
  const connectVendorWallet = async () => {
    logoutOfficerSession();
    setNetworkError('');

    if (!window.ethereum) {
      const msg = 'MetaMask extension not detected. Please install MetaMask to connect your hardware wallet.';
      setNetworkError(msg);
      throw new Error(msg);
    }

    try {
      const chainId = await window.ethereum.request({ method: 'eth_chainId' });
      const numericChainId = parseInt(chainId, 16);

      if (numericChainId !== CHAIN_ID && chainId !== CHAIN_ID_HEX) {
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: CHAIN_ID_HEX }],
          });
        } catch (switchError) {
          if (switchError.code === 4902) {
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [
                {
                  chainId: CHAIN_ID_HEX,
                  chainName: CHAIN_ID === 11155111 ? 'Sepolia Testnet' : 'NIRVAAN Network',
                  rpcUrls: [RPC_URL || 'https://rpc.sepolia.org'],
                  nativeCurrency: { name: 'Sepolia ETH', symbol: 'ETH', decimals: 18 },
                  blockExplorerUrls: ['https://sepolia.etherscan.io'],
                },
              ],
            });
          } else {
            const errStr = `Incorrect Network: Connected to chain ${chainId}. Please switch MetaMask network to Chain ID ${CHAIN_ID}.`;
            setNetworkError(errStr);
            throw new Error(errStr);
          }
        }
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await provider.send('eth_requestAccounts', []);
      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts selected in MetaMask.');
      }

      const connectedAddr = accounts[0];
      setWalletAddress(connectedAddr);
      localStorage.setItem('vendor_wallet', connectedAddr);
      return connectedAddr;
    } catch (err) {
      console.error('MetaMask Wallet Connection Failed:', err);
      throw err;
    }
  };

  const disconnectVendorWallet = () => {
    setWalletAddress('');
    localStorage.removeItem('vendor_wallet');
  };

  // Officer Functions
  const loginOfficerSession = (token, officerData) => {
    setOfficerToken(token);
    setOfficerUser(officerData);
    if (officerData?.psu) {
      setSelectedPSU(officerData.psu);
    }
    setWalletAddress('');
    localStorage.removeItem('vendor_wallet');
    localStorage.setItem('officer_token', token);
    localStorage.setItem('officer_user', JSON.stringify(officerData));
  };

  const logoutOfficerSession = () => {
    setOfficerToken('');
    setOfficerUser(null);
    localStorage.removeItem('officer_token');
    localStorage.removeItem('officer_user');
  };

  const activateVendorSession = (address) => {
    logoutOfficerSession();
    setWalletAddress(address);
    localStorage.setItem('vendor_wallet', address);
  };

  // State flags: KYC state read strictly from chain truth
  const isVendorAuthenticated = Boolean(walletAddress);
  const isVendorRegistered = Boolean(
    walletAddress && registeredVendors[walletAddress.toLowerCase()]?.isRegistered
  );
  const isOfficerAuthenticated = Boolean(officerToken && officerUser);

  return (
    <AuthContext.Provider
      value={{
        walletAddress,
        networkError,
        registeredVendors,
        connectVendorWallet,
        disconnectVendorWallet,
        activateVendorSession,
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
