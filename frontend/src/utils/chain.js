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

/**
 * Decodes contract revert reasons and user-friendly error messages from ethers.js errors.
 * Extracts revert strings, RPC error payloads, custom errors, and translates them
 * into clean, human-readable messages (e.g. "EMD below minimum", "Bidding closed").
 */
export function decodeContractError(err) {
  if (!err) return 'Unknown error occurred';

  // 1. Direct reason from ethers error
  if (err.reason && typeof err.reason === 'string') {
    return cleanRevertReason(err.reason);
  }

  // 2. shortMessage from ethers v6 (e.g., 'execution reverted: "Insufficient EMD amount"')
  if (err.shortMessage && typeof err.shortMessage === 'string') {
    const match = err.shortMessage.match(/execution reverted: "([^"]+)"/i) ||
                  err.shortMessage.match(/reverted with reason string '([^']+)'/i);
    if (match && match[1]) {
      return cleanRevertReason(match[1]);
    }
  }

  // 3. Nested error payloads (MetaMask / RPC)
  const nestedError = err.error || err.data || err.info?.error;
  if (nestedError) {
    if (nestedError.message) {
      const match = nestedError.message.match(/execution reverted: "([^"]+)"/i) ||
                    nestedError.message.match(/reverted with reason string '([^']+)'/i) ||
                    nestedError.message.match(/reverted: ([^,]+)/i);
      if (match && match[1]) {
        return cleanRevertReason(match[1].trim());
      }
    }
    if (typeof nestedError === 'string') {
      const match = nestedError.match(/execution reverted: "([^"]+)"/i);
      if (match && match[1]) {
        return cleanRevertReason(match[1]);
      }
    }
  }

  // 4. Inspect err.message directly
  if (err.message && typeof err.message === 'string') {
    if (err.message.includes('user rejected') || err.message.includes('ACTION_REJECTED')) {
      return 'Transaction rejected by user wallet.';
    }
    const match = err.message.match(/reverted with reason string '([^']+)'/i) ||
                  err.message.match(/execution reverted: "([^"]+)"/i) ||
                  err.message.match(/reason="([^"]+)"/i);
    if (match && match[1]) {
      return cleanRevertReason(match[1]);
    }
  }

  return cleanRevertReason(err.message || 'Transaction failed');
}

function cleanRevertReason(reason) {
  if (!reason || typeof reason !== 'string') return 'Transaction reverted';
  const trimmed = reason.trim();

  // Friendly human mappings for known contract reverts
  if (/insufficient emd/i.test(trimmed)) return 'EMD below minimum';
  if (/submission period over/i.test(trimmed) || /tender not open for bidding/i.test(trimmed)) return 'Bidding closed';
  if (/reveal deadline has passed/i.test(trimmed)) return 'Reveal deadline expired';
  if (/bids not yet opened/i.test(trimmed) || /opening time not reached/i.test(trimmed)) return 'Bids not yet opened';
  if (/commitment mismatch/i.test(trimmed)) return 'Commitment mismatch (tampering detected or invalid secret salt)';
  if (/appeal window has closed/i.test(trimmed)) return 'Appeal window closed';
  if (/duplicate bid/i.test(trimmed)) return 'Duplicate bid: You have already submitted a bid for this tender';
  if (/only vendors who placed a bid/i.test(trimmed)) return 'Only vendors who placed a bid may file a dispute';
  if (/no pending withdrawal/i.test(trimmed)) return 'No pending withdrawal balance';

  return trimmed;
}
