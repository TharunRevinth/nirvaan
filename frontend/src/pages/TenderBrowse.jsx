import React, { useState } from 'react';
import { Link } from 'react-router-dom';

export default function TenderBrowse({ tenders, selectedPSU, setSelectedPSU }) {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const filtered = tenders.filter(t => {
    const matchPSU = selectedPSU === 'ALL' || t.psu === selectedPSU;
    const matchCat = categoryFilter === 'ALL' || t.category === categoryFilter;
    const matchStatus = statusFilter === 'ALL' || t.status === statusFilter;
    const matchSearch = t.id.toLowerCase().includes(search.toLowerCase()) || 
                        t.title.toLowerCase().includes(search.toLowerCase()) ||
                        t.category.toLowerCase().includes(search.toLowerCase());
    return matchPSU && matchCat && matchStatus && matchSearch;
  });

  return (
    <div id="main-content" className="space-y-6">
      <div className="flex justify-between items-end border-b border-graphite/15 pb-4">
        <div>
          <span className="text-xs font-mono text-slate bg-slate/10 px-2 py-0.5 border border-slate/20">
            PUBLIC LEDGER // ACTIVE TENDERS
          </span>
          <h1 className="text-2xl font-bold text-graphite uppercase tracking-tight mt-2">
            Active Procurement Tender Register
          </h1>
          <p className="text-xs text-graphite/70 mt-1">
            Displaying live tenders published across Indian Oil PSUs (IOCL, HPCL, BPCL, ONGC, GAIL).
          </p>
        </div>
        <div className="text-right font-mono text-xs text-slate">
          <div>Consortium Gas Price: <span className="font-bold text-graphite">0 Gwei</span></div>
          <div>Consensus Protocol: <span className="text-emerald-700 font-bold">QBFT 7/7 Nodes</span></div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white border border-graphite/15 p-4 flex flex-wrap items-center gap-4 text-xs">
        <div className="flex-1 min-w-[240px] flex items-center border border-graphite/30 bg-offwhite px-3 py-2">
          <span className="text-graphite/50 mr-2">🔍</span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by Tender Reference ID, Category, or Title..."
            className="w-full bg-transparent border-none p-0 text-xs text-graphite placeholder:text-graphite/40 outline-none"
          />
        </div>

        <div className="flex items-center gap-2 border-r border-graphite/15 pr-4">
          <label className="font-bold text-graphite">PSU Entity:</label>
          <select
            value={selectedPSU}
            onChange={(e) => setSelectedPSU(e.target.value)}
            className="bg-offwhite border border-graphite/30 px-2 py-1 text-xs text-graphite outline-none cursor-pointer font-bold"
          >
            <option value="ALL">ALL PSUs</option>
            <option value="IOCL">IOCL</option>
            <option value="BPCL">BPCL</option>
            <option value="HPCL">HPCL</option>
            <option value="ONGC">ONGC</option>
            <option value="GAIL">GAIL</option>
          </select>
        </div>

        <div className="flex items-center gap-2 border-r border-graphite/15 pr-4">
          <label className="font-bold text-graphite">Category:</label>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-offwhite border border-graphite/30 px-2 py-1 text-xs text-graphite outline-none cursor-pointer font-bold"
          >
            <option value="ALL">ALL Categories</option>
            <option value="Pipeline Infrastructure">Pipeline Infrastructure</option>
            <option value="Heavy Machinery">Heavy Machinery</option>
            <option value="Consulting">Consulting</option>
            <option value="IT Infrastructure">IT Infrastructure</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="font-bold text-graphite">Status:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-offwhite border border-graphite/30 px-2 py-1 text-xs text-graphite outline-none cursor-pointer font-bold"
          >
            <option value="ALL">ALL Statuses</option>
            <option value="OPEN">OPEN FOR BIDDING</option>
            <option value="CLOSING SOON">CLOSING SOON (&lt;48 HR)</option>
          </select>
        </div>
      </div>

      {/* Dense Ledger-Style Table */}
      <div className="bg-white border border-graphite/15 overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead className="bg-graphite text-white text-xs font-mono tracking-wider border-b border-graphite/20">
            <tr>
              <th className="p-3 w-[15%]">TENDER REF ID</th>
              <th className="p-3 w-[10%]">PSU</th>
              <th className="p-3 w-[30%]">CATEGORY & SPECIFICATIONS</th>
              <th className="p-3 text-right w-[15%]">EST. VALUE (₹ CR)</th>
              <th className="p-3 w-[15%]">SUBMISSION DEADLINE</th>
              <th className="p-3 text-right w-[15%]">ACTION</th>
            </tr>
          </thead>
          <tbody className="text-xs text-graphite">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-graphite/60 bg-offwhite/50">
                  <p className="font-bold text-sm">No tenders match your specified filter criteria.</p>
                  <p className="text-xs text-slate mt-1">Try resetting your search parameters or selecting "ALL PSUs".</p>
                </td>
              </tr>
            ) : (
              filtered.map((t) => (
                <tr key={t.id} className="border-b border-graphite/15 hover:bg-offwhite transition-colors">
                  <td className="p-3 font-mono font-bold text-slate">{t.id}</td>
                  <td className="p-3 font-bold text-graphite">{t.psu}</td>
                  <td className="p-3">
                    <div className="font-bold text-graphite">{t.category}</div>
                    <div className="text-[11px] text-graphite/70 truncate max-w-xs">{t.title}</div>
                  </td>
                  <td className="p-3 font-mono font-bold text-right text-graphite">{t.valueCr}</td>
                  <td className="p-3 font-mono">
                    {t.status === 'CLOSING SOON' ? (
                      <span className="amber-flash font-bold flex items-center gap-1">
                        <span>⏳</span> {t.deadline}
                      </span>
                    ) : (
                      <span>{t.deadline}</span>
                    )}
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        to={`/tenders/${t.id}`}
                        className="border border-graphite/30 text-graphite px-2.5 py-1 font-bold text-[11px] hover:bg-graphite hover:text-white transition-colors"
                      >
                        Details & Custody
                      </Link>
                      <Link
                        to="/submit-bid"
                        className="bg-copper text-white px-3 py-1 font-bold text-[11px] hover:bg-copper-hover transition-colors"
                      >
                        Submit Bid
                      </Link>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
