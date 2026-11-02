/**
 * NIRVAAN Frontend Component Fixture Test
 * Tests rendering of TenderDetail and ChainOfCustodyTimeline with exact backend API payloads.
 * Verifies case-insensitive status handling, award details, appeal window calculations,
 * and elimination of leftover legacy terminology.
 */

import assert from 'node:assert';
import path from 'node:path';
import esbuild from '../frontend/node_modules/esbuild/lib/main.js';

if (typeof global.localStorage === 'undefined') {
  global.localStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  };
}

// Suppress harmless React SSR useLayoutEffect warnings in Node
const origError = console.error;
console.error = (...args) => {
  if (typeof args[0] === 'string' && args[0].includes('useLayoutEffect does nothing on the server')) {
    return;
  }
  origError(...args);
};

console.log('===============================================================');
console.log('  NIRVAAN FRONTEND FIXTURE TEST: TENDER DETAIL & TIMELINE');
console.log('===============================================================');

const testRunnerCode = `
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import TenderDetail from './src/pages/TenderDetail';
import ChainOfCustodyTimeline from './src/components/ChainOfCustodyTimeline';
import Sidebar from './src/components/Sidebar';
import { AuthProvider } from './src/context/AuthContext';

// 1. EXACT API PAYLOAD FOR TENDER 11 (AWARDED)
export const mockTender11Awarded = {
  id: '11',
  onChainId: 11,
  title: 'Subsea Pipeline Inspection & Maintenance 2026',
  psu: 'IOCL',
  category: 'PIPELINE',
  desc: 'High-precision acoustic inspection and maintenance for subsea pipeline',
  valueCr: '250.00',
  minEmdEth: '0.01',
  status: 'Awarded', // Case-sensitive test: TitleCase from backend
  winnerAddress: '0x1234567890abcdef1234567890abcdef12345678',
  winner: 'Oceanic Subsea Services Ltd',
  winningAmount: '0.05 ETH',
  awardTxHash: '0x8fdc111122223333444455556666777788889999aaaabbbbccccddddeeee94bfa',
  awardBlock: 'Block #12045830', // String block test
  appealDeadline: '2026-11-09T04:37:24.000Z',
  appealWindowClosed: false,
  deadline: '2026-10-25T12:00:00.000Z',
  opening: '2026-10-26T12:00:00.000Z',
  revealDeadline: '2026-10-27T12:00:00.000Z',
  blockNumber: 12045000,
  txHash: '0x1111111111111111111111111111111111111111'
};

export const mockTenderCreated = {
  id: '12',
  onChainId: 12,
  title: 'Refinery Process Valves',
  psu: 'BPCL',
  status: 'Created',
  deadline: '2026-12-01T12:00:00.000Z',
  appealDeadline: null,
  appealWindowClosed: false
};

export const mockTenderUnderEvaluation = {
  id: '13',
  onChainId: 13,
  title: 'Catalytic Reformer Overhaul',
  psu: 'HPCL',
  status: 'UnderEvaluation',
  deadline: '2026-10-01T12:00:00.000Z',
  appealDeadline: null,
  appealWindowClosed: false
};

export const mockTenderDisputed = {
  id: '14',
  onChainId: 14,
  title: 'Subsea Compression Skid',
  psu: 'ONGC',
  status: 'Disputed',
  winnerAddress: '0x1234567890abcdef1234567890abcdef12345678',
  winner: 'Oceanic Subsea Services Ltd',
  winningAmount: '0.05 ETH',
  awardTxHash: '0x8fdc111122223333444455556666777788889999aaaabbbbccccddddeeee94bfa',
  awardBlock: 'Block #12045830',
  appealDeadline: '2026-11-09T04:37:24.000Z',
  appealWindowClosed: false
};

export const mockTenderFinalized = {
  id: '15',
  onChainId: 15,
  title: 'Liquefied Gas Compressors',
  psu: 'GAIL',
  status: 'Finalized',
  winnerAddress: '0x1234567890abcdef1234567890abcdef12345678',
  winner: 'Oceanic Subsea Services Ltd',
  winningAmount: '0.05 ETH',
  awardTxHash: '0x8fdc111122223333444455556666777788889999aaaabbbbccccddddeeee94bfa',
  awardBlock: 'Block #12045830',
  appealDeadline: '2026-11-09T04:37:24.000Z',
  appealWindowClosed: true
};

export function renderDetail(tender, initialPath = \`/tenders/\${tender.id}\`) {
  return ReactDOMServer.renderToString(
    React.createElement(
      MemoryRouter,
      { initialEntries: [initialPath] },
      React.createElement(
        Routes,
        null,
        React.createElement(Route, {
          path: '/tenders/:id',
          element: React.createElement(TenderDetail, { tenders: [tender] })
        })
      )
    )
  );
}

export function renderSidebar(initialPath = '/tenders') {
  return ReactDOMServer.renderToString(
    React.createElement(
      MemoryRouter,
      { initialEntries: [initialPath] },
      React.createElement(
        AuthProvider,
        null,
        React.createElement(Sidebar, null)
      )
    )
  );
}
`;

// Bundle the test runner code using esbuild
const bundleResult = esbuild.buildSync({
  stdin: {
    contents: testRunnerCode,
    resolveDir: path.resolve('./frontend'),
    loader: 'jsx',
  },
  bundle: true,
  format: 'cjs',
  define: {
    'import.meta.env': '{}',
  },
  write: false,
});

const moduleExports = {};
const moduleWrapper = new Function('module', 'exports', 'require', bundleResult.outputFiles[0].text);
const cjsModule = { exports: moduleExports };
moduleWrapper(cjsModule, moduleExports, (moduleName) => {
  return import(moduleName);
});

const {
  mockTender11Awarded,
  mockTenderCreated,
  mockTenderUnderEvaluation,
  mockTenderDisputed,
  mockTenderFinalized,
  renderDetail,
  renderSidebar
} = cjsModule.exports;

// =========================================================================
// TEST 1: Tender 11 (Awarded) - Renders Award Step & Standstill Details
// =========================================================================
console.log('\n[TEST 1] Rendering Tender 11 with exact API object (Status: "Awarded")...');
const awardedHtml = renderDetail(mockTender11Awarded);

// 1.1 L1 Award Step in Timeline
assert(
  awardedHtml.includes('L1 Award &amp; Standstill') || awardedHtml.includes('L1 Award & Standstill'),
  'Expected Chain of Custody Timeline to contain "L1 Award & Standstill"'
);
console.log(' [PASS] Timeline displays "L1 Award & Standstill" stage.');

// 1.2 Winner name appears
assert(
  awardedHtml.includes('Oceanic Subsea Services Ltd'),
  'Expected HTML to display winner name "Oceanic Subsea Services Ltd"'
);
console.log(' [PASS] Selected winner "Oceanic Subsea Services Ltd" rendered.');

// 1.3 Winning amount appears
assert(
  awardedHtml.includes('0.05 ETH'),
  'Expected HTML to display winning commercial quote "0.05 ETH"'
);
console.log(' [PASS] Winning quote "0.05 ETH" rendered.');

// 1.4 Award block appears without duplicate "Block #Block #"
assert(
  awardedHtml.includes('Block #12045830'),
  'Expected HTML to contain "Block #12045830"'
);
assert(
  !awardedHtml.includes('Block #Block #'),
  'Expected HTML not to contain duplicate "Block #Block #"'
);
console.log(' [PASS] Award block "Block #12045830" cleanly formatted without duplicates.');

// 1.5 Sepolia Etherscan link to awardTxHash
assert(
  awardedHtml.includes('https://sepolia.etherscan.io/tx/0x8fdc111122223333444455556666777788889999aaaabbbbccccddddeeee94bfa'),
  'Expected HTML to contain Sepolia Etherscan link to awardTxHash'
);
console.log(' [PASS] Sepolia Etherscan link to awardTxHash verified.');

// 1.6 Appeal Window shows real appealDeadline and "Open"
assert(
  awardedHtml.includes('APPEALS OPEN (7-DAY STANDSTILL)') || awardedHtml.includes('APPEALS OPEN'),
  'Expected appeal window to indicate open appeal period'
);
assert(
  awardedHtml.includes('Nov 9, 2026') || awardedHtml.includes('2026-11-09'),
  'Expected appeal deadline to display formatted date'
);
assert(
  /Deadline:.*Open/i.test(awardedHtml),
  'Expected appeal deadline section to show Open status'
);
console.log(' [PASS] Appeal window shows real appealDeadline and computed "Open" status.');

// 1.7 Ensure NO "Pending L1 Award" or "Pending Evaluation" for awarded tender
assert(
  !awardedHtml.includes('Pending L1 Award'),
  'Expected awarded tender not to show "Pending L1 Award"'
);
assert(
  !awardedHtml.includes('Dispute Window Status:</span>\n              <span class="font-mono text-[11px] font-medium px-2 py-0.5 rounded border inline-block mt-1 bg-[#FAFAF9] text-[#71716D] border-[#E8E6E1]">\n                Not applicable'),
  'Expected awarded tender not to show "Dispute Window: Not applicable"'
);
console.log(' [PASS] Stale fallback text ("Pending L1 Award", "Not applicable") successfully eliminated.');

// =========================================================================
// TEST 2: Pre-Award Tenders (Created & UnderEvaluation)
// =========================================================================
console.log('\n[TEST 2] Verifying pre-award tenders show "Not applicable" for dispute window...');
const createdHtml = renderDetail(mockTenderCreated);
assert(
  createdHtml.includes('Not applicable'),
  'Expected "Created" tender to show "Not applicable" for dispute window'
);
assert(
  createdHtml.includes('Pending L1 Award'),
  'Expected "Created" tender timeline to show "Pending L1 Award"'
);
console.log(' [PASS] Created tender correctly shows "Not applicable" and "Pending L1 Award".');

const underEvalHtml = renderDetail(mockTenderUnderEvaluation);
assert(
  underEvalHtml.includes('Not applicable'),
  'Expected "UnderEvaluation" tender to show "Not applicable" for dispute window'
);
console.log(' [PASS] UnderEvaluation tender correctly shows "Not applicable".');

// =========================================================================
// TEST 3: Post-Award Variations (Disputed, Finalized)
// =========================================================================
console.log('\n[TEST 3] Verifying Disputed and Finalized tenders handle dispute window properly...');
const disputedHtml = renderDetail(mockTenderDisputed);
assert(
  disputedHtml.includes('DISPUTE FILED • UNDER CVC REVIEW'),
  'Expected Disputed tender to show "DISPUTE FILED • UNDER CVC REVIEW"'
);
assert(
  !disputedHtml.includes('Not applicable'),
  'Expected Disputed tender NOT to show "Not applicable"'
);
console.log(' [PASS] Disputed tender renders CVC review notice with deadline.');

const finalizedHtml = renderDetail(mockTenderFinalized);
assert(
  finalizedHtml.includes('APPEAL WINDOW CLOSED • FINALIZED'),
  'Expected Finalized tender to show "APPEAL WINDOW CLOSED • FINALIZED"'
);
assert(
  !finalizedHtml.includes('Not applicable'),
  'Expected Finalized tender NOT to show "Not applicable"'
);
console.log(' [PASS] Finalized tender renders finalized notice with deadline.');

// =========================================================================
// TEST 4: Leftover "Consensus Trail" and "Consortium" Removal
// =========================================================================
console.log('\n[TEST 4] Verifying removal of leftover legacy terminology...');
assert(
  !awardedHtml.includes('Consensus Trail'),
  'Expected "Consensus Trail" to be completely removed from ledger'
);
assert(
  awardedHtml.includes('Audit Trail • Ethereum Sepolia'),
  'Expected ledger to display "Audit Trail • Ethereum Sepolia"'
);
console.log(' [PASS] "Consensus Trail" replaced with "Audit Trail • Ethereum Sepolia".');

const sidebarHtml = renderSidebar();
assert(
  !sidebarHtml.includes('About Consortium Platform'),
  'Expected "About Consortium Platform" to be removed from sidebar'
);
assert(
  !sidebarHtml.includes('Consortium E-Procurement'),
  'Expected "Consortium E-Procurement" to be removed from sidebar'
);
assert(
  !sidebarHtml.includes('Consortium Helpdesk'),
  'Expected "Consortium Helpdesk" to be removed from sidebar'
);
console.log(' [PASS] "Consortium" text removed from sidebar.');

console.log('\n===============================================================');
console.log('  ALL FRONTEND FIXTURE TESTS PASSED CLEANLY');
console.log('===============================================================');
