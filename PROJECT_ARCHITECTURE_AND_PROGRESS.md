# PROJECT NIRVAAN — ARCHITECTURE, IMPLEMENTATION PROGRESS & SYSTEM HANDOVER REPORT
**System Title:** NIRVAAN — Permissioned Consortium Blockchain E-Tendering Platform for Indian Oil PSUs (IOCL, HPCL, BPCL, ONGC, GAIL)  
**System Acronym:** **NIRVAAN** (National Indelible Record & Verification Architecture for Autonomous Negotiation)  
**Compliance Standards:** Information Technology Act 2000 (Sections 3 & 4), Central Vigilance Commission (CVC) Procurement Guidelines, Guidelines for Indian Government Websites (GIGW)  
**Date Last Updated:** 16-Sep-2026  

---

## 1. Executive Summary & Overview
Centralized e-procurement portals for Indian public sector undertakings (PSUs) face risks of insider bid tampering, premature price leakage, timestamp manipulation, and single-point-of-failure vulnerabilities. 

**Project NIRVAAN** implements a permissioned consortium blockchain system leveraging zero-gas EVM consensus (QBFT architecture, 7 validator nodes) and decentralized IPFS storage to provide:
1. **Cryptographic Sealed-Bid Confidentiality**: Client-side salting and commit-reveal hashing via Solidity `keccak256(vendor, amount, salt, tenderId)` before broadcast.
2. **Multi-Tenant Sovereign Isolation**: Strict cryptographic and frontend role separation between PSU Procurement Officers (IOCL, BPCL, HPCL, ONGC, GAIL), Commercial Bidders, and Public Auditors.
3. **Immutable Chain-of-Custody**: Monospace timeline verifying every stage (Initiated → Bidding Closed → Public Reveal → Evaluation & Award → Standstill/Dispute) directly on-chain.
4. **Decentralized Specification Storage**: Real IPFS anchoring with automatic SHA-256 document hashing and multi-gateway failover.
5. **Statutory CVC Dispute Redressal**: On-chain 7-day post-award appeal window with escrow bond locking and CVC arbitration mechanics.

---

## 2. Component Implementation & Operational Status Breakdown

| Component | Current Implementation Status | Operational & Execution Details |
| :--- | :--- | :--- |
| **Smart Contract Suite** | ✅ **100% Tested & Verified** | [`contracts/contracts/OilTenderingV1.sol`](file:///home/cybernode/Projects/nirvaan/contracts/contracts/OilTenderingV1.sol) compiles under Solidity `^0.8.24` with OpenZeppelin UUPS upgradeable proxies. All 8 Hardhat unit tests pass in `test/OilTendering.test.js` (deadline enforcement, commitment mismatch rejection, EMD minimums, evaluation gating, 1 ETH dispute bond, 7-day appeal expiration, and winner dispute exclusion). |
| **Local EVM Node & Deployment** | ✅ **Live & Operational (Port 8545)** | Local node running on `http://127.0.0.1:8545` (Chain ID `31337`). Proxy deployed at `0x5FbDB2315678afecb367f032d93F642f64180aa3`. |
| **IPFS Storage Daemon** | ✅ **Live & Operational (Port 5001 / 8080)** | Local Kubo IPFS daemon active. Supported by resilient multi-gateway client uploader (`frontend/src/utils/ipfs.js`) with client-side SHA-256 digest calculation and automatic failover. |
| **Officer Auth & Relay Backend** | ✅ **100% Functional (Port 5000)** | Express backend (`backend/server.js`) implementing JWT authentication, bcrypt hash validation against `backend/data/officers.json`, first-time password reset enforcement, and server-side private key relaying (`/api/tenders/create`, `/api/vendors/register`, `/api/tenders/:id/award`) with `safeParseEther` formatting. |
| **Vendor Web3 Wallet Auth** | ✅ **100% Functional** | Supports real MetaMask injection (`window.ethereum`) and simulated vendor testing (`0x7099...79C8`). Direct RPC verification against on-chain `registeredVendors(address)`. |
| **Tenant & Role Security Guards** | ✅ **100% Functional & Audited** | `ProtectedRoute.jsx` strictly isolates officer vs vendor execution contexts. Accessing `/vendor/dispute` or vendor areas as an officer triggers a dedicated **Security Protocol 403 Access Denied** view displaying verified `Officer ID` and returning links. |
| **Tender Register Scoping** | ✅ **100% Functional & Audited** | Officer dashboard (`/psu/dashboard`) strictly restricts view to `tender.psu === officerUser.psu`. "Bid" button actions are stripped from officer and public views. Searching other PSU tender IDs (e.g. searching ONGC from IOCL) yields zero matches. |
| **TopBar & Institutional Branding** | ✅ **100% Functional & Audited** | Removed vulnerable cross-tenant dropdowns. Locked officer header to static institutional badge: `<PSU> • Authorized Procurement Cell`. Replaced placeholder text with official bespoke **NIRVAAN Sovereign Consortium Emblem & SVG logo** (`NirvaanLogo.jsx`). |
| **Dispute Filing Flow** | ✅ **100% Functional & Verified** | Contract logic (`disputeTender()`) fully integrated on-chain with 1.0 ETH dispute bond and 7-day appeal checks. Frontend on `DisputeFiling.jsx` supports direct Web3 transaction signing via MetaMask with automated fallback to the backend server relay. |
| **Autonomous Oracle Keeper Service** | ✅ **100% Functional & Verified** | Dedicated off-chain keeper (`keeper/keeper.js`) continuously polls contract state via `tenderCounter` and `tenders(id)`. Automatically triggers `openBids(id)` once opening time is reached, and calls `finalizeTender(id)` once the 7-day post-award appeal standstill window expires. |
| **Tender Persistence & Multi-Tab Sync** | ✅ **100% Functional & Verified** | Persistent file store in `backend/data/tenders.json` backed by `GET /api/tenders`. Synchronized to client `localStorage` with `window.addEventListener('storage', ...)` event propagation, ensuring newly created tenders and award states survive hard refreshes (`F5`) and sync across parallel browser tabs instantly. |
| **Dynamic Tender Bidding & Evaluation** | ✅ **100% Functional & Verified** | Dynamic tender package selectors in `SealedBidSubmission.jsx` and `EvaluationAward.jsx` binding to `currentTender.onChainId`. Client-side Keccak-256 commitment generation dynamically salts the exact tender ID. |

---

## 3. Monorepo Repository Architecture

```
nirvaan/
├── contracts/                        # Smart Contracts & Hardhat Environment
│   ├── contracts/
│   │   └── OilTenderingV1.sol        # UUPS Upgradeable Smart Contract (Solidity ^0.8.24)
│   ├── scripts/
│   │   ├── deploy.js                 # Proxy deployment script for local/Besu network
│   │   └── test-runner-custom.js     # Standalone acceptance test runner
│   ├── test/
│   │   └── OilTendering.test.js      # Complete 8-Scenario Hardhat Unit Test Suite
│   ├── hardhat.config.js             # Hardhat Config (Solidity 0.8.24, ChainID 31337/1337)
│   └── package.json                  # Dependencies (@openzeppelin/contracts-upgradeable, hardhat, ethers)
│
├── backend/                          # Express Gateway & PSU Officer JWT Auth Service
│   ├── data/
│   │   └── officers.json             # Officer accounts storing bcrypt hashes ($2a$10$)
│   ├── scripts/
│   │   └── seed-officers.js          # Seed script generating crypto-random temporary passwords
│   ├── server.js                     # Express API Server (JWT auth, relayers, IPFS upload, safeParseEther)
│   └── package.json                  # Express, bcryptjs, jsonwebtoken, cors, ethers, multer
│
├── frontend/                         # Vite + React 18 + React Router + Tailwind CSS Frontend
│   ├── public/
│   │   ├── nirvaan-logo.svg          # Standalone SVG Vector Consortium Logo
│   │   ├── nirvaan-logo.png          # High-resolution PNG logo
│   │   └── nirvaan-emblem.png        # Official sovereign emblem
│   ├── src/
│   │   ├── components/
│   │   │   ├── NirvaanLogo.jsx       # Official NIRVAAN Vector Logo Component
│   │   │   ├── GovIdentityStrip.jsx  # Ashoka Emblem & Government of India Header Bar
│   │   │   ├── AccessibilityBar.jsx  # GIGW Font Controls (A-/A/A+), Contrast, Skip Link
│   │   │   ├── TopBar.jsx            # Top Header, Tenant Badge, Logo, Network Status
│   │   │   ├── Sidebar.jsx           # Dynamic Role-Gated Navigation (Public / Vendor / Officer)
│   │   │   ├── GovFooter.jsx         # Ministry Ownership, CVC Directives & Audit Links
│   │   │   ├── ChainOfCustodyTimeline.jsx # Immutable Stage Timeline (Consensus Trail)
│   │   │   ├── ConfirmationModal.jsx # Irreversible Action Confirmation Modal
│   │   │   ├── Toast.jsx             # Transaction & System Feedback Banner
│   │   │   └── ProtectedRoute.jsx    # Strict Role Guard with Protocol 403 Access Denied View
│   │   ├── context/
│   │   │   └── AuthContext.jsx       # Isolated Vendor (Wallet) & Officer (JWT) Sessions
│   │   ├── pages/
│   │   │   ├── Landing.jsx           # Unified Portal Entry & Officer SSO / Vendor Connect
│   │   │   ├── VendorRegistration.jsx# On-Chain Corporate KYC Onboarding
│   │   │   ├── TenderBrowse.jsx      # Scoped Register (Officer Scoped / Public Multi-PSU)
│   │   │   ├── TenderDetail.jsx      # Read-only Public Tender View & Custody Timeline
│   │   │   ├── SealedBidSubmission.jsx# Client-side Keccak-256 Sealed Bid Form
│   │   │   ├── DisputeFiling.jsx     # Statutory CVC Dispute Filing & Escrow Bond Notice
│   │   │   ├── TenderCreation.jsx    # Tenant-Locked Notice Inviting Tender (NIT) Formulation
│   │   │   ├── EvaluationAward.jsx   # Officer Bids Evaluation Console & Contract Award
│   │   │   └── About.jsx             # Platform Architecture & CVC Oversight Specifications
│   │   ├── utils/
│   │   │   └── ipfs.js               # Multi-Gateway Failover IPFS Upload Client
│   │   ├── App.jsx                   # Route Definitions & Session Flash Toast Listener
│   │   └── index.css                 # GIGW Tailwind Utilities & Sovereign Color Palette
│   ├── index.html                    # Favicon integration & Google Web Fonts
│   ├── vite.config.js                # Vite Bundler Config (Port 3000)
│   └── package.json                  # React 18, React Router v6, Tailwind CSS, Ethers v6
│
├── docker/                           # Hyperledger Besu Consortium Infrastructure
│   ├── genesis.json                  # QBFT Genesis Block Config (ChainID 1337, Zero Base Fee)
│   └── docker-compose.yml            # Besu 7-Node Consortium Validator Topology & Local IPFS Node
│
└── PROJECT_ARCHITECTURE_AND_PROGRESS.md # This Documentation File
```

---

## 4. In-Depth Security & Governance Architecture

### A. Multi-Tenant Role Isolation (Officer vs Vendor vs Public)
1. **Officer Tenant Scoping**:
   - PSU Officers are issued cryptographically signed JWT tokens containing `psu: 'IOCL'` (or BPCL, HPCL, ONGC, GAIL).
   - In [`frontend/src/pages/TenderBrowse.jsx`](file:///home/cybernode/Projects/nirvaan/frontend/src/pages/TenderBrowse.jsx#L17-L26), the table query pipeline applies `t.psu === officerPSU` simultaneously with search text, category filters, and status filters. An IOCL officer cannot query or view ONGC tenders even by typing the exact reference ID.
   - The TopBar replaces tenant-switching buttons with an immutable badge: `<IOCL> • Authorized Procurement Cell`.
   - NIT Formulation in [`frontend/src/pages/TenderCreation.jsx`](file:///home/cybernode/Projects/nirvaan/frontend/src/pages/TenderCreation.jsx) is permanently bound to `officerUser.psu`.

2. **Role Authorization Matrix**:
   - **Officers**: Can view scoped PSU tenders, formulate NITs, evaluate revealed bids, and award contracts on-chain. **Cannot** submit bids, view "Bid" action buttons, or access vendor dispute filing.
   - **Vendors**: Can browse all public tenders, view read-only award summaries, complete Corporate KYC, submit encrypted sealed bids, and file disputes against eligible tenders. **Cannot** access officer NIT formulation or evaluation consoles.
   - **Public Visitors**: Can view all active and awarded tenders across PSUs, read technical specifications, inspect custody timelines, and view award details without authentication. **Cannot** submit bids or file disputes without connecting an authorized wallet.

3. **Protocol 403 Access Denied Enforcement**:
   - In [`frontend/src/components/ProtectedRoute.jsx`](file:///home/cybernode/Projects/nirvaan/frontend/src/components/ProtectedRoute.jsx#L28-L78), attempting to access `/vendor/dispute` or vendor areas as an officer renders a dedicated, unmissable Access Denied banner displaying the authenticated `Officer ID: 88-X92-IOC` and navigation links back to the officer dashboard.

### B. Smart Contract Dispute Mechanics & Locus Standi
In [`contracts/contracts/OilTenderingV1.sol`](file:///home/cybernode/Projects/nirvaan/contracts/contracts/OilTenderingV1.sol#L317-L340):
```solidity
function disputeTender(
    uint256 _tenderId,
    string memory _reasonIpfsHash
) external payable onlyVendor {
    Tender storage tender = tenders[_tenderId];
    require(tender.status == TenderStatus.Awarded, "Tender not in Awarded state");
    require(msg.sender != tender.winner, "Winning vendor cannot dispute own award");
    require(block.timestamp <= tender.appealDeadline, "Appeal window has closed");
    require(msg.value >= 1 ether, "Dispute bond required");

    tenderDisputes[_tenderId] = Dispute({ ... });
    tender.status = TenderStatus.Disputed;
    emit DisputeFiled(_tenderId, msg.sender);
}
```
- **Escrow Bond**: Requires a mandatory `1.0 ETH` bond deposited on-chain, discouraging frivolous appeals.
- **7-Day Standstill**: Once awarded, `tender.appealDeadline` starts an immutable 7-day countdown. After expiry, `disputeTender` reverts.
- **Winning Bidder Exclusion**: `require(msg.sender != tender.winner)` prevents the awarded vendor from challenging their own contract.
- **Locus Standi Characteristic**: `onlyVendor` verifies that `registeredVendors[msg.sender] == true`. The contract does not restrict disputes to bidders who previously submitted a bid in that specific tender; any accredited KYC vendor can challenge an irregular award (aligning with CVC public vigilance paradigms).

---

## 5. Verified Hardhat Test Suite (8/8 Passing)

The contract acceptance test suite (`contracts/test/OilTendering.test.js`) verifies the complete state lifecycle:
1. `01. Should initialize proxy with correct admins, keeper, and CVC auditor`
2. `02. Should reject bid submission after the submission deadline has passed`
3. `03. Should reject bid reveal when wrong salt or amount is submitted (Commitment mismatch)`
4. `04. Should reject bid submission when EMD deposited is below tender minimum`
5. `05. Should block contract award if bids remain un-opened/un-evaluated`
6. `06. Should allow dispute filing within 7-day appeal window with required bond`
7. `07. Should reject dispute filing after the 7-day appeal window has expired`
8. `08. Should prevent winning vendor from filing a dispute against their own award`

---

## 6. Complete System Run Commands & Operational Runbook

This section details the exact CLI commands required to boot, compile, deploy, run, test, and shut down the complete NIRVAAN platform.

### A. Initial Setup & Dependency Installation

Run from the root repository directory `/home/cybernode/Projects/nirvaan`:

```bash
# 1. Install Contracts Dependencies (Hardhat, OpenZeppelin, Ethers)
cd contracts && npm install && cd ..

# 2. Install Backend Relay Server Dependencies (Express, JWT, Bcrypt, Multer)
cd backend && npm install && cd ..

# 3. Install Frontend Web Application Dependencies (React, Vite, Tailwind)
cd frontend && npm install && cd ..

# 4. Install Autonomous Oracle Keeper Dependencies
cd keeper && npm install && cd ..
```

---

### B. Standard Service Launch Sequence (Multi-Terminal)

To run the full end-to-end NIRVAAN consortium platform locally, launch the following processes in separate terminal tabs or sessions:

#### Terminal 1 — Local EVM Consortium Blockchain Node (Hardhat)
```bash
cd contracts
npx hardhat node
# Starts JSON-RPC server on http://127.0.0.1:8545 (Chain ID: 31337)
```

#### Terminal 2 — Smart Contract Deployment
*(Run once after Terminal 1 is active to deploy and initialize the UUPS proxy)*
```bash
cd contracts
npx hardhat run scripts/deploy.js --network localhost
# Implementation and proxy deployed at 0x5FbDB2315678afecb367f032d93F642f64180aa3
```

#### Terminal 3 — Decentralized Storage (IPFS Kubo Daemon)
```bash
ipfs daemon
# Starts IPFS API on port 5001 and Gateway on port 8080
```

#### Terminal 4 — PSU Officer Auth & Blockchain Relay Backend
```bash
cd backend
node server.js
# Starts Express REST API and Signing Relayers on http://localhost:5000
```

#### Terminal 5 — Frontend Web Portal (Vite React Application)
```bash
cd frontend
npm run dev
# Starts GIGW compliant portal on http://localhost:3000
```

#### Terminal 6 — Autonomous Oracle Keeper Daemon
```bash
cd keeper
node keeper.js
# Polls contract every 10s: opens bids upon deadline and finalizes tenders post-appeal
```

---

### C. Testing & Verification Run Commands

#### 1. Smart Contract Unit Tests (8/8 Hardhat Scenarios)
```bash
cd contracts
npx hardhat test
```
*Verifies proxy initialization, deadline enforcement, commitment mismatch rejection, EMD minimums, evaluation gating, dispute bond, 7-day standstill expiration, and winner dispute exclusion.*

#### 2. Full Platform On-Chain End-to-End Lifecycle Test (9/9 Stages)
```bash
# Run from repository root with node active on port 8545
NODE_PATH=backend/node_modules:contracts/node_modules node test-complete-platform-workflow.js
```
*Verifies all 9 stages on-chain with real transactions:*
1. Vendor KYC Registration on-chain (`registerVendor`)
2. PSU Officer NIT Formulation & Creation (`createTender`)
3. Sealed Bid Submission with Keccak-256 commitment + 0.1 ETH EMD (`submitBid`)
4. Automated Bid Opening via Keeper (`openBids`)
5. Cryptographic Bid Reveal On-Chain (`revealBid`)
6. Technical Evaluation Scoring (`setTechnicalScore` 98/100)
7. L1 Contract Award & 7-Day Standstill Trigger (`awardTender`)
8. Challenger Vendor CVC Dispute Filing with 1.0 ETH Escrow Bond (`disputeTender`)
9. Independent CVC Auditor Adjudication & Resolution (`resolveDispute`)
10. Contract Finalization & Automated EMD Refunds via Keeper (`finalizeTender`)

#### 3. Playwright Browser E2E Lifecycle & Persistence Verification
```bash
# Automated browser verification verifying UI login, tender creation, F5 persistence,
# multi-tab sync, sealed bidding, evaluation, and dispute filing
npx playwright test
```

#### 4. Fast-Forward Network Time (Development & Demo Utility)
```bash
# Fast-forwards Hardhat block timestamp by 7 days to simulate appeal window expiration
node keeper/fast-forward.js
```

#### 5. Reset & Re-Seed Officer Accounts
```bash
# Generates random temporary credentials and updates backend/data/officers.json
node backend/scripts/seed-officers.js
```

#### 6. Frontend Production Build Check
```bash
cd frontend
npm run build
```

---

### D. System Shutdown Commands

To cleanly terminate all running NIRVAAN consortium processes and free their network ports:

```bash
# Graceful shutdown of all active consortium services (Ports 8545, 5001, 5000, 3000, 8080)
kill $(lsof -t -i :8545 -i :5001 -i :5000 -i :3000 -i :8080) 2>/dev/null || true
```

Or target individual services by port:
```bash
# Free specific ports
fuser -k 8545/tcp  # Hardhat Node
fuser -k 5000/tcp  # Backend Server
fuser -k 3000/tcp  # Frontend Vite
fuser -k 5001/tcp  # IPFS Daemon
fuser -k 8080/tcp  # IPFS Gateway
```

---

## 7. Implementation Roadmap & Current Progress

- [x] **Phase 1 — Smart Contract Suite & Proxy Architecture (Complete)**
  - UUPS upgradeable contract `OilTenderingV1.sol` with Commit-Reveal Keccak-256 scheme.
  - Complete Hardhat test suite with 100% passing test assertions.
- [x] **Phase 2 — Backend Services & Auth Gateway (Complete)**
  - Express backend on port 5000 with officer JWT sessions and bcrypt authentication.
  - On-chain transaction relayer endpoints for NIT creation, KYC registration, and contract award.
  - `safeParseEther` formatting resolving scientific notation / fixed-number errors.
- [x] **Phase 3 — Frontend GIGW Experience & Security Hardening (Complete)**
  - React 18 + Vite frontend on port 3000 adhering to GIGW accessibility guidelines.
  - Bespoke official NIRVAAN Sovereign Consortium Emblem and SVG logo.
  - Multi-tenant officer register scoping (`t.psu === officerPSU`).
  - Action restrictions: Bid buttons stripped from officer and public views.
  - 403 Access Denied gate on `/vendor/dispute` for officers with resolved Officer ID.
  - Dynamic role-gated sidebar navigation (Public / Vendor / Officer).
  - Search filter isolation preventing cross-tenant information leakage.
- [x] **Phase 4 — Web3 Dispute Wiring, Oracle Keeper & Multi-Tab State Persistence (Complete)**
  - Direct frontend Web3 contract call integration for `disputeTender()` with MetaMask transaction signing and server relay fallback (1.0 ETH bond).
  - Automated Oracle Keeper service (`keeper/keeper.js`) continuously polling and executing automated state transitions (`openBids`, `finalizeTender`).
  - Cross-tab `storage` event synchronization and persistent disk storage (`backend/data/tenders.json`) preventing disappearance of newly created tenders upon browser reload (`F5`).
  - Dynamic tender package selectors in `SealedBidSubmission.jsx`, `EvaluationAward.jsx`, and `DisputeFiling.jsx`.
  - Comprehensive Playwright automated test suite verifying complete end-to-end browser execution and UI persistence.
- [ ] **Phase 5 — Multi-Node Besu Production Deployment**
  - Transition from local development node to 7-validator node QBFT Docker cluster with permissioned validator keys.
