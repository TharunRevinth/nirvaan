import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config';
import NirvaanLogo from '../components/NirvaanLogo';

export default function Landing({ triggerToast }) {
  const navigate = useNavigate();
  const { connectVendorWallet, connectSimulatedVendorWallet, isDevDemoEnabled, isVendorRegistered, loginOfficerSession } = useAuth();

  const [activeTab, setActiveTab] = useState('officer'); // 'officer' | 'vendor'

  // Officer Form State
  const [username, setUsername] = useState('iocl_officer');
  const [password, setPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Password Change State for first-time login
  const [requirePasswordChange, setRequirePasswordChange] = useState(false);
  const [tempToken, setTempToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Handle Vendor Wallet Connect via window.ethereum
  const handleVendorConnect = async () => {
    try {
      const connectedAddr = await connectVendorWallet();
      if (isVendorRegistered) {
        triggerToast(`Wallet connected: ${connectedAddr.substring(0, 6)}…${connectedAddr.substring(connectedAddr.length - 4)}`, 'success');
        navigate('/vendor/dashboard');
      } else {
        triggerToast(`Wallet connected. Please complete corporate KYC registration.`, 'info');
        navigate('/vendor/kyc');
      }
    } catch (err) {
      triggerToast(err.message || 'Wallet connection failed. Please unlock MetaMask.', 'error');
    }
  };

  const handleSimulatedVendorConnect = () => {
    try {
      const devAddress = import.meta.env.VITE_DEV_VENDOR_ADDRESS;
      if (!devAddress) {
        throw new Error('VITE_DEV_VENDOR_ADDRESS is not configured in environment.');
      }
      const demoAddr = connectSimulatedVendorWallet(devAddress);
      triggerToast(`Simulated vendor session connected: ${demoAddr.substring(0, 6)}…${demoAddr.substring(demoAddr.length - 4)}`, 'success');
      navigate('/vendor/dashboard');
    } catch (err) {
      triggerToast(err.message, 'error');
    }
  };

  // Handle PSU Officer Login via Backend Express Server
  const handleOfficerLogin = async (e) => {
    e.preventDefault();
    setIsLoggingIn(true);

    try {
      const res = await fetch(`${API_URL}/api/auth/officer-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password: password.trim() })
      });

      const data = await res.json();
      setIsLoggingIn(false);

      if (!res.ok) {
        triggerToast(data.error || 'Authentication failed. Please check credentials.', 'error');
        return;
      }

      if (data.requirePasswordChange) {
        setTempToken(data.tempToken);
        setRequirePasswordChange(true);
        triggerToast('First-time login detected. You must set a new permanent password.', 'info');
        return;
      }

      loginOfficerSession(data.token, data.officer);
      triggerToast(`Signed in as ${data.officer.username} (${data.officer.psu})`, 'success');
      navigate('/psu/dashboard');
    } catch (err) {
      setIsLoggingIn(false);
      console.error('Officer login error:', err);
      triggerToast(`Unable to connect to authentication server at ${API_URL}`, 'error');
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
      const res = await fetch(`${API_URL}/api/auth/change-password`, {
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
      triggerToast('Password updated. Session activated.', 'success');
      navigate('/psu/dashboard');
    } catch (err) {
      triggerToast('Password update failed.', 'error');
    }
  };

  return (
    <div id="main-content" className="max-w-xl mx-auto py-12 px-4 space-y-6">
      
      {/* Platform Title */}
      <div className="text-center space-y-3 flex flex-col items-center">
        <NirvaanLogo className="w-14 h-14 drop-shadow-sm" size={56} />
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#1A1A18] tracking-tight">
            NIRVAAN E-Tendering
          </h1>
          <p className="text-xs sm:text-sm text-[#575753] mt-1">
            Unified e-procurement platform for Indian Oil PSUs under CVC guidelines.
          </p>
        </div>
      </div>

      {/* Two-Path Authentication Card */}
      <div className="bg-white border border-[#E8E6E1] rounded-2xl shadow-xs overflow-hidden">
        
        {/* Role Switcher Tabs */}
        <div className="flex border-b border-[#E8E6E1] bg-[#FAFAF9]" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'officer'}
            onClick={() => setActiveTab('officer')}
            className={`flex-1 py-3 px-4 text-xs font-semibold text-center transition-colors ${
              activeTab === 'officer'
                ? 'bg-white text-[#1A1A18] border-b-2 border-[#A13D2B] font-bold shadow-xs'
                : 'text-[#71716D] hover:text-[#1A1A18]'
            }`}
          >
            PSU Officer Sign In
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'vendor'}
            onClick={() => setActiveTab('vendor')}
            className={`flex-1 py-3 px-4 text-xs font-semibold text-center transition-colors ${
              activeTab === 'vendor'
                ? 'bg-white text-[#1A1A18] border-b-2 border-[#A13D2B] font-bold shadow-xs'
                : 'text-[#71716D] hover:text-[#1A1A18]'
            }`}
          >
            Vendor / Bidder Access
          </button>
        </div>

        <div className="p-6 sm:p-8">
          {activeTab === 'officer' ? (
            <div>
              {!requirePasswordChange ? (
                <form onSubmit={handleOfficerLogin} className="space-y-4">
                  <div className="space-y-1">
                    <h2 className="text-sm font-semibold text-[#1A1A18]">
                      Sign in with officer credentials
                    </h2>
                    <p className="text-xs text-[#71716D]">
                      Authorized access for IOCL, BPCL, HPCL, ONGC, and GAIL procurement officers.
                    </p>
                  </div>

                  <div className="space-y-1.5 pt-2">
                    <label htmlFor="officer-username" className="text-xs font-medium text-[#1A1A18] block">
                      Username / Officer ID
                    </label>
                    <input
                      id="officer-username"
                      name="username"
                      type="text"
                      required
                      autoComplete="username"
                      spellCheck={false}
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="e.g. iocl_officer"
                      className="w-full bg-white border border-[#E8E6E1] rounded-lg px-3 py-2.5 text-xs text-[#1A1A18] placeholder:text-[#A8A7A1] focus-visible:ring-2 focus-visible:ring-[#A13D2B] focus-visible:outline-none transition-all"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <label htmlFor="officer-password" className="text-xs font-medium text-[#1A1A18] block">
                        Password
                      </label>
                      <span className="text-[11px] text-[#71716D]">Temporary or permanent</span>
                    </div>
                    <input
                      id="officer-password"
                      name="password"
                      type="password"
                      required
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter password"
                      className="w-full bg-white border border-[#E8E6E1] rounded-lg px-3 py-2.5 text-xs text-[#1A1A18] placeholder:text-[#A8A7A1] focus-visible:ring-2 focus-visible:ring-[#A13D2B] focus-visible:outline-none transition-all"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isLoggingIn}
                    className="w-full bg-[#A13D2B] hover:bg-[#8A3323] text-white font-semibold text-xs py-2.5 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2 focus-visible:ring-2 focus-visible:ring-[#A13D2B] focus-visible:outline-none mt-2"
                  >
                    {isLoggingIn ? 'Authenticating…' : 'Sign In as PSU Officer'}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleChangePassword} className="space-y-4">
                  <div className="bg-[#FFF9F2] border border-[#F3DFC1] rounded-lg p-3 text-xs text-[#7A4510]">
                    <strong className="block font-semibold">First-time password reset required</strong>
                    Please create a permanent password of at least 8 characters before proceeding.
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="new-password" className="text-xs font-medium text-[#1A1A18] block">
                      New Password
                    </label>
                    <input
                      id="new-password"
                      type="password"
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Minimum 8 characters"
                      className="w-full bg-white border border-[#E8E6E1] rounded-lg px-3 py-2 text-xs text-[#1A1A18] focus-visible:ring-2 focus-visible:ring-[#A13D2B] focus-visible:outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="confirm-password" className="text-xs font-medium text-[#1A1A18] block">
                      Confirm New Password
                    </label>
                    <input
                      id="confirm-password"
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter password"
                      className="w-full bg-white border border-[#E8E6E1] rounded-lg px-3 py-2 text-xs text-[#1A1A18] focus-visible:ring-2 focus-visible:ring-[#A13D2B] focus-visible:outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-[#A13D2B] hover:bg-[#8A3323] text-white font-semibold text-xs py-2.5 rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-[#A13D2B] focus-visible:outline-none"
                  >
                    Save Password &amp; Continue
                  </button>
                </form>
              )}
            </div>
          ) : (
            <div className="space-y-5">
              <div className="space-y-1">
                <h2 className="text-sm font-semibold text-[#1A1A18]">
                  Commercial bidder connection
                </h2>
                <p className="text-xs text-[#71716D] leading-relaxed">
                  Connect your registered Class-3 DSC cryptographic hardware token or Web3 wallet to submit sealed bids and view eligible tenders.
                </p>
              </div>

              <div className="bg-[#FAFAF9] border border-[#E8E6E1] rounded-lg p-3.5 space-y-2 text-xs">
                <div className="flex justify-between text-[#575753]">
                  <span>Network</span>
                  <span className="font-mono font-medium text-[#1A1A18]">Besu QBFT Consortium</span>
                </div>
                <div className="flex justify-between text-[#575753]">
                  <span>Gas policy</span>
                  <span className="font-mono text-[#1A1A18]">0.00 Gwei (Fixed)</span>
                </div>
                <div className="flex justify-between text-[#575753]">
                  <span>Encryption standard</span>
                  <span className="font-mono text-[#1A1A18]">Client-side Keccak-256</span>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <button
                  type="button"
                  onClick={handleVendorConnect}
                  className="w-full bg-[#A13D2B] hover:bg-[#8A3323] text-white font-semibold text-xs py-3 rounded-lg transition-colors flex items-center justify-center gap-2 focus-visible:ring-2 focus-visible:ring-[#A13D2B] focus-visible:outline-none"
                >
                  Connect Wallet (MetaMask / Class-3 DSC)
                </button>

                {isDevDemoEnabled && import.meta.env.VITE_DEV_VENDOR_ADDRESS && (
                  <button
                    type="button"
                    onClick={handleSimulatedVendorConnect}
                    className="w-full bg-[#F5F4F0] border border-[#E8E6E1] text-[#575753] hover:text-[#1A1A18] font-mono text-xs py-2 rounded-lg transition-colors"
                  >
                    Dev-Only Simulated Vendor Session
                  </button>
                )}

                <div className="text-center pt-2">
                  <Link
                    to="/vendor/kyc"
                    className="text-xs text-[#71716D] hover:text-[#1A1A18] font-medium transition-colors"
                  >
                    New supplier? Register corporate KYC →
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quiet Link to About Page */}
      <div className="text-center pt-2">
        <Link
          to="/about"
          className="text-xs text-[#71716D] hover:text-[#1A1A18] transition-colors underline-offset-4 hover:underline"
        >
          About NIRVAAN &amp; Platform Architecture →
        </Link>
      </div>

    </div>
  );
}
