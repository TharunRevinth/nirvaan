export const API_URL = import.meta.env.VITE_API_URL || '';
export const RPC_URL = import.meta.env.VITE_RPC_URL || 'https://rpc.sepolia.org';
export const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS || '';
export const CHAIN_ID = parseInt(import.meta.env.VITE_CHAIN_ID || '11155111', 10);
export const CHAIN_ID_HEX = `0x${CHAIN_ID.toString(16)}`;
export const IPFS_RPC_URL = import.meta.env.VITE_IPFS_RPC_URL || '';
export const ENABLE_DEV_DEMO = import.meta.env.VITE_ENABLE_DEV_DEMO === 'true';
