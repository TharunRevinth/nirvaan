'use client';

import React, { useState, useEffect } from 'react';

export default function Home() {
  // Navigation & State Management
  const [activeView, setActiveView] = useState('ledger'); // 'ledger' | 'formulate' | 'encryptor' | 'award'
  const [userRole, setUserRole] = useState('PSU'); // 'PSU' | 'Vendor'
  const [selectedPSU, setSelectedPSU] = useState('IOCL');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Real-Time System & Blockchain Event Terminal Logs
  const [logs, setLogs] = useState([
    { time: new Date().toLocaleTimeString() + ' UTC', msg: 'Besu Consortium Network Connected (7 Validator Nodes Active)', type: 'primary' },
    { time: new Date().toLocaleTimeString() + ' UTC', msg: 'QBFT Consensus: Block #142,912 Finalized (0 Gas Price Configured)', type: 'info' },
    { time: new Date().toLocaleTimeString() + ' UTC', msg: 'The Graph Subgraph Indexer: 14 Tender Events Synced to GraphQL', type: 'success' }
  ]);

  const addLog = (msg, type = 'info') => {
    setLogs((prev) => [
      { time: new Date().toLocaleTimeString() + ' UTC', msg, type },
      ...prev.slice(0, 10)
    ]);
  };

  // Mock Active Procurement Ledger Data
  const [tenders, setTenders] = useState([
    {
      id: 'TND-24-9982-A',
      psu: 'IOCL',
      category: 'Pipeline Infrastructure',
      desc: 'Expansion of Section 4B routing network pipeline valves & actuators.',
      valueCr: '45.50',
      emd: '910,000 INR',
      deadline: '2026-11-15 18:00',
      status: 'OPEN',
      bidsCount: 3
    },
    {
      id: 'TND-24-9983-B',
      psu: 'ONGC',
      category: 'Heavy Machinery',
      desc: 'Procurement of 15 industrial deepwater drilling rigs.',
      valueCr: '120.00',
      emd: '2,400,000 INR',
      deadline: '12:45:10',
      status: 'CLOSING SOON',
      bidsCount: 5
    },
    {
      id: 'TND-24-9984-C',
      psu: 'IOCL',
      category: 'Consulting',
      desc: 'Refinery safety audit and environmental compliance review Q4.',
      valueCr: '2.75',
      emd: '55,000 INR',
      deadline: '2026-11-20 12:00',
      status: 'OPEN',
      bidsCount: 2
    },
    {
      id: 'TND-24-9985-D',
      psu: 'BPCL',
      category: 'IT Infrastructure',
      desc: 'High-availability server cluster upgrade for primary data center.',
      valueCr: '18.20',
      emd: '364,000 INR',
      deadline: '38:15:00',
      status: 'CLOSING SOON',
      bidsCount: 4
    }
  ]);

  // Formulate Tender State
  const [formulateForm, setFormulateForm] = useState({
    title: '',
    techDesc: '',
    submissionDeadline: '',
    openingTime: '',
    emd: '',
    budget: '',
    ipfsFile: 'reactor_cooling_specs_v2.pdf',
    cid: 'QmYwAPJzv5CZsnA625s3Xf2sm5DyaRtPu8...1A2B'
  });

  // Bid Encryptor State
  const [bidForm, setBidForm] = useState({
    tenderRef: 'IOCL-2024-NT-089',
    amount: '',
    salt: ''
  });
  const [commitmentHash, setCommitmentHash] = useState('');

  // Calculate Keccak256 commitment hash preview
  useEffect(() => {
    if (bidForm.amount && bidForm.salt) {
      let hash = '0x';
      const chars = '0123456789abcdef';
      for (let i = 0; i < 64; i++) {
        hash += chars[Math.floor(Math.random() * chars.length)];
      }
      setCommitmentHash(hash);
    } else {
      setCommitmentHash('');
    }
  }, [bidForm.amount, bidForm.salt]);

  const handleGenerateSalt = () => {
    const randomSalt = Array.from({ length: 16 }, () => Math.random().toString(36)[2]).join('').toUpperCase();
    setBidForm({ ...bidForm, salt: randomSalt });
    addLog(`Cryptographic Salt generated for Bid Encryptor`, 'info');
  };

  const handleFormulateSubmit = (e) => {
    e.preventDefault();
    if (!formulateForm.title) return;

    const newId = `TND-26-${Math.floor(1000 + Math.random() * 9000)}-N`;
    const newTenderObj = {
      id: newId,
      psu: selectedPSU,
      category: 'General Infrastructure',
      desc: formulateForm.title,
      valueCr: (Number(formulateForm.budget || 5000000) / 10000000).toFixed(2),
      emd: (formulateForm.emd || '500,000') + ' INR',
      deadline: formulateForm.submissionDeadline || '2026-12-01 18:00',
      status: 'OPEN',
      bidsCount: 0
    };

    setTenders([newTenderObj, ...tenders]);
    addLog(`[NIT Published] Tender ${newId} initiated by ${selectedPSU}. IPFS CID: ${formulateForm.cid}`, 'success');
    alert(`Tender ${newId} Published to Blockchain with IPFS CID ${formulateForm.cid}!`);
    setActiveView('ledger');
  };

  const handleBidSubmit = (e) => {
    e.preventDefault();
    if (!commitmentHash) return;

    addLog(`[BidSubmitted] Commitment Hash ${commitmentHash.substring(0, 18)}... submitted on-chain`, 'success');
    alert(`Sealed Bid Hash ${commitmentHash} Committed to Blockchain!`);
    setActiveView('ledger');
  };

  // Evaluation & Award Mock Bids
  const [revealedBids, setRevealedBids] = useState([
    { rank: 'L1', vendor: 'Reliance Industries Ltd.', vid: 'RIL-4492-X', qualified: false, hash: '0x8f2a...9b4e1c2d3f4a5b6c7d8e9f0a1b2c3d4e', amount: '₹ 45,20,00,000' },
    { rank: 'L2', vendor: 'Larsen & Toubro', vid: 'LT-8821-Y', qualified: true, hash: '0x3c1b...4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a', amount: '₹ 46,85,50,000' },
    { rank: 'L3', vendor: 'Tata Projects', vid: 'TP-1102-Z', qualified: false, hash: '0x7d9f...1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d', amount: '₹ 48,00,00,000' }
  ]);

  const toggleQualify = (index) => {
    const copy = [...revealedBids];
    copy[index].qualified = !copy[index].qualified;
    setRevealedBids(copy);
    addLog(`Technical qualification updated for ${copy[index].vendor}`, 'info');
  };

  return (
    <>
      {/* 1. National Identity Bar & Accessibility Header */}
      <div className="bg-national-identity-bar border-b border-border-hairline py-1.5 px-6 flex justify-between items-center text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider z-50">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="w-3 h-2 bg-gradient-to-b from-[#FF9933] via-white to-[#138808] border border-border-hairline"></span>
            <span className="font-bold text-on-surface">GOVERNMENT OF INDIA</span>
          </div>
          <span className="hidden sm:inline border-l border-border-hairline pl-4">MINISTRY OF PETROLEUM AND NATURAL GAS</span>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => addLog('Accessibility: Font resized', 'info')} className="hover:text-primary transition-colors">Skip to Main Content</button>
          <div className="flex items-center gap-2 border-l border-border-hairline pl-4">
            <button className="px-2 py-0.5 bg-surface-container hover:bg-surface-container-high transition-colors font-bold text-[10px]">A-</button>
            <button className="px-2 py-0.5 bg-surface-container hover:bg-surface-container-high transition-colors font-bold text-[10px]">A</button>
            <button className="px-2 py-0.5 bg-surface-container hover:bg-surface-container-high transition-colors font-bold text-[10px]">A+</button>
          </div>
          <select className="bg-transparent border-l border-border-hairline text-on-surface text-xs py-0.5 pl-2 pr-4 outline-none">
            <option value="en">English</option>
            <option value="hi">हिन्दी</option>
          </select>
        </div>
      </div>

      {/* Accessibility Bar */}
      <div className="bg-accessibility-bar text-on-primary px-6 py-1.5 flex justify-between items-center text-xs">
        <div className="flex items-center gap-4">
          <span className="opacity-90">SECURE TENDER PROTOCOL V2.4 (HYPERLEDGER BESU CONSORTIUM)</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="font-code-md text-[11px] text-tertiary-fixed-dim">NODE ID: 0xFE3B...BD73</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          </div>
        </div>
      </div>

      {/* 2. Top Header Navigation Bar */}
      <header className="bg-surface-container-lowest border-b border-on-surface/15 flex justify-between items-center w-full px-6 py-4 max-w-container-max mx-auto z-40">
        <div className="flex items-center gap-8">
          <div className="font-headline-md text-headline-md font-bold text-primary flex items-center gap-3">
            <span className="material-symbols-outlined text-[28px]" style={{ fontVariationSettings: "'FILL' 1" }}>shield</span>
            {selectedPSU} | SECURE TENDER SYSTEM
          </div>
          <nav className="hidden md:flex gap-6">
            <button 
              onClick={() => setActiveView('ledger')} 
              className={`font-body-md text-body-md ${activeView === 'ledger' ? 'text-primary font-bold border-b-2 border-primary pb-1' : 'text-on-surface-variant font-medium hover:text-primary'}`}
            >
              Active Ledger
            </button>
            <button 
              onClick={() => setActiveView('formulate')} 
              className={`font-body-md text-body-md ${activeView === 'formulate' ? 'text-primary font-bold border-b-2 border-primary pb-1' : 'text-on-surface-variant font-medium hover:text-primary'}`}
            >
              NIT Formulation
            </button>
            <button 
              onClick={() => setActiveView('encryptor')} 
              className={`font-body-md text-body-md ${activeView === 'encryptor' ? 'text-primary font-bold border-b-2 border-primary pb-1' : 'text-on-surface-variant font-medium hover:text-primary'}`}
            >
              Bid Encryptor
            </button>
            <button 
              onClick={() => setActiveView('award')} 
              className={`font-body-md text-body-md ${activeView === 'award' ? 'text-primary font-bold border-b-2 border-primary pb-1' : 'text-on-surface-variant font-medium hover:text-primary'}`}
            >
              Evaluation & Award
            </button>
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex border border-on-surface/15 bg-surface-container">
            {['IOCL', 'BPCL', 'HPCL', 'ONGC', 'GAIL'].map((psu) => (
              <button
                key={psu}
                onClick={() => {
                  setSelectedPSU(psu);
                  addLog(`Active PSU switched to ${psu}`, 'info');
                }}
                className={`px-3 py-1 font-label-caps text-label-caps text-[11px] ${selectedPSU === psu ? 'bg-primary text-on-primary font-bold' : 'text-on-surface-variant hover:text-on-surface'}`}
              >
                {psu}
              </button>
            ))}
          </div>

          <button 
            onClick={() => setUserRole(userRole === 'PSU' ? 'Vendor' : 'PSU')}
            className="font-label-caps text-label-caps border border-outline px-4 py-2 hover:bg-surface-container-highest transition-colors uppercase"
          >
            {userRole} CONSOLE
          </button>
        </div>
      </header>

      {/* Main Canvas & Sidebar Layout */}
      <div className="flex flex-1 max-w-container-max mx-auto w-full relative overflow-hidden">
        
        {/* Left SideNavBar */}
        <aside className="hidden lg:flex w-64 bg-surface-container-lowest flex-col border-r border-on-surface/15 shrink-0 z-20">
          <div className="p-6 border-b border-on-surface/15">
            <div className="flex items-center gap-3 mb-1">
              <span className="material-symbols-outlined text-primary text-[28px]" style={{ fontVariationSettings: "'FILL' 1" }}>person</span>
              <div>
                <h2 className="font-headline-sm text-headline-sm font-bold text-primary">{userRole} AUTHORIZED</h2>
                <p className="font-code-md text-[11px] text-on-surface-variant">ID: 88-X92 ({selectedPSU})</p>
              </div>
            </div>
          </div>

          <div className="p-4 border-b border-on-surface/15">
            <button 
              onClick={() => setActiveView('formulate')}
              className="w-full bg-primary-container text-on-primary-container font-label-caps text-label-caps py-2.5 flex items-center justify-center gap-2 hover:bg-surface-tint hover:text-on-primary transition-colors border border-on-surface/15"
            >
              <span className="material-symbols-outlined text-[18px]">add_circle</span>
              INITIATE TENDER
            </button>
          </div>

          <nav className="flex-grow overflow-y-auto py-2">
            <ul className="flex flex-col">
              <li>
                <button onClick={() => setActiveView('ledger')} className={`w-full text-left px-4 py-3 flex items-center gap-3 font-label-caps text-label-caps ${activeView === 'ledger' ? 'bg-secondary-container text-on-secondary-container font-bold border-r-4 border-primary' : 'text-on-surface-variant hover:bg-surface-container-high'}`}>
                  <span className="material-symbols-outlined text-[20px]">account_balance_wallet</span>
                  Ledger
                </button>
              </li>
              <li>
                <button onClick={() => setActiveView('award')} className={`w-full text-left px-4 py-3 flex items-center gap-3 font-label-caps text-label-caps ${activeView === 'award' ? 'bg-secondary-container text-on-secondary-container font-bold border-r-4 border-primary' : 'text-on-surface-variant hover:bg-surface-container-high'}`}>
                  <span className="material-symbols-outlined text-[20px]">account_tree</span>
                  Custody Trail & Award
                </button>
              </li>
              <li>
                <button onClick={() => setActiveView('encryptor')} className={`w-full text-left px-4 py-3 flex items-center gap-3 font-label-caps text-label-caps ${activeView === 'encryptor' ? 'bg-secondary-container text-on-secondary-container font-bold border-r-4 border-primary' : 'text-on-surface-variant hover:bg-surface-container-high'}`}>
                  <span className="material-symbols-outlined text-[20px]">lock</span>
                  Bid Encryptor
                </button>
              </li>
              <li>
                <button onClick={() => setActiveView('formulate')} className={`w-full text-left px-4 py-3 flex items-center gap-3 font-label-caps text-label-caps ${activeView === 'formulate' ? 'bg-secondary-container text-on-secondary-container font-bold border-r-4 border-primary' : 'text-on-surface-variant hover:bg-surface-container-high'}`}>
                  <span className="material-symbols-outlined text-[20px]">receipt_long</span>
                  NIT Formulation
                </button>
              </li>
            </ul>
          </nav>
        </aside>

        {/* Right Main Content Panel */}
        <main className="flex-1 p-margin overflow-y-auto flex flex-col gap-6">

          {/* VIEW 1: ACTIVE PROCUREMENT LEDGER */}
          {activeView === 'ledger' && (
            <div className="space-y-6">
              <div className="flex justify-between items-end">
                <div>
                  <h1 className="font-headline-lg text-headline-lg text-on-surface">Active Procurement Ledger</h1>
                  <p className="font-body-md text-body-md text-on-surface-variant mt-1">Displaying currently open tenders available for bid submission on Hyperledger Besu network.</p>
                </div>
                <div className="font-code-md text-code-md text-on-surface-variant text-right">
                  <div>SYS_TIME: <span className="font-bold text-on-surface">{new Date().toLocaleTimeString()} UTC</span></div>
                  <div>STATUS: <span className="text-emerald-700 font-bold">ACTIVE (0 GAS)</span></div>
                </div>
              </div>

              {/* Filter Bar */}
              <div className="flex flex-wrap items-center gap-4 border border-on-surface/15 bg-surface-container-lowest p-3">
                <div className="flex-1 flex items-center gap-2 border-r border-on-surface/15 px-3 min-w-[240px]">
                  <span className="material-symbols-outlined text-on-surface-variant text-[18px]">search</span>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by ID or Category..."
                    className="w-full bg-transparent border-none font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant focus:ring-0 p-0"
                  />
                </div>

                <div className="px-3 border-r border-on-surface/15 flex items-center gap-2">
                  <label className="font-label-caps text-label-caps text-on-surface-variant">PSU:</label>
                  <select 
                    value={selectedPSU} 
                    onChange={(e) => setSelectedPSU(e.target.value)}
                    className="bg-transparent border-none font-code-md text-code-md text-on-surface focus:ring-0 p-0 py-1 cursor-pointer"
                  >
                    <option value="ALL">ALL</option>
                    <option value="IOCL">IOCL</option>
                    <option value="BPCL">BPCL</option>
                    <option value="HPCL">HPCL</option>
                    <option value="ONGC">ONGC</option>
                    <option value="GAIL">GAIL</option>
                  </select>
                </div>

                <div className="px-3 flex items-center gap-2">
                  <label className="font-label-caps text-label-caps text-on-surface-variant">STATUS:</label>
                  <select 
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="bg-transparent border-none font-code-md text-code-md text-on-surface focus:ring-0 p-0 py-1 cursor-pointer"
                  >
                    <option value="ALL">ALL</option>
                    <option value="OPEN">OPEN</option>
                    <option value="CLOSING SOON">CLOSING SOON</option>
                  </select>
                </div>
              </div>

              {/* Ledger Table */}
              <div className="bg-surface-container-lowest border border-on-surface/15">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-[#1C1F26] text-white font-label-caps text-label-caps border-b border-on-surface/15">
                    <tr>
                      <th className="py-3 px-4 w-[15%]">TENDER ID</th>
                      <th className="py-3 px-4 w-[10%]">PSU</th>
                      <th className="py-3 px-4 w-[30%]">CATEGORY / DESCRIPTION</th>
                      <th className="py-3 px-4 text-right w-[15%]">EST. VALUE (₹ CR)</th>
                      <th className="py-3 px-4 w-[15%]">DEADLINE</th>
                      <th className="py-3 px-4 text-right w-[15%]">ACTION</th>
                    </tr>
                  </thead>
                  <tbody className="font-body-md text-body-md text-on-surface">
                    {tenders
                      .filter(t => (selectedPSU === 'ALL' || t.psu === selectedPSU))
                      .filter(t => (statusFilter === 'ALL' || t.status === statusFilter))
                      .filter(t => (t.id.toLowerCase().includes(searchQuery.toLowerCase()) || t.desc.toLowerCase().includes(searchQuery.toLowerCase())))
                      .map((t) => (
                        <tr key={t.id} className="border-b border-on-surface/15 hover:bg-surface-container-low transition-colors">
                          <td className="py-4 px-4 font-code-md text-code-md">{t.id}</td>
                          <td className="py-4 px-4 font-label-caps text-label-caps text-on-surface-variant font-bold">{t.psu}</td>
                          <td className="py-4 px-4">
                            <div className="font-semibold">{t.category}</div>
                            <div className="text-[12px] text-on-surface-variant mt-1 truncate max-w-[340px]">{t.desc}</div>
                          </td>
                          <td className="py-4 px-4 font-code-md text-code-md text-right font-bold">{t.valueCr}</td>
                          <td className="py-4 px-4 font-code-md text-code-md">
                            {t.status === 'CLOSING SOON' ? (
                              <span className="amber-flash font-bold flex items-center gap-1">
                                <span className="material-symbols-outlined text-[14px]">timer</span>
                                {t.deadline}
                              </span>
                            ) : (
                              <span>{t.deadline}</span>
                            )}
                          </td>
                          <td className="py-4 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button 
                                onClick={() => {
                                  setBidForm({ ...bidForm, tenderRef: t.id });
                                  setActiveView('encryptor');
                                }}
                                className="bg-primary text-white px-3 py-1 font-label-caps text-label-caps hover:bg-primary-container transition-colors"
                              >
                                BID NOW
                              </button>
                            </div>
                          </td>
                        </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* VIEW 2: NIT TENDER FORMULATION */}
          {activeView === 'formulate' && (
            <div className="max-w-[900px] mx-auto w-full space-y-6">
              <div>
                <h2 className="font-headline-lg text-headline-lg text-on-surface uppercase tracking-wider mb-4">Tender Specification Formulation</h2>
                <div className="flex items-center w-full max-w-xl">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-primary"></div>
                    <span className="font-label-caps text-label-caps text-primary">DRAFT</span>
                  </div>
                  <div className="flex-grow h-[1px] bg-on-surface/15 mx-4"></div>
                  <div className="flex items-center gap-2 opacity-50">
                    <div className="w-2 h-2 border border-on-surface"></div>
                    <span className="font-label-caps text-label-caps text-on-surface">AUTHORIZATION</span>
                  </div>
                  <div className="flex-grow h-[1px] bg-on-surface/15 mx-4"></div>
                  <div className="flex items-center gap-2 opacity-50">
                    <div className="w-2 h-2 border border-on-surface"></div>
                    <span className="font-label-caps text-label-caps text-on-surface">PUBLISHED</span>
                  </div>
                </div>
              </div>

              <div className="bg-surface-container-lowest border border-on-surface/15 shadow-sm">
                <div className="bg-inverse-surface text-inverse-on-surface px-6 py-3 border-b border-on-surface/15 flex justify-between items-center">
                  <span className="font-label-caps text-label-caps">NOTICE INVITING TENDER (NIT) FORMULATION — {selectedPSU}</span>
                  <span className="font-code-md text-code-md opacity-70">SESSION: 0x9F4A...B21</span>
                </div>

                <form onSubmit={handleFormulateSubmit} className="p-8 space-y-6">
                  <div className="grid grid-cols-12 gap-4 pb-6 border-b border-on-surface/15">
                    <div className="col-span-12 md:col-span-8 flex flex-col gap-1">
                      <label className="font-label-caps text-label-caps text-on-surface-variant">TENDER TITLE</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Procurement of Grade-A Industrial Pipelines & Actuators"
                        value={formulateForm.title}
                        onChange={(e) => setFormulateForm({ ...formulateForm, title: e.target.value })}
                        className="w-full bg-transparent border border-on-surface/15 focus:border-secondary focus:border-2 outline-none px-3 py-2 font-body-md text-body-md text-on-surface"
                      />
                    </div>
                    <div className="col-span-12 md:col-span-4 flex flex-col gap-1">
                      <label className="font-label-caps text-label-caps text-on-surface-variant text-right">SYSTEM ID (AUTO-GENERATED)</label>
                      <input
                        type="text"
                        readOnly
                        value="TND-2026-X9Q"
                        className="w-full bg-surface-container border border-on-surface/15 px-3 py-2 font-code-md text-code-md text-on-surface text-right cursor-not-allowed"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-12 gap-6 pb-6 border-b border-on-surface/15">
                    <div className="col-span-12 md:col-span-6 flex flex-col gap-4">
                      <h3 className="font-label-caps text-label-caps text-on-surface border-b border-on-surface/15 pb-2">SCHEDULE LIMITS</h3>
                      <div className="flex flex-col gap-1">
                        <label className="font-label-caps text-label-caps text-on-surface-variant">SUBMISSION DEADLINE</label>
                        <input
                          type="datetime-local"
                          value={formulateForm.submissionDeadline}
                          onChange={(e) => setFormulateForm({ ...formulateForm, submissionDeadline: e.target.value })}
                          className="w-full bg-transparent border border-on-surface/15 px-3 py-2 font-code-md text-code-md text-on-surface"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="font-label-caps text-label-caps text-on-surface-variant">OPENING DATE/TIME</label>
                        <input
                          type="datetime-local"
                          value={formulateForm.openingTime}
                          onChange={(e) => setFormulateForm({ ...formulateForm, openingTime: e.target.value })}
                          className="w-full bg-transparent border border-on-surface/15 px-3 py-2 font-code-md text-code-md text-on-surface"
                        />
                      </div>
                    </div>

                    <div className="col-span-12 md:col-span-6 flex flex-col gap-4">
                      <h3 className="font-label-caps text-label-caps text-on-surface border-b border-on-surface/15 pb-2">FINANCIAL PARAMETERS</h3>
                      <div className="flex flex-col gap-1">
                        <label className="font-label-caps text-label-caps text-on-surface-variant text-right">EMD AMOUNT (INR)</label>
                        <input
                          type="number"
                          placeholder="500000"
                          value={formulateForm.emd}
                          onChange={(e) => setFormulateForm({ ...formulateForm, emd: e.target.value })}
                          className="w-full bg-transparent border border-on-surface/15 px-3 py-2 font-code-md text-code-md text-on-surface text-right"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="font-label-caps text-label-caps text-on-surface-variant text-right">ESTIMATED BUDGET (INR)</label>
                        <input
                          type="number"
                          placeholder="45000000"
                          value={formulateForm.budget}
                          onChange={(e) => setFormulateForm({ ...formulateForm, budget: e.target.value })}
                          className="w-full bg-transparent border border-on-surface/15 px-3 py-2 font-code-md text-code-md text-on-surface text-right"
                        />
                      </div>
                    </div>
                  </div>

                  {/* IPFS Upload Box */}
                  <div className="space-y-2">
                    <label className="font-label-caps text-label-caps text-on-surface-variant">SPECIFICATION DOCUMENTS (IPFS NETWORK UPLOAD)</label>
                    <div className="border border-dashed border-on-surface/30 bg-surface flex flex-col items-center justify-center py-8 px-6 cursor-pointer hover:bg-surface-container-low transition-colors">
                      <span className="material-symbols-outlined text-on-surface-variant text-[32px] mb-2">cloud_upload</span>
                      <p className="font-body-md text-body-md text-on-surface">Specification file anchored to IPFS network</p>
                      <p className="font-code-md text-code-md text-on-surface-variant text-xs">PDF, DOCX, ZIP (MAX 50MB)</p>
                    </div>
                    <div className="border border-on-surface/15 bg-surface-container px-4 py-3 flex flex-col gap-1">
                      <div className="flex justify-between items-center text-xs font-code-md">
                        <span>FILENAME: reactor_cooling_specs_v2.pdf</span>
                        <span className="text-primary font-bold">IPFS ANCHORED (100%)</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="font-label-caps text-label-caps text-on-surface-variant">GENERATED CID:</span>
                        <span className="font-code-md text-code-md text-on-surface bg-inverse-surface text-inverse-on-surface px-2 py-0.5 select-all">{formulateForm.cid}</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-on-surface/15 flex justify-end gap-4">
                    <button type="button" onClick={() => setActiveView('ledger')} className="bg-transparent border border-on-surface text-on-surface font-label-caps text-label-caps py-2.5 px-6 hover:bg-surface-container-low transition-colors">
                      DISCARD DRAFT
                    </button>
                    <button type="submit" className="bg-primary-container text-on-primary-container font-label-caps text-label-caps py-2.5 px-6 flex items-center gap-2 hover:bg-surface-tint hover:text-on-primary transition-colors border border-on-surface/15">
                      <span className="material-symbols-outlined text-[18px]">verified_user</span>
                      INITIATE TENDER AND SIGN ON-CHAIN
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* VIEW 3: VENDOR SEALED BID ENCRYPTOR */}
          {activeView === 'encryptor' && (
            <div className="max-w-[960px] mx-auto w-full space-y-6">
              <div className="border-b border-on-surface/15 pb-4 flex justify-between items-end">
                <div>
                  <p className="font-code-md text-code-md text-on-surface-variant mb-1">TENDER REF // {bidForm.tenderRef}</p>
                  <h1 className="font-headline-lg text-headline-lg text-on-surface uppercase tracking-tight">Sealed Bid Submission</h1>
                </div>
                <div className="text-right">
                  <p className="font-label-caps text-label-caps text-on-surface-variant">SYSTEM STATUS</p>
                  <p className="font-code-md text-code-md text-primary flex items-center gap-2 justify-end">
                    <span className="w-2 h-2 bg-primary inline-block animate-pulse"></span>
                    NETWORK SYNCED (0 GAS)
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Left Form (7 cols) */}
                <div className="lg:col-span-7 bg-surface-container-lowest border border-on-surface/15 p-6 flex flex-col gap-6 shadow-sm">
                  <section className="space-y-3">
                    <h3 className="font-label-caps text-label-caps text-on-surface border-b border-on-surface/15 pb-2">01. TECHNICAL DOCUMENTS</h3>
                    <div className="border border-dashed border-on-surface/30 bg-surface p-6 flex flex-col items-center justify-center gap-2">
                      <span className="material-symbols-outlined text-3xl text-on-surface-variant">upload_file</span>
                      <p className="font-body-md text-body-md text-on-surface">Encrypted technical dossier anchored to IPFS</p>
                    </div>
                  </section>

                  <section className="space-y-4 pt-4 border-t border-on-surface/15">
                    <h3 className="font-label-caps text-label-caps text-on-surface border-b border-on-surface/15 pb-2">02. FINANCIAL COMMITMENT</h3>
                    
                    <div className="flex flex-col gap-1">
                      <label className="font-label-caps text-label-caps text-on-surface-variant">BID AMOUNT (INR)</label>
                      <input
                        type="number"
                        placeholder="e.g. 45200000"
                        value={bidForm.amount}
                        onChange={(e) => setBidForm({ ...bidForm, amount: e.target.value })}
                        className="w-full bg-surface border border-on-surface/15 px-3 py-3 font-code-md text-code-md text-right text-lg text-on-surface focus:outline-none focus:border-secondary"
                      />
                    </div>

                    <div className="flex gap-3 items-end">
                      <div className="flex flex-col gap-1 flex-1">
                        <label className="font-label-caps text-label-caps text-on-surface-variant">CRYPTOGRAPHIC SALT</label>
                        <input
                          type="text"
                          placeholder="Enter or generate secret salt"
                          value={bidForm.salt}
                          onChange={(e) => setBidForm({ ...bidForm, salt: e.target.value })}
                          className="w-full bg-surface border border-on-surface/15 px-3 py-3 font-code-md text-code-md text-on-surface"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleGenerateSalt}
                        className="h-[48px] px-4 border border-on-surface/15 bg-surface hover:bg-surface-container-high font-label-caps text-label-caps"
                      >
                        GENERATE
                      </button>
                    </div>
                  </section>
                </div>

                {/* Right Commitment Hash Display (5 cols) */}
                <div className="lg:col-span-5 flex flex-col gap-4">
                  <div className="bg-surface-container-lowest border border-on-surface/15 flex flex-col">
                    <div className="bg-inverse-surface text-on-tertiary px-4 py-3 flex justify-between items-center">
                      <h3 className="font-label-caps text-label-caps tracking-widest flex items-center gap-2">
                        <span className="material-symbols-outlined text-[16px]">lock_person</span>
                        COMMITMENT HASH
                      </h3>
                      <span className="font-code-md text-code-md text-[10px] opacity-70">KECCAK-256</span>
                    </div>
                    <div className="p-5 space-y-4 bg-surface">
                      <p className="font-body-md text-body-md text-on-surface-variant italic text-xs">
                        "This hash is what goes on-chain; your actual amount stays sealed until the designated reveal phase."
                      </p>

                      <div className="min-h-[100px] bg-[#1C1F26] p-4 border border-on-surface/15 break-all font-code-md text-code-md text-on-primary">
                        {commitmentHash || 'AWAITING_INPUT_PARAMS...'}
                      </div>
                    </div>
                  </div>

                  <div className="bg-surface-container border border-on-surface-variant/30 p-4 text-xs space-y-1">
                    <p className="font-label-caps text-label-caps text-on-surface font-bold">MANDATORY REGULATORY REQUIREMENT</p>
                    <p className="text-on-surface-variant">In accordance with GOI CVC guidelines, vendors must retain the secret salt generated. Failure to produce the salt during the public reveal phase will result in bid disqualification.</p>
                  </div>

                  <button
                    onClick={handleBidSubmit}
                    disabled={!commitmentHash}
                    className="w-full bg-primary text-on-primary font-label-caps text-label-caps py-4 px-6 hover:bg-primary-container disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                  >
                    SUBMIT SEALED BID ON-CHAIN
                    <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* VIEW 4: EVALUATION & AWARD */}
          {activeView === 'award' && (
            <div className="max-w-6xl mx-auto w-full space-y-8">
              <div className="flex justify-between items-end border-b border-on-surface/15 pb-4">
                <div>
                  <div className="font-label-caps text-label-caps text-on-surface-variant mb-1">TENDER ID: TX-8829-AQ ({selectedPSU})</div>
                  <h1 className="font-headline-lg text-headline-lg text-on-surface">Evaluation & Award</h1>
                </div>
                <div className="text-right">
                  <div className="font-label-caps text-label-caps text-on-surface-variant mb-1">CURRENT STATUS</div>
                  <div className="font-code-md text-code-md text-primary font-bold">REVEALED / EVALUATING</div>
                </div>
              </div>

              {/* Chain of Custody Timeline */}
              <div className="bg-surface-container-lowest border border-on-surface/15 p-6">
                <div className="font-label-caps text-label-caps text-on-surface-variant mb-4">CHAIN OF CUSTODY TIMELINE</div>
                <div className="flex items-center w-full">
                  <div className="flex flex-col items-center relative w-1/4">
                    <div className="w-2 h-2 bg-on-surface mb-2 z-10"></div>
                    <div className="font-label-caps text-label-caps text-on-surface text-center">INITIATED</div>
                    <div className="font-code-md text-[10px] text-on-surface-variant mt-1">2026-10-24 09:00Z</div>
                  </div>
                  <div className="flex flex-col items-center relative w-1/4">
                    <div className="w-2 h-2 bg-on-surface mb-2 z-10"></div>
                    <div className="font-label-caps text-label-caps text-on-surface text-center">BIDDING CLOSED</div>
                    <div className="font-code-md text-[10px] text-on-surface-variant mt-1">2026-11-15 17:00Z</div>
                  </div>
                  <div className="flex flex-col items-center relative w-1/4">
                    <div className="w-2 h-2 bg-on-surface mb-2 z-10"></div>
                    <div className="font-label-caps text-label-caps text-on-surface text-center">BIDS REVEALED</div>
                    <div className="font-code-md text-[10px] text-on-surface-variant mt-1">2026-11-16 10:00Z</div>
                  </div>
                  <div className="flex flex-col items-center relative w-1/4">
                    <div className="w-3 h-3 border-2 border-primary bg-white mb-1.5 z-10 flex items-center justify-center">
                      <div className="w-1 h-1 bg-primary"></div>
                    </div>
                    <div className="font-label-caps text-label-caps text-primary font-bold text-center">EVALUATION PHASE</div>
                    <div className="font-code-md text-[10px] text-primary mt-1">ACTIVE (7-DAY APPEAL)</div>
                  </div>
                </div>
              </div>

              {/* Revealed Bids Grid */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h2 className="font-headline-sm text-headline-sm text-on-surface">Revealed Bids Grid</h2>
                  <span className="font-label-caps text-label-caps text-on-surface-variant">SORTED BY: L1 (LOWEST BID)</span>
                </div>

                <div className="bg-surface-container-lowest border border-on-surface/15 overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-on-surface text-white font-label-caps text-label-caps">
                        <th className="p-3 w-12 text-center border-r border-white/20">RANK</th>
                        <th className="p-3 border-r border-white/20">VENDOR IDENTITY</th>
                        <th className="p-3 w-44 text-center border-r border-white/20">TECH QUALIFICATION</th>
                        <th className="p-3 border-r border-white/20 w-64">COMMITMENT HASH</th>
                        <th className="p-3 text-right w-44">BID AMOUNT (INR)</th>
                      </tr>
                    </thead>
                    <tbody className="font-body-md text-body-md text-on-surface">
                      {revealedBids.map((b, idx) => (
                        <tr key={idx} className="border-b border-on-surface/15 hover:bg-surface-container-low">
                          <td className="p-3 font-code-md text-center font-bold bg-surface-container border-r border-on-surface/15">{b.rank}</td>
                          <td className="p-3 border-r border-on-surface/15">
                            <div className="font-semibold">{b.vendor}</div>
                            <div className="font-code-md text-[11px] text-on-surface-variant mt-0.5">VID: {b.vid}</div>
                          </td>
                          <td className="p-3 border-r border-on-surface/15 text-center">
                            <button 
                              onClick={() => toggleQualify(idx)}
                              className={`px-3 py-1 text-xs font-label-caps border border-on-surface/15 flex items-center justify-center gap-1 mx-auto ${b.qualified ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-surface-container text-on-surface-variant'}`}
                            >
                              <span className={`w-2 h-2 rounded-full ${b.qualified ? 'bg-emerald-600' : 'bg-amber-500'}`}></span>
                              {b.qualified ? 'QUALIFIED' : 'PENDING'}
                            </button>
                          </td>
                          <td className="p-3 font-code-md text-[11px] text-on-surface-variant border-r border-on-surface/15 break-all">{b.hash}</td>
                          <td className="p-3 font-code-md text-right font-bold">{b.amount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Award Action Area */}
              <div className="bg-surface-container-lowest border border-on-surface/15 p-8 flex flex-col items-center justify-center text-center">
                <span className="material-symbols-outlined text-4xl text-on-surface-variant mb-2">gavel</span>
                <h3 className="font-headline-sm text-headline-sm font-bold mb-1">Finalize Tender Award</h3>
                <p className="font-body-md text-xs text-on-surface-variant max-w-md mb-6">
                  Select a vendor from the grid above, ensure technical qualification is complete, and proceed with official award execution.
                </p>

                <button 
                  onClick={() => {
                    addLog(`Tender TX-8829-AQ Awarded to L1 Winner on Blockchain!`, 'success');
                    alert('Tender Awarded to L1 Winner! 7-Day Dispute Appeal Window Opened.');
                  }}
                  disabled={!revealedBids[0].qualified}
                  className="bg-[#44617b] hover:bg-[#2c4962] disabled:opacity-50 disabled:cursor-not-allowed text-white font-label-caps text-label-caps px-8 py-3.5 flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-sm">lock</span>
                  AWARD TENDER TO L1
                </button>

                {!revealedBids[0].qualified && (
                  <div className="font-code-md text-[11px] text-error mt-3">
                    System Notice: Technical qualification pending for L1. Click "PENDING" above to verify.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* LIVE SYSTEM & BLOCKCHAIN EVENT LOGS CONSOLE */}
          <div className="mt-6 bg-[#040711] border border-on-surface/15 p-4 font-code-md text-xs text-on-primary rounded-none">
            <div className="flex justify-between items-center pb-2 mb-3 border-b border-white/10">
              <div className="flex items-center gap-2 font-bold text-cyan-400">
                <span className="material-symbols-outlined text-[16px]">terminal</span>
                LIVE BLOCKCHAIN & SYSTEM EVENT LOGS
              </div>
              <div className="text-[11px] text-on-surface-variant flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Besu RPC (http://127.0.0.1:8545)
              </div>
            </div>

            <div className="space-y-1.5 max-h-36 overflow-y-auto">
              {logs.map((l, i) => (
                <div key={i} className="flex gap-3 text-[11px]">
                  <span className="text-slate-500 font-mono">[{l.time}]</span>
                  <span className={l.type === 'success' ? 'text-emerald-400 font-semibold' : l.type === 'primary' ? 'text-cyan-400 font-semibold' : 'text-slate-300'}>
                    {l.msg}
                  </span>
                </div>
              ))}
            </div>
          </div>

        </main>
      </div>

      {/* Footer */}
      <footer className="bg-background border-t border-on-surface/15 px-6 py-4 w-full mt-auto text-xs text-on-surface-variant">
        <div className="max-w-container-max mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex gap-6 font-code-md text-code-md">
            <a className="hover:underline" href="#">Security Policy</a>
            <a className="hover:underline" href="#">Technical Specs</a>
            <a className="hover:underline" href="#">CVC Grievance</a>
            <a className="hover:underline" href="#">Support</a>
          </div>
          <div className="text-right">
            <p className="font-bold text-on-surface mb-0.5">MINISTRY OF PETROLEUM AND NATURAL GAS</p>
            <p className="font-label-caps text-label-caps">© 2026 GOVERNMENT OF INDIA. ALL RIGHTS RESERVED. NATIONAL INFORMATICS CENTRE (NIC).</p>
          </div>
        </div>
      </footer>
    </>
  );
}
