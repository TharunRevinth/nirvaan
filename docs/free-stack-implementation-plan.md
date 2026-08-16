# Free/Open-Source Implementation Plan — Blockchain Oil E-Tendering System

**Purpose:** Map every component in the architecture report to a free or open-source equivalent, organized by the same 5-stage roadmap, with effort/priority guidance so you know where to invest time first.

**Reality check first:** Everything below is free to *build and test*. Three things stop being free only when you go to real production:
1. Cloud VMs to actually host 7 always-on validator nodes (dev/testing on your own laptop or free-tier cloud is fine).
2. A CERT-In certified security audit (mandatory for a real government-facing PSU system — no free substitute exists, but free static-analysis tools get you 80% of the way for your own review).
3. Real HSM hardware / paid Vault Enterprise (open-source Vault + software-based "HSM simulation" covers dev/test).

Everything else — frameworks, blockchain client, storage, indexing, crypto libraries — is 100% free and open source.

---

## Free Tooling Map (per component)

| Component in report | Free/OSS Substitute | Cost model |
|---|---|---|
| Hyperledger Besu (7-node consortium) | Hyperledger Besu itself | Free, Apache 2.0 — always was |
| Node hosting (production) | Oracle Cloud Free Tier (4 ARM VMs free forever) + your own machine for dev | Free for dev/small pilot; real 7-node prod needs paid VMs eventually |
| IPFS / MinIO | Kubo (go-ipfs) + MinIO Community Edition | Free |
| React.js / Next.js / Tailwind | Same — already free | Free |
| NestJS / FastAPI backend | Same — already free | Free |
| The Graph Protocol (Subgraph) | Self-hosted `graph-node` (Docker) instead of hosted paid service | Free self-hosted |
| HashiCorp Vault (KMS) | Vault Open Source edition | Free (Enterprise features like HSM auto-unseal cost money — skip for now, use `dev` mode or file-based unseal) |
| HSM (ePass2003 DSC tokens) | Software PKCS#11 simulation (SoftHSM2) for dev/test | Free for dev; real DSC tokens (~₹1,500/vendor) needed for legal validity in prod |
| Gnosis Safe Multisig | Gnosis Safe (self-hosted or testnet) | Free |
| Solidity dev/test framework | Hardhat or Foundry | Free |
| Ethers.js SDK | Same | Free |
| GSTIN/MCA21/PAN verification APIs | Government sandbox/test APIs (free), production APIs are free too but need registration | Free (some require empanelment paperwork, not money) |
| Security audit | Slither, Mythril, Solhint, Echidna (fuzzing) — all free static/dynamic analysis | Free self-audit; CERT-In formal audit is paid and required eventually |
| SAP/ERP integration | Can't avoid — SAP itself is licensed. For dev, mock the integration with a free ERP like ERPNext or just a REST stub | Free to simulate, real SAP connector requires PSU's existing SAP license (they already have it) |
| Postgres (for Graph indexer + backend) | PostgreSQL | Free |
| Docker/Kubernetes for orchestration | Docker Compose (dev), K3s (free lightweight k8s) | Free |

---

## Stage 1 — Sandbox & Genesis Block Configuration
**Effort: Medium | Priority: Highest — this is your foundation, don't rush it**

- Run Besu in **dev mode first** (single node) before attempting the full 7-node QBFT network — this alone saves weeks of debugging.
- Once single-node works, use `besu operator generate-blockchain-config` to generate the QBFT genesis with your 7 validator addresses.
- Run all 7 nodes as Docker containers on **one machine** initially (docker-compose with 7 services) — no need for real distributed infra until Stage 4/5.
- Set `"gasPrice": "0x0"` in genesis.json as specified.
- Free hosting once local testing is solid: Oracle Cloud Free Tier gives you enough ARM compute to run several real nodes for free indefinitely.

**Where people waste time:** trying to set up real multi-cloud networking before the contract logic is even tested. Don't — do this on `localhost` with Docker first.

---

## Stage 2 — PKI & KMS Integration
**Effort: Medium-High | Priority: High, but can be stubbed initially**

- Use **Vault OSS in dev mode** (`vault server -dev`) for local work — auto-unseals, no HSM needed.
- For DSC/PKI signing simulation, use **SoftHSM2** + OpenSSL to generate test X.509 certs instead of buying real ePass2003 tokens during development.
- Ethers.js has built-in transaction signing — you don't need Vault's transit engine until you're automating the Keeper's signing in a real deployment.
- **Practical shortcut:** for your first working prototype, just use raw private keys in a `.env` (never for anything real) to get the flow working end-to-end, then swap in Vault-based signing once the core logic is proven. Don't let KMS integration block your smart contract testing.

---

## Stage 3 — Web Portal, KYC & Subgraph Indexer
**Effort: High (most person-hours) | Priority: High**

- `graph-node` runs fully free via Docker — point it at your local Besu node, no need for The Graph's hosted/paid service.
- GSTIN/PAN/MCA21 have public **sandbox test APIs** — use those instead of live government endpoints during dev; switching to production endpoints later is just a config/URL change, not new code.
- Client-side crypto (keccak256 commitment hash, symmetric encryption) — use `ethers.js` + `crypto-js`/WebCrypto API, both free, both already what your report specifies.
- This stage is the biggest time sink because it's the most UI-heavy. Budget the most hours here relative to the roadmap's "2 months" — realistically 2-3 months for a small team, 4-6 for a solo builder.

---

## Stage 4 — Audit & CVC Pilot
**Effort: Low (tooling) / High (process) | Priority: Do the free self-audit before anything else — it's nearly zero-cost and catches most bugs**

- Run **Slither** (static analysis) and **Mythril** (symbolic execution) on your Solidity contract — both free, both catch re-entrancy, overflow, access-control bugs like the ones your contract already tries to guard against.
- Run **Echidna** for fuzz testing the bid commit-reveal logic specifically — this is the highest-risk part of your contract (money + hashes).
- The formal CERT-In audit is the one genuinely non-free step in the whole roadmap — budget for it only once the free tools come back clean, so you're not paying auditors to find bugs Slither would have caught for free.
- CVC/pilot onboarding is a process/relationship task, not a technical cost.

---

## Stage 5 — Full Rollout & SAP Integration
**Effort: Medium | Priority: Last, and only once Stages 1-4 are solid**

- SAP itself isn't something you need to license — PSUs already run SAP; you're building a connector/webhook listener, which is free code on your side (NestJS webhook + SAP's existing OData/REST APIs).
- For your own dev/demo purposes without real SAP access, stub it with a free open-source ERP like **ERPNext** to simulate PO generation, then swap the connector to real SAP endpoints later.
- Node promotion to real production data centers is the only "real cost" item here, and it's infra cost, not software licensing.

---

## Suggested Effort Allocation (if working solo or small team)

| Stage | % of total effort | Why |
|---|---|---|
| 1. Sandbox & Genesis | 15% | Foundational but mechanical once Besu docs are followed |
| 2. PKI & KMS | 10% | Can be stubbed early, hardened later |
| 3. Web Portal/KYC/Subgraph | 40% | Most person-hours, most surface area for bugs/UX issues |
| 4. Audit | 15% | Free tools first, cheap in time, expensive in payoff |
| 5. Rollout/SAP | 20% | Mostly integration glue, depends on PSU's real SAP access |

**One general piece of advice:** build the smart contract + Hardhat/Foundry test suite *before* touching the frontend or the 7-node network. A contract you've unit-tested locally with Hardhat (free, instant) saves you from debugging the same logic errors later across a slow multi-node Besu network.
