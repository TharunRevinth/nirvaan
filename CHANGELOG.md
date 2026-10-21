# NIRVAAN Engineering Changelog

This document chronicles all architectural, security, smart contract, backend persistence, autonomous keeper, frontend, and infrastructure fixes across all six project phases.

---

## Phase 1 — Security Hardening (`backend/server.js`, `frontend`)

1. **Elimination of Hardcoded Private Keys & Wallets**:
   - Removed backend hardcoded deployer/officer private key and server dispute relay key from `backend/server.js`.
   - Backend now mandates `OFFICER_PRIVATE_KEY` in environment variables; fails fast on startup if missing.
   - Removed client-side fallback private keys and default wallets from `frontend/src/pages/SealedBidSubmission.jsx` and `frontend/src/pages/VendorRegistration.jsx`.

2. **Removal of Password Backdoors & Strict JWT Configuration**:
   - Purged all universal password backdoors (`Nirvaan2026!`, `admin123`, and per-PSU defaults) from authentication routines.
   - Mandated `JWT_SECRET` from environment; backend halts immediately on startup if missing.
   - Authentication is strictly backed by salted bcrypt hashes (`bcrypt.compare`).
   - Integrated `helmet` for secure HTTP headers.
   - Integrated `express-rate-limit` for global API endpoints (100 req/15min) and strict authentication rate limiting (10 req/15min) against brute force attacks.
   - Restricted CORS headers exclusively to explicit origin whitelists configured in `ALLOWED_ORIGINS`.

3. **Dispute Relay Deletion & Vendor Self-Signing**:
   - Completely deleted the server-side dispute relay endpoint (`POST /api/tenders/:id/dispute`) and removed `privateKey` body parameter acceptance.
   - Disputes must be signed and broadcast on-chain directly by the vendor's own authorized Web3 wallet along with the 1.0 ETH statutory escrow bond.
   - Removed all fallback relay code from `frontend/src/pages/DisputeFiling.jsx`.

4. **Endpoint Access Control & File Validation**:
   - Protected `POST /api/vendors/register` with mandatory PSU officer / admin JWT authentication (`authenticateOfficer`).
   - Protected `POST /api/ipfs/upload` with JWT authentication, a strict 15 MB payload limit, and MIME/file-extension whitelisting (`.pdf`, `.json`, `.zip`, `.png`, `.jpg`).

5. **Path Traversal Remediation in IPFS Gateway**:
   - Fixed directory traversal vulnerability in `GET /api/ipfs/:cid`: validated CIDs against strict Base58/Base32 regex, resolved target paths using `path.resolve`, and verified that the target path remains inside `uploadsDir`.
   - Removed loopback redirect (`127.0.0.1:8080`) that leaked internal server architecture.

6. **Tenant Isolation & Tender Creation Integrity**:
   - Enforced PSU tenant isolation on `/api/tenders/:id/award` and officer actions (`tender.psu === req.officer.psu`).
   - Replaced client-supplied tender identifiers in `/api/tenders/create` with sequential server-minted IDs (`TND-26-XXXXX`).

7. **Single-Use Password Change Token**:
   - Enforced single-use consumption of temporary tokens on `/api/auth/change-password` using an in-memory tracking set (`usedTempTokens`), preventing replay attacks.

---

## Phase 2 — Smart Contract Architecture (`contracts/`)

1. **ERC-1967 Atomic Proxy Deployment & Multisig Governance**:
   - Upgraded `OilTenderingV1.sol` and created `TenderProxy.sol` to enforce atomic initialization with `ERC1967Proxy`.
   - Added `_disableInitializers()` in the implementation contract constructor.
   - Refactored `contracts/scripts/deploy.js` to initialize the contract atomically in a single transaction.
   - Replaced default deployer admin with configurable multisig address (`ADMIN_MULTISIG_ADDRESS`) from environment.

2. **On-Chain L1 Enforcement & Award Validation**:
   - `awardTender` enforces:
     - Winner is an active bidder on the tender.
     - Winner's bid is in `Opened` state and technical score meets or exceeds qualifying threshold (score $\ge 70$).
     - Declared winning amount matches the revealed unsealed bid amount exactly.
     - At least one valid bid was submitted.
     - Winner is strictly the lowest qualified bidder (L1) on-chain; higher bids revert.

3. **Reveal Window & Deadline Enforcement**:
   - Added `revealDeadline` to tender initialization.
   - Enforced that unrevealed bids after `revealDeadline` are automatically marked `Rejected` and their EMD forfeited during evaluation, preventing malicious vendors from indefinitely blocking tender awards.

4. **Pull Payments Architecture (`withdraw()`)**:
   - Replaced vulnerable push-transfer loops (`.transfer` in a loop) with pull payments (`pendingWithdrawals` mapping and `withdraw()` function).
   - Winning vendor's EMD is credited for pull withdrawal upon finalization or cancellation.
   - Forfeited dispute bonds from dismissed appeals are credited directly to `treasuryAddress`.

5. **Dispute Lifecycle & CVC Timeout**:
   - Enforced that only vendors who submitted a bid on the tender can file a dispute; winner cannot dispute own award.
   - Added a 14-day statutory CVC resolution timeout (`resolveDisputeTimeout`) allowing anyone to trigger auto-finalization if CVC fails to act.
   - When a dispute is upheld, winner state is reset, reverting the tender to `UnderEvaluation` for re-evaluation.
   - Preserved complete dispute audit history in `tenderDisputeHistory` mapping rather than overwriting state.

6. **Duplicate Bid Protection, Cancellation & Events**:
   - Blocked duplicate bids per vendor per tender via `hasBid` mapping.
   - Added `cancelTender` function with automated pull-payment refund credits for all depositors.
   - Added `BidRevealed` and `TechnicalScoreSet` events.

7. **Hardhat Configuration & Test Suite**:
   - Set EVM target to `paris` in `hardhat.config.js`.
   - Added environment-driven network accounts and chain ID configuration.
   - Created comprehensive 13-test suite in `contracts/test/OilTendering.test.js` covering proxy initialization, access control, bid deadlines, duplicate blocking, reveal window, L1 award enforcement, dispute upheld/dismissed, CVC timeouts, pull withdrawals, and cancellation.

---

## Phase 3 — Backend Logic & Persistence (`backend/`)

1. **Standardized Monetary Convention**:
   - Defined canonical unit convention: Wei (`1 ETH = 10^18 wei`).
   - Completely eliminated magic remapping (`safeParseEther` mapping `> 50 -> 0.1 ETH`).
   - Ensured exact consistency between on-chain contract values and backend API representations.

2. **Explicit UTC ISO-8601 Timestamps & Block Timestamp Standstill**:
   - Standardized all tender deadlines to UTC ISO-8601 format with explicit timezone offsets (`toUtcIso`).
   - Replaced local system clocks (`Date.now()`) for appeal windows with on-chain block timestamps queried from the provider (`block.timestamp + 7 * 86400`).

3. **Persistent SQLite Database & Blockchain Event Indexer**:
   - Replaced flat JSON files (`tenders.json`, `officers.json`) with persistent SQLite WAL database via Node built-in `node:sqlite` (`backend/db.js`).
   - Implemented real-time and startup event indexer (`backend/indexer.js`) that indexes smart contract events (`TenderCreated`, `BidRevealed`, `TenderAwarded`, `DisputeFiled`, `DisputeResolved`, `TenderFinalized`, `TenderCancelled`) into SQLite as the source of truth.

4. **Numeric Tender Identifier Validation**:
   - Enforced strict integer regex validation (`/^\d+$/`) across all tender route parameters (`/api/tenders/:id/*`).
   - Removed all `|| 1` fallbacks and invalid defaults across backend routes.

5. **IPFS Verification & Client-Side Bid Document Encryption**:
   - Updated IPFS handler to verify physical CID storage before tender metadata anchoring.
   - Created client-side AES-256-GCM encryption utility (`frontend/src/utils/crypto.js`) to encrypt technical bid documents prior to IPFS upload.

---

## Phase 4 — Autonomous Keeper Bot (`keeper/`)

1. **Dynamic Gas Estimation**:
   - Removed hardcoded `gasLimit: 350000`.
   - Integrated dynamic `estimateGas` with a 20% safety margin buffer (`gasLimit * 120n / 100n`).

2. **Event Cursor State Tracking**:
   - Replaced 1..N full tender polling loop with an event-driven cursor (`syncEventCursor`) tracking active tenders dynamically from blockchain logs.

3. **Exponential Backoff & Resilience**:
   - Added exponential backoff retry wrapper (`executeWithRetry`) for contract calls and transaction mining.

4. **Health Check & Alerting Subsystem**:
   - Added HTTP REST health server on port 5050 exposing `/health` (sync status, block number, active tenders count) and `/alerts` endpoints.
   - Created `keeper/.env.example`.

---

## Phase 5 — Frontend Modernization (`frontend/`)

1. **Environment Configuration & Localhost Elimination**:
   - Moved all hosts, RPC URLs, contract addresses, and chain IDs into `VITE_*` environment variables (`frontend/src/config.js`, `frontend/.env`, `frontend/.env.example`).
   - Removed every hardcoded instance of `localhost`, `127.0.0.1`, `0x5FbD`, and dev wallet addresses.

2. **Real Contract Integration in Evaluation & Award**:
   - Rebuilt `EvaluationAward.jsx` to fetch real bid data on-chain using contract getters.
   - Replaced mock UI bids and static strings ("7/7 Nodes", "06 Days Remaining") with live on-chain bid counts, technical scores, and actual L1 calculation.
   - Integrated on-chain `setTechnicalScore` and `awardTender` calls.

3. **New Vendor & Governance User Interfaces**:
   - Created `VendorReveal.jsx` (`/vendor/reveal`): allows vendors to reveal bids on-chain with JSON cryptographic receipt upload during the evaluation stage.
   - Created `CVCResolution.jsx` (`/cvc/disputes`): provides CVC vigilance officers with an on-chain interface to review evidence and uphold or dismiss disputes.
   - Created `Withdraw.jsx` (`/vendor/withdraw`): allows bidders to view claimable pull-payment balances and invoke `withdraw()`.

4. **Cryptographic Salt Management & Receipt Generation**:
   - Rebuilt `SealedBidSubmission.jsx` to generate 32-byte salts via `window.crypto.getRandomValues`.
   - Removed 31-character truncation bug and removed all prefilled amounts/salts.
   - Implemented mandatory download of the "Cryptographic Salt Receipt" before enabling bid submission.
   - Integrated client-side AES-256-GCM encryption for tender document attachments.

5. **State Integrity & Network Protection**:
   - Removed `DEFAULT_TENDERS` mock array and `localStorage` tender cache from `App.jsx`. Tenders load directly from canonical API/chain.
   - Removed local storage trust for KYC verification; KYC status is validated on-chain via smart contract.
   - Created `ensureCorrectChain` utility (`frontend/src/utils/chain.js`) verifying `chainId` before every transaction and requesting automatic network switching if mismatched.
   - Deleted unused Next.js legacy files (`frontend/app`, `frontend/next.config.mjs`).

---

## Phase 6 — Infrastructure & CI/CD (`docker/`, `.github/`)

1. **Docker Compose Hardening**:
   - Pinned Docker image tags: `hyperledger/besu:24.1.0` and `ipfs/kubo:v0.26.0` (removed unbounded `:latest`).
   - Added persistent named Docker volumes (`besu-data` and `ipfs-data`).
   - Restricted IPFS API port binding to `127.0.0.1:5001:5001` to prevent public API exposure while leaving gateway port `8080` accessible.
   - Matched consortium chain ID (`1337`) across genesis, Docker compose, backend, keeper, and frontend configurations.

2. **Besu Validator Key Alignment & Account Pre-funding**:
   - Created `docker/key` containing the private key for genesis validator `0xfe3b557e8fb62b89f4916b721be55ceb828dbd73` and mounted it via `--node-private-key-file=/opt/besu/key`.
   - Updated `docker/genesis.json` alloc table to pre-fund all required testing and development accounts (Deployer, PSU Officers, Vendors 1–3, Keeper Bot, CVC Auditor, Admin Multisig, and Treasury) with native balances.

3. **Git Configuration & Environment Templates**:
   - Fixed `.gitignore` to allow tracking of documentation (`*.md`) and assets (`*.png`), while properly ignoring local databases and caches.
   - Created `.env.example` templates for all repository components (`contracts/.env.example`, `backend/.env.example`, `keeper/.env.example`, `frontend/.env.example`, `docker/.env.example`, and root `.env.example`).

4. **Continuous Integration (CI) Workflow**:
   - Created `.github/workflows/ci.yml` running:
     - Smart contract automated test suite (`cd contracts && npx hardhat test`).
     - Backend syntax and lint check (`cd backend && npm run lint`).
     - Frontend production build (`cd frontend && npm run build`).

---

## Online Free-Tier Deployment Adaptations (Vercel, Render, Sepolia, Pinata)

### Phase 1 — Smart Contract for Testnet (`contracts/`)
- **Configurable Testnet Parameters**: Added `disputeBondAmount` and `defaultMinEMD` state variables to `OilTenderingV1.sol`, configured at deployment/initialize time via environment variables (`DISPUTE_BOND_ETH` defaulting to `0.01 ETH` on Sepolia instead of `1 ETH` to preserve scarce faucet ETH; `DEFAULT_MIN_EMD_ETH` defaulting to `0.001 ETH`).
- **Governance Setters**: Added `setDisputeBondAmount` and `setDefaultMinEMD` restricted to `onlyAdmin`.
- **Deploy Script (`scripts/deploy-sepolia.js`)**: Deploys implementation and `ERC1967Proxy` with initializer atomically in one transaction using addresses from environment (`ADMIN_MULTISIG_ADDRESS`, `KEEPER_ADDRESS`, `CVC_AUDITOR_ADDRESS`, `TREASURY_ADDRESS`), verifies on-chain state post-deploy, writes deployment addresses and block to `contracts/deploy/addresses.json`, and supports optional automated Etherscan verification.
- **Hardhat Network Config**: Added `sepolia` network configuration using `SEPOLIA_RPC_URL` and `DEPLOYER_PRIVATE_KEY` with chain ID `11155111`. Added Etherscan API key config. Removed Besu from the deploy path (kept strictly for local dev).
- **Test Suite Updates**: Updated all contract tests in `test/OilTendering.test.js` to verify deployment with `0.01 ETH` dispute bond and pull refunds (13/13 passing).

### Phase 2 — IPFS via Pinata (`backend/`, `frontend/`)
- **Pinata Pinning**: Replaced local Kubo daemon and uploads in `backend/server.js` with direct Pinata IPFS pinning (`POST /api/ipfs/upload`) using `PINATA_JWT`.
- **Pinata Gateway Retrieval**: Updated `GET /api/ipfs/:cid` to fetch requested documents from the Pinata IPFS gateway (`https://gateway.pinata.cloud/ipfs/:cid`) with local streaming cache.
- **Strict Verification**: Retained officer/vendor authentication, 15 MB file size limit, and MIME whitelist. Enforced that no unpinned CID can ever be anchored to smart contract tenders or bids.
- **Frontend Pinning Enforcement**: Updated `frontend/src/utils/ipfs.js` to upload solely through the authenticated backend Pinata relay, rejecting unanchored/unpinned client generation.

### Phase 3 — Free-Tier Backend & Keeper on Render (`backend/`, `render.yaml`)
- **Single Free Web Service Target**: Targeted Render's free tier (no persistent disk, no background workers) with Node.js 22 (`engine` specification in `package.json`).
- **Ephemeral Reconstructable SQLite**: Configured SQLite DB path to `/tmp/nirvaan.db`. On startup boot, runs migrations, seeds initial PSU officers from `OFFICER_SEED_JSON` / `SEED_*` variables (or generates initial random credentials printed once to console), and executes the indexer from `DEPLOY_BLOCK` to the latest block in batches before serving HTTP traffic.
- **Embedded Autonomous Keeper**: Runs the keeper loop directly inside the backend process (single service) after initial indexing finishes. Features dynamic gas estimation (20% margin), exponential backoff retries, and event-cursor tracking on a 20-second poll interval.
- **Reduced RPC Utilization**: Polls no faster than every 20 seconds, batches `getLogs` in ranges of 500 blocks with exponential backoff on 429 rate limit responses, and caches `latestBlock` (15s TTL).
- **Observability Endpoint (`/api/health`)**: Exposes health endpoint reporting `indexerLag` and `keeper` status for external uptime monitors.
- **Reverse Proxy Support**: Configured `app.set('trust proxy', 1)` and CORS restrictions to `ALLOWED_ORIGINS`.
- **Render Infrastructure as Code**: Added `render.yaml` defining the single free web service with all environment variables listed and secured.

### Phase 4 — Frontend on Vercel (`frontend/`, `vercel.json`)
- **SPA Rewrites**: Added `vercel.json` (and `frontend/vercel.json`) with client-side SPA routing rewrites to `/index.html`.
- **Sepolia Network Configuration**: Configured `VITE_CHAIN_ID=11155111` and `VITE_RPC_URL=https://rpc.sepolia.org` in `config.js` and `.env.example`.
- **Wallet Network Switching**: Updated `ensureCorrectChain` and `AuthContext.jsx` to switch/prompt `wallet_addEthereumChain` directly for the Ethereum Sepolia Testnet with block explorer parameters.
- **Mixed Content & Localhost Audit**: Verified zero remaining instances of `localhost` or insecure `http://` URLs in frontend source code.

### Phase 5 — Documentation, Checks & Verification
- **Beginner Deployment Guide (`DEPLOYMENT.md`)**: Created comprehensive numbered deployment guide covering Sepolia contract deployment, Render backend setup, Vercel frontend build, UptimeRobot 5-minute health monitoring (preventing free-tier spin-down and documenting 60s cold starts), and environment variable configurations.
- **End-to-End Smoke Test (`scripts/smoke-test.js`)**: Created automated test suite verifying:
  - Rejection of unauthenticated `/api/vendors/register` (401).
  - Rejection of unauthenticated `/api/ipfs/upload` (401).
  - `/api/health` status, indexer lag, and keeper health reporting.
  - Officer initial login, temp token issuance, password reset, and replay rejection.
  - Officer-authenticated vendor KYC registration.
  - Tender creation with sequential ID issuance.
  - Sealed bid commitment submission.
  - Cryptographic bid reveal verification.
  - Technical score assignment and L1 award determination.
- **Secret & Key Leak Scanner (`scripts/scan-secrets.js`)**: Created automated security script scanning all git-tracked working tree files for 64-hexadecimal private key assignments. Verified 0 keys detected.
- **CI Pipeline**: Updated `.github/workflows/ci.yml` to automatically execute smart contract tests, backend linting, frontend production build, secret scanning, and smoke tests on every push.

---

## Vendor KYC Apply-Then-Approve Workflow (`backend/`, `frontend/`)

1. **Decoupled Apply-Then-Approve Backend Architecture**:
   - `POST /api/vendors/apply`: Public, rate-limited (`applyLimiter`) endpoint accepting wallet address, company name, GSTIN, PAN, and optional IPFS incorporation certificate CID. Enforces strict input validation, rejects invalid addresses and duplicate applications, and records status as `PENDING`.
   - `GET /api/vendors/applications`: Officer-only (`authenticateAdminOrOfficer`) endpoint listing all vendor applications with optional status filtering (`?status=PENDING`).
   - `POST /api/vendors/applications/:id/approve`: Officer-only endpoint executing on-chain smart contract registration via `contractInstance.registerVendor(...)` and marking status `APPROVED` with the mined transaction hash.
   - `POST /api/vendors/applications/:id/reject`: Officer-only endpoint recording application rejection with formal reason.
   - `GET /api/vendors/status/:address`: Public endpoint returning statutory verification status (`NONE`, `PENDING`, `APPROVED`, or `REJECTED`), querying the on-chain `registeredVendors` mapping first to guarantee source-of-truth accuracy.
   - **Ephemeral Database Rebuild on Boot**: Updated `backend/indexer.js` to index `VendorRegistered` events from `DEPLOY_BLOCK`, automatically restoring all approved vendors into SQLite on boot. Documented the operational limitation that unapproved `PENDING` applications may be cleared on cold instance reboot.
   - Preserved `POST /api/vendors/register` for direct officer registration while syncing the internal application registry.

2. **Frontend Vendor Onboarding & Officer Approval UI**:
   - `VendorRegistration.jsx`: Rewritten to query `/api/vendors/status/:address` on load and display appropriate status states:
     - `APPROVED`: Displays verified corporate credentials, on-chain badge, and direct call-to-action to browse active tenders.
     - `PENDING`: Displays review card with application ID, submission timestamp, and status refresh button.
     - `REJECTED`: Displays rejection notice with reason and option to re-apply.
     - `NONE`: Renders the KYC submission form, posting to `/api/vendors/apply` without requiring an officer JWT.
   - `OfficerVendorApproval.jsx` (`/officer/vendors`, `/psu/vendors`): Created dedicated portal for PSU Nodal Officers to review corporate submissions, view pinned incorporation certificates via IPFS, and execute on-chain smart contract approval or rejection.
   - `Sidebar.jsx`: Integrated "Vendor KYC Approvals" navigation item visible strictly to authenticated PSU Officers.

3. **Automated Verification**:
   - Added `backend/test/vendor.test.js` (6 unit tests) covering schema creation, duplicate constraints, approval/rejection state transitions, boot-time event rebuild, and Indian GSTIN/PAN regex validation.
   - Expanded end-to-end smoke test suite in `scripts/smoke-test.js` to 34 tests, verifying public apply -> status PENDING -> officer review -> on-chain approval -> status APPROVED.

---

## Tender Creation Form & Monetary Amount Validation (`backend/`, `frontend/`)

1. **EMD & Monetary Bounds Enforcement (`backend/server.js`)**:
   - Refactored `parseEtherAmount(val, fieldName)`: completely removed the "integer > 1e12 means wei" heuristic and silent defaults.
   - Strictly enforces ETH decimal string inputs (e.g. `"0.001"`).
   - Rejects missing, empty, or non-numeric inputs with clear 400 Bad Request responses.
   - Enforces configurable `MAX_EMD_ETH` (default 1) and minimum 0.0001 ETH, returning descriptive error messages: `"EMD must be between 0.0001 and 1 ETH on this network"` and `"Bid must be between 0.0001 and 1 ETH on this network"`.
   - Applied strict validation across tender creation (`POST /api/tenders/create`), bid submission (`POST /api/tenders/:id/bids`), and award (`POST /api/tenders/:id/award`).
   - Guarded backend server startup so importing `server.js` in unit tests does not spawn active listening ports or background indexers.
   - Added `backend/test/parseEtherAmount.test.js` covering `"500000"`, `"0.001"`, `""`, `"abc"`, and custom `MAX_EMD_ETH`.

2. **Frontend Tender Creation & Detail Refinement (`frontend/`)**:
   - `TenderCreation.jsx`: Relabelled EMD field as `"Earnest Money Deposit (ETH) * (testnet value)"`, defaulted to `0.001` ETH. Separated budget as display-only INR (`"Estimated Budget (INR ₹) [Display Only]"`). Removed silent `"0.1"` fallback on submission.
   - `TenderDetail.jsx`: Formatted on-chain EMD in ETH (e.g. `0.001 ETH (on-chain escrow)`), eliminating hardcoded `500,000 INR (0.1 ETH)` text.
   - `SealedBidSubmission.jsx`: Dynamically prefills `emdDeposited` from the tender's actual `minEmdEth` / `minEmdAmount`. Displays required on-chain EMD in ETH on the form.
   - Replaced all "Zero-knowledge commitment" wording with "commit-reveal".
   - `TopBar.jsx`: Updated consortium header from `"Besu Consortium Chain / 0.00 Gwei"` to `"Ethereum Sepolia / Chain #11155111"`.

3. **Contract Revert Reason Decoding (`frontend/src/utils/chain.js`)**:
   - Implemented `decodeContractError(err)`: extracts revert strings, RPC payloads, and custom errors from ethers.js v6 error objects.
   - Translates raw contract reverts into friendly human messages like `"EMD below minimum"`, `"Bidding closed"`, `"Reveal deadline expired"`, and `"Commitment mismatch (tampering detected or invalid secret salt)"`.
   - Integrated into `SealedBidSubmission.jsx`, `VendorReveal.jsx`, `DisputeFiling.jsx`, `EvaluationAward.jsx`, and `Withdraw.jsx`.

---

## Production Security, Relays & Sepolia Alignment (`backend/`, `frontend/`, `README.md`)

1. **Tender Creation & Technical Scoring Relays (Phase 1)**:
   - `TenderCreation.jsx`: Converted deadlines to `new Date(value).toISOString()`, eliminating timezone discrepancies on UTC Render containers. Added a visible note that times are selected in the user's local timezone. Added an optional reveal-deadline input.
   - `backend/server.js`: In `createTender`, parsed the newly created tender ID directly from the `TenderCreated` event log in the transaction receipt.
   - `backend/server.js`: Implemented `POST /api/tenders/:id/tech-score` as an authenticated relay (`authenticateOfficerToken` + strict tenant isolation check `tender.psu === req.officer.psu`), signing `setTechnicalScore` on-chain with the backend server wallet.
   - `EvaluationAward.jsx`: Routed both technical scoring (`POST /api/tenders/:id/tech-score`) and tender awards (`POST /api/tenders/:id/award`) through the backend officer relays, freeing procurement officers from needing the contract deployer/admin private key in MetaMask.

2. **Security Hardening & Endpoint Sanitization (Phase 2)**:
   - Deleted unauthenticated endpoints `POST /api/tenders/:id/bids` and `POST /api/tenders/:id/reveal`; all bid data is sourced authentically from blockchain events via the indexer.
   - Removed client-side bid sync call from `SealedBidSubmission.jsx`.
   - Hardened `POST /api/ipfs/upload`: eliminated bare `x-vendor-address` authorization bypass. Mandated either an officer JWT or a vendor wallet cryptographic signature (`x-vendor-signature`) over a server-issued challenge nonce (`GET /api/ipfs/nonce`).
   - Hardened server startup: fails immediately if `CONTRACT_ADDRESS`, `RPC_URL`, `JWT_SECRET`, or `OFFICER_PRIVATE_KEY` is missing; removed hardcoded `localhost:8545` and `0x5FbDB...` defaults.
   - Removed `backend/data/*.json` from git tracking (`git rm --cached`) and added to `.gitignore`.

3. **Text & Documentation Alignment (Phase 3)**:
   - Cleaned all remaining "Besu", "0.00 Gwei", "7 validator nodes", and "Consortium Free" references across `ConfirmationModal.jsx`, `Landing.jsx`, `TenderBrowse.jsx`, `About.jsx`, `Login.jsx`, `ChainOfCustodyTimeline.jsx`, and `NirvaanLogo.jsx`, replacing them with Ethereum Sepolia PoS text.
   - Updated `README.md` to reflect the 13 passing smart contract tests, Sepolia deployment, Vercel frontend, Render backend, Pinata IPFS, and zero hardcoded addresses.
   - Updated smoke test suite (`scripts/smoke-test.js`) to verify 404 responses for deleted endpoints and test nonce generation.

---

## Items Blocked or Incomplete

*None*. Every item specified in the requirements across Phase 1 through Phase 5, the Vendor KYC Apply-Then-Approve flow, Tender Creation EMD/Revert Decoders, and the Demo Blockers / Security / Text phases has been completed, tested, and verified.



