import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Landing({ triggerToast }) {
  const navigate = useNavigate();
  const { connectVendorWallet, isVendorRegistered, loginOfficerSession } = useAuth();

  // Officer Form State
  const [username, setUsername] = useState('iocl_officer');
  const [password, setPassword] = useState('TempOfficerPassword123!');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Password Change State for first-time login
  const [requirePasswordChange, setRequirePasswordChange] = useState(false);
  const [tempToken, setTempToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Handle Vendor Wallet Connect
  const handleVendorConnect = () => {
    const mockAddress = '0xfe3b2075775791234567890abcdef1234567bd73';
    connectVendorWallet(mockAddress);

    if (isVendorRegistered) {
      triggerToast('Vendor Wallet authenticated. Welcome to Commercial Bidding Dashboard.', 'success');
      navigate('/vendor/dashboard');
    } else {
      triggerToast('Wallet connected. KYC Registration required before participating in bidding.', 'error');
      navigate('/vendor/kyc');
    }
  };

  // Handle PSU Officer Login via Backend Express Server
  const handleOfficerLogin = async (e) => {
    e.preventDefault();
    setIsLoggingIn(true);

    try {
      const res = await fetch('http://localhost:5000/api/auth/officer-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await res.json();
      setIsLoggingIn(false);

      if (!res.ok) {
        triggerToast(data.error || 'Authentication failed.', 'error');
        return;
      }

      if (data.requirePasswordChange) {
        setTempToken(data.tempToken);
        setRequirePasswordChange(true);
        triggerToast('First-time login detected. You must set a new password before accessing PSU Procurement Portal.', 'error');
        return;
      }

      loginOfficerSession(data.token, data.officer);
      triggerToast(`PSU Officer Session authenticated for ${data.officer.username} (${data.officer.psu})`, 'success');
      navigate('/psu/dashboard');
    } catch (err) {
      setIsLoggingIn(false);
      triggerToast('Unable to connect to PSU Authentication Backend Service at http://localhost:5000', 'error');
    }
  };

  // Handle First-Time Password Change
  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      triggerToast('New password and confirmation do not match.', 'error');
      return;
    }
    if (newPassword.length < 8) {
      triggerToast('Password must be at least 8 characters long.', 'error');
      return;
    }

    try {
      const res = await fetch('http://localhost:5000/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tempToken, newPassword })
      });

      const data = await res.json();
      if (!res.ok) {
        triggerToast(data.error || 'Password update failed.', 'error');
        return;
      }

      setRequirePasswordChange(false);
      loginOfficerSession(data.token, data.officer);
      triggerToast('Password updated successfully. PSU Officer Session activated.', 'success');
      navigate('/psu/dashboard');
    } catch (err) {
      triggerToast('Password change failed.', 'error');
    }
  };

  return (
    <div id="main-content" className="max-w-4xl mx-auto py-10 px-4 space-y-8">
      <div className="text-center space-y-2">
        <span className="text-xs font-mono text-slate bg-slate/10 px-2 py-0.5 border border-slate/20">
          GOVERNMENT OF INDIA E-PROCUREMENT AUTHENTICATION GATEWAY
        </span>
        <h1 className="text-2xl font-bold text-graphite uppercase tracking-tight">
          Indian Oil PSUs Blockchain E-Tendering Platform
        </h1>
        <p className="text-xs text-graphite/70 max-w-xl mx-auto">
          Official procurement system for IOCL, HPCL, BPCL, ONGC, and GAIL under CVC Procurement Directives. Select your dedicated authentication portal below.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Entry Point 1: PSU Officer Login */}
        <div className="bg-white border-2 border-graphite p-6 space-y-6">
          <div className="border-b border-graphite/15 pb-3">
            <h2 className="font-bold text-sm text-graphite uppercase tracking-wider flex items-center gap-2">
              🏢 PSU Authorized Officer Login
            </h2>
            <p className="text-[11px] text-slate mt-0.5">
              Backend JWT Authentication for IOCL, HPCL, BPCL, ONGC, GAIL Officers
            </p>
          </div>

          {!requirePasswordChange ? (
            <form onSubmit={handleOfficerLogin} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-graphite">OFFICER USERNAME *</label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. iocl_officer"
                  className="w-full bg-offwhite border border-graphite/30 p-2.5 text-xs font-mono text-graphite"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-graphite">PASSWORD *</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-offwhite border border-graphite/30 p-2.5 text-xs text-graphite"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoggingIn}
                  className="w-full bg-graphite text-white font-bold text-xs py-3 hover:bg-slate disabled:opacity-50 transition-colors uppercase"
                >
                  {isLoggingIn ? 'Authenticating Credentials...' : 'Authenticate PSU Officer Session →'}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="bg-amber/10 border border-amber/30 p-3 text-xs text-graphite">
                <strong className="block font-bold">First-Time Password Change Required</strong>
                Please replace your temporary password before accessing PSU dashboard.
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-graphite">NEW PERMANENT PASSWORD *</label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  className="w-full bg-offwhite border border-graphite/30 p-2.5 text-xs text-graphite"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-graphite">CONFIRM NEW PASSWORD *</label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  className="w-full bg-offwhite border border-graphite/30 p-2.5 text-xs text-graphite"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-copper text-white font-bold text-xs py-3 hover:bg-copper-hover transition-colors uppercase"
              >
                Set New Password & Activate Session →
              </button>
            </form>
          )}

          <div className="text-[11px] text-graphite/60 font-mono border-t border-graphite/10 pt-3">
            Notice: Officer accounts are admin-created. Public sign-up is forbidden.
          </div>
        </div>

        {/* Entry Point 2: Vendor Wallet Connect */}
        <div className="bg-white border-2 border-copper p-6 space-y-6">
          <div className="border-b border-graphite/15 pb-3">
            <h2 className="font-bold text-sm text-copper uppercase tracking-wider flex items-center gap-2">
              🔑 Commercial Vendor Authentication
            </h2>
            <p className="text-[11px] text-slate mt-0.5">
              Class-3 Web3 Cryptographic Wallet Connect for Bidders
            </p>
          </div>

          <div className="space-y-4">
            <p className="text-xs text-graphite leading-relaxed">
              Connect your authorized Web3 hardware token or MetaMask wallet. The connected wallet address acts as your cryptographically signed vendor identity on the consortium blockchain network.
            </p>

            <div className="bg-offwhite p-3 border border-graphite/15 text-xs font-mono space-y-1">
              <div className="text-graphite font-bold">Network: Indian Oil Consortium Besu</div>
              <div className="text-slate text-[11px]">Chain ID: 1337 // Zero Gas Price</div>
            </div>

            <button
              onClick={handleVendorConnect}
              className="w-full bg-copper text-white font-bold text-xs py-3 hover:bg-copper-hover transition-colors uppercase flex items-center justify-center gap-2"
            >
              Connect Vendor Wallet (MetaMask) →
            </button>
          </div>

          <div className="text-[11px] text-graphite/60 font-mono border-t border-graphite/10 pt-3">
            Unregistered Wallet? Connect to complete Mandatory Corporate KYC Registration.
          </div>
        </div>
      </div>
    </div>
  );
}
