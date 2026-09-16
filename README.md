# NIRVAAN: Sovereign Consortium Blockchain E-Tendering Platform

**National Indelible Record & Verification Architecture for Autonomous Negotiation**

NIRVAAN is an enterprise permissioned blockchain e-procurement platform engineered specifically for Indian Public Sector Undertakings (PSUs) operating under the Ministry of Petroleum & Natural Gas, Government of India—including Indian Oil Corporation Limited (IOCL), Bharat Petroleum Corporation Limited (BPCL), Hindustan Petroleum Corporation Limited (HPCL), Oil and Natural Gas Corporation (ONGC), and Gas Authority of India Limited (GAIL).

The platform is designed in strict compliance with the Central Vigilance Commission (CVC) Procurement Guidelines, Sections 3 and 4 of the Information Technology Act, 2000 (electronic records and digital signatures), and the Guidelines for Indian Government Websites (GIGW).

---

## 1. Architectural Highlights

- **Permissioned Zero-Gas Consortium:** Operates on Hyperledger Besu utilizing the QBFT (Quorum Byzantine Fault Tolerant) consensus protocol across seven authorized validator nodes, enforcing a zero-base-fee gas model (`gasPrice: 0x0`) for zero-cost internal execution.
- **Client-Side Sealed-Bid Cryptography:** Commercial financial bids are salted and hashed client-side before broadcast using Solidity `keccak256(vendorAddress, bidAmount, salt, tenderId)`. Bid amounts remain mathematically confidential until the automated public opening phase.
- **Multi-Tenant Sovereign Isolation:** Rigorous tenant and role boundaries prevent cross-tenant data leakage. Procurement officers are restricted exclusively to tenders issued by their respective PSU, with administrative actions inaccessible to vendors and public visitors.
- **Decentralized Specification Dossiers:** Notice Inviting Tender (NIT) specifications, engineering drawings, and evidentiary dossiers are anchored to the InterPlanetary File System (IPFS) with client-side SHA-256 digest verification and multi-gateway failover.
- **Statutory 7-Day Standstill & Dispute Escrow:** Contract awards automatically trigger an immutable 7-day appeal window. Accredited bidders can lodge formal challenges backed by a mandatory 1.0 ETH on-chain escrow bond, subject to independent CVC auditor review.
- **Enterprise Upgradeability:** Smart contracts adhere to the OpenZeppelin Universal Upgradeable Proxy Standard (UUPS), permitting non-disruptive logic upgrades managed by a multi-signature governance key.

---

## 2. Security & Role Authorization Matrix

| Dimension | PSU Procurement Officer | Commercial Bidder (Vendor) | Public Auditor / Citizen |
| :--- | :--- | :--- | :--- |
| **Authentication** | JWT issued via Express Backend; Bcrypt-hashed credentials | Web3 Wallet (MetaMask / Hardware Wallet); On-chain KYC | Unauthenticated (Public Access) |
| **Tender Scope** | Scoped strictly to logged-in PSU (`tender.psu === officerUser.psu`) | All active tenders across all five PSUs | All active tenders across all five PSUs |
| **Bidding Actions** | Prohibited (Bid actions stripped from all officer views) | Submit sealed bid commitments; reveal bids during opening | Read-only; cannot submit bids |
| **Administrative Actions** | Formulate NITs; evaluate revealed bids; execute contract award | None (Protocol 403 access denied) | None |
| **Dispute Filing** | Blocked via Protocol 403 role guard | File dispute with 1.0 ETH bond within 7-day standstill | None |
| **Award Resolution** | Full Evaluation & Award Console with technical scoring | Read-only public award summary and custody ledger | Read-only public award summary and custody ledger |

---

## 3. Monorepo Repository Structure

```
nirvaan/
├── contracts/                        # Smart Contracts & Testing Suite
│   ├── contracts/
│   │   └── OilTenderingV1.sol        # UUPS Upgradeable Smart Contract (Solidity ^0.8.24)
│   ├── scripts/
│   │   ├── deploy.js                 # Proxy deployment script
│   │   └── test-runner-custom.js     # Standalone acceptance suite runner
│   ├── test/
│   │   └── OilTendering.test.js      # Hardhat unit test suite (8/8 passing)
│   └── hardhat.config.js             # Hardhat network configuration
│
├── backend/                          # Gateway & Authentication Service
│   ├── data/
│   │   └── officers.json             # Seeded officer credential datastore
│   ├── scripts/
│   │   └── seed-officers.js          # Cryptographic credential provisioning utility
│   ├── server.js                     # Express API server (JWT auth, relayers, IPFS upload)
│   └── package.json                  # Backend dependencies
│
├── frontend/                         # GIGW-Compliant User Interface
│   ├── public/
│   │   ├── nirvaan-logo.svg          # Official vector emblem
│   │   └── nirvaan-logo.png          # High-resolution raster asset
│   ├── src/
│   │   ├── components/
│   │   │   ├── NirvaanLogo.jsx       # Official NIRVAAN vector component
│   │   │   ├── GovIdentityStrip.jsx  # Ashoka Emblem & Government of India banner
│   │   │   ├── AccessibilityBar.jsx  # GIGW font and contrast controls
│   │   │   ├── TopBar.jsx            # Header, institutional badge, network telemetry
│   │   │   ├── Sidebar.jsx           # Role-gated navigation hierarchy
│   │   │   ├── ChainOfCustodyTimeline.jsx # Immutable custody audit timeline
│   │   │   ├── ConfirmationModal.jsx # Irreversible transaction confirmation dialog
│   │   │   └── ProtectedRoute.jsx    # Protocol 403 access control & route guard
│   │   ├── context/
│   │   │   └── AuthContext.jsx       # Dual-session provider (Wallet & JWT)
│   │   ├── pages/
│   │   │   ├── Landing.jsx           # Entry portal (PSU login & vendor connect)
│   │   │   ├── VendorRegistration.jsx# Corporate KYC onboarding
│   │   │   ├── TenderBrowse.jsx      # Scoped tender registers with multi-factor search
│   │   │   ├── TenderDetail.jsx      # Read-only specification and custody record
│   │   │   ├── SealedBidSubmission.jsx# Client-side commit-reveal form
│   │   │   ├── DisputeFiling.jsx     # Statutory dispute filing interface
│   │   │   ├── TenderCreation.jsx    # PSU NIT formulation console
│   │   │   └── EvaluationAward.jsx   # Officer bid evaluation and award console
│   │   └── utils/
│   │       └── ipfs.js               # Multi-gateway failover IPFS client
│   └── package.json                  # Frontend dependencies
│
├── keeper/                           # Automated Oracle Keeper Service
│   └── keeper.js                     # Time-triggered state machine transition monitor
│
├── docker/                           # Consortium Node Topology
│   ├── genesis.json                  # QBFT genesis configuration (Chain ID 1337)
│   └── docker-compose.yml            # 7-node validator cluster definition
│
└── PROJECT_ARCHITECTURE_AND_PROGRESS.md # Detailed technical specification report
```

---

## 4. Environment Setup & Execution

### Prerequisites
- Node.js (v18.0.0 or higher)
- npm (v9.0.0 or higher)
- Hardhat / Local EVM compatible runtime
- IPFS Kubo Daemon (v0.20.0 or higher, optional for local uploads)

### Step 1: Smart Contracts & Local Node
```bash
# Navigate to contracts workspace
cd contracts

# Install dependencies
npm install

# Run the complete test suite
npx hardhat test test/OilTendering.test.js

# Launch local EVM node (port 8545)
npx hardhat node

# Deploy UUPS proxy contract (in a separate terminal)
npx hardhat run scripts/deploy.js --network localhost
```

### Step 2: Backend Authentication Gateway
```bash
# Navigate to backend workspace
cd backend

# Install dependencies
npm install

# Seed officer credential store with randomized passwords
npm run seed

# Start API gateway (port 5000)
npm start
```

### Step 3: Frontend Application
```bash
# Navigate to frontend workspace
cd frontend

# Install dependencies
npm install

# Start development server (port 3000)
npm run dev
```

The application will be accessible at `http://localhost:3000`.

---

## 5. Verification & Test Suite Summary

The smart contract suite in [`contracts/test/OilTendering.test.js`](contracts/test/OilTendering.test.js) verifies eight critical operational invariants:

1. **Proxy Initialization:** Correct allocation of admin, keeper, and CVC auditor role designations.
2. **Deadline Enforcement:** Strict rejection of sealed bid submissions following the submission deadline.
3. **Commitment Verification:** Rejection of bid revelations containing invalid amounts or salts.
4. **EMD Enforcement:** Rejection of bid submissions with earnest money deposits below the tender threshold.
5. **Evaluation Gating:** Prohibition of contract award prior to bid opening and qualification review.
6. **Dispute Registration:** Acceptance of valid dispute filings within the 7-day standstill accompanied by a 1.0 ETH bond.
7. **Standstill Expiration:** Rejection of dispute filings submitted after the 7-day statutory appeal window.
8. **Winner Exclusion:** Prohibition against awarded winning bidders disputing their own contract award.

---

## 6. Regulatory & Compliance Standards

- **Information Technology Act, 2000:** Implements digital signatures and hash commitments compliant with Section 3 (Authentication of electronic records) and Section 4 (Legal recognition of electronic records).
- **Central Vigilance Commission (CVC):** Upholds directives regarding public procurement transparency, mandatory tender publicity periods, post-award standstill windows, and independent grievance redressal.
- **Guidelines for Indian Government Websites (GIGW 3.0):** Incorporates high-contrast accessibility toggles, dynamic text resizing (A-/A/A+), skip-to-content navigation landmarks, and standardized institutional identity banners.
