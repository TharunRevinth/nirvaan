import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { useAuth } from '../context/AuthContext';
import { CONTRACT_ADDRESS } from '../config';
import { ensureCorrectChain } from '../utils/chain';

export default function Withdraw({ triggerToast }) {
  const { walletAddress } = useAuth();
  const [balanceEth, setBalanceEth] = useState('0.0');
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [txHash, setTxHash] = useState('');

  const loadBalance = async () => {
    if (!walletAddress || !window.ethereum) return;
    setLoadingBalance(true);
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const abi = [
        "function pendingWithdrawals(address) external view returns (uint256)"
      ];
      const contract = new ethers.Contract(CONTRACT_ADDRESS, abi, provider);
      const bal = await contract.pendingWithdrawals(walletAddress);
      setBalanceEth(ethers.formatEther(bal));
    } catch (err) {
      console.warn('Could not read pending withdrawal balance:', err);
    } finally {
      setLoadingBalance(false);
    }
  };

  useEffect(() => {
    loadBalance();
  }, [walletAddress]);

  const handleWithdraw = async () => {
    if (!walletAddress) {
      triggerToast('Please connect your Web3 wallet first.', 'error');
      return;
    }
    if (parseFloat(balanceEth) <= 0) {
      triggerToast('No pending balance available for withdrawal.', 'warning');
      return;
    }

    setIsSubmitting(true);
    setTxHash('');

    try {
      await ensureCorrectChain();

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const abi = [
        "function withdraw() external"
      ];
      const contract = new ethers.Contract(CONTRACT_ADDRESS, abi, signer);

      const tx = await contract.withdraw();
      setTxHash(tx.hash);
      triggerToast(`Withdrawal transaction sent: ${tx.hash.substring(0, 18)}…`, 'info');

      const receipt = await tx.wait();
      triggerToast(`Successfully pulled ${balanceEth} ETH to ${walletAddress.substring(0, 6)}… in Block #${receipt.blockNumber}.`, 'success');
      setBalanceEth('0.0');
    } catch (err) {
      console.error('Withdrawal error:', err);
      triggerToast(`Withdrawal failed: ${err.reason || err.message}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div id="main-content" className="max-w-2xl mx-auto space-y-6">
      <div className="border-b border-[#E8E6E1] pb-4">
        <span className="text-[11px] font-mono font-semibold uppercase text-[#71716D] tracking-wider">
          Pull Payment Escrow Settlement
        </span>
        <h1 className="text-2xl font-bold text-[#1A1A18] tracking-tight mt-1">
          Withdraw Refundable Escrow Balances
        </h1>
        <p className="text-xs text-[#575753] mt-1">
          Pull payments for refunded tender EMD deposits and successfully resolved dispute bonds.
        </p>
      </div>

      <div className="bg-white border border-[#E8E6E1] rounded-2xl p-6 sm:p-8 space-y-6 shadow-xs">
        <div className="bg-[#FAFAF9] border border-[#E8E6E1] rounded-xl p-5 space-y-2">
          <span className="text-xs text-[#71716D] block">Available for Withdrawal</span>
          <div className="text-3xl font-extrabold font-mono text-[#1A1A18]">
            {loadingBalance ? 'Reading chain…' : `${balanceEth} ETH`}
          </div>
          <span className="text-[11px] text-[#575753] block">
            Wallet: <span className="font-mono">{walletAddress || 'Not Connected'}</span>
          </span>
        </div>

        <button
          type="button"
          disabled={isSubmitting || !walletAddress || parseFloat(balanceEth) <= 0}
          onClick={handleWithdraw}
          className="w-full bg-[#1A1A18] hover:bg-black disabled:bg-[#A8A7A1] text-white font-semibold text-xs py-3.5 rounded-xl transition-colors cursor-pointer"
        >
          {isSubmitting ? 'Pulling Funds via Smart Contract…' : 'Withdraw Funds to Connected Wallet →'}
        </button>

        {txHash && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-mono text-emerald-900 break-all">
            Transaction Confirmed: {txHash}
          </div>
        )}

        <div className="text-[11px] text-[#71716D] leading-relaxed border-t border-[#E8E6E1] pt-4">
          <strong>Security Note:</strong> Nirvaan utilizes the pull-over-push payment design pattern recommended by the Ethereum Foundation and OpenZeppelin to prevent smart contract denial-of-service vulnerabilities. All refundable deposits remain securely in escrow until explicitly claimed by the recipient.
        </div>
      </div>
    </div>
  );
}
