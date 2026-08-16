# Blockchain-Enabled Oil E-Tendering System for India

A secure, permissioned blockchain e-tendering system tailored for Indian Oil PSUs (IOCL, HPCL, BPCL, ONGC, GAIL) complying with CVC guidelines and the Indian IT Act, 2000.

## Project Structure

- `contracts/`: Solidity Smart Contracts (`OilTenderingV1.sol`), Hardhat testing suite, proxy deployment scripts.
- `backend/`: Node.js API Gateway, KYC validation stubs, Vault integration, IPFS middleware.
- `frontend/`: React.js Dashboard UI with Tailwind CSS & Reactbits interactive UI components.
- `keeper/`: Oracle Keeper service for automated time-triggered bid opening & tender finalization.
- `subgraph/`: The Graph indexing schema & mapping for blockchain event queries.
- `docker/`: Hyperledger Besu 7-node QBFT network configuration & docker-compose services.
- `docs/`: Technical reports & free-stack implementation blueprints.

## Architecture Highlights
- **Consortium Network:** Hyperledger Besu with QBFT consensus (7 validator nodes).
- **Zero Gas Fees:** `"gasPrice": "0x0"` genesis block configuration.
- **Sealed-Bid Commitment Scheme:** Client-side encryption & `keccak256(vendorAddress, bidAmount, salt, tenderId)` commitments.
- **7-Day Dispute Resolution Window:** On-chain appeal mechanism moderated by Central Vigilance Commission (CVC).
- **Upgradeability:** OpenZeppelin UUPS Transparent Proxy pattern.
