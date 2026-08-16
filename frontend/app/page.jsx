'use client';

import React, { useState, useEffect } from 'react';

export default function Home() {
  const [currentScreen, setCurrentScreen] = useState('ledger'); // 'ledger' | 'formulation' | 'award' | 'bidding'
  
  // Real-time clock for UI realism
  const [sysTime, setSysTime] = useState('');
  useEffect(() => {
    const timer = setInterval(() => {
      setSysTime(new Date().toISOString().substr(11, 8) + ' UTC');
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Form states for Tender Formulation
  const [tenderForm, setTenderForm] = useState({
    title: '',
    techDesc: '',
    deadline: '',
    opening: '',
    emd: '',
    budget: '',
    cid: 'QmYwAPJzv5CZsnA625s3Xf2sm5DyaRtPu8...'
  });

  // Form states for Sealed Bid Submission
  const [bidForm, setBidForm] = useState({
    amount: '',
    salt: ''
  });
  const [generatedHash, setGeneratedHash] = useState('AWAITING_INPUT_PARAMS...');

  // Simple Hash calculation simulator
  useEffect(() => {
    if (bidForm.amount || bidForm.salt) {
      let str = bidForm.amount + bidForm.salt;
      let hashVal = 0;
      for (let i = 0; i < str.length; i++) {
        hashVal = (hashVal << 5) - hashVal + str.charCodeAt(i);
        hashVal |= 0;
      }
      const hex = Math.abs(hashVal).toString(16).padStart(8, '0');
      let full = '0x8f2a' + hex + '9b4e1c2d3f4a5b6c7d8e9f0a1b2c3d4e';
      setGeneratedHash(full.substring(0, 66));
    } else {
      setGeneratedHash('AWAITING_INPUT_PARAMS...');
    }
  }, [bidForm.amount, bidForm.salt]);

  const handleGenerateSalt = () => {
    const salt = Array.from({ length: 16 }, () => Math.random().toString(36)[2]).join('').toUpperCase();
    setBidForm({ ...bidForm, salt });
  };

  // Evaluation & Award Grid State
  const [bids, setBids] = useState([
    { rank: 'L1', vendor: 'Reliance Industries Ltd.', vid: 'RIL-4492-X', qualified: false, hash: '0x8f2a...9b4e1c2d3f4a5b6c7d8e9f0a1b2c3d4e', amount: '₹ 45,20,00,000' },
    { rank: 'L2', vendor: 'Larsen & Toubro', vid: 'LT-8821-Y', qualified: true, hash: '0x3c1b...4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a', amount: '₹ 46,85,50,000' },
    { rank: 'L3', vendor: 'Tata Projects', vid: 'TP-1102-Z', qualified: false, hash: '0x7d9f...1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d', amount: '₹ 48,00,00,000' }
  ]);

  const toggleQualify = (idx) => {
    const updated = [...bids];
    updated[idx].qualified = !updated[idx].qualified;
    setBids(updated);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-on-surface font-body-md antialiased">
      
      {/* Global Screen Selector Switcher Bar */}
      <div className="bg-[#1C1F26] text-white px-6 py-2 flex flex-wrap justify-between items-center text-xs font-code-md border-b border-on-surface/20">
        <div className="flex items-center gap-3">
          <span className="text-amber-400 font-bold">STITCH UI PROTOTYPE NAVIGATION:</span>
          <button 
            onClick={() => setCurrentScreen('ledger')} 
            className={`px-3 py-1 border border-white/20 transition-colors ${currentScreen === 'ledger' ? 'bg-primary text-white font-bold' : 'bg-surface-container-lowest text-on-surface hover:bg-white/10'}`}
          >
            1. Active Procurement Ledger
          </button>
          <button 
            onClick={() => setCurrentScreen('formulation')} 
            className={`px-3 py-1 border border-white/20 transition-colors ${currentScreen === 'formulation' ? 'bg-primary text-white font-bold' : 'bg-surface-container-lowest text-on-surface hover:bg-white/10'}`}
          >
            2. PSU - NIT Formulation
          </button>
          <button 
            onClick={() => setCurrentScreen('bidding')} 
            className={`px-3 py-1 border border-white/20 transition-colors ${currentScreen === 'bidding' ? 'bg-primary text-white font-bold' : 'bg-surface-container-lowest text-on-surface hover:bg-white/10'}`}
          >
            3. Vendor - Bid Submission
          </button>
          <button 
            onClick={() => setCurrentScreen('award')} 
            className={`px-3 py-1 border border-white/20 transition-colors ${currentScreen === 'award' ? 'bg-primary text-white font-bold' : 'bg-surface-container-lowest text-on-surface hover:bg-white/10'}`}
          >
            4. PSU - Evaluation & Award
          </button>
        </div>
        <div className="text-slate-400">
          SYS_TIME: <span className="text-white font-bold">{sysTime || '14:32:01 UTC'}</span>
        </div>
      </div>

      {/* SCREEN 1: VENDOR - ACTIVE PROCUREMENT LEDGER */}
      {currentScreen === 'ledger' && (
        <div className="flex flex-col min-h-screen">
          {/* National Identity Bar & Accessibility */}
          <div className="bg-national-identity-bar border-b border-border-hairline py-1 px-4 flex justify-between items-center text-xs text-on-surface z-30 relative">
            <div className="flex items-center gap-2">
              <span className="font-bold uppercase">Government of India</span>
              <span className="text-on-surface-variant">| Ministry of Petroleum and Natural Gas</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex gap-2">
                <button className="px-2 py-1 bg-surface-container hover:bg-surface-container-high transition-colors text-[10px] font-bold">A-</button>
                <button className="px-2 py-1 bg-surface-container hover:bg-surface-container-high transition-colors text-[10px] font-bold">A</button>
                <button className="px-2 py-1 bg-surface-container hover:bg-surface-container-high transition-colors text-[10px] font-bold">A+</button>
              </div>
              <select className="text-xs bg-transparent border-none py-0 pl-2 pr-6 ml-2 border-l border-border-hairline focus:ring-0 cursor-pointer">
                <option>English</option>
                <option>हिन्दी</option>
              </select>
            </div>
          </div>

          <div className="flex flex-1 relative">
            {/* SideNavBar */}
            <nav className="bg-surface-container-lowest text-primary font-label-caps text-label-caps w-64 border-r border-on-surface/15 flex flex-col z-20 shrink-0">
              <div className="p-6 border-b border-on-surface/15">
                <div className="flex items-center gap-3 mb-4">
                  <span className="material-symbols-outlined text-[32px] text-primary">account_circle</span>
                  <div>
                    <h2 className="font-headline-sm text-headline-sm font-bold text-primary m-0">PSU AUTHORIZED</h2>
                    <p className="text-on-surface-variant font-code-md text-[10px] mt-1">Officer ID: 88-X92</p>
                  </div>
                </div>
                <button onClick={() => setCurrentScreen('formulation')} className="w-full bg-primary text-on-primary border border-on-surface/15 py-2 px-4 flex items-center justify-center gap-2 hover:bg-primary-container transition-colors rounded-none">
                  <span className="material-symbols-outlined text-[16px]">add</span>
                  INITIATE TENDER
                </button>
              </div>

              <ul className="flex-grow py-4 overflow-y-auto">
                <li>
                  <button onClick={() => setCurrentScreen('ledger')} className="w-full bg-secondary-container text-on-secondary-container font-bold border-r-4 border-primary px-4 py-3 flex items-center gap-3 text-left">
                    <span className="material-symbols-outlined">account_balance_wallet</span>
                    Ledger
                  </button>
                </li>
                <li>
                  <button onClick={() => setCurrentScreen('award')} className="w-full text-on-surface-variant px-4 py-3 flex items-center gap-3 hover:bg-surface-container-high transition-colors text-left">
                    <span className="material-symbols-outlined">account_tree</span>
                    Custody Trail
                  </button>
                </li>
                <li>
                  <button onClick={() => setCurrentScreen('bidding')} className="w-full text-on-surface-variant px-4 py-3 flex items-center gap-3 hover:bg-surface-container-high transition-colors text-left">
                    <span className="material-symbols-outlined">lock</span>
                    Bid Encryptor
                  </button>
                </li>
                <li>
                  <button onClick={() => setCurrentScreen('formulation')} className="w-full text-on-surface-variant px-4 py-3 flex items-center gap-3 hover:bg-surface-container-high transition-colors text-left">
                    <span className="material-symbols-outlined">receipt_long</span>
                    Audit Log
                  </button>
                </li>
              </ul>
            </nav>

            {/* Main Canvas */}
            <main className="flex-1 flex flex-col min-h-screen">
              <header className="bg-surface-container-lowest border-b border-on-surface/15 p-margin sticky top-0 z-10 p-6">
                <div className="max-w-container-max mx-auto w-full">
                  <div className="flex justify-between items-end mb-6">
                    <div>
                      <h1 className="font-headline-lg text-headline-lg text-on-surface m-0">Active Procurement Ledger</h1>
                      <p className="font-body-md text-body-md text-on-surface-variant mt-2">Displaying currently open tenders available for bid submission.</p>
                    </div>
                    <div className="font-code-md text-code-md text-on-surface-variant text-right">
                      <div>SYS_TIME: <span className="font-bold text-on-surface">{sysTime || '14:32:01 UTC'}</span></div>
                      <div>STATUS: <span className="text-[#3D5A73] font-bold">ACTIVE</span></div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 border border-on-surface/15 bg-background p-2 w-full">
                    <div className="flex-1 flex items-center gap-2 border-r border-on-surface/15 px-3">
                      <span className="material-symbols-outlined text-on-surface-variant text-[18px]">search</span>
                      <input className="w-full bg-transparent border-none font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant focus:ring-0 p-0" placeholder="Search by ID or Category..." type="text"/>
                    </div>
                    <div className="px-3 border-r border-on-surface/15 flex items-center gap-2">
                      <label className="font-label-caps text-label-caps text-on-surface-variant whitespace-nowrap">PSU:</label>
                      <select className="bg-transparent border-none font-code-md text-code-md text-on-surface focus:ring-0 p-0 py-1 cursor-pointer">
                        <option>ALL</option>
                        <option>IOCL</option>
                        <option>ONGC</option>
                        <option>BPCL</option>
                      </select>
                    </div>
                    <div className="px-3 border-r border-on-surface/15 flex items-center gap-2">
                      <label className="font-label-caps text-label-caps text-on-surface-variant whitespace-nowrap">CATEGORY:</label>
                      <select className="bg-transparent border-none font-code-md text-code-md text-on-surface focus:ring-0 p-0 py-1 cursor-pointer">
                        <option>ALL</option>
                        <option>Heavy Machinery</option>
                        <option>Pipeline Infrastructure</option>
                        <option>Consulting</option>
                      </select>
                    </div>
                  </div>
                </div>
              </header>

              <div className="flex-1 p-margin p-6">
                <div className="max-w-container-max mx-auto w-full bg-surface-container-lowest border border-on-surface/15">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-[#1C1F26] text-white font-label-caps text-label-caps border-b border-on-surface/15">
                      <tr>
                        <th className="py-3 px-4 font-normal tracking-wider w-[15%]">TENDER ID</th>
                        <th className="py-3 px-4 font-normal tracking-wider w-[10%]">PSU</th>
                        <th className="py-3 px-4 font-normal tracking-wider w-[25%]">CATEGORY / DESCRIPTION</th>
                        <th className="py-3 px-4 font-normal tracking-wider text-right w-[15%]">EST. VALUE (₹ CR)</th>
                        <th className="py-3 px-4 font-normal tracking-wider w-[15%]">DEADLINE</th>
                        <th className="py-3 px-4 font-normal tracking-wider text-right w-[20%]">ACTION</th>
                      </tr>
                    </thead>
                    <tbody className="font-body-md text-body-md text-on-surface">
                      <tr className="border-b border-on-surface/15 hover:bg-surface-container-low transition-colors">
                        <td className="py-4 px-4 font-code-md text-code-md">TND-24-9982-A</td>
                        <td className="py-4 px-4 font-label-caps text-label-caps text-on-surface-variant">IOCL</td>
                        <td className="py-4 px-4">
                          <div className="font-semibold">Pipeline Infrastructure</div>
                          <div className="text-[12px] text-on-surface-variant mt-1 truncate max-w-[300px]">Expansion of Section 4B routing network.</div>
                        </td>
                        <td className="py-4 px-4 font-code-md text-code-md text-right">45.50</td>
                        <td className="py-4 px-4 font-code-md text-code-md">2026-11-15 18:00</td>
                        <td className="py-4 px-4 text-right">
                          <button onClick={() => setCurrentScreen('bidding')} className="border border-on-surface/15 px-3 py-1 font-label-caps text-label-caps hover:bg-[#1C1F26] hover:text-white transition-colors rounded-none bg-surface-container-lowest">VIEW</button>
                        </td>
                      </tr>
                      <tr className="border-b border-on-surface/15 hover:bg-surface-container-low transition-colors">
                        <td className="py-4 px-4 font-code-md text-code-md">TND-24-9983-B</td>
                        <td className="py-4 px-4 font-label-caps text-label-caps text-on-surface-variant">ONGC</td>
                        <td className="py-4 px-4">
                          <div className="font-semibold">Heavy Machinery</div>
                          <div className="text-[12px] text-on-surface-variant mt-1 truncate max-w-[300px]">Procurement of 15 industrial drilling rigs.</div>
                        </td>
                        <td className="py-4 px-4 font-code-md text-code-md text-right">120.00</td>
                        <td className="py-4 px-4 font-code-md text-code-md">
                          <span className="amber-flash font-bold flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px]">timer</span>
                            12:45:10
                          </span>
                        </td>
                        <td className="py-4 px-4 text-right">
                          <button onClick={() => setCurrentScreen('bidding')} className="bg-primary text-white px-3 py-1 font-label-caps text-label-caps hover:bg-primary-container transition-colors rounded-none">BID NOW</button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </main>
          </div>
        </div>
      )}

      {/* SCREEN 2: PSU - TENDER SPECIFICATION FORMULATION */}
      {currentScreen === 'formulation' && (
        <div className="flex flex-col min-h-screen">
          <div className="bg-national-identity-bar border-b border-on-surface/10 px-6 py-1.5 flex justify-between items-center text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">
            <div className="flex items-center gap-4">
              <span>GOVERNMENT OF INDIA</span>
              <span>MINISTRY OF PETROLEUM AND NATURAL GAS</span>
            </div>
            <div>
              <a className="hover:text-primary transition-colors" href="#">Skip to Main Content</a>
            </div>
          </div>

          <div className="flex flex-grow p-6">
            <main className="flex-grow max-w-[1024px] mx-auto">
              <div className="mb-8">
                <h2 className="font-headline-lg text-headline-lg text-on-surface mb-6 uppercase tracking-wider">Tender Specification Formulation</h2>
                <div className="flex items-center w-full max-w-2xl">
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

              <div className="bg-surface-container-lowest border border-on-surface/15 shadow-sm rounded-none">
                <div className="bg-inverse-surface text-inverse-on-surface px-6 py-3 border-b border-on-surface/15 flex justify-between items-center rounded-none">
                  <span className="font-label-caps text-label-caps">NOTICE INVITING TENDER (NIT) FORMULATION</span>
                  <span className="font-code-md text-code-md opacity-70">SESSION: 0x9F4A...B21</span>
                </div>

                <div className="p-8">
                  <div className="grid grid-cols-12 gap-6 mb-8 pb-8 border-b border-on-surface/15">
                    <div className="col-span-12 md:col-span-8 flex flex-col gap-1">
                      <label className="font-label-caps text-label-caps text-on-surface-variant">TENDER TITLE</label>
                      <input 
                        className="w-full bg-transparent border border-on-surface/15 focus:border-secondary focus:border-2 outline-none px-3 py-2 font-body-md text-body-md text-on-surface rounded-none" 
                        placeholder="e.g., Procurement of Grade-A Industrial Pipelines" 
                        type="text"
                        value={tenderForm.title}
                        onChange={(e) => setTenderForm({ ...tenderForm, title: e.target.value })}
                      />
                    </div>
                    <div className="col-span-12 md:col-span-4 flex flex-col gap-1">
                      <label className="font-label-caps text-label-caps text-on-surface-variant text-right">SYSTEM ID (AUTO-GENERATED)</label>
                      <input className="w-full bg-surface-container border border-on-surface/15 px-3 py-2 font-code-md text-code-md text-on-surface text-right rounded-none cursor-not-allowed" readOnly type="text" value="TND-2026-X9Q"/>
                    </div>
                    <div className="col-span-12 mt-4 flex flex-col gap-1">
                      <label className="font-label-caps text-label-caps text-on-surface-variant">TECHNICAL DESCRIPTION</label>
                      <textarea 
                        className="w-full bg-transparent border border-on-surface/15 focus:border-secondary focus:border-2 outline-none px-3 py-2 font-body-md text-body-md text-on-surface rounded-none resize-y" 
                        placeholder="Enter detailed specifications..." 
                        rows={4}
                        value={tenderForm.techDesc}
                        onChange={(e) => setTenderForm({ ...tenderForm, techDesc: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-12 gap-6 mb-8 pb-8 border-b border-on-surface/15">
                    <div className="col-span-12 md:col-span-6 flex flex-col gap-4">
                      <h3 className="font-label-caps text-label-caps text-on-surface pb-2 border-b border-on-surface/15">SCHEDULE LIMITS</h3>
                      <div className="flex flex-col gap-1">
                        <label className="font-label-caps text-label-caps text-on-surface-variant">SUBMISSION DEADLINE</label>
                        <input className="w-full bg-transparent border border-on-surface/15 px-3 py-2 font-code-md text-code-md text-on-surface rounded-none" type="datetime-local"/>
                      </div>
                    </div>
                    <div className="col-span-12 md:col-span-6 flex flex-col gap-4">
                      <h3 className="font-label-caps text-label-caps text-on-surface pb-2 border-b border-on-surface/15">FINANCIAL PARAMETERS</h3>
                      <div className="flex flex-col gap-1">
                        <label className="font-label-caps text-label-caps text-on-surface-variant text-right">EMD AMOUNT (INR)</label>
                        <input className="w-full bg-transparent border border-on-surface/15 px-3 py-2 font-code-md text-code-md text-on-surface text-right rounded-none" placeholder="500000.00" type="text"/>
                      </div>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-on-surface/15 flex justify-end gap-4">
                    <button onClick={() => setCurrentScreen('ledger')} className="bg-transparent border border-on-surface text-on-surface font-label-caps text-label-caps py-2 px-6 rounded-none">
                      DISCARD DRAFT
                    </button>
                    <button onClick={() => { alert('Tender Initiated & Signed On-Chain!'); setCurrentScreen('ledger'); }} className="bg-primary-container text-on-primary-container font-label-caps text-label-caps py-2 px-6 flex items-center gap-2 hover:bg-surface-tint hover:text-on-primary transition-colors border border-on-surface/15 rounded-none">
                      <span className="material-symbols-outlined text-[18px]">verified_user</span>
                      INITIATE TENDER AND SIGN ON-CHAIN
                    </button>
                  </div>
                </div>
              </div>
            </main>
          </div>
        </div>
      )}

      {/* SCREEN 3: VENDOR - SEALED BID SUBMISSION */}
      {currentScreen === 'bidding' && (
        <div className="flex flex-col min-h-screen">
          <header className="flex justify-between items-center w-full px-6 py-4 bg-background border-b border-on-surface/15 h-16">
            <div className="font-headline-md text-headline-md font-bold text-primary">
              IOCL | SECURE TENDER SYSTEM
            </div>
            <button onClick={() => setCurrentScreen('award')} className="font-label-caps text-label-caps text-primary border border-primary px-3 py-1.5">
              PSU EVALUATION CONSOLE
            </button>
          </header>

          <main className="flex-1 p-8 bg-surface-container-low">
            <div className="max-w-container-max mx-auto flex flex-col gap-6">
              <div className="border-b border-on-surface/15 pb-4 flex justify-between items-end">
                <div>
                  <p className="font-code-md text-code-md text-on-surface-variant mb-1">TENDER REF // IOCL-2026-NT-089</p>
                  <h1 className="font-headline-lg text-headline-lg text-on-surface uppercase">Sealed Bid Submission</h1>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <div className="lg:col-span-7 bg-surface-container-lowest border border-on-surface/15 p-6 flex flex-col gap-6">
                  <section className="flex flex-col gap-4">
                    <h3 className="font-label-caps text-label-caps text-on-surface border-b border-on-surface/15 pb-2">01. TECHNICAL DOCUMENTS</h3>
                    <div className="border border-dashed border-on-surface-variant/40 bg-surface p-6 flex flex-col items-center justify-center gap-3">
                      <span className="material-symbols-outlined text-4xl text-on-surface-variant">upload_file</span>
                      <p className="font-body-md text-body-md text-on-surface">Drag & drop encrypted dossier here, or browse.</p>
                    </div>
                  </section>

                  <section className="flex flex-col gap-4 pt-4 border-t border-on-surface/15">
                    <h3 className="font-label-caps text-label-caps text-on-surface border-b border-on-surface/15 pb-2">02. FINANCIAL COMMITMENT</h3>
                    <div className="flex flex-col gap-1">
                      <label className="font-label-caps text-label-caps text-on-surface-variant">BID AMOUNT (INR)</label>
                      <input 
                        className="w-full bg-surface border border-on-surface/15 py-3 px-3 font-code-md text-code-md text-right text-lg text-on-surface rounded-none" 
                        placeholder="0.00" 
                        type="number"
                        value={bidForm.amount}
                        onChange={(e) => setBidForm({ ...bidForm, amount: e.target.value })}
                      />
                    </div>
                    <div className="flex gap-4 items-end">
                      <div className="flex flex-col gap-1 flex-1">
                        <label className="font-label-caps text-label-caps text-on-surface-variant">CRYPTOGRAPHIC SALT</label>
                        <input 
                          className="w-full bg-surface border border-on-surface/15 py-3 px-3 font-code-md text-code-md text-on-surface rounded-none" 
                          placeholder="Enter or generate random string" 
                          type="text"
                          value={bidForm.salt}
                          onChange={(e) => setBidForm({ ...bidForm, salt: e.target.value })}
                        />
                      </div>
                      <button onClick={handleGenerateSalt} className="h-[50px] px-4 border border-on-surface/15 bg-surface hover:bg-surface-container-high transition-colors flex items-center justify-center font-label-caps text-label-caps">
                        GENERATE
                      </button>
                    </div>
                  </section>
                </div>

                <div className="lg:col-span-5 flex flex-col gap-6">
                  <div className="bg-surface-container-lowest border border-on-surface/15 flex flex-col">
                    <div className="bg-inverse-surface text-on-tertiary px-4 py-3 flex justify-between items-center">
                      <h3 className="font-label-caps text-label-caps tracking-widest flex items-center gap-2">
                        <span className="material-symbols-outlined text-[16px]">lock_person</span>
                        COMMITMENT HASH
                      </h3>
                      <span className="font-code-md text-code-md text-[10px] opacity-70">SHA-256</span>
                    </div>
                    <div className="p-6 flex flex-col gap-4 bg-surface">
                      <p className="font-body-md text-body-md text-on-surface-variant italic text-xs">
                        "This hash is what goes on-chain; your actual amount stays sealed until the designated reveal phase."
                      </p>
                      <div className="min-h-[100px] bg-[#1C1F26] p-4 border border-on-surface/15 break-all font-code-md text-code-md text-white">
                        {generatedHash}
                      </div>
                    </div>
                  </div>

                  <button 
                    onClick={() => { alert('Bid Committed On-Chain!'); setCurrentScreen('award'); }}
                    className="w-full bg-primary text-on-primary font-label-caps text-label-caps py-4 px-6 hover:bg-primary/90 transition-colors border border-transparent flex items-center justify-center gap-2 rounded-none"
                  >
                    SUBMIT BID ON-CHAIN
                    <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                  </button>
                </div>
              </div>
            </div>
          </main>
        </div>
      )}

      {/* SCREEN 4: PSU - EVALUATION & AWARD */}
      {currentScreen === 'award' && (
        <div className="flex flex-col min-h-screen p-8">
          <div className="max-w-6xl mx-auto space-y-8 w-full">
            <div className="flex justify-between items-end mb-6">
              <div>
                <div className="font-label-caps text-label-caps text-on-surface-variant mb-2">TENDER ID: TX-8829-AQ</div>
                <h1 className="font-headline-lg text-headline-lg text-on-surface">Evaluation & Award</h1>
              </div>
              <div className="text-right">
                <div className="font-label-caps text-label-caps text-on-surface-variant mb-1">CURRENT STATUS</div>
                <div className="font-code-md text-code-md text-primary font-bold">REVEALED / EVALUATING</div>
              </div>
            </div>

            <div className="bg-white border border-on-surface/15 p-6">
              <div className="font-label-caps text-label-caps text-on-surface-variant mb-4">CHAIN OF CUSTODY TIMELINE</div>
              <div className="flex items-center w-full">
                <div className="flex flex-col items-center w-1/4">
                  <div className="w-2 h-2 bg-on-surface mb-2"></div>
                  <div className="font-label-caps text-label-caps text-on-surface">INITIATED</div>
                </div>
                <div className="flex flex-col items-center w-1/4">
                  <div className="w-2 h-2 bg-on-surface mb-2"></div>
                  <div className="font-label-caps text-label-caps text-on-surface">BIDDING CLOSED</div>
                </div>
                <div className="flex flex-col items-center w-1/4">
                  <div className="w-2 h-2 bg-on-surface mb-2"></div>
                  <div className="font-label-caps text-label-caps text-on-surface">BIDS REVEALED</div>
                </div>
                <div className="flex flex-col items-center w-1/4">
                  <div className="w-3 h-3 border-2 border-primary bg-white mb-1.5 flex items-center justify-center">
                    <div className="w-1 h-1 bg-primary"></div>
                  </div>
                  <div className="font-label-caps text-label-caps text-primary font-bold">EVALUATION PHASE</div>
                </div>
              </div>
            </div>

            <div className="bg-white border border-on-surface/15 overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-on-surface text-white">
                    <th className="p-3 font-label-caps text-label-caps text-center w-12">RANK</th>
                    <th className="p-3 font-label-caps text-label-caps">VENDOR IDENTITY</th>
                    <th className="p-3 font-label-caps text-label-caps text-center w-40">TECH QUALIFICATION</th>
                    <th className="p-3 font-label-caps text-label-caps w-64">COMMITMENT HASH</th>
                    <th className="p-3 font-label-caps text-label-caps text-right w-40">BID AMOUNT (INR)</th>
                  </tr>
                </thead>
                <tbody>
                  {bids.map((b, idx) => (
                    <tr key={idx} className="border-b border-on-surface/15">
                      <td className="p-3 font-code-md text-center font-bold">{b.rank}</td>
                      <td className="p-3 font-body-md">
                        <div className="font-semibold">{b.vendor}</div>
                        <div className="font-code-md text-[11px] text-on-surface-variant">VID: {b.vid}</div>
                      </td>
                      <td className="p-3 text-center">
                        <button onClick={() => toggleQualify(idx)} className="border border-on-surface/15 px-3 py-1 text-xs font-label-caps">
                          {b.qualified ? 'QUALIFIED' : 'PENDING'}
                        </button>
                      </td>
                      <td className="p-3 font-code-md text-[11px] text-on-surface-variant break-all">{b.hash}</td>
                      <td className="p-3 font-code-md text-right font-bold">{b.amount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="bg-surface-container-lowest border border-on-surface/15 p-8 flex flex-col items-center justify-center">
              <button 
                onClick={() => alert('Tender Awarded to L1 Winner on Blockchain!')}
                disabled={!bids[0].qualified}
                className="bg-[#44617b] hover:bg-[#2c4962] disabled:opacity-50 text-white font-label-caps text-label-caps px-8 py-4 flex items-center gap-2"
              >
                AWARD TENDER TO L1
              </button>
              {!bids[0].qualified && (
                <div className="font-code-md text-[11px] text-error mt-4">System Notice: Technical qualification pending for L1. Click "PENDING" to qualify.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-background border-t border-on-surface/15 px-6 py-4 w-full mt-auto text-xs text-on-surface-variant">
        <div className="max-w-container-max mx-auto flex justify-between items-center">
          <p className="font-bold">MINISTRY OF PETROLEUM AND NATURAL GAS</p>
          <p className="font-label-caps">© 2026 GOVERNMENT OF INDIA. NATIONAL INFORMATICS CENTRE (NIC).</p>
        </div>
      </footer>
    </div>
  );
}
