import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ethers } from 'ethers';
import multer from 'multer';
import crypto from 'crypto';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

import db, { seedOfficersFromEnv } from './db.js';
import { EventIndexer } from './indexer.js';
import { startEmbeddedKeeper, getKeeperStatus } from './embeddedKeeper.js';

dotenv.config();

// Enforce mandatory environment variables
if (!process.env.OFFICER_PRIVATE_KEY) {
  console.error('[FATAL ERROR] OFFICER_PRIVATE_KEY environment variable is required. Refusing to start.');
  process.exit(1);
}
if (!process.env.JWT_SECRET) {
  console.error('[FATAL ERROR] JWT_SECRET environment variable is required. Refusing to start.');
  process.exit(1);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
// Enable reverse proxy trust for Render & Vercel deployments (required for accurate rate limiting)
app.set('trust proxy', 1);

const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET;
const SERVER_PRIVATE_KEY = process.env.OFFICER_PRIVATE_KEY;
const RPC_URL = process.env.RPC_URL || 'http://127.0.0.1:8545';
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || '0x5FbDB2315678afecb367f032d93F642f64180aa3';

// -----------------------------------------------------------------------
// SECURITY HEADERS & RATE LIMITING & CORS
// -----------------------------------------------------------------------
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      return callback(null, true);
    }
    return callback(new Error('CORS policy: Not allowed by CORS origin restriction.'));
  },
  credentials: true
}));

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' }
});
app.use('/api/', generalLimiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts, please try again in 15 minutes.' }
});
app.use('/api/auth/', authLimiter);

app.use(express.json());

// In-memory single-use token set for temporary password reset tokens
const usedTempTokens = new Set();

// -----------------------------------------------------------------------
// BLOCKCHAIN SIGNING RELAY SETUP & EVENT INDEXER
// -----------------------------------------------------------------------
const provider = new ethers.JsonRpcProvider(RPC_URL);
const serverWallet = new ethers.Wallet(SERVER_PRIVATE_KEY, provider);

const CONTRACT_ABI = [
  "function createTender(string memory _ipfsHash, uint256 _submissionDeadline, uint256 _openingTime, uint256 _revealDeadline, uint256 _minEMD) external",
  "function awardTender(uint256 _tenderId, address _winner, uint256 _winningBidId, uint256 _winningBidAmount) external",
  "function registerVendor(address _vendorAddress, bytes32 _gstinHash, bytes32 _panHash, string memory _kycIpfsHash) external",
  "function registeredVendors(address) external view returns (bool)",
  "function vendorKYC(address) external view returns (bytes32 gstinHash, bytes32 panHash, string memory kycIpfsHash, uint256 registeredAt)",
  "function tenders(uint256) external view returns (uint256 id, address psuAddress, string memory ipfsHashDoc, uint256 submissionDeadline, uint256 openingTime, uint256 revealDeadline, uint256 appealDeadline, uint256 minEMDAmount, uint8 status, address winner, uint256 winningBidId, uint256 winningBidAmount)",
  "function tenderCounter() external view returns (uint256)"
];

const contractInstance = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, serverWallet);
const indexer = new EventIndexer(provider, CONTRACT_ADDRESS);

// -----------------------------------------------------------------------
// HEALTH CHECK ENDPOINT (UPTIMEROBOT & MONITORING)
// -----------------------------------------------------------------------
app.get('/api/health', async (req, res) => {
  try {
    const latestBlock = await indexer.getLatestBlockNumber().catch(() => 0);
    const lastIndexedBlock = indexer.getLastIndexedBlock();
    const keeperStatus = getKeeperStatus();
    const indexerLag = Math.max(0, Number(latestBlock) - Number(lastIndexedBlock));

    res.json({
      status: 'healthy',
      service: 'nirvaan-backend-relay',
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      network: {
        chainId: parseInt(process.env.CHAIN_ID || '11155111', 10),
        latestBlock,
        indexedBlock: lastIndexedBlock,
        indexerLag
      },
      keeper: {
        status: keeperStatus.healthy ? (keeperStatus.initialized ? 'running' : 'idle') : 'degraded',
        lastRunAt: keeperStatus.lastRunAt,
        activeTenders: keeperStatus.activeTenders,
        lastAction: keeperStatus.lastAction,
        errorCount: keeperStatus.errorCount
      }
    });
  } catch (err) {
    res.status(500).json({ status: 'error', error: err.message });
  }
});

// -----------------------------------------------------------------------
// UNIT CONVENTION & DEADLINE HELPERS
// -----------------------------------------------------------------------
/**
 * UNIT CONVENTION (DOCUMENTED):
 * All on-chain monetary amounts (EMD, bids, bonds) are expressed and stored in Wei (1 ETH = 10^18 wei).
 * Inputs can be provided as ETH decimal strings (e.g., "0.5") or integer Wei strings.
 * Magic re-mapping (>50 -> 0.1) has been completely removed to preserve value integrity between chain and DB.
 */
function parseEtherAmount(val, defaultVal = "0.1") {
  if (!val) return ethers.parseEther(defaultVal);
  const str = String(val).replace(/ETH/i, '').trim();
  if (/^\d+$/.test(str) && BigInt(str) > 1000000000000n) {
    return BigInt(str);
  }
  return ethers.parseEther(str);
}

function toUtcIso(dateInput) {
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) {
    throw new Error(`Invalid date format: ${dateInput}. Explicit UTC ISO-8601 required.`);
  }
  return d.toISOString();
}

function parseNumericTenderId(idParam) {
  if (!idParam || !/^\d+$/.test(String(idParam).trim())) {
    return null;
  }
  return parseInt(String(idParam).trim(), 10);
}

// -----------------------------------------------------------------------
// AUTHENTICATION MIDDLEWARES
// -----------------------------------------------------------------------
function authenticateOfficerToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: PSU Officer JWT required.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'PSU' && decoded.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Forbidden: Requires PSU Officer or Admin privileges.' });
    }
    req.officer = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired officer JWT session.' });
  }
}

function authenticateAdminOrOfficer(req, res, next) {
  const adminKey = req.headers['x-admin-key'];
  if (process.env.ADMIN_API_KEY && adminKey && adminKey === process.env.ADMIN_API_KEY) {
    req.officer = { role: 'ADMIN', username: 'admin' };
    return next();
  }
  return authenticateOfficerToken(req, res, next);
}

function authenticateUpload(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
      return next();
    } catch (err) {
      return res.status(401).json({ error: 'Unauthorized: Invalid token for file upload.' });
    }
  }

  const vendorAddress = req.headers['x-vendor-address'];
  if (vendorAddress && ethers.isAddress(vendorAddress)) {
    req.user = { role: 'Vendor', address: vendorAddress };
    return next();
  }

  return res.status(401).json({ error: 'Unauthorized: Officer session or vendor wallet credentials required for upload.' });
}

// -----------------------------------------------------------------------
// HEALTH CHECK
// -----------------------------------------------------------------------
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    psuConsortium: 'NIRVAAN',
    database: 'SQLite WAL Active',
    timestamp: new Date().toISOString()
  });
});

// -----------------------------------------------------------------------
// OFFICER AUTHENTICATION (SQLITE PERSISTENCE)
// -----------------------------------------------------------------------
app.post('/api/auth/officer-login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username/Officer ID and password are required.' });
  }

  const cleanQuery = String(username).trim().toLowerCase();
  const cleanPassword = String(password).trim();

  const officer = db.prepare(`
    SELECT * FROM officers
    WHERE LOWER(username) = ? OR LOWER(officer_id) = ? OR LOWER(psu) = ?
  `).get(cleanQuery, cleanQuery, cleanQuery);

  if (!officer) {
    return res.status(401).json({ error: `Invalid credentials: No PSU Officer found matching "${username}".` });
  }

  let match = false;
  try {
    match = await bcrypt.compare(cleanPassword, officer.password_hash);
  } catch (err) {
    console.error('Bcrypt comparison error:', err);
    return res.status(500).json({ error: 'Authentication processing error.' });
  }

  if (!match) {
    return res.status(401).json({ error: 'Invalid password. Please check your credentials.' });
  }

  if (officer.must_change_password === 1) {
    const tokenId = crypto.randomUUID();
    const tempToken = jwt.sign(
      { id: officer.id, username: officer.username, temp: true, jti: tokenId },
      JWT_SECRET,
      { expiresIn: '15m' }
    );
    return res.json({
      requirePasswordChange: true,
      tempToken,
      message: 'First-time login detected. Password change required.'
    });
  }

  const token = jwt.sign(
    { id: officer.id, username: officer.username, psu: officer.psu, officerId: officer.officer_id, role: 'PSU' },
    JWT_SECRET,
    { expiresIn: '8h' }
  );

  return res.json({
    token,
    officer: {
      username: officer.username,
      psu: officer.psu,
      officerId: officer.officer_id,
      role: 'PSU'
    }
  });
});

app.post('/api/auth/change-password', async (req, res) => {
  const { tempToken, newPassword } = req.body;

  if (!tempToken || !newPassword || newPassword.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
  }

  try {
    const decoded = jwt.verify(tempToken, JWT_SECRET);
    if (!decoded.temp) {
      return res.status(400).json({ error: 'Invalid password change token: Not a temporary token.' });
    }

    const tokenId = decoded.jti || tempToken;
    if (usedTempTokens.has(tokenId)) {
      return res.status(401).json({ error: 'Temporary token has already been used and invalidated.' });
    }

    usedTempTokens.add(tokenId);

    const officer = db.prepare('SELECT * FROM officers WHERE id = ?').get(decoded.id);
    if (!officer) {
      return res.status(404).json({ error: 'Officer account not found.' });
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    db.prepare('UPDATE officers SET password_hash = ?, must_change_password = 0 WHERE id = ?').run(newHash, decoded.id);

    const token = jwt.sign(
      { id: officer.id, username: officer.username, psu: officer.psu, officerId: officer.officer_id, role: 'PSU' },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    return res.json({
      token,
      officer: {
        username: officer.username,
        psu: officer.psu,
        officerId: officer.officer_id,
        role: 'PSU'
      }
    });
  } catch (err) {
    return res.status(401).json({ error: 'Session expired or invalid temporary token.' });
  }
});

app.get('/api/auth/me', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return res.json({ officer: decoded });
  } catch (err) {
    return res.status(401).json({ error: 'Invalid session token' });
  }
});

// -----------------------------------------------------------------------
// TENDER MANAGEMENT (SQLITE PERSISTENCE & EVENT SOURCE OF TRUTH)
// -----------------------------------------------------------------------

// GET /api/tenders — List all tenders from database with evaluated deadlines
app.get('/api/tenders', async (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM tenders ORDER BY on_chain_id DESC').all();
    const now = Date.now();

    const tenders = rows.map(t => {
      const isPast = new Date(t.submission_deadline).getTime() <= now;
      const appealClosed = t.appeal_deadline ? new Date(t.appeal_deadline).getTime() <= now : false;

      return {
        id: t.code,
        onChainId: t.on_chain_id,
        psu: t.psu,
        category: t.category,
        title: t.title,
        desc: t.description,
        valueCr: t.budget,
        minEmdAmount: t.min_emd_wei,
        emd: `${t.min_emd_eth} ETH`,
        deadline: t.submission_deadline,
        opening: t.opening_time,
        revealDeadline: t.reveal_deadline,
        appealDeadline: t.appeal_deadline,
        appealWindowClosed: appealClosed,
        isExpired: isPast,
        bidsClosed: isPast,
        status: t.status,
        cid: t.cid,
        txHash: t.tx_hash,
        blockNumber: t.block_number,
        winnerAddress: t.winner_address,
        winner: t.winner_name,
        winningAmount: t.winning_amount,
        awardTxHash: t.award_tx_hash,
        awardBlock: t.award_block,
        disputeActive: Boolean(t.dispute_active),
        challenger: t.challenger,
        disputeTxHash: t.dispute_tx_hash
      };
    });

    return res.json({ tenders });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/tenders/:id — Retrieve single tender by numeric on-chain ID
app.get('/api/tenders/:id', async (req, res) => {
  try {
    const numericId = parseNumericTenderId(req.params.id);
    if (numericId === null) {
      return res.status(400).json({ error: `Invalid tender ID '${req.params.id}': Tender IDs must be strictly numeric integers.` });
    }

    const t = db.prepare('SELECT * FROM tenders WHERE on_chain_id = ?').get(numericId);
    if (!t) {
      return res.status(404).json({ error: `Tender #${numericId} not found.` });
    }

    const now = Date.now();
    const isPast = new Date(t.submission_deadline).getTime() <= now;
    const appealClosed = t.appeal_deadline ? new Date(t.appeal_deadline).getTime() <= now : false;

    return res.json({
      tender: {
        id: t.code,
        onChainId: t.on_chain_id,
        psu: t.psu,
        category: t.category,
        title: t.title,
        desc: t.description,
        valueCr: t.budget,
        minEmdAmount: t.min_emd_wei,
        emd: `${t.min_emd_eth} ETH`,
        deadline: t.submission_deadline,
        opening: t.opening_time,
        revealDeadline: t.reveal_deadline,
        appealDeadline: t.appeal_deadline,
        appealWindowClosed: appealClosed,
        isExpired: isPast,
        bidsClosed: isPast,
        status: t.status,
        cid: t.cid,
        txHash: t.tx_hash,
        blockNumber: t.block_number,
        winnerAddress: t.winner_address,
        winner: t.winner_name,
        winningAmount: t.winning_amount,
        awardTxHash: t.award_tx_hash,
        awardBlock: t.award_block,
        disputeActive: Boolean(t.dispute_active),
        challenger: t.challenger,
        disputeTxHash: t.dispute_tx_hash
      }
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/tenders/create — PSU Officer Server-side Signing Relay for Tender Creation
app.post('/api/tenders/create', authenticateOfficerToken, async (req, res) => {
  try {
    const ipfsHash = req.body.ipfsHash || req.body.ipfsCid || req.body.cid;
    if (!ipfsHash) {
      return res.status(400).json({ error: 'Missing required IPFS document CID: Document must be uploaded before creating tender.' });
    }

    // Verify document exists in local uploads cache or on Pinata gateway before anchoring
    const localFilePath = path.resolve(uploadsDir, ipfsHash);
    if (!fs.existsSync(localFilePath) && process.env.NODE_ENV !== 'test') {
      try {
        const pinataGateway = process.env.PINATA_GATEWAY || 'https://gateway.pinata.cloud/ipfs';
        const pinataJwt = process.env.PINATA_JWT;
        const headers = pinataJwt ? { 'Authorization': `Bearer ${pinataJwt}` } : {};
        const ipfsCheck = await fetch(`${pinataGateway.replace(/\/$/, '')}/${ipfsHash}`, {
          method: 'HEAD',
          headers
        });
        if (!ipfsCheck.ok) {
          return res.status(400).json({ error: `Cannot anchor tender: Document with CID "${ipfsHash}" has not been stored or verified on IPFS.` });
        }
      } catch (ipfsConnErr) {
        return res.status(400).json({ error: `Cannot anchor tender: Document with CID "${ipfsHash}" not found in IPFS storage.` });
      }
    }

    const submissionDeadline = req.body.submissionDeadline || req.body.deadline;
    const openingTime = req.body.openingTime || req.body.opening;
    const revealDeadline = req.body.revealDeadline;
    const minEMD = req.body.minEMD || req.body.emd || "0.1";

    if (!submissionDeadline || !openingTime) {
      return res.status(400).json({ error: 'Submission deadline and opening time are required.' });
    }

    const subIso = toUtcIso(submissionDeadline);
    const openIso = toUtcIso(openingTime);
    const deadLineTimestamp = Math.floor(new Date(subIso).getTime() / 1000);
    const openingTimestamp = Math.floor(new Date(openIso).getTime() / 1000);

    const revealDeadlineTimestamp = revealDeadline
      ? Math.floor(new Date(toUtcIso(revealDeadline)).getTime() / 1000)
      : openingTimestamp + 86400; // Default reveal deadline: 24h after opening
    const revealIso = new Date(revealDeadlineTimestamp * 1000).toISOString();

    let chainNow = Math.floor(Date.now() / 1000);
    try {
      const latestBlock = await provider.getBlock('latest');
      if (latestBlock) chainNow = latestBlock.timestamp;
    } catch (e) {}

    if (deadLineTimestamp <= chainNow) {
      return res.status(400).json({
        error: `Submission deadline (${subIso}) must be in the future relative to blockchain time (${new Date(chainNow * 1000).toISOString()}).`
      });
    }

    if (openingTimestamp <= deadLineTimestamp) {
      return res.status(400).json({ error: 'Bid opening time must be strictly after the submission deadline.' });
    }

    if (revealDeadlineTimestamp <= openingTimestamp) {
      return res.status(400).json({ error: 'Reveal deadline must be strictly after the opening time.' });
    }

    const emdWei = parseEtherAmount(minEMD, "0.1");

    let tenderIdNum = 1;
    let txHash = '0xsimulated_create_tender_tx';
    let blockNumber = 1;

    try {
      // Execute createTender on smart contract
      const tx = await contractInstance.createTender(
        ipfsHash,
        deadLineTimestamp,
        openingTimestamp,
        revealDeadlineTimestamp,
        emdWei
      );

      const receipt = await tx.wait();
      const newCounter = await contractInstance.tenderCounter();
      tenderIdNum = Number(newCounter);
      txHash = tx.hash;
      blockNumber = receipt.blockNumber;
    } catch (contractErr) {
      if (process.env.NODE_ENV === 'test') {
        const lastRow = db.prepare('SELECT MAX(on_chain_id) as max_id FROM tenders').get();
        tenderIdNum = (lastRow && lastRow.max_id) ? lastRow.max_id + 1 : 1;
      } else {
        throw contractErr;
      }
    }

    // Enforce server-side tender ID generation (client-supplied IDs strictly ignored)
    const tenderCode = `TND-26-${String(tenderIdNum).padStart(4, '0')}-${(req.officer.psu || 'GEN').charAt(0)}`;
    const budgetVal = req.body.budget ? (Number(req.body.budget) / 10000000).toFixed(2) : '25.00';

    // Store in SQLite DB
    db.prepare(`
      INSERT INTO tenders (
        on_chain_id, code, psu, category, title, description, budget,
        min_emd_wei, min_emd_eth, submission_deadline, opening_time,
        reveal_deadline, appeal_deadline, status, cid, tx_hash, block_number,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      tenderIdNum,
      tenderCode,
      req.officer.psu || 'IOCL',
      req.body.category || 'Pipeline Infrastructure',
      req.body.title || `Procurement Package #${tenderIdNum}`,
      req.body.desc || '',
      budgetVal,
      emdWei.toString(),
      ethers.formatEther(emdWei),
      subIso,
      openIso,
      revealIso,
      null,
      'Created',
      ipfsHash,
      txHash,
      blockNumber,
      new Date().toISOString()
    );

    return res.json({
      success: true,
      txHash,
      blockNumber,
      tenderId: tenderIdNum,
      tender: {
        onChainId: tenderIdNum,
        id: tenderCode,
        title: req.body.title || `Procurement Package #${tenderIdNum}`
      },
      tenderCode,
      officer: req.officer.username,
      psu: req.officer.psu
    });
  } catch (err) {
    console.error('Tender creation error:', err);
    return res.status(500).json({ error: err.reason || err.message || 'On-chain tender creation failed.' });
  }
});

// GET /api/tenders/:id/bids — Retrieve ranked bids for a tender
app.get('/api/tenders/:id/bids', (req, res) => {
  try {
    const numericId = parseNumericTenderId(req.params.id);
    if (numericId === null) {
      return res.status(400).json({ error: `Invalid tender ID '${req.params.id}': Tender IDs must be strictly numeric integers.` });
    }

    const rows = db.prepare('SELECT * FROM bids WHERE tender_id = ? ORDER BY CAST(amount_wei AS INTEGER) ASC').all(numericId);

    const ranked = rows.map((b, idx) => ({
      id: b.id,
      tenderId: b.tender_id,
      vendor: b.vendor_name,
      vid: b.vid,
      vendorAddress: b.vendor_address,
      qualified: Boolean(b.is_qualified),
      techScore: b.tech_score,
      hash: b.commitment_hash,
      cid: b.cid,
      amount: b.amount_wei,
      amountFormatted: `${b.amount_eth} ETH`,
      amountCr: b.amount_eth,
      status: b.status,
      rank: `L${idx + 1}`
    }));

    return res.json({ tenderId: numericId, bids: ranked, count: ranked.length });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/tenders/:id/bids — Record a new revealed bid
app.post('/api/tenders/:id/bids', (req, res) => {
  try {
    const numericId = parseNumericTenderId(req.params.id);
    if (numericId === null) {
      return res.status(400).json({ error: `Invalid tender ID '${req.params.id}': Tender IDs must be strictly numeric integers.` });
    }

    const { vendor, vid, vendorAddress, amount, hash, cid, qualified, techScore } = req.body;
    if (!vendorAddress || !ethers.isAddress(vendorAddress)) {
      return res.status(400).json({ error: 'Valid vendor Ethereum address required.' });
    }

    const emdWei = parseEtherAmount(amount, "0.1");
    const bidId = `BID-${numericId}-${vendorAddress.slice(2, 6)}`;

    db.prepare(`
      INSERT INTO bids (
        id, tender_id, vendor_address, bid_index, vendor_name, vid,
        amount_wei, amount_eth, commitment_hash, cid, is_qualified,
        tech_score, status, submission_time
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        amount_wei = excluded.amount_wei,
        amount_eth = excluded.amount_eth,
        is_qualified = excluded.is_qualified,
        tech_score = excluded.tech_score
    `).run(
      bidId,
      numericId,
      vendorAddress,
      0,
      vendor || `Vendor (${vendorAddress.slice(0, 6)}…)`,
      vid || `VEN-${vendorAddress.slice(2, 6).toUpperCase()}-X`,
      emdWei.toString(),
      ethers.formatEther(emdWei),
      hash || ethers.ZeroHash,
      cid || 'QmDefaultBidHash',
      qualified ? 1 : 0,
      techScore || 90,
      'Opened',
      new Date().toISOString()
    );

    return res.json({ success: true, bidId });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/tenders/:id/reveal — Cryptographic Bid Reveal Verification
app.post('/api/tenders/:id/reveal', (req, res) => {
  try {
    const numericId = parseNumericTenderId(req.params.id);
    if (numericId === null) {
      return res.status(400).json({ error: 'Invalid tender ID.' });
    }
    const { vendorAddress, amountWei, salt } = req.body;
    if (!vendorAddress || !amountWei || !salt) {
      return res.status(400).json({ error: 'vendorAddress, amountWei, and salt required.' });
    }

    const computedCommitment = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ['address', 'uint256', 'bytes32', 'uint256'],
        [vendorAddress, amountWei, salt, numericId]
      )
    );

    const bid = db.prepare('SELECT * FROM bids WHERE tender_id = ? AND vendor_address = ?').get(numericId, vendorAddress);
    if (!bid) {
      return res.status(404).json({ error: 'No sealed bid found for this vendor and tender.' });
    }

    if (bid.commitment_hash.toLowerCase() !== computedCommitment.toLowerCase()) {
      return res.status(400).json({ error: 'Cryptographic commitment mismatch. Tampering detected.' });
    }

    db.prepare(`
      UPDATE bids SET status = 'Opened', amount_wei = ?, amount_eth = ?
      WHERE tender_id = ? AND vendor_address = ?
    `).run(amountWei, ethers.formatEther(amountWei), numericId, vendorAddress);

    return res.json({ success: true, verified: true, computedCommitment });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/tenders/:id/tech-score — Technical Score Evaluation Relay
app.post('/api/tenders/:id/tech-score', authenticateOfficerToken, (req, res) => {
  try {
    const numericId = parseNumericTenderId(req.params.id);
    if (numericId === null) {
      return res.status(400).json({ error: 'Invalid tender ID.' });
    }
    const { bidIndex, qualified, score } = req.body;
    db.prepare(`
      UPDATE bids SET is_qualified = ?, tech_score = ?
      WHERE tender_id = ? AND (bid_index = ? OR rowid = ?)
    `).run(qualified ? 1 : 0, score || 90, numericId, bidIndex || 0, (bidIndex || 0) + 1);

    return res.json({ success: true, tenderId: numericId, qualified: Boolean(qualified), score: score || 90 });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/tenders/:id/award — PSU Officer Relay for Contract Award with Strict Tenant Isolation
app.post('/api/tenders/:id/award', authenticateOfficerToken, async (req, res) => {
  try {
    const numericId = parseNumericTenderId(req.params.id);
    if (numericId === null) {
      return res.status(400).json({ error: `Invalid tender ID '${req.params.id}': Tender IDs must be strictly numeric integers.` });
    }

    const { winner, winningBidId, winningBidAmount, winnerName } = req.body;
    if (!winner || !ethers.isAddress(winner)) {
      return res.status(400).json({ error: 'Valid winning bidder Ethereum address is required.' });
    }

    const tenderRecord = db.prepare('SELECT * FROM tenders WHERE on_chain_id = ?').get(numericId);
    if (!tenderRecord) {
      return res.status(404).json({ error: `Tender #${numericId} not found in procurement database.` });
    }

    // STRICT TENANT ISOLATION: tender.psu === req.officer.psu
    if (!req.officer || !req.officer.psu || req.officer.psu.toUpperCase() !== tenderRecord.psu.toUpperCase()) {
      return res.status(403).json({
        error: `Tenant Isolation Violation: Tender #${numericId} belongs to ${tenderRecord.psu}. You are authenticated under ${req.officer?.psu || 'Unknown'}.`
      });
    }

    const winningAmountWei = parseEtherAmount(winningBidAmount, "1.0");

    let txHash = '0xsimulated_award_tx';
    let blockNumber = 1;
    let appealDeadlineIso = new Date(Date.now() + 7 * 86400 * 1000).toISOString();

    try {
      // Execute awardTender on-chain
      const tx = await contractInstance.awardTender(
        numericId,
        winner,
        winningBidId || 1,
        winningAmountWei
      );
      const receipt = await tx.wait();
      txHash = tx.hash;
      blockNumber = receipt.blockNumber;

      // Use blockchain time for appeal deadline (NOT Date.now())
      const block = await provider.getBlock(receipt.blockNumber);
      const blockTime = block ? block.timestamp : Math.floor(Date.now() / 1000);
      appealDeadlineIso = new Date((blockTime + 7 * 86400) * 1000).toISOString();
    } catch (contractErr) {
      if (process.env.NODE_ENV !== 'test') {
        throw contractErr;
      }
    }

    db.prepare(`
      UPDATE tenders SET
        status = 'Awarded',
        winner_address = ?,
        winner_name = ?,
        winning_amount = ?,
        award_tx_hash = ?,
        award_block = ?,
        appeal_deadline = ?
      WHERE on_chain_id = ?
    `).run(
      winner,
      winnerName || `Awarded Bidder (${winner.slice(0, 6)}…)`,
      `${ethers.formatEther(winningAmountWei)} ETH`,
      txHash,
      `Block #${blockNumber}`,
      appealDeadlineIso,
      numericId
    );

    return res.json({
      success: true,
      txHash,
      blockNumber,
      tenderId: numericId,
      winner,
      appealDeadline: appealDeadlineIso
    });
  } catch (err) {
    console.error('Contract award error:', err);
    return res.status(500).json({ error: err.reason || err.message || 'On-chain tender award failed.' });
  }
});

// -----------------------------------------------------------------------
// VENDOR REGISTRATION
// -----------------------------------------------------------------------
app.post('/api/vendors/register', authenticateAdminOrOfficer, async (req, res) => {
  try {
    const { vendorAddress, gstin, pan } = req.body;
    const kycIpfsHash = req.body.kycIpfsHash || req.body.kycCid || req.body.cid;

    if (!vendorAddress || !gstin || !pan || !kycIpfsHash) {
      return res.status(400).json({ error: 'Missing required vendor registration parameters.' });
    }

    if (!ethers.isAddress(vendorAddress)) {
      return res.status(400).json({ error: 'Invalid Ethereum address for vendor.' });
    }

    const gstinHash = ethers.id(gstin);
    const panHash = ethers.id(pan);

    try {
      const isAlreadyReg = await contractInstance.registeredVendors(vendorAddress);
      if (isAlreadyReg) {
        return res.json({
          success: true,
          alreadyRegistered: true,
          vendorAddress,
          message: 'Vendor wallet is already registered and verified on-chain.'
        });
      }

      const tx = await contractInstance.registerVendor(
        vendorAddress,
        gstinHash,
        panHash,
        kycIpfsHash
      );

      const receipt = await tx.wait();

      return res.json({
        success: true,
        txHash: tx.hash,
        blockNumber: receipt.blockNumber,
        vendorAddress,
        kycIpfsHash
      });
    } catch (contractErr) {
      if (process.env.NODE_ENV === 'test') {
        return res.json({
          success: true,
          simulated: true,
          vendorAddress,
          kycIpfsHash
        });
      }
      throw contractErr;
    }
  } catch (err) {
    if (err.message && err.message.includes('Already registered')) {
      return res.json({
        success: true,
        alreadyRegistered: true,
        vendorAddress: req.body.vendorAddress,
        message: 'Vendor wallet is already registered on-chain.'
      });
    }
    console.error('Vendor registration error:', err);
    return res.status(500).json({ error: err.reason || err.message || 'On-chain vendor registration failed.' });
  }
});

// -----------------------------------------------------------------------
// PROTECTED IPFS VAULT (AUTH + SIZE + TYPE LIMITS + PATH TRAVERSAL PREVENTED)
// -----------------------------------------------------------------------
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/json',
  'text/plain',
  'image/png',
  'image/jpeg',
  'application/octet-stream'
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB max
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      return cb(new Error(`Unsupported file type: ${file.mimetype}. Allowed formats: PDF, JSON, TXT, PNG, JPEG, Octet-Stream.`));
    }
    const ext = path.extname(file.originalname).toLowerCase();
    const disallowedExts = ['.exe', '.sh', '.bat', '.cmd', '.js', '.mjs', '.cjs', '.py', '.html', '.htm', '.svg', '.php'];
    if (disallowedExts.includes(ext)) {
      return cb(new Error(`File extension "${ext}" is disallowed.`));
    }
    cb(null, true);
  }
});

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function toBase58(buffer) {
  let digits = [0];
  for (let i = 0; i < buffer.length; i++) {
    for (let j = 0; j < digits.length; j++) digits[j] <<= 8;
    digits[0] += buffer[i];
    let carry = 0;
    for (let j = 0; j < digits.length; ++j) {
      digits[j] += carry;
      carry = (digits[j] / 58) | 0;
      digits[j] %= 58;
    }
    while (carry) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }
  for (let i = 0; i < buffer.length && buffer[i] === 0; i++) digits.push(0);
  return digits.reverse().map(d => ALPHABET[d]).join("");
}

app.post('/api/ipfs/upload', authenticateUpload, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided for upload.' });
    }

    const filename = path.basename(req.file.originalname) || 'document.pdf';
    const buffer = req.file.buffer;
    const pinataJwt = process.env.PINATA_JWT;

    if (!pinataJwt) {
      console.error('[IPFS Upload] Missing PINATA_JWT environment variable.');
      return res.status(500).json({
        error: 'Pinata IPFS service not configured on server (PINATA_JWT missing). Cannot anchor unpinned CID.'
      });
    }

    // Pin encrypted file to Pinata IPFS
    const formData = new FormData();
    const blob = new Blob([buffer], { type: req.file.mimetype || 'application/octet-stream' });
    formData.append('file', blob, filename);

    const metadata = JSON.stringify({
      name: filename,
      keyvalues: {
        app: 'nirvaan',
        uploadedAt: new Date().toISOString()
      }
    });
    formData.append('pinataMetadata', metadata);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const pinataRes = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${pinataJwt}`
      },
      body: formData,
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (!pinataRes.ok) {
      const errBody = await pinataRes.text();
      console.error('[Pinata Pin Error]', pinataRes.status, errBody);
      return res.status(502).json({
        error: 'Failed to pin file to Pinata IPFS. Never anchoring unpinned CID.',
        details: errBody
      });
    }

    const pinataData = await pinataRes.json();
    const realCid = pinataData.IpfsHash;

    // Cache copy in local uploadsDir for faster serving / resilience
    try {
      const safeDestination = path.resolve(uploadsDir, realCid);
      if (safeDestination.startsWith(path.resolve(uploadsDir) + path.sep)) {
        fs.writeFileSync(safeDestination, buffer);
      }
    } catch (cacheErr) {
      console.warn('[Cache Notice] Could not write local cache:', cacheErr.message);
    }

    return res.json({
      Hash: realCid,
      Name: filename,
      Size: pinataData.PinSize || buffer.length,
      source: 'pinata-ipfs'
    });
  } catch (err) {
    console.error('Pinata upload error:', err);
    return res.status(500).json({ error: err.message || 'File upload failed.' });
  }
});

app.get('/api/ipfs/:cid', async (req, res) => {
  const cid = req.params.cid;
  if (!cid || !/^[a-zA-Z0-9]{44,70}$/.test(cid)) {
    return res.status(400).json({ error: 'Invalid CID format.' });
  }

  const normalizedUploads = path.resolve(uploadsDir);
  const targetPath = path.resolve(normalizedUploads, cid);

  if (!targetPath.startsWith(normalizedUploads + path.sep)) {
    return res.status(403).json({ error: 'Access denied: Directory traversal forbidden.' });
  }

  // 1. Serve from local cache if present
  if (fs.existsSync(targetPath)) {
    return res.sendFile(targetPath);
  }

  // 2. Fetch via Pinata Gateway
  const pinataGateway = process.env.PINATA_GATEWAY || 'https://gateway.pinata.cloud/ipfs';
  const pinataJwt = process.env.PINATA_JWT;

  try {
    const gatewayUrl = `${pinataGateway.replace(/\/$/, '')}/${cid}`;
    const headers = {};
    if (pinataJwt) {
      headers['Authorization'] = `Bearer ${pinataJwt}`;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const gatewayRes = await fetch(gatewayUrl, { headers, signal: controller.signal });
    clearTimeout(timeout);

    if (!gatewayRes.ok) {
      return res.status(gatewayRes.status === 404 ? 404 : 502).json({
        error: `Document CID not found on Pinata IPFS gateway (${gatewayRes.status}).`
      });
    }

    const contentType = gatewayRes.headers.get('content-type') || 'application/octet-stream';
    const arrayBuffer = await gatewayRes.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);

    // Save to local cache
    try {
      fs.writeFileSync(targetPath, fileBuffer);
    } catch (e) {}

    res.setHeader('Content-Type', contentType);
    return res.send(fileBuffer);
  } catch (err) {
    console.error('[Pinata Gateway Error]:', err.message);
    return res.status(502).json({ error: 'Failed to retrieve document from Pinata IPFS gateway.' });
  }
});

async function startServer() {
  try {
    // 1. Seed PSU officers into ephemeral SQLite DB if empty
    seedOfficersFromEnv();

    // 2. Reconstruct ephemeral DB state from blockchain events starting from DEPLOY_BLOCK
    const deployBlock = parseInt(process.env.DEPLOY_BLOCK || '0', 10);
    console.log(`[STARTUP] Reconstructing state from chain events (DEPLOY_BLOCK: ${deployBlock})...`);
    await indexer.syncFromChain({ isStartup: true });
    console.log(`[STARTUP] Ephemeral database synchronized with blockchain.`);

    // 3. Start embedded keeper inside backend process (single service deployment)
    await startEmbeddedKeeper({
      provider,
      contractAddress: CONTRACT_ADDRESS,
      keeperPrivateKey: process.env.KEEPER_PRIVATE_KEY,
      pollIntervalSeconds: parseInt(process.env.KEEPER_POLL_INTERVAL_S || '20', 10)
    });

    // 4. Background indexer sync every 20 seconds
    setInterval(() => {
      indexer.syncFromChain().catch(err => {
        console.warn('[INDEXER BACKGROUND SYNC NOTICE]:', err.message);
      });
    }, 20000);

    // 5. Start Express HTTP service
    const server = app.listen(PORT, () => {
      console.log(`PSU Officer Authentication & Blockchain Relay Server running on port ${PORT}`);
      console.log(`Relay Server Wallet Address: ${serverWallet.address}`);
      console.log(`Smart Contract Address: ${CONTRACT_ADDRESS}`);
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`\n[FATAL ERROR] Port ${PORT} is in use.`);
        process.exit(1);
      } else {
        throw err;
      }
    });
  } catch (err) {
    console.error('[FATAL STARTUP ERROR]:', err);
    process.exit(1);
  }
}

startServer();

export default app;
