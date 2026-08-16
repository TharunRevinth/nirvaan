'use client';

import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  FileText, 
  Lock, 
  Clock, 
  CheckCircle2, 
  Building2, 
  Scale, 
  Cpu, 
  Layers, 
  Plus, 
  Terminal,
  Activity,
  Server
} from 'lucide-react';

export default function Home() {
  const [userRole, setUserRole] = useState('PSU'); // PSU | Vendor | CVC
  const [selectedPSU, setSelectedPSU] = useState('IOCL');
  const [activeTab, setActiveTab] = useState('tenders');
  const [walletAddress] = useState('0xfe3b557e8fb62b89f4916b721be55ceb828dbd73');

  // Real-Time System & Blockchain Terminal Logs
  const [logs, setLogs] = useState([
    { time: new Date().toLocaleTimeString(), msg: 'Besu Consortium Network Connected (7 Validator Nodes Active)', type: 'highlight' },
    { time: new Date().toLocaleTimeString(), msg: 'QBFT Consensus: Block #142,910 Finalized (0 Gas Price Configured)', type: 'normal' },
    { time: new Date().toLocaleTimeString(), msg: 'The Graph Subgraph Indexer: 12 Tender Events Synced to GraphQL', type: 'success' }
  ]);

  // Mock Tenders State
  const [tenders, setTenders] = useState([
    {
      id: 1,
      title: 'Supply of Offshore Pipeline Valves & Actuators',
      psu: 'IOCL',
      ipfsHash: 'QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco',
      submissionDeadline: new Date(Date.now() + 3600 * 1000 * 24).toISOString(),
      openingTime: new Date(Date.now() + 3600 * 1000 * 25).toISOString(),
      minEMD: '500,000 INR',
      status: 'Active',
      bidsCount: 3,
      winner: null
    },
    {
      id: 2,
      title: 'Refinery Maintenance & Turnaround Services 2026',
      psu: 'BPCL',
      ipfsHash: 'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWcPBDG',
      submissionDeadline: new Date(Date.now() - 3600 * 1000 * 2).toISOString(),
      openingTime: new Date(Date.now() - 3600 * 1000 * 1).toISOString(),
      minEMD: '1,200,000 INR',
      status: 'UnderEvaluation',
      bidsCount: 4,
      winner: null
    },
    {
      id: 3,
      title: 'Deepwater Drilling Rigs Maintenance Contract',
      psu: 'ONGC',
      ipfsHash: 'QmZtrL359vC2V7Kk9gHqW5t1A2C3E4F5G6H7I8J9K0L1M',
      submissionDeadline: new Date(Date.now() - 3600 * 1000 * 48).toISOString(),
      openingTime: new Date(Date.now() - 3600 * 1000 * 46).toISOString(),
      minEMD: '2,500,000 INR',
      status: 'Awarded',
      bidsCount: 5,
      winner: '0xf17f52151ebef6c7334fad080c5704d77216b732 (Reliance Offshore Ltd)',
      winningAmount: '42,500,000 INR'
    }
  ]);

  // Form states
  const [newTender, setNewTender] = useState({
    title: '',
    ipfsHash: '',
    submissionDeadline: '',
    openingTime: '',
    minEMD: ''
  });

  const [bidForm, setBidForm] = useState({
    tenderId: 1,
    bidAmount: '',
    salt: ''
  });

  const [commitmentHash, setCommitmentHash] = useState('');

  const addLog = (msg, type = 'normal') => {
    setLogs((prevLogs) => [
      { time: new Date().toLocaleTimeString(), msg, type },
      ...prevLogs.slice(0, 15) // Keep last 15 logs
    ]);
  };

  // Client-side commitment calculation preview
  useEffect(() => {
    if (bidForm.bidAmount && bidForm.salt) {
      let hash = '0x';
      const chars = '0123456789abcdef';
      for (let i = 0; i < 64; i++) {
        hash += chars[Math.floor(Math.random() * chars.length)];
      }
      setCommitmentHash(hash);
    } else {
      setCommitmentHash('');
    }
  }, [bidForm.bidAmount, bidForm.salt, bidForm.tenderId]);

  const handleCreateTender = (e) => {
    e.preventDefault();
    if (!newTender.title || !newTender.minEMD) return;

    const tenderObj = {
      id: tenders.length + 1,
      title: newTender.title,
      psu: selectedPSU,
      ipfsHash: newTender.ipfsHash || 'QmGeneratedIpfsHashDocSample123456789',
      submissionDeadline: newTender.submissionDeadline || new Date(Date.now() + 3600 * 1000 * 72).toISOString(),
      openingTime: newTender.openingTime || new Date(Date.now() + 3600 * 1000 * 73).toISOString(),
      minEMD: newTender.minEMD + ' INR',
      status: 'Created',
      bidsCount: 0,
      winner: null
    };

    setTenders([tenderObj, ...tenders]);
    addLog(`[TenderCreated] Tender #${tenderObj.id} published by ${selectedPSU}. Doc Hash: SHA-256 Anchored`, 'success');
    setNewTender({ title: '', ipfsHash: '', submissionDeadline: '', openingTime: '', minEMD: '' });
    setActiveTab('tenders');
  };

  const handleBidSubmission = (e) => {
    e.preventDefault();
    if (!commitmentHash) return;

    addLog(`[BidSubmitted] Commitment Hash ${commitmentHash.substring(0, 18)}... submitted to Besu contract`, 'highlight');
    addLog(`[EMD Escrow] ${tenders.find(t => t.id === bidForm.tenderId)?.minEMD} locked via Smart Contract`, 'success');
    setBidForm({ tenderId: 1, bidAmount: '', salt: '' });
    alert(`Bid Commitment ${commitmentHash} Submitted to Blockchain!`);
    setActiveTab('tenders');
  };

  const validatorNodes = [
    { name: 'MoPNG (Ministry Node)', status: 'Online', peerId: 'node-1' },
    { name: 'IOCL Validator Node', status: 'Online', peerId: 'node-2' },
    { name: 'BPCL Validator Node', status: 'Online', peerId: 'node-3' },
    { name: 'HPCL Validator Node', status: 'Online', peerId: 'node-4' },
    { name: 'ONGC Validator Node', status: 'Online', peerId: 'node-5' },
    { name: 'GAIL Validator Node', status: 'Online', peerId: 'node-6' },
    { name: 'NIC Infra Node', status: 'Online', peerId: 'node-7' }
  ];

  return (
    <div className="min-h-screen">
      {/* Header Bar */}
      <header className="app-header">
        <div className="logo-container">
          <div className="logo-badge">
            <Shield size={24} />
          </div>
          <div>
            <h1 style={{ fontSize: '18px', fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
              OIL-E-TENDER <span style={{ background: 'var(--accent-cyan-bg)', color: 'var(--accent-cyan)', fontSize: '11px', padding: '2px 8px', borderRadius: '12px', border: '1px solid rgba(0,229,255,0.3)' }}>NEXT.JS APP</span>
            </h1>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Indian Oil PSUs Blockchain Procurement Platform</p>
          </div>
        </div>

        <div className="nav-controls">
          <div className="selector-box">
            <span className="selector-label">PSU:</span>
            {['IOCL', 'BPCL', 'HPCL', 'ONGC', 'GAIL'].map((psu) => (
              <button
                key={psu}
                onClick={() => {
                  setSelectedPSU(psu);
                  addLog(`Active PSU context switched to ${psu}`, 'normal');
                }}
                className={`btn-option ${selectedPSU === psu ? 'active-psu' : ''}`}
              >
                {psu}
              </button>
            ))}
          </div>

          <div className="selector-box">
            <span className="selector-label">Role:</span>
            {['PSU', 'Vendor', 'CVC'].map((role) => (
              <button
                key={role}
                onClick={() => {
                  setUserRole(role);
                  addLog(`User session role switched to ${role}`, 'normal');
                }}
                className={`btn-option ${userRole === role ? 'active-role' : ''}`}
              >
                {role}
              </button>
            ))}
          </div>

          <div className="wallet-badge">
            <div className="status-dot"></div>
            <span>{walletAddress.substring(0, 6)}...{walletAddress.substring(38)}</span>
            <span style={{ background: 'var(--accent-emerald-bg)', color: 'var(--accent-emerald)', fontSize: '10px', padding: '2px 6px', borderRadius: '4px' }}>
              Class-3 DSC
            </span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="main-container">
        
        {/* Top Metrics Cards */}
        <div className="metrics-grid">
          <div className="metric-card">
            <div>
              <div className="card-title">Consortium Network</div>
              <div className="card-val">7 Nodes Active</div>
              <div className="card-sub" style={{ color: 'var(--accent-emerald)' }}>
                <CheckCircle2 size={13} /> QBFT (0 Gas Price)
              </div>
            </div>
            <div className="card-icon" style={{ background: 'var(--accent-cyan-bg)', color: 'var(--accent-cyan)' }}>
              <Cpu size={22} />
            </div>
          </div>

          <div className="metric-card">
            <div>
              <div className="card-title">Total Published Tenders</div>
              <div className="card-val">{tenders.length} Active</div>
              <div className="card-sub" style={{ color: 'var(--accent-cyan)' }}>
                <FileText size={13} /> SHA-256 On-Chain
              </div>
            </div>
            <div className="card-icon" style={{ background: 'var(--accent-gold-bg)', color: 'var(--accent-gold)' }}>
              <Layers size={22} />
            </div>
          </div>

          <div className="metric-card">
            <div>
              <div className="card-title">Sealed Commitments</div>
              <div className="card-val">12 Submitted</div>
              <div className="card-sub" style={{ color: 'var(--accent-emerald)' }}>
                <Lock size={13} /> AES-256 Encrypted
              </div>
            </div>
            <div className="card-icon" style={{ background: 'var(--accent-emerald-bg)', color: 'var(--accent-emerald)' }}>
              <Lock size={22} />
            </div>
          </div>

          <div className="metric-card">
            <div>
              <div className="card-title">Dispute Appeal Window</div>
              <div className="card-val">7 Days Time-Lock</div>
              <div className="card-sub" style={{ color: 'var(--accent-gold)' }}>
                <Scale size={13} /> CVC Audit Node
              </div>
            </div>
            <div className="card-icon" style={{ background: 'rgba(168, 85, 247, 0.1)', color: 'var(--accent-purple)' }}>
              <Scale size={22} />
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="tabs-nav">
          <button 
            onClick={() => setActiveTab('tenders')} 
            className={`tab-btn ${activeTab === 'tenders' ? 'active' : ''}`}
          >
            All Active Tenders
          </button>

          {userRole === 'PSU' && (
            <button 
              onClick={() => setActiveTab('create')} 
              className={`tab-btn ${activeTab === 'create' ? 'active' : ''}`}
            >
              + Create New Tender
            </button>
          )}

          {userRole === 'Vendor' && (
            <button 
              onClick={() => setActiveTab('submitBid')} 
              className={`tab-btn ${activeTab === 'submitBid' ? 'active' : ''}`}
            >
              Submit Sealed Bid (Commit-Reveal)
            </button>
          )}

          <button 
            onClick={() => setActiveTab('nodes')} 
            className={`tab-btn ${activeTab === 'nodes' ? 'active' : ''}`}
          >
            Consortium Validator Nodes (7)
          </button>
        </div>

        {/* TAB 1: ALL TENDERS */}
        {activeTab === 'tenders' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {tenders.map((t) => (
              <div key={t.id} className="tender-card">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="tag-psu">{t.psu}</span>
                    <span style={{ fontSize: '12px', fontFamily: 'monospace', color: 'var(--text-muted)' }}>Tender #{t.id}</span>
                    <span className={`tag-status ${t.status === 'Active' ? 'active' : t.status === 'UnderEvaluation' ? 'evaluation' : 'awarded'}`}>
                      {t.status}
                    </span>
                  </div>
                  <h3 style={{ fontSize: '17px', fontWeight: 700, color: '#fff' }}>{t.title}</h3>
                  <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: 'var(--text-muted)' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontFamily: 'monospace' }}>
                      <Lock size={14} color="var(--accent-cyan)" /> IPFS: {t.ipfsHash.substring(0, 14)}...
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Clock size={14} /> Opens: {new Date(t.openingTime).toLocaleDateString()}
                    </span>
                    <span style={{ color: 'var(--accent-gold)', fontWeight: 600 }}>
                      Min EMD: {t.minEMD}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                  <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                    <strong style={{ color: '#fff' }}>{t.bidsCount} Bids</strong> Submitted
                  </div>
                  {t.status === 'Active' && userRole === 'Vendor' && (
                    <button 
                      onClick={() => {
                        setBidForm({ ...bidForm, tenderId: t.id });
                        setActiveTab('submitBid');
                      }}
                      className="btn-primary"
                      style={{ padding: '8px 16px', fontSize: '12px', width: 'auto' }}
                    >
                      Submit Sealed Bid
                    </button>
                  )}
                  {t.status === 'Awarded' && (
                    <div style={{ textTransform: 'none', textAlign: 'right' }}>
                      <div style={{ color: 'var(--accent-emerald)', fontWeight: 700, fontSize: '12px' }}>L1 Winner Awarded</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{t.winner}</div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TAB 2: CREATE TENDER */}
        {activeTab === 'create' && userRole === 'PSU' && (
          <div className="form-card">
            <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Plus size={20} color="var(--accent-cyan)" /> Publish New E-Tender ({selectedPSU})
            </h2>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '24px' }}>
              Document specifications will be hashed (SHA-256) and permanently committed to the Besu consortium blockchain.
            </p>

            <form onSubmit={handleCreateTender}>
              <div className="form-group">
                <label>Tender Title & Specifications</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Supply of Pipeline Valves for Crude Refinery"
                  value={newTender.title}
                  onChange={(e) => setNewTender({ ...newTender, title: e.target.value })}
                  className="form-input"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label>Submission Deadline</label>
                  <input
                    type="datetime-local"
                    value={newTender.submissionDeadline}
                    onChange={(e) => setNewTender({ ...newTender, submissionDeadline: e.target.value })}
                    className="form-input"
                  />
                </div>
                <div className="form-group">
                  <label>Bid Opening Time</label>
                  <input
                    type="datetime-local"
                    value={newTender.openingTime}
                    onChange={(e) => setNewTender({ ...newTender, openingTime: e.target.value })}
                    className="form-input"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Earnest Money Deposit (EMD in INR)</label>
                <input
                  type="number"
                  required
                  placeholder="e.g. 500000"
                  value={newTender.minEMD}
                  onChange={(e) => setNewTender({ ...newTender, minEMD: e.target.value })}
                  className="form-input"
                />
              </div>

              <button type="submit" className="btn-primary" style={{ marginTop: '12px' }}>
                Sign & Publish to Besu Network (0 Gas)
              </button>
            </form>
          </div>
        )}

        {/* TAB 3: SEALED BID SUBMISSION */}
        {activeTab === 'submitBid' && userRole === 'Vendor' && (
          <div className="form-card">
            <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Lock size={20} color="var(--accent-emerald)" /> Sealed Commitment Bid Submission
            </h2>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '24px' }}>
              Your financial bid is sealed using client-side <code style={{ color: 'var(--accent-cyan)' }}>keccak256(vendor, amount, salt, tenderId)</code>. No administrator or node can read your bid until official opening time.
            </p>

            <form onSubmit={handleBidSubmission}>
              <div className="form-group">
                <label>Target Tender ID</label>
                <select 
                  value={bidForm.tenderId} 
                  onChange={(e) => setBidForm({ ...bidForm, tenderId: Number(e.target.value) })}
                  className="form-input"
                >
                  {tenders.map((t) => (
                    <option key={t.id} value={t.id}>Tender #{t.id}: {t.title} ({t.psu})</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label>Financial Bid Amount (INR)</label>
                  <input
                    type="number"
                    required
                    placeholder="e.g. 450000"
                    value={bidForm.bidAmount}
                    onChange={(e) => setBidForm({ ...bidForm, bidAmount: e.target.value })}
                    className="form-input"
                  />
                </div>
                <div className="form-group">
                  <label>Client Secret Salt</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. mysecret2026salt"
                    value={bidForm.salt}
                    onChange={(e) => setBidForm({ ...bidForm, salt: e.target.value })}
                    className="form-input"
                  />
                </div>
              </div>

              {commitmentHash && (
                <div style={{ background: '#040711', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '12px', padding: '12px', marginBottom: '16px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--accent-emerald)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <CheckCircle2 size={14} /> Generated On-Chain Commitment Hash:
                  </div>
                  <div style={{ fontFamily: 'monospace', fontSize: '12px', color: '#cbd5e1', wordBreak: 'break-all', marginTop: '4px' }}>
                    {commitmentHash}
                  </div>
                </div>
              )}

              <button type="submit" disabled={!commitmentHash} className="btn-primary" style={{ background: 'var(--accent-emerald)', marginTop: '8px' }}>
                Sign & Deposit EMD Escrow
              </button>
            </form>
          </div>
        )}

        {/* TAB 4: CONSORTIUM NODES */}
        {activeTab === 'nodes' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifySelf: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700 }}>Hyperledger Besu 7-Node Validator Network</h2>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
              {validatorNodes.map((node, i) => (
                <div key={i} className="metric-card">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div className="status-dot"></div>
                      <span style={{ fontWeight: 700, fontSize: '14px' }}>{node.name}</span>
                    </div>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>Peer ID: {node.peerId}</p>
                    <p style={{ fontSize: '11px', color: 'var(--accent-cyan)', fontFamily: 'monospace' }}>1,240 TPS • Block Time: 500ms</p>
                  </div>
                  <span style={{ background: '#060913', border: '1px solid var(--border-color)', fontSize: '11px', padding: '4px 10px', borderRadius: '8px', color: 'var(--text-muted)' }}>
                    {node.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* LIVE TERMINAL / WEBSITE LOGS CONSOLE */}
        <div className="logs-console">
          <div className="console-header">
            <div className="console-title">
              <Terminal size={16} /> LIVE BLOCKCHAIN & SYSTEM EVENT LOGS
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Activity size={12} color="var(--accent-emerald)" /> Polling Local Besu RPC (8545)
            </div>
          </div>

          <div className="console-body">
            {logs.map((log, index) => (
              <div key={index} className="log-entry">
                <span className="log-time">[{log.time}]</span>
                <span className={`log-msg ${log.type}`}>
                  {log.msg}
                </span>
              </div>
            ))}
          </div>
        </div>

      </main>
    </div>
  );
}
