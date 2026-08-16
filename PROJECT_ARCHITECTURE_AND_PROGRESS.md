# PROJECT ARCHITECTURE, IMPLEMENTATION PROGRESS & SYSTEM HANDOVER REPORT
**System Title:** Permissioned Consortium Blockchain E-Tendering Platform for Indian Oil PSUs (IOCL, HPCL, BPCL, ONGC, GAIL)  
**Compliance Standards:** CVC E-Procurement Guidelines 2026, Indian IT Act 2000, GIGW V2.4  
**Date Last Updated:** 16-Aug-2026  

---

## 1. Executive Summary & Overview
Current central e-procurement portals for Indian public sector undertakings (PSUs) are vulnerable to insider bid tampering, timestamp disputes, and single-point-of-failure vulnerabilities. This project implements a permissioned consortium blockchain system leveraging **Hyperledger Besu** with **QBFT Consensus** (7 validator nodes, zero gas pricing) to guarantee cryptographic sealed-bid confidentiality (Commit-Reveal via Keccak-256), immutable chain-of-custody audit trails, IPFS decentralized specification storage, automated Oracle Keeper triggers, and statutory 7-day CVC dispute resolution mechanics.

---

## 2. Monorepo Repository Architecture

```
oil-e-tendering-blockchain/
├── contracts/                        # Smart Contracts & Hardhat Environment
│   ├── contracts/
│   │   └── OilTenderingV1.sol        # UUPS Upgradeable Smart Contract (Solidity ^0.8.24)
│   ├── scripts/
│   │   └── deploy.js                 # Hardhat deployment script for Besu / Local Network
│   ├── test/
│   │   └── OilTendering.test.js      # Hardhat Unit Test Suite (Creation, Bidding, Reveal, Dispute, Award)
│   ├── hardhat.config.js             # Hardhat Config (Solidity 0.8.24, ChainID 1337)
│   └── package.json                  # Dependencies (@openzeppelin/contracts-upgradeable, hardhat, ethers)
│
├── backend/                          # Express Gateway & PSU Officer JWT Auth Service
│   ├── data/
│   │   └── officers.json             # Seeded PSU Officer accounts with bcrypt password hashes
│   ├── scripts/
│   │   └── seed-officers.js          # Admin seed script for officer account generation
│   ├── server.js                     # Express API Server (JWT auth, KYC validation, IPFS proxy)
│   └── package.json                  # Express, bcryptjs, jsonwebtoken, cors
│
├── frontend/                         # Vite + React 18 + React Router + Tailwind CSS Frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── GovIdentityStrip.jsx  # Ashoka Emblem & Government of India Header Bar
│   │   │   ├── AccessibilityBar.jsx  # Font Resizing (A-/A/A+), High Contrast, Skip to Main Content Link
│   │   │   ├── TopBar.jsx            # PSU Entity Selector, Active Wallet / Officer Session Badges
│   │   │   ├── Sidebar.jsx           # Responsive Nav Sidebar (Role-scoped for PSU vs Vendor)
│   │   │   ├── GovFooter.jsx         # Ministry Ownership, Last Updated Date, CVC Portal Links
│   │   │   ├── ChainOfCustodyTimeline.jsx # Monospace Block Timestamp Chain-of-Custody Timeline
│   │   │   ├── ConfirmationModal.jsx # Irreversible Action Confirmation Dialog
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
│   ├── oil_tendering_report.md       # Comprehensive 50-page Technical & Legal Report
│   └── free-stack-implementation-plan.md # 5-Stage Open Source Implementation Guide
│
└── PROJECT_ARCHITECTURE_AND_PROGRESS.md # This File (Context & Handover Persistence)
```

---

## 3. Technology Stack & Key Configurations

| Component | Framework / Tool | Key Parameters |
| :--- | :--- | :--- |
| **Blockchain Network** | Hyperledger Besu | QBFT Consensus, 7 Validator Nodes, Chain ID `1337`, Zero Base Fee (`"zeroBaseFee": true`) |
| **Smart Contracts** | Solidity `^0.8.24` | UUPS Upgradeable Proxy (OpenZeppelin v5), Sealed Commit-Reveal Hashing, Re-entrancy Safe Refunds |
| **Contract Suite** | Hardhat | Compiled: `13 Solidity files`, Tests: `OilTendering.test.js` passing |
| **Backend Gateway** | Express (Node.js) | JWT Authentication (`jsonwebtoken`), Bcrypt Password Hashing (`bcryptjs`), Mock GSTIN/PAN Verification |
| **Frontend Web App** | React 18 + Vite | React Router v6, Tailwind CSS v3 (GIGW Bureaucratic Minimalism, Zero Radius Policy) |
| **Storage Layer** | IPFS | Content Identifier (CID) digest pinning for Tender Specifications & Dossiers |
| **Keeper Service** | Ethers.js v6 | Autonomous Polling Service for automatic deadline transitions (`closeBidding`, `revealBids`) |

---

## 4. Security & Access Control Mechanics

1. **Role Separation Enforcement:**
   - **Vendor Sessions (Wallet-Based):** Wallet address acts as public key identity. Registered state verified against `registerVendor()`. Unregistered wallets are routed to Corporate KYC and blocked from bidding.
   - **PSU Officer Sessions (JWT-Based):** Public sign-up is forbidden. Officer accounts (`iocl_officer`, `bpcl_officer`, `hpcl_officer`, `ongc_officer`, `gail_officer`) are pre-seeded via `backend/scripts/seed-officers.js`. First-time logins require updating default temporary password (`TempOfficerPassword123!`).
   - **Route Guards (`ProtectedRoute.jsx`):** Enforces strict role boundary redirects. Vendors navigating to `/psu/*` or Officers navigating to `/vendor/*` are blocked with explicit access-denied banners.

2. **Sealed-Bid Commit-Reveal Cryptography:**
   - Client-side Keccak-256 Hash Computation: `keccak256(abi.encodePacked(vendorAddress, bidAmount, salt, tenderId))`.
   - Prevents cross-vendor copy attacks and cross-tender replay attacks.
   - Numerical amounts remain strictly sealed until public reveal phase.

---

## 5. System Execution & Startup Commands

### A. Express Authentication Backend
```bash
cd /home/cybernode/Projects/oil-e-tendering-blockchain/backend
npm run seed      # Generates initial officers database (if missing)
npm start         # Starts backend on http://localhost:5000
```

### B. React Vite Frontend Application
```bash
cd /home/cybernode/Projects/oil-e-tendering-blockchain/frontend
npm run dev       # Starts dev server on http://localhost:3000
```

### C. Smart Contract Compilation & Unit Tests
```bash
cd /home/cybernode/Projects/oil-e-tendering-blockchain/contracts
npx hardhat compile
npx hardhat test
```

---

## 6. Project Stage Progress & Next Stage Roadmap

- [x] **Stage 1 (Completed):** Architecture design report, Solidity smart contracts (`OilTenderingV1.sol`), Hardhat unit test suite, Hyperledger Besu QBFT genesis configuration.
- [x] **Stage 2 (Completed):** Express JWT officer auth service, GIGW-compliant React + Vite frontend, wallet connect, sealed-bid Keccak256 commitment generator, strict route guards, and acceptance test scenarios.
- [ ] **Stage 3 (Next Stage - In Progress):** Hyperledger Besu local node container setup (`docker-compose.yml` startup), deployed contract instance link with frontend Ethers.js provider (`OilTenderingV1` contract contract interaction), local IPFS pinning integration.
- [ ] **Stage 4 (Upcoming):** Autonomous Oracle Keeper service integration (`keeper.js`), real-time event indexing with The Graph / Subgraph local node, and CVC dispute arbitration demo.

---

*Note: This file serves as the permanent system documentation. Any future agent session or user prompt can read this file to restore context immediately without system failure.*
