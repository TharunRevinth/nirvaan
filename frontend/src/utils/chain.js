import { CHAIN_ID, CHAIN_ID_HEX, RPC_URL } from '../config';

/**
 * Validates that connected wallet is on the correct chain before transaction.
 * Prompts user to switch network if on wrong chain.
 */
export async function ensureCorrectChain() {
  if (!window.ethereum) {
    throw new Error('MetaMask or Web3 provider not detected.');
  }

  const currentChainId = await window.ethereum.request({ method: 'eth_chainId' });
  const currentNumeric = parseInt(currentChainId, 16);

  if (currentNumeric !== CHAIN_ID && currentChainId !== CHAIN_ID_HEX) {
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: CHAIN_ID_HEX }],
      });
    } catch (switchErr) {
      if (switchErr.code === 4902) {
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
        throw new Error(
          `Incorrect Network: Connected to chain ${currentChainId}. Please switch MetaMask to Chain ID ${CHAIN_ID} (${RPC_URL}).`
        );
      }
    }
  }
}
