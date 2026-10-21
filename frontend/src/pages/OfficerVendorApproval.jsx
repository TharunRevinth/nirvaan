import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config';

export default function OfficerVendorApproval({ triggerToast }) {
  const { officerToken, officerUser, selectedPSU } = useAuth();
  const [applications, setApplications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('PENDING'); // 'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL'
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [rejectModalApp, setRejectModalApp] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  const fetchApplications = useCallback(async () => {
    if (!officerToken) return;
    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/vendors/applications`, {
        headers: {
          'Authorization': `Bearer ${officerToken}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setApplications(Array.isArray(data.applications) ? data.applications : []);
      } else {
        const errData = await res.json().catch(() => ({}));
        triggerToast?.(errData.error || 'Failed to load vendor applications.', 'error');
      }
    } catch (err) {
      console.error('Fetch applications error:', err);
      triggerToast?.('Network error fetching vendor applications.', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [officerToken, triggerToast]);

  useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

  const handleApprove = async (app) => {
    if (!officerToken) return;
    setActionLoadingId(app.id);

    try {
      const res = await fetch(`${API_URL}/api/vendors/applications/${app.id}/approve`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${officerToken}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to approve vendor application.');
      }

      triggerToast?.(
        `Vendor "${app.companyName}" successfully approved and registered on-chain! Tx: ${data.txHash ? data.txHash.slice(0, 16) + '…' : 'Confirmed'}`,
        'success'
      );

      // Update in-memory state
      setApplications(prev => prev.map(a => a.id === app.id ? { ...a, status: 'APPROVED', txHash: data.txHash } : a));
    } catch (err) {
      console.error('Approval error:', err);
      triggerToast?.(err.message, 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRejectConfirm = async () => {
    if (!rejectModalApp || !officerToken) return;
    setActionLoadingId(rejectModalApp.id);

    try {
      const res = await fetch(`${API_URL}/api/vendors/applications/${rejectModalApp.id}/reject`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${officerToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reason: rejectReason })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to reject vendor application.');
      }

      triggerToast?.(`Vendor application for "${rejectModalApp.companyName}" marked as Rejected.`, 'info');

      setApplications(prev => prev.map(a => a.id === rejectModalApp.id ? { ...a, status: 'REJECTED', rejectionReason: rejectReason } : a));
      setRejectModalApp(null);
      setRejectReason('');
    } catch (err) {
      console.error('Rejection error:', err);
      triggerToast?.(err.message, 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  const filteredApps = applications.filter(app => {
    if (activeTab === 'ALL') return true;
    return app.status === activeTab;
  });

  const pendingCount = applications.filter(a => a.status === 'PENDING').length;
  const approvedCount = applications.filter(a => a.status === 'APPROVED').length;
  const rejectedCount = applications.filter(a => a.status === 'REJECTED').length;

  return (
    <div id="main-content" className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="border-b border-[#E8E6E1] pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <span className="text-[11px] font-mono font-semibold uppercase text-[#71716D] tracking-wider">
            Consortium Nodal Officer • Statutory Oversight
          </span>
          <h1 className="text-2xl font-bold text-[#1A1A18] tracking-tight">
            Vendor KYC Application Register
          </h1>
          <p className="text-xs text-[#575753]">
            Verify corporate incorporation, GSTIN/PAN compliance, and execute on-chain smart contract registration.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchApplications}
          disabled={isLoading}
          className="self-start sm:self-auto bg-white border border-[#E8E6E1] hover:bg-[#F5F4F0] text-[#1A1A18] px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center space-x-1.5 cursor-pointer shadow-2xs"
        >
          <span>{isLoading ? 'Syncing…' : '↻ Refresh Register'}</span>
        </button>
      </div>

      {/* Metrics Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-[#E8E6E1] rounded-xl p-4 space-y-1 shadow-2xs">
          <span className="text-[11px] font-mono uppercase text-[#71716D]">Total Applications</span>
          <p className="text-2xl font-bold text-[#1A1A18]">{applications.length}</p>
        </div>
        <div className="bg-amber-50/50 border border-amber-200/60 rounded-xl p-4 space-y-1 shadow-2xs">
          <span className="text-[11px] font-mono uppercase text-amber-800">Pending Review</span>
          <p className="text-2xl font-bold text-amber-900">{pendingCount}</p>
        </div>
        <div className="bg-emerald-50/50 border border-emerald-200/60 rounded-xl p-4 space-y-1 shadow-2xs">
          <span className="text-[11px] font-mono uppercase text-emerald-800">Approved On-Chain</span>
          <p className="text-2xl font-bold text-emerald-900">{approvedCount}</p>
        </div>
        <div className="bg-rose-50/50 border border-rose-200/60 rounded-xl p-4 space-y-1 shadow-2xs">
          <span className="text-[11px] font-mono uppercase text-rose-800">Rejected</span>
          <p className="text-2xl font-bold text-rose-900">{rejectedCount}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#E8E6E1] space-x-4 text-xs font-semibold">
        <button
          type="button"
          onClick={() => setActiveTab('PENDING')}
          className={`pb-2.5 transition-colors border-b-2 cursor-pointer ${
            activeTab === 'PENDING'
              ? 'border-[#A13D2B] text-[#A13D2B]'
              : 'border-transparent text-[#71716D] hover:text-[#1A1A18]'
          }`}
        >
          Pending Review ({pendingCount})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('APPROVED')}
          className={`pb-2.5 transition-colors border-b-2 cursor-pointer ${
            activeTab === 'APPROVED'
              ? 'border-[#A13D2B] text-[#A13D2B]'
              : 'border-transparent text-[#71716D] hover:text-[#1A1A18]'
          }`}
        >
          Approved ({approvedCount})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('REJECTED')}
          className={`pb-2.5 transition-colors border-b-2 cursor-pointer ${
            activeTab === 'REJECTED'
              ? 'border-[#A13D2B] text-[#A13D2B]'
              : 'border-transparent text-[#71716D] hover:text-[#1A1A18]'
          }`}
        >
          Rejected ({rejectedCount})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('ALL')}
          className={`pb-2.5 transition-colors border-b-2 cursor-pointer ${
            activeTab === 'ALL'
              ? 'border-[#A13D2B] text-[#A13D2B]'
              : 'border-transparent text-[#71716D] hover:text-[#1A1A18]'
          }`}
        >
          All Applications ({applications.length})
        </button>
      </div>

      {/* List / Cards */}
      {isLoading ? (
        <div className="bg-white border border-[#E8E6E1] rounded-2xl p-12 text-center space-y-3">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-[#A13D2B] border-t-transparent"></div>
          <p className="text-xs text-[#575753]">Loading vendor applications from database…</p>
        </div>
      ) : filteredApps.length === 0 ? (
        <div className="bg-white border border-[#E8E6E1] rounded-2xl p-12 text-center space-y-2">
          <p className="font-semibold text-sm text-[#1A1A18]">No {activeTab.toLowerCase()} applications found</p>
          <p className="text-xs text-[#71716D]">
            {activeTab === 'PENDING'
              ? 'There are currently no vendor KYC applications awaiting officer review.'
              : 'No applications match the selected filter.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredApps.map((app) => (
            <div
              key={app.id}
              className="bg-white border border-[#E8E6E1] hover:border-[#D1CEB7] rounded-xl p-5 transition-all shadow-2xs space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-[#F5F4F0] pb-3">
                <div className="space-y-0.5">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-sm text-[#1A1A18]">{app.companyName}</span>
                    <span className="font-mono text-[10px] text-[#71716D] bg-[#FAFAF9] px-2 py-0.5 rounded border border-[#E8E6E1]">
                      {app.id}
                    </span>
                  </div>
                  <span className="font-mono text-[11px] text-[#575753] block break-all">
                    Wallet: {app.walletAddress}
                  </span>
                </div>

                <div>
                  <span
                    className={`font-mono text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                      app.status === 'APPROVED'
                        ? 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                        : app.status === 'PENDING'
                        ? 'bg-amber-100 text-amber-900 border border-amber-200'
                        : 'bg-rose-100 text-rose-900 border border-rose-200'
                    }`}
                  >
                    {app.status}
                  </span>
                </div>
              </div>

              {/* Data Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-[#71716D] text-[10px] font-mono uppercase block">GSTIN</span>
                  <span className="font-mono font-semibold text-[#1A1A18]">{app.gstin}</span>
                </div>
                <div>
                  <span className="text-[#71716D] text-[10px] font-mono uppercase block">PAN</span>
                  <span className="font-mono font-semibold text-[#1A1A18]">{app.pan}</span>
                </div>
                <div>
                  <span className="text-[#71716D] text-[10px] font-mono uppercase block">Submitted</span>
                  <span className="text-[#575753]">
                    {app.createdAt ? new Date(app.createdAt).toLocaleDateString('en-IN') : 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-[#71716D] text-[10px] font-mono uppercase block">Incorporation Doc</span>
                  {app.kycCid ? (
                    <a
                      href={`${API_URL}/api/ipfs/${app.kycCid}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#A13D2B] hover:underline font-mono truncate block"
                      title={app.kycCid}
                    >
                      {app.kycCid.slice(0, 10)}…{app.kycCid.slice(-6)} ↗
                    </a>
                  ) : (
                    <span className="text-[#71716D] italic">None uploaded</span>
                  )}
                </div>
              </div>

              {/* Tx Hash / Rejection Reason Details */}
              {app.txHash && (
                <div className="bg-[#FAFAF9] p-2.5 rounded-lg border border-[#E8E6E1] text-[11px] font-mono text-[#575753] flex justify-between items-center">
                  <span>Registration Tx: {app.txHash}</span>
                  <span className="text-emerald-700 font-bold">SMART CONTRACT RECORD</span>
                </div>
              )}

              {app.rejectionReason && (
                <div className="bg-rose-50/50 p-2.5 rounded-lg border border-rose-200/60 text-[11px] text-rose-900">
                  <span className="font-semibold">Rejection Note: </span>
                  {app.rejectionReason}
                </div>
              )}

              {/* Actions for PENDING */}
              {app.status === 'PENDING' && (
                <div className="pt-2 flex items-center justify-end space-x-3 border-t border-[#F5F4F0]">
                  <button
                    type="button"
                    onClick={() => {
                      setRejectModalApp(app);
                      setRejectReason('Tax identification or incorporation documentation could not be verified.');
                    }}
                    disabled={actionLoadingId === app.id}
                    className="border border-[#E8E6E1] hover:bg-rose-50 hover:border-rose-300 text-rose-700 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Reject Application
                  </button>

                  <button
                    type="button"
                    onClick={() => handleApprove(app)}
                    disabled={actionLoadingId === app.id}
                    className="bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors shadow-2xs cursor-pointer flex items-center space-x-1.5"
                  >
                    {actionLoadingId === app.id ? (
                      <span>Registering On-Chain…</span>
                    ) : (
                      <>
                        <span>Approve &amp; Register On-Chain →</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Rejection Modal */}
      {rejectModalApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-[#E8E6E1] p-6 max-w-md w-full space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-[#1A1A18]">Reject KYC Application</h3>
            <p className="text-xs text-[#575753]">
              Specify the reason for rejecting <strong>{rejectModalApp.companyName}</strong>. The vendor will be notified and permitted to resubmit credentials.
            </p>

            <textarea
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Enter rejection reason..."
              className="w-full bg-white border border-[#E8E6E1] rounded-lg p-2.5 text-xs text-[#1A1A18] focus-visible:ring-2 focus-visible:ring-[#A13D2B] focus-visible:outline-none"
            />

            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setRejectModalApp(null);
                  setRejectReason('');
                }}
                className="px-3.5 py-1.5 rounded-lg border border-[#E8E6E1] text-xs font-medium text-[#575753] hover:bg-[#F5F4F0]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRejectConfirm}
                disabled={actionLoadingId === rejectModalApp.id}
                className="px-4 py-1.5 rounded-lg bg-rose-700 hover:bg-rose-800 text-white text-xs font-semibold"
              >
                {actionLoadingId === rejectModalApp.id ? 'Rejecting…' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
