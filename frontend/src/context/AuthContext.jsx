import React, { createContext, useContext, useState, useEffect } from 'react';
import { ethers } from 'ethers';

const AuthContext = createContext();

// Contract Address deployed to local RPC node
export const CONTRACT_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
export const REQUIRED_CHAIN_ID_HEX = "0x7a69"; // 31337 in hex

export function AuthProvider({ children }) {
  // Vendor State (Real Wallet-Based via window.ethereum)
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

  // Check on-chain vendor registration when wallet address changes
  useEffect(() => {
    async function checkRegistrationOnChain() {
      if (!walletAddress) return;
      try {
        const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
        const abi = ["function registeredVendors(address) view returns (bool)"];
        const contract = new ethers.Contract(CONTRACT_ADDRESS, abi, provider);
        const isReg = await contract.registeredVendors(walletAddress);
        setRegisteredVendors(prev => ({
          ...prev,
          [walletAddress.toLowerCase()]: { isRegistered: isReg }
        }));
      } catch (err) {
        console.error("Error reading vendor registration on-chain:", err);
      }
    }

    checkRegistrationOnChain();
  }, [walletAddress]);

  // Real MetaMask Connection Function
  const connectVendorWallet = async () => {
    setNetworkError('');

    if (!window.ethereum) {
      const msg = 'MetaMask extension not detected. Please install MetaMask to connect your hardware wallet.';
      setNetworkError(msg);
      throw new Error(msg);
    }

    try {
      // 1. Check Network Chain ID (31337)
      const chainId = await window.ethereum.request({ method: 'eth_chainId' });
      if (chainId !== REQUIRED_CHAIN_ID_HEX && parseInt(chainId, 16) !== 31337) {
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: REQUIRED_CHAIN_ID_HEX }],
          });
        } catch (switchError) {
          // If network is not added to MetaMask, request adding it
          if (switchError.code === 4902) {
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [
                {
                  chainId: REQUIRED_CHAIN_ID_HEX,
                  chainName: 'Local NIRVAAN Hardhat Node',
                  rpcUrls: ['http://127.0.0.1:8545'],
                  nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
                },
              ],
            });
          } else {
            const errStr = `Incorrect Network: Connected to chain ${chainId}. Please switch MetaMask network to Local NIRVAAN RPC (http://127.0.0.1:8545, Chain ID 31337).`;
            setNetworkError(errStr);
            throw new Error(errStr);
          }
        }
      }

      // 2. Request Account Access via window.ethereum
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

  const registerVendorRecord = (address, vendorData) => {
    setRegisteredVendors(prev => ({
      ...prev,
      [address.toLowerCase()]: { ...vendorData, isRegistered: true }
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
