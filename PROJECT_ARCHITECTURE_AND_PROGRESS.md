# PROJECT NIRVAAN — ARCHITECTURE, IMPLEMENTATION PROGRESS & SYSTEM HANDOVER REPORT
**System Title:** NIRVAAN — Permissioned Consortium Blockchain E-Tendering Platform for Indian Oil PSUs (IOCL, HPCL, BPCL, ONGC, GAIL)  
**System Acronym:** **NIRVAAN** (Nationale Indelible Record & Verification Architecture for Autonomous Negotiation)  
**Compliance Standards:** Information Technology Act 2000 (Sections 3 & 4), Guidelines for Indian Government Websites (GIGW)  
**Date Last Updated:** 16-Aug-2026  

---

## 1. Executive Summary & Overview
Current central e-procurement portals for Indian public sector undertakings (PSUs) face risks of insider bid tampering, timestamp disputes, and single-point-of-failure vulnerabilities. **Project NIRVAAN** implements a permissioned consortium blockchain system leveraging **Hyperledger Besu** with **QBFT Consensus** (7 validator nodes, zero gas pricing) to guarantee cryptographic sealed-bid confidentiality (Commit-Reveal via Keccak-256), immutable chain-of-custody audit trails, IPFS decentralized specification storage, automated Oracle Keeper triggers, and statutory 7-day dispute resolution mechanics.

---

## 2. Honest Component Status Breakdown (Stage 2 Audit)

| Component | Current Implementation Status | Honest Execution Details |
| :--- | :--- | :--- |
| **Smart Contract Suite** | ✅ **100% Tested & Verified** | All 8 Hardhat unit tests (`test/OilTendering.test.js`) compile and pass. Validated post-deadline rejection, commitment hash mismatch rejection, EMD minimum enforcement, award prerequisite checks, and 7-day dispute window rules. |
| **Officer Auth Backend** | ✅ **100% Functional (Local Port 5000)** | Real Express JWT authentication service (`backend/server.js`). Validates bcrypt password hashes stored in `backend/data/officers.json`. Generates unique crypto-random temporary passwords per officer during seed script execution. Enforces mandatory password update on first login. |
| **Vendor Wallet Auth** | ✅ **Functional Mock / Web3 Interface** | Simulates MetaMask wallet connection (`0xfe3b...bd73`) and checks registration state against `registeredVendors`. |
| **Route Guards** | ✅ **100% Functional** | `ProtectedRoute.jsx` blocks vendor sessions from `/psu/*` routes and PSU sessions from `/vendor/*` routes, redirecting with explicit access-denied toasts. |
| **UI Components** | ✅ **100% Functional (Local Port 3000)** | Built with React 18, React Router v6, and Tailwind CSS. Implements GIGW accessibility bar (font +/- controls, high contrast, working skip link), national emblem strip, sealed-bid commitment hash calculator, chain-of-custody timeline, and double-click confirmation modals. |
| **Backend Transaction Signing** | ⏳ **Pending Stage 3 Build** | Officer JWT login issues authenticated API sessions. Server-side private key signing relayer for smart contract transactions will be connected in Stage 3 when local Besu RPC node (`http://localhost:8545`) is launched. |
| **Local Besu Node & IPFS** | ⏳ **Pending Stage 3 Build** | Docker topology configured (`docker/docker-compose.yml` & `genesis.json`). Container network spin-up scheduled for Stage 3. |

---

## 3. Monorepo Repository Architecture

```
nirvaan/
├── contracts/                        # Smart Contracts & Hardhat Environment
│   ├── contracts/
│   │   └── OilTenderingV1.sol        # UUPS Upgradeable Smart Contract (Solidity ^0.8.24)
│   ├── scripts/
│   │   ├── test-runner-custom.js     # Hardhat execution script for acceptance suite
│   │   └── deploy.js                 # Hardhat deployment script for Besu / Local Network
│   ├── test/
│   │   └── OilTendering.test.js      # Complete 8-Scenario Hardhat Unit Test Suite
│   ├── hardhat.config.js             # Hardhat Config (Solidity 0.8.24, ChainID 1337)
│   └── package.json                  # Dependencies (@openzeppelin/contracts-upgradeable, hardhat, ethers)
│
├── backend/                          # Express Gateway & PSU Officer JWT Auth Service
│   ├── data/
│   │   └── officers.json             # Seeded officer accounts storing bcrypt hashes ($2a$10$)
│   ├── scripts/
│   │   └── seed-officers.js          # Seed script generating crypto-random temporary passwords
│   ├── server.js                     # Express API Server (JWT auth, password change, /api/auth/me)
│   └── package.json                  # Express, bcryptjs, jsonwebtoken, cors
│
├── frontend/                         # Vite + React 18 + React Router + Tailwind CSS Frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── GovIdentityStrip.jsx  # Ashoka Emblem & Government of India Header Bar
│   │   │   ├── AccessibilityBar.jsx  # Font Resizing (A-/A/A+), High Contrast, Skip to Main Content Link
│   │   │   ├── TopBar.jsx            # NIRVAAN Logo, PSU Entity Selector, Active Session Badges
│   │   │   ├── Sidebar.jsx           # Responsive Nav Sidebar (Role-scoped for PSU vs Vendor)
│   │   │   ├── GovFooter.jsx         # Ministry Ownership, Last Updated Date, Vigilance Portal Links
│   │   │   ├── ChainOfCustodyTimeline.jsx # Monospace Block Timestamp Chain-of-Custody Timeline
│   │   │   ├── ConfirmationModal.jsx # Irreversible Action Confirmation Dialog with Pending Banner
│   │   │   ├── Toast.jsx             # Factual Transaction Feedback Banner
│   │   │   └── ProtectedRoute.jsx    # Strict Role Guard & KYC Verification Enforcer
│   │   ├── context/
│   │   │   └── AuthContext.jsx       # Vendor (Wallet-Based) & PSU Officer (JWT-Based) Sessions
│   │   ├── pages/
│   │   │   ├── Landing.jsx           # Entry Point (PSU SSO Login vs Vendor Wallet Connect)
│   │   │   ├── VendorRegistration.jsx # Contract registerVendor() KYC Onboarding
│   │   │   ├── TenderBrowse.jsx      # Dense Ledger Table of Active Tenders & Countdown Timers
│   │   │   ├── TenderDetail.jsx      # Detailed Tender View featuring Chain-of-Custody Timeline
│   │   │   ├── SealedBidSubmission.jsx # Live Client-Side Keccak-256 Hash Generator & Salt Warning
│   │   │   ├── DisputeFiling.jsx     # Contract disputeTender() Appeal Form & Escrow Bond Display
│   │   │   ├── TenderCreation.jsx    # PSU Notice Inviting Tender (NIT) Formulation & IPFS CID
│   │   │   └── EvaluationAward.jsx   # Revealed Bids Table, Tech Qualification Toggle & Award
│   │   ├── App.jsx                   # React Router Path Routing & Protected Views
│   │   ├── main.jsx                  # React Entry Point & BrowserRouter
│   │   └── index.css                 # GIGW Tailwind Custom Utilities & Focus Outlines
│   ├── tailwind.config.cjs           # GIGW Theme Palette (#1C1F26, #F2EFE9, #B5541A, #3D5A73, #C99A3E)
│   ├── postcss.config.cjs            # PostCSS Autoprefixer & Tailwind Plugins
│   ├── vite.config.js                # Vite Bundler Setup (Port 3000)
│   └── package.json                  # React 18, React Router v6, Tailwind CSS, Ethers v6
│
├── keeper/                           # Autonomous Oracle Keeper Polling Service
│   ├── keeper.js                     # Automated deadline monitor & state transition trigger
│   └── package.json                  # Ethers v6 & Node-cron dependencies
│
├── docker/                           # Hyperledger Besu Consortium Infrastructure
│   ├── genesis.json                  # QBFT Genesis Block Config (ChainID 1337, Zero Base Fee)
│   └── docker-compose.yml            # Besu 7-Node Consortium Validator Topology & Local IPFS Node
│
├── docs/                             # System Architecture Reports & Stage Roadmap
│   └── free-stack-implementation-plan.md # 5-Stage Open Source Implementation Guide
│
└── PROJECT_ARCHITECTURE_AND_PROGRESS.md # This File (Context & Handover Persistence)
```

---

## 4. Technology Stack & Key Configurations

| Component | Framework / Tool | Key Parameters |
| :--- | :--- | :--- |
| **Blockchain Network** | Hyperledger Besu | QBFT Consensus, 7 Validator Nodes, Chain ID `1337`, Zero Base Fee (`"zeroBaseFee": true`) |
| **Smart Contracts** | Solidity `^0.8.24` | UUPS Upgradeable Proxy (OpenZeppelin v5), Sealed Commit-Reveal Hashing, Re-entrancy Safe Refunds |
| **Contract Suite** | Hardhat | Compiled: `13 Solidity files`, Tests: `OilTendering.test.js` (8/8 scenarios passing) |
| **Backend Gateway** | Express (Node.js) | JWT Authentication (`jsonwebtoken`), Bcrypt Password Hashing (`bcryptjs`), Port `5000` |
| **Frontend Web App** | React 18 + Vite | React Router v6, Tailwind CSS v3 (Zero Radius Policy, Hairline Borders, Port `3000`) |
| **Storage Layer** | IPFS | Content Identifier (CID) digest pinning for Tender Specifications & Dossiers |
| **Keeper Service** | Ethers.js v6 | Autonomous Polling Service for automatic deadline transitions (`closeBidding`, `revealBids`) |

---

## 5. System Execution Commands

### A. Seed Officer Database (Generates Random Temp Passwords)
```bash
cd /home/cybernode/Projects/nirvaan/backend
npm run seed
```

### B. Express Authentication Backend
```bash
cd /home/cybernode/Projects/nirvaan/backend
npm start         # Runs backend on http://localhost:5000
```

### C. React Vite Frontend Application
```bash
cd /home/cybernode/Projects/nirvaan/frontend
npm run dev       # Runs dev server on http://localhost:3000
```

### D. Smart Contract Compilation & Unit Test Suite
```bash
cd /home/cybernode/Projects/nirvaan/contracts
npx hardhat test
```

---

## 6. Stage Roadmap

- [x] **Stage 1 (Completed):** Smart contracts (`OilTenderingV1.sol`), Hardhat unit tests, Hyperledger Besu QBFT genesis configuration.
- [x] **Stage 2 (Completed & Audited):** Express JWT officer auth service, NIRVAAN GIGW-compliant React + Vite frontend, wallet connect, sealed-bid Keccak256 commitment generator, strict route guards, and 8 acceptance test scenarios.
- [ ] **Stage 3 (Next Stage):** Hyperledger Besu local node container startup (`docker-compose.yml`), contract deployment to local chain, Ethers.js transaction relayer integration for server-signed officer transactions, local IPFS gateway integration.
- [ ] **Stage 4 (Upcoming):** Autonomous Oracle Keeper service (`keeper.js`), real-time event indexing, CVC dispute arbitration demo.

---

*Note: This document provides an empirical, verified status report of the NIRVAAN codebase.*
