# NIRVAAN: Sovereign Consortium Blockchain E-Tendering Platform

**National Indelible Record & Verification Architecture for Autonomous Negotiation**

NIRVAAN is an enterprise permissioned blockchain e-procurement platform engineered specifically for Indian Public Sector Undertakings (PSUs) operating under the Ministry of Petroleum & Natural Gas, Government of India—including Indian Oil Corporation Limited (IOCL), Bharat Petroleum Corporation Limited (BPCL), Hindustan Petroleum Corporation Limited (HPCL), Oil and Natural Gas Corporation (ONGC), and Gas Authority of India Limited (GAIL).

The platform is designed in strict compliance with the Central Vigilance Commission (CVC) Procurement Guidelines, Sections 3 and 4 of the Information Technology Act, 2000 (electronic records and digital signatures), and the Guidelines for Indian Government Websites (GIGW).

---

## 1. System Architecture Overview

```mermaid
flowchart TD
    subgraph Users["User & Identity Tier"]
        PSU["PSU Procurement Officers<br/>(IOCL / BPCL / HPCL / ONGC / GAIL)"]
        Vendor["Commercial Bidders<br/>(Accredited Suppliers)"]
        Public["Public Auditors & Citizens<br/>(CVC & Transparency Oversight)"]
    end

    subgraph Client["Frontend Layer (Vercel SPA)"]
        UI["NIRVAAN Web Portal<br/>(Vite + React 18 + GIGW)"]
        AuthCtx["AuthContext Provider<br/>(JWT Officer / Web3 Wallet)"]
        CryptoClient["Client-Side Keccak-256 Hasher<br/>(Commit-Reveal Protocol)"]
        IPFSClient["Resilient IPFS Client<br/>(Pinata Gateway)"]
    end

    subgraph Services["Cloud Services (Render Free Web Service)"]
        Express["API Gateway Backend<br/>(Node 22 / JWT & Tenant Isolation)"]
        Indexer["Dynamic Event Indexer<br/>(Block-Range Adaptive Sync)"]
        Keeper["Autonomous Oracle Keeper<br/>(Embedded Time-Triggered Bot)"]
    end

    subgraph Storage["Decentralized Storage"]
        Pinata["Pinata Cloud IPFS<br/>(AES-256 Encrypted Dossiers)"]
    end

    subgraph Blockchain["Decentralized Blockchain (Ethereum Sepolia)"]
        Sepolia["Ethereum Sepolia Testnet<br/>(Chain ID: 11155111 / Proof-of-Stake)"]
        Proxy["ERC-1967 Transparent Proxy<br/>(Configurable Multisig Admin)"]
        Contract["OilTenderingV1 Engine<br/>(On-chain L1, Pull Payments, Standstill)"]
    end

    PSU -->|"JWT Authenticated Session"| UI
    Vendor -->|"Web3 / MetaMask EIP-1193"| UI
    Public -->|"Read-Only Public Ledger"| UI

    UI --> AuthCtx
    UI --> CryptoClient
    UI --> IPFSClient

    AuthCtx --> Express
    IPFSClient --> Pinata
    Express -->|"Server-Signed Relays"| Sepolia

    Keeper -->|"openBids() / finalizeTender()"| Sepolia
    CryptoClient -->|"Sealed Commitments"| Sepolia

    Sepolia --> Proxy
    Proxy --> Contract
```

---

## 2. Tender State Machine Lifecycle

```mermaid
stateDiagram-v2
    [*] --> Created: PSU Officer calls createTender()
    note right of Created: Sealed Bidding Window\nVendors call submitBid()\nwith EMD & Keccak-256 commitment

    Created --> UnderEvaluation: Oracle Keeper calls openBids()\n(block.timestamp >= openingTime)
    note right of UnderEvaluation: Reveal & Evaluation Window\nVendors call revealBid()\nPSU Officer sets technical scores

    UnderEvaluation --> Awarded: PSU Officer calls awardTender()\n(L1 Determination)
    note right of Awarded: Statutory 7-Day Standstill Window\ntender.appealDeadline = block.timestamp + 7 days

    Awarded --> Disputed: Accredited Vendor calls disputeTender()\n(requires 1.0 ETH escrow bond)
    
    state Disputed {
        [*] --> CVCReview
        CVCReview --> Upheld: CVC rules in favor of challenger
        CVCReview --> Dismissed: CVC dismisses dispute
    }

    Upheld --> UnderEvaluation: CVC calls resolveDispute(upheld=true)\n(Tender reopened for re-evaluation)
    Dismissed --> DisputeResolved: CVC calls resolveDispute(upheld=false)\n(Dispute bond forfeited to treasury)

    Awarded --> Finalized: Oracle Keeper calls finalizeTender()\n(block.timestamp > appealDeadline, no dispute)
    DisputeResolved --> Finalized: Oracle Keeper calls finalizeTender()\n(block.timestamp > appealDeadline)

    note right of Finalized: Contract Award Sealed\n_refundLosingBidders() executes\nFull on-chain custody archive

    Finalized --> [*]
```

---

## 3. Architectural Highlights

- **Decentralized Public Testnet Consensus:** Operates on the Ethereum Sepolia network (Chain ID: 11155111) utilizing Proof-of-Stake consensus, ensuring transparent, immutable, and fully verifiable procurement state execution.
- **Client-Side Commit-Reveal Cryptography:** Commercial financial bids are salted and hashed client-side before broadcast using Solidity `keccak256(vendorAddress, bidAmount, salt, tenderId)`. Bid amounts remain mathematically confidential until the automated public opening phase.
- **Multi-Tenant Sovereign Isolation:** Rigorous tenant and role boundaries prevent cross-tenant data leakage. Procurement officers are restricted exclusively to tenders issued by their respective PSU, with administrative actions inaccessible to vendors and public visitors.
- **Decentralized Specification Dossiers:** Notice Inviting Tender (NIT) specifications, engineering drawings, and evidentiary dossiers are anchored to IPFS via Pinata with cryptographic multihashes verified and stored directly on-chain.
- **Statutory 7-Day Standstill & Configurable Dispute Bond:** Contract awards automatically trigger an immutable 7-day appeal window. Accredited bidders can lodge formal challenges backed by a configurable on-chain escrow bond (0.01 ETH on Sepolia to conserve testnet funds), subject to independent CVC auditor review with 14-day timeout protection.
- **On-Chain L1 Enforcement & Pull Payments:** Smart contract guarantees the awarded winner is strictly the lowest qualified bidder (L1) with matching revealed bid parameters. Push transfers in loops are replaced with pull payments (`withdraw()`), protecting against denial-of-service vulnerabilities.
- **Enterprise Upgradeability:** Smart contracts adhere to the OpenZeppelin ERC-1967 Transparent Upgradeable Proxy Standard, permitting non-disruptive logic upgrades managed by a configurable multi-signature governance key.

---

## 4. Security & Role Authorization Matrix

| Dimension | PSU Procurement Officer | Commercial Bidder (Vendor) | Public Auditor / Citizen |
| :--- | :--- | :--- | :--- |
| **Authentication** | JWT issued via Express Backend; Bcrypt-hashed credentials | Web3 Wallet (MetaMask / Hardware Wallet); On-chain KYC | Unauthenticated (Public Access) |
| **Tender Scope** | Scoped strictly to logged-in PSU (`tender.psu === officerUser.psu`) | All active tenders across all five PSUs | All active tenders across all five PSUs |
| **Bidding Actions** | Prohibited (Bid actions stripped from all officer views) | Submit sealed bid commitments; reveal bids during opening | Read-only; cannot submit bids |
| **Administrative Actions** | Formulate NITs; evaluate revealed bids; execute contract award | None (Protocol 403 access denied) | None |
| **Dispute Filing** | Blocked via Protocol 403 role guard | File dispute with bond within 7-day standstill | None |
| **Award Resolution** | Full Evaluation & Award Console with technical scoring | Read-only public award summary and custody ledger | Read-only public award summary and custody ledger |

---

## 5. Monorepo Repository Structure

```
nirvaan/
├── contracts/                        # Smart Contracts & Testing Suite
│   ├── contracts/
│   │   ├── OilTenderingV1.sol        # Upgradeable Smart Contract Engine (Solidity ^0.8.24)
│   │   └── TenderProxy.sol           # ERC1967Proxy Implementation
│   ├── scripts/
│   │   ├── deploy-sepolia.js         # Atomic Sepolia deployment script
│   │   └── deploy.js                 # Proxy deployment script
│   ├── test/
│   │   └── OilTendering.test.js      # Hardhat test suite (13/13 passing)
│   └── hardhat.config.js             # Hardhat network configuration (Sepolia + local)
│
├── backend/                          # Gateway & Authentication Service
│   ├── server.js                     # Express API server (JWT auth, officer relays, Pinata IPFS)
│   ├── indexer.js                    # Adaptive RPC block-range event indexer
│   ├── embeddedKeeper.js             # Autonomous oracle keeper background worker
│   └── package.json                  # Backend dependencies (Node 22)
│
├── frontend/                         # GIGW-Compliant User Interface
│   ├── src/
│   │   ├── components/               # Accessible UI components & navigation
│   │   ├── pages/                    # Role-gated portal views (Officer, Vendor, CVC, Public)
│   │   └── utils/                    # IPFS, cryptographic, and chain helpers
│   └── package.json                  # Frontend dependencies (React 18 + Vite)
│
└── DEPLOYMENT.md                     # Step-by-step free-tier online deployment guide
```

---

## 6. Deployment & Environment Setup

NIRVAAN is production-ready for free-tier online cloud deployment:
- **Smart Contracts**: Ethereum Sepolia Testnet (ERC-1967 Atomic Proxy)
- **Decentralized Storage**: Pinata Cloud IPFS
- **Backend & Autonomous Keeper**: Render Free Web Service (Node 22 with Ephemeral Reconstructable SQLite)
- **Frontend**: Vercel Single Page Application (Vite SPA)

> For full, beginner-friendly instructions, see [DEPLOYMENT.md](DEPLOYMENT.md).

### Local Test Execution

```bash
# Run all test suites across the monorepo:
npm test

# Run smart contract unit tests (13/13 passing):
npm run test:contracts

# Run backend unit tests & KYC workflows:
npm run test:backend

# Run automated deployment smoke test:
npm run test:smoke

# Security secret scanner (verifies 0 private keys committed):
npm run scan:secrets
```

---

## 7. Verification & Test Suite Summary

The smart contract suite in [`contracts/test/OilTendering.test.js`](contracts/test/OilTendering.test.js) verifies 13 critical operational invariants:

1. **Proxy Initialization & Access Control:** ERC1967Proxy deployment with configurable multisig admin and disabled implementation initializers.
2. **Access Control Enforcement:** Strict permission checks across PSU, Vendor, Keeper, CVC, and Admin roles.
3. **Bid Submission & Deadline:** Rejection of bids submitted after the submission deadline or below minimum EMD.
4. **Duplicate Bid Protection:** Prevention of multiple bids from the same vendor on a single tender.
5. **Bid Reveal & Technical Score:** Cryptographic Keccak-256 reveal verification emitting `BidRevealed`.
6. **Reveal Deadline Enforcement:** Rejection of bid revelations submitted after the reveal window closes.
7. **On-Chain L1 Enforcement:** Guarantee that only the lowest qualified bidder (L1) with matching revealed bid can be awarded.
8. **Dispute Ineligibility:** Rejection of disputes from non-bidders, awarded winners, or below dispute bond.
9. **Dispute UPHELD Resolution:** Winner state reset and dispute bond refunded via pull payments.
10. **Dispute DISMISSED Resolution:** Bond forfeited and transferred directly to treasury address.
11. **14-Day CVC Resolution Timeout:** Automated timeout resolution releasing tenders stalled by inactive auditors.
12. **Finalization & Pull Refunds:** Finalization crediting pull payment refunds to all bidders including the winner.
13. **Tender Cancellation:** Safe tender cancellation returning escrowed EMD to bidders via pull payments.

---

## 8. Regulatory & Compliance Standards

- **Information Technology Act, 2000:** Implements digital signatures and hash commitments compliant with Section 3 (Authentication of electronic records) and Section 4 (Legal recognition of electronic records).
- **Central Vigilance Commission (CVC):** Upholds directives regarding public procurement transparency, mandatory tender publicity periods, post-award standstill windows, and independent grievance redressal.
- **Guidelines for Indian Government Websites (GIGW 3.0):** Incorporates high-contrast accessibility toggles, dynamic text resizing (A-/A/A+), skip-to-content navigation landmarks, and standardized institutional identity banners.
