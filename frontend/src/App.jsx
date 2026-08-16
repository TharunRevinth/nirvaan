import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  FileText, 
  Lock, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  Building2, 
  UserCheck, 
  Scale, 
  Cpu, 
  Layers, 
  Key, 
  Search, 
  Plus, 
  ExternalLink,
  ChevronRight,
  TrendingUp,
  RefreshCw
} from 'lucide-react';

export default function App() {
  const [userRole, setUserRole] = useState('PSU'); // PSU | Vendor | CVC
  const [selectedPSU, setSelectedPSU] = useState('IOCL');
  const [activeTab, setActiveTab] = useState('tenders');
  const [walletConnected, setWalletConnected] = useState(true);
  const [walletAddress, setWalletAddress] = useState('0xfe3b557e8fb62b89f4916b721be55ceb828dbd73');

  // Sample Mock Tenders State
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
      winningAmount: '42,500,000 INR',
      disputeDeadline: new Date(Date.now() + 3600 * 1000 * 120).toISOString()
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
    salt: '',
    encryptedIpfs: ''
  });

  const [commitmentHash, setCommitmentHash] = useState('');

  // 7 Consortium Nodes
  const validatorNodes = [
    { name: 'MoPNG (Ministry Node)', status: 'Online', tps: '1,240 TPS', peerId: 'node-1' },
    { name: 'IOCL Validator Node', status: 'Online', tps: '1,240 TPS', peerId: 'node-2' },
    { name: 'BPCL Validator Node', status: 'Online', tps: '1,240 TPS', peerId: 'node-3' },
    { name: 'HPCL Validator Node', status: 'Online', tps: '1,240 TPS', peerId: 'node-4' },
    { name: 'ONGC Validator Node', status: 'Online', tps: '1,240 TPS', peerId: 'node-5' },
    { name: 'GAIL Validator Node', status: 'Online', tps: '1,240 TPS', peerId: 'node-6' },
    { name: 'NIC Infra Node', status: 'Online', tps: '1,240 TPS', peerId: 'node-7' }
  ];

  // Calculate client-side commitment hash preview
  useEffect(() => {
    if (bidForm.bidAmount && bidForm.salt) {
      // Mock keccak256 simulation hash
      const str = `${walletAddress}-${bidForm.bidAmount}-${bidForm.salt}-${bidForm.tenderId}`;
      let hash = '0x';
      for (let i = 0; i < 64; i++) {
        hash += Math.floor(Math.random() * 16).toString(16);
      }
      setCommitmentHash(hash);
    } else {
      setCommitmentHash('');
    }
  }, [bidForm.bidAmount, bidForm.salt, bidForm.tenderId, walletAddress]);

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
    setNewTender({ title: '', ipfsHash: '', submissionDeadline: '', openingTime: '', minEMD: '' });
    alert('Tender Created Successfully on Blockchain!');
  };

  return (
    <div className="min-h-screen bg-[#0A0F1D] text-slate-100 flex flex-col">
      {/* Top Navbar */}
      <header className="border-b border-slate-800 bg-[#0D1527]/80 backdrop-blur-md sticky top-0 z-50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Shield className="w-6 h-6 text-black font-bold" />
          </div>
          <div>
            <h1 className="font-extrabold text-lg tracking-wide text-white flex items-center gap-2">
              OIL-E-TENDER <span className="bg-cyan-500/10 text-cyan-400 text-xs px-2 py-0.5 rounded-full border border-cyan-500/30">BESU QBFT 7-NODE</span>
            </h1>
            <p className="text-xs text-slate-400">Indian Oil PSUs Blockchain Procurement Platform</p>
          </div>
        </div>

        {/* Role & PSU Selector */}
        <div className="flex items-center gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-1 flex items-center">
            <span className="text-xs text-slate-400 px-2 font-medium">PSU:</span>
            {['IOCL', 'BPCL', 'HPCL', 'ONGC', 'GAIL'].map((psu) => (
              <button
                key={psu}
                onClick={() => setSelectedPSU(psu)}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                  selectedPSU === psu 
                    ? 'bg-amber-500 text-black shadow-md shadow-amber-500/20' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {psu}
              </button>
            ))}
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-lg p-1 flex items-center">
            <span className="text-xs text-slate-400 px-2 font-medium">Role:</span>
            {['PSU', 'Vendor', 'CVC'].map((role) => (
              <button
                key={role}
                onClick={() => setUserRole(role)}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                  userRole === role 
                    ? 'bg-cyan-500 text-black shadow-md shadow-cyan-500/20' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {role}
              </button>
            ))}
          </div>

          {/* Wallet Button */}
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
            <span className="font-mono text-slate-300">
              {walletAddress.substring(0, 6)}...{walletAddress.substring(38)}
            </span>
            <span className="bg-emerald-500/10 text-emerald-400 text-[10px] px-1.5 py-0.5 rounded border border-emerald-500/30">
              Class-3 DSC
            </span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 flex flex-col gap-6">
        
        {/* Top Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="glass-panel p-4 rounded-xl border border-slate-800 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 font-medium">Consortium Network</p>
              <p className="text-xl font-bold text-white mt-1">7 Nodes Active</p>
              <p className="text-[11px] text-emerald-400 flex items-center gap-1 mt-1">
                <CheckCircle2 className="w-3 h-3" /> IBFT 2.0 / QBFT (0 Gas)
              </p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <Cpu className="w-5 h-5" />
            </div>
          </div>

          <div className="glass-panel p-4 rounded-xl border border-slate-800 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 font-medium">Total Tenders</p>
              <p className="text-xl font-bold text-white mt-1">{tenders.length} Published</p>
              <p className="text-[11px] text-cyan-400 flex items-center gap-1 mt-1">
                <FileText className="w-3 h-3" /> SHA-256 On-Chain
              </p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Layers className="w-5 h-5" />
            </div>
          </div>

          <div className="glass-panel p-4 rounded-xl border border-slate-800 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 font-medium">Sealed Commitments</p>
              <p className="text-xl font-bold text-white mt-1">12 Bids Submitted</p>
              <p className="text-[11px] text-emerald-400 flex items-center gap-1 mt-1">
                <Lock className="w-3 h-3" /> AES-256 Sealed
              </p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Lock className="w-5 h-5" />
            </div>
          </div>

          <div className="glass-panel p-4 rounded-xl border border-slate-800 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 font-medium">Dispute Appeal Window</p>
              <p className="text-xl font-bold text-white mt-1">7 Days Time-Lock</p>
              <p className="text-[11px] text-amber-400 flex items-center gap-1 mt-1">
                <Scale className="w-3 h-3" /> CVC Audited
              </p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <Scale className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800 space-x-6 text-sm font-medium">
          <button 
            onClick={() => setActiveTab('tenders')} 
            className={`pb-3 transition-colors relative ${activeTab === 'tenders' ? 'text-cyan-400 font-semibold' : 'text-slate-400 hover:text-slate-200'}`}
          >
            All Active Tenders
            {activeTab === 'tenders' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-400 rounded-full"></div>}
          </button>

          {userRole === 'PSU' && (
            <button 
              onClick={() => setActiveTab('create')} 
              className={`pb-3 transition-colors relative ${activeTab === 'create' ? 'text-cyan-400 font-semibold' : 'text-slate-400 hover:text-slate-200'}`}
            >
              + Create New Tender
              {activeTab === 'create' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-400 rounded-full"></div>}
            </button>
          )}

          {userRole === 'Vendor' && (
            <button 
              onClick={() => setActiveTab('submitBid')} 
              className={`pb-3 transition-colors relative ${activeTab === 'submitBid' ? 'text-cyan-400 font-semibold' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Submit Sealed Bid (Commit-Reveal)
              {activeTab === 'submitBid' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-400 rounded-full"></div>}
            </button>
          )}

          <button 
            onClick={() => setActiveTab('nodes')} 
            className={`pb-3 transition-colors relative ${activeTab === 'nodes' ? 'text-cyan-400 font-semibold' : 'text-slate-400 hover:text-slate-200'}`}
          >
            Consortium Validator Nodes (7)
            {activeTab === 'nodes' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-400 rounded-full"></div>}
          </button>
        </div>

        {/* TAB 1: ALL TENDERS */}
        {activeTab === 'tenders' && (
          <div className="grid grid-cols-1 gap-4">
            {tenders.map((tender) => (
              <div key={tender.id} className="glass-panel p-6 rounded-2xl border border-slate-800 hover:border-slate-700 transition-all flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="space-y-2 max-w-2xl">
                  <div className="flex items-center gap-2">
                    <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs px-2.5 py-0.5 rounded-full font-bold">
                      {tender.psu}
                    </span>
                    <span className="text-xs font-mono text-slate-400">Tender #{tender.id}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${
                      tender.status === 'Active' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' :
                      tender.status === 'UnderEvaluation' ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30' :
                      'bg-purple-500/10 text-purple-400 border-purple-500/30'
                    }`}>
                      {tender.status}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-white">{tender.title}</h3>
                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 pt-1">
                    <span className="flex items-center gap-1 font-mono">
                      <Lock className="w-3.5 h-3.5 text-cyan-400" /> IPFS: {tender.ipfsHash.substring(0, 14)}...
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" /> Opens: {new Date(tender.openingTime).toLocaleDateString()}
                    </span>
                    <span className="flex items-center gap-1 text-amber-400 font-medium">
                      Min EMD: {tender.minEMD}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2 w-full md:w-auto">
                  <div className="text-xs text-right text-slate-400">
                    <span className="font-bold text-white text-sm">{tender.bidsCount} Bids</span> Submitted
                  </div>
                  {tender.status === 'Active' && userRole === 'Vendor' && (
                    <button 
                      onClick={() => {
                        setBidForm({ ...bidForm, tenderId: tender.id });
                        setActiveTab('submitBid');
                      }}
                      className="w-full md:w-auto bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs px-4 py-2 rounded-xl transition-all shadow-lg shadow-cyan-500/20"
                    >
                      Submit Sealed Bid
                    </button>
                  )}
                  {tender.status === 'Awarded' && (
                    <div className="text-xs text-right">
                      <div className="text-emerald-400 font-bold">L1 Winner Awarded</div>
                      <div className="text-slate-400 text-[11px]">{tender.winner}</div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TAB 2: CREATE TENDER (PSU ONLY) */}
        {activeTab === 'create' && userRole === 'PSU' && (
          <div className="glass-panel p-6 rounded-2xl border border-slate-800 max-w-2xl mx-auto w-full">
            <h2 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
              <Plus className="w-5 h-5 text-cyan-400" /> Publish New E-Tender ({selectedPSU})
            </h2>
            <p className="text-xs text-slate-400 mb-6">
              Document specifications will be hashed (SHA-256) and permanently committed to the Besu consortium blockchain.
            </p>

            <form onSubmit={handleCreateTender} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Tender Title & Scope</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Supply of Pipeline Valves for Crude Refinery"
                  value={newTender.title}
                  onChange={(e) => setNewTender({ ...newTender, title: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Submission Deadline</label>
                  <input
                    type="datetime-local"
                    value={newTender.submissionDeadline}
                    onChange={(e) => setNewTender({ ...newTender, submissionDeadline: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Bid Opening Time</label>
                  <input
                    type="datetime-local"
                    value={newTender.openingTime}
                    onChange={(e) => setNewTender({ ...newTender, openingTime: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Earnest Money Deposit (EMD in INR)</label>
                <input
                  type="number"
                  required
                  placeholder="e.g. 500000"
                  value={newTender.minEMD}
                  onChange={(e) => setNewTender({ ...newTender, minEMD: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-cyan-500 hover:bg-cyan-400 text-black font-bold py-3 rounded-xl transition-all shadow-lg shadow-cyan-500/20 mt-4"
              >
                Sign & Publish to Blockchain (0 Gas)
              </button>
            </form>
          </div>
        )}

        {/* TAB 3: SEALED BID SUBMISSION (VENDOR ONLY) */}
        {activeTab === 'submitBid' && userRole === 'Vendor' && (
          <div className="glass-panel p-6 rounded-2xl border border-slate-800 max-w-2xl mx-auto w-full">
            <h2 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
              <Lock className="w-5 h-5 text-emerald-400" /> Sealed Commitment Bid Submission
            </h2>
            <p className="text-xs text-slate-400 mb-6">
              Your financial bid is sealed using client-side <code className="text-cyan-400">keccak256(vendor, amount, salt, tenderId)</code>. No administrator or node can read your bid until official opening time.
            </p>

            <div className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Target Tender ID</label>
                <select 
                  value={bidForm.tenderId} 
                  onChange={(e) => setBidForm({ ...bidForm, tenderId: Number(e.target.value) })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-cyan-500"
                >
                  {tenders.map((t) => (
                    <option key={t.id} value={t.id}>Tender #{t.id}: {t.title} ({t.psu})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Financial Bid Amount (INR)</label>
                  <input
                    type="number"
                    placeholder="e.g. 450000"
                    value={bidForm.bidAmount}
                    onChange={(e) => setBidForm({ ...bidForm, bidAmount: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Client-Side Secret Salt</label>
                  <input
                    type="text"
                    placeholder="e.g. mysecret2026salt"
                    value={bidForm.salt}
                    onChange={(e) => setBidForm({ ...bidForm, salt: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              {/* Commitment Preview Box */}
              {commitmentHash && (
                <div className="bg-slate-950 border border-emerald-500/30 rounded-xl p-3 space-y-1">
                  <div className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Generated On-Chain Commitment Hash:
                  </div>
                  <div className="font-mono text-xs text-slate-300 break-all">{commitmentHash}</div>
                </div>
              )}

              <button
                onClick={() => alert(`Bid Commitment ${commitmentHash} Submitted to Blockchain!`)}
                disabled={!commitmentHash}
                className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-bold py-3 rounded-xl transition-all shadow-lg shadow-emerald-500/20 mt-4"
              >
                Sign & Deposit EMD Escrow
              </button>
            </div>
          </div>
        )}

        {/* TAB 4: CONSORTIUM NODES STATUS */}
        {activeTab === 'nodes' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Hyperledger Besu 7-Node Validator Network</h2>
              <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs px-3 py-1 rounded-full font-mono">
                Consensus: QBFT / IBFT 2.0 (BFT = 2 failures tolerated)
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {validatorNodes.map((node, i) => (
                <div key={i} className="glass-panel p-4 rounded-xl border border-slate-800 flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></div>
                      <span className="font-bold text-sm text-white">{node.name}</span>
                    </div>
                    <p className="text-xs text-slate-400 font-mono">Peer ID: {node.peerId}</p>
                    <p className="text-[11px] text-cyan-400 font-mono">{node.tps} • Block Time: 500ms</p>
                  </div>
                  <span className="bg-slate-900 border border-slate-800 text-xs text-slate-300 px-2.5 py-1 rounded-lg">
                    {node.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
