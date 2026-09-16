import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function TenderBrowse({ tenders, selectedPSU: propPsu, setSelectedPSU }) {
  const { officerUser, walletAddress, selectedPSU } = useAuth();
  const isOfficer = Boolean(officerUser);
  const isVendor = Boolean(walletAddress && !officerUser);
  const isPublic = !isOfficer && !isVendor;

  const officerPSU = officerUser?.psu || selectedPSU || 'IOCL';
  const [localPsuFilter, setLocalPsuFilter] = useState(isOfficer ? officerPSU : 'ALL');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const filtered = tenders.filter(t => {
    // Officers are strictly tenant-locked to their own PSU's tenders
    const matchPSU = isOfficer ? t.psu === officerPSU : (localPsuFilter === 'ALL' || t.psu === localPsuFilter);
    const matchCat = categoryFilter === 'ALL' || t.category === categoryFilter;
    const matchStatus = statusFilter === 'ALL' || t.status === statusFilter;
    const matchSearch = t.id.toLowerCase().includes(search.toLowerCase()) || 
                        t.title.toLowerCase().includes(search.toLowerCase()) ||
                        t.category.toLowerCase().includes(search.toLowerCase());
    return matchPSU && matchCat && matchStatus && matchSearch;
  });

  return (
    <div id="main-content" className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-end border-b border-[#E8E6E1] pb-4 gap-4">
        <div>
          <span className="text-[11px] font-mono font-semibold uppercase text-[#71716D] tracking-wider">
            {isOfficer ? `${officerPSU} Register • Entity NITs` : 'Public Register • Active NITs'}
          </span>
          <h1 className="text-2xl font-bold text-[#1A1A18] tracking-tight mt-1">
            {isOfficer ? `${officerPSU} Procurement Register` : 'Active Procurement Tenders'}
          </h1>
          <p className="text-xs text-[#575753] mt-0.5">
            {isOfficer 
              ? `Displaying official tenders issued by ${officerPSU} Procurement Cell. Scoped strictly to your tenant.`
              : 'Displaying official tenders published across IOCL, HPCL, BPCL, ONGC, and GAIL.'}
          </p>
        </div>
        <div className="text-left sm:text-right font-mono text-xs text-[#71716D] tabular-nums shrink-0 space-y-0.5">
          <div>Gas Policy: <span className="font-semibold text-[#1A1A18]">0.00 Gwei Fixed</span></div>
          <div>Consensus: <span className="text-emerald-700 font-semibold">QBFT 7/7 Nodes</span></div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white border border-[#E8E6E1] rounded-xl p-3 flex flex-wrap items-center gap-3 text-xs shadow-xs">
        <div className="flex-1 min-w-[220px] flex items-center border border-[#E8E6E1] bg-[#FAFAF9] rounded-lg px-3 py-2 focus-within:ring-2 focus-within:ring-[#A13D2B] transition-all">
          <label htmlFor="tender-search-input" className="sr-only">Search active tenders</label>
          <span className="text-[#71716D] mr-2 text-xs" aria-hidden="true">🔍</span>
          <input
            id="tender-search-input"
            name="search"
            type="search"
            autoComplete="off"
            spellCheck={false}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by ID, Category, or Title…"
            className="w-full bg-transparent border-none p-0 text-xs text-[#1A1A18] placeholder:text-[#A8A7A1] outline-none"
          />
        </div>

        {/* PSU Filter: Locked badge for Officer, Dropdown for Public/Vendor */}
        {isOfficer ? (
          <div className="flex items-center gap-1.5 border-r border-[#E8E6E1] pr-3">
            <span className="font-medium text-[#575753]">Tenant:</span>
            <span className="bg-[#F5F4F0] border border-[#E8E6E1] rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-[#1A1A18] flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
              <span>{officerPSU} (Restricted)</span>
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 border-r border-[#E8E6E1] pr-3">
            <label htmlFor="psu-filter-select" className="font-medium text-[#575753]">PSU:</label>
            <select
              id="psu-filter-select"
              name="psuFilter"
              value={localPsuFilter}
              onChange={(e) => setLocalPsuFilter(e.target.value)}
              className="bg-white border border-[#E8E6E1] rounded-lg px-2.5 py-1.5 text-xs text-[#1A1A18] focus-visible:ring-2 focus-visible:ring-[#A13D2B] focus-visible:outline-none cursor-pointer font-medium"
            >
              <option value="ALL">All PSUs</option>
              <option value="IOCL">IOCL</option>
              <option value="BPCL">BPCL</option>
              <option value="HPCL">HPCL</option>
              <option value="ONGC">ONGC</option>
              <option value="GAIL">GAIL</option>
            </select>
          </div>
        )}

        <div className="flex items-center gap-1.5 border-r border-[#E8E6E1] pr-3">
          <label htmlFor="category-filter-select" className="font-medium text-[#575753]">Category:</label>
          <select
            id="category-filter-select"
            name="categoryFilter"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-white border border-[#E8E6E1] rounded-lg px-2.5 py-1.5 text-xs text-[#1A1A18] focus-visible:ring-2 focus-visible:ring-[#A13D2B] focus-visible:outline-none cursor-pointer font-medium"
          >
            <option value="ALL">All Categories</option>
            <option value="Pipeline Infrastructure">Pipeline Infrastructure</option>
            <option value="Heavy Machinery">Heavy Machinery</option>
            <option value="Consulting">Consulting</option>
            <option value="IT Infrastructure">IT Infrastructure</option>
          </select>
        </div>

        <div className="flex items-center gap-1.5">
          <label htmlFor="status-filter-select" className="font-medium text-[#575753]">Status:</label>
          <select
            id="status-filter-select"
            name="statusFilter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-white border border-[#E8E6E1] rounded-lg px-2.5 py-1.5 text-xs text-[#1A1A18] focus-visible:ring-2 focus-visible:ring-[#A13D2B] focus-visible:outline-none cursor-pointer font-medium"
          >
            <option value="ALL">All Statuses</option>
            <option value="OPEN">Open</option>
            <option value="CLOSING SOON">Closing Soon</option>
            <option value="AWARDED">Awarded</option>
          </select>
        </div>
      </div>

      {/* Enterprise Data Table */}
      <div className="bg-white border border-[#E8E6E1] rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse" aria-label="Active Tenders Registry">
            <thead className="bg-[#FAFAF9] text-[#71716D] text-[11px] font-semibold uppercase tracking-wider border-b border-[#E8E6E1]">
              <tr>
                <th scope="col" className="p-3.5 w-[15%]">Tender Ref ID</th>
                <th scope="col" className="p-3.5 w-[10%]">PSU</th>
                <th scope="col" className="p-3.5 w-[35%]">Title &amp; Category</th>
                <th scope="col" className="p-3.5 text-right w-[15%]">Est. Value (₹ Cr)</th>
                <th scope="col" className="p-3.5 w-[15%]">Status / Deadline</th>
                <th scope="col" className="p-3.5 text-right w-[10%]">Action</th>
              </tr>
            </thead>
            <tbody className="text-xs text-[#1A1A18] divide-y divide-[#E8E6E1]">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-10 text-center text-[#71716D]">
                    <p className="font-semibold text-sm text-[#1A1A18]">No matching tenders found</p>
                    <p className="text-xs text-[#71716D] mt-1">Try broadening your search or filter parameters.</p>
                  </td>
                </tr>
              ) : (
                filtered.map((t) => (
                  <tr key={t.id} className="hover:bg-[#FAFAF9] transition-colors group">
                    <td className="p-3.5 font-mono font-medium text-[#1A1A18] tabular-nums">{t.id}</td>
                    <td className="p-3.5">
                      <span className="px-2 py-0.5 rounded bg-[#F5F4F0] border border-[#E8E6E1] font-semibold text-[#1A1A18] text-[11px]">
                        {t.psu}
                      </span>
                    </td>
                    <td className="p-3.5">
                      <div className="font-semibold text-[#1A1A18] flex items-center gap-2">
                        <span>{t.title}</span>
                        {t.status === 'AWARDED' && (
                          <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 border border-emerald-300 text-[10px] font-mono font-semibold">
                            AWARDED
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-[#71716D] flex flex-wrap items-center gap-1.5 mt-0.5">
                        <span>{t.category}</span>
                        {t.winner && (
                          <>
                            <span>•</span>
                            <span className="text-emerald-900 font-semibold">Winner: {t.winner} ({t.winningAmount || `₹ ${t.valueCr} Cr`})</span>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="p-3.5 font-mono font-semibold text-right text-[#1A1A18] tabular-nums">{t.valueCr}</td>
                    <td className="p-3.5 font-mono tabular-nums">
                      {t.status === 'AWARDED' ? (
                        <span className="font-semibold text-emerald-800 flex items-center gap-1.5 text-[11px]">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                          <span>Awarded (Standstill)</span>
                        </span>
                      ) : t.status === 'CLOSING SOON' ? (
                        <span className="font-medium text-amber-700 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-pulse" aria-hidden="true"></span>
                          <span>{t.deadline}</span>
                        </span>
                      ) : (
                        <span className="text-[#575753]">{t.deadline}</span>
                      )}
                    </td>
                    <td className="p-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {isOfficer ? (
                          <>
                            <Link
                              to={`/tenders/${t.id}`}
                              className="border border-[#E8E6E1] bg-white text-[#575753] hover:text-[#1A1A18] hover:bg-[#F5F4F0] px-2.5 py-1 rounded-md font-medium text-[11px] transition-colors focus-visible:ring-2 focus-visible:ring-[#A13D2B] focus-visible:outline-none"
                            >
                              {t.status === 'AWARDED' ? 'Award Details →' : 'Details'}
                            </Link>
                            {t.status === 'OPEN' && (
                              <Link
                                to="/psu/evaluation"
                                className="bg-[#1A1A18] hover:bg-black text-white px-2.5 py-1 rounded-md font-medium text-[11px] transition-colors focus-visible:ring-2 focus-visible:ring-[#A13D2B] focus-visible:outline-none"
                              >
                                Evaluate →
                              </Link>
                            )}
                          </>
                        ) : isVendor ? (
                          <>
                            <Link
                              to={`/tenders/${t.id}`}
                              className={`px-3 py-1.5 rounded-md font-semibold text-[11px] transition-colors focus-visible:ring-2 focus-visible:outline-none ${
                                t.status === 'AWARDED'
                                  ? 'border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 focus-visible:ring-emerald-600'
                                  : 'border border-[#E8E6E1] bg-white text-[#575753] hover:text-[#1A1A18] hover:bg-[#F5F4F0] focus-visible:ring-[#A13D2B]'
                              }`}
                            >
                              {t.status === 'AWARDED' ? 'Award Details →' : 'Details'}
                            </Link>
                            {t.status !== 'AWARDED' && !t.isExpired && (
                              <Link
                                to="/vendor/submit-bid"
                                className="bg-[#A13D2B] hover:bg-[#8A3323] text-white px-2.5 py-1 rounded-md font-medium text-[11px] transition-colors focus-visible:ring-2 focus-visible:ring-[#A13D2B] focus-visible:outline-none"
                              >
                                Bid
                              </Link>
                            )}
                          </>
                        ) : (
                          /* Public / Unauthenticated visitor: NO Bid button */
                          <Link
                            to={`/tenders/${t.id}`}
                            className="border border-[#E8E6E1] bg-white text-[#575753] hover:text-[#1A1A18] hover:bg-[#F5F4F0] px-3 py-1.5 rounded-md font-medium text-[11px] transition-colors focus-visible:ring-2 focus-visible:ring-[#A13D2B] focus-visible:outline-none"
                          >
                            {t.status === 'AWARDED' ? 'Award Details →' : 'View Details'}
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
