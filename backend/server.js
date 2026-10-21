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

const applyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many KYC registration attempts from this IP, please try again in 15 minutes.' }
});

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
    const indexerError = indexer.getLastError();

    res.json({
      status: 'healthy',
      service: 'nirvaan-backend-relay',
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      network: {
        chainId: parseInt(process.env.CHAIN_ID || '11155111', 10),
        latestBlock,
        indexedBlock: lastIndexedBlock,
        indexerLag,
        indexerError
      },
      indexerLag,
      indexerError,
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
 * Inputs must be provided strictly as ETH decimal strings (e.g., "0.001").
 * The "integer > 1e12 means wei" heuristic and silent default fallbacks have been removed.
 * Enforces configurable MAX_EMD_ETH (default 1) and minimum 0.0001 ETH.
 */
export function parseEtherAmount(val, fieldName = "EMD") {
  const min = 0.0001;
  const max = parseFloat(process.env.MAX_EMD_ETH || '1');

  if (val === undefined || val === null || String(val).trim() === '') {
    throw new Error(`${fieldName} amount is required and must be provided as an ETH decimal string (e.g. '0.001').`);
  }

  const str = String(val).replace(/ETH/i, '').trim();

  // Accept valid positive decimal strings only (e.g. "0.001", "0.5", "1")
  if (!/^\d+(\.\d+)?$/.test(str)) {
    throw new Error(`Invalid ${fieldName} amount: '${val}'. Must be a valid ETH decimal string (e.g. '0.001').`);
  }

  const ethNum = parseFloat(str);
  if (isNaN(ethNum) || ethNum < min || ethNum > max) {
    throw new Error(`${fieldName} must be between ${min} and ${max} ETH on this network`);
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
        minEmdEth: t.min_emd_eth,
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
        minEmdEth: t.min_emd_eth,
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
    const minEMD = req.body.minEMD || req.body.emd || req.body.minEmdAmount;

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

    let emdWei;
    try {
      emdWei = parseEtherAmount(minEMD, "EMD");
    } catch (emdErr) {
      return res.status(400).json({ error: emdErr.message });
    }

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

    let emdWei;
    try {
      emdWei = parseEtherAmount(amount, "Bid");
    } catch (parseErr) {
      return res.status(400).json({ error: parseErr.message });
    }
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

    const { winner, winningBidId, winnerName } = req.body;
    const winningBidAmount = req.body.winningBidAmount || req.body.winningAmount;
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

    let winningAmountWei;
    try {
      winningAmountWei = parseEtherAmount(winningBidAmount, "Winning bid");
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }

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
// VENDOR REGISTRATION & KYC APPLICATIONS (APPLY-THEN-APPROVE WORKFLOW)
// -----------------------------------------------------------------------

/**
 * Public Vendor KYC Application (Rate-Limited, Strict Validation)
 * Creates a PENDING application in SQLite for PSU officer approval.
 */
app.post('/api/vendors/apply', applyLimiter, async (req, res) => {
  try {
    const { walletAddress, address, companyName, gstin, pan } = req.body || {};
    const rawAddress = walletAddress || address;
    const kycCid = req.body?.kycCid || req.body?.kycIpfsHash || req.body?.cid || null;

    if (!rawAddress || !ethers.isAddress(rawAddress)) {
      return res.status(400).json({ error: 'Valid Ethereum wallet address is required.' });
    }
    const normalizedAddress = ethers.getAddress(rawAddress);

    if (!companyName || typeof companyName !== 'string' || companyName.trim().length < 3 || companyName.trim().length > 150) {
      return res.status(400).json({ error: 'Company or Legal Entity name must be between 3 and 150 characters.' });
    }

    const cleanGstin = String(gstin || '').trim().toUpperCase();
    const gstinRegex = /^[0-9]{2}[A-Z]{4,5}[0-9]{4}[A-Z0-9]{1}[1-9A-Z]{1}[A-Z0-9]{1}[0-9A-Z]{1}$/i;
    if (!cleanGstin || !gstinRegex.test(cleanGstin)) {
      return res.status(400).json({ error: 'Invalid GSTIN format (expected standard 15-character Indian GSTIN, e.g. 27AABCU9603R1ZM).' });
    }

    const cleanPan = String(pan || '').trim().toUpperCase();
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    if (!cleanPan || !panRegex.test(cleanPan)) {
      return res.status(400).json({ error: 'Invalid PAN format (expected standard 10-character Indian PAN, e.g. AAACR1234F).' });
    }

    if (kycCid && (typeof kycCid !== 'string' || kycCid.trim().length < 10 || kycCid.trim().length > 120)) {
      return res.status(400).json({ error: 'Invalid KYC Document CID format.' });
    }

    // 1. Check if vendor is already registered and verified on-chain
    try {
      const isAlreadyOnChain = await contractInstance.registeredVendors(normalizedAddress);
      if (isAlreadyOnChain) {
        return res.status(409).json({
          error: 'Vendor wallet is already registered and verified on-chain.',
          status: 'APPROVED',
          walletAddress: normalizedAddress
        });
      }
    } catch (e) {
      // Allow testing with offline RPC
    }

    // 2. Check existing application in SQLite database
    const existing = db.prepare('SELECT * FROM vendor_applications WHERE LOWER(wallet_address) = LOWER(?)').get(normalizedAddress);
    const nowIso = new Date().toISOString();

    if (existing) {
      if (existing.status === 'APPROVED') {
        return res.status(409).json({
          error: 'Vendor wallet has already been approved.',
          status: 'APPROVED',
          walletAddress: normalizedAddress
        });
      }
      if (existing.status === 'PENDING') {
        return res.status(409).json({
          error: 'A KYC application is already pending officer review for this wallet address.',
          status: 'PENDING',
          applicationId: existing.id,
          walletAddress: normalizedAddress
        });
      }

      // If previously REJECTED, allow resubmission
      db.prepare(`
        UPDATE vendor_applications SET
          company_name = ?,
          gstin = ?,
          pan = ?,
          kyc_cid = ?,
          status = 'PENDING',
          rejection_reason = NULL,
          updated_at = ?
        WHERE id = ?
      `).run(companyName.trim(), cleanGstin, cleanPan, kycCid ? kycCid.trim() : null, nowIso, existing.id);

      return res.status(200).json({
        success: true,
        message: 'KYC application resubmitted successfully for PSU Officer approval.',
        application: {
          id: existing.id,
          walletAddress: normalizedAddress,
          companyName: companyName.trim(),
          gstin: cleanGstin,
          pan: cleanPan,
          kycCid: kycCid ? kycCid.trim() : null,
          status: 'PENDING',
          updatedAt: nowIso
        }
      });
    }

    // 3. Insert new PENDING application
    const appId = `APP-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    db.prepare(`
      INSERT INTO vendor_applications (
        id, wallet_address, company_name, gstin, pan, kyc_cid, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?, ?)
    `).run(
      appId,
      normalizedAddress,
      companyName.trim(),
      cleanGstin,
      cleanPan,
      kycCid ? kycCid.trim() : null,
      nowIso,
      nowIso
    );

    return res.status(201).json({
      success: true,
      message: 'KYC application submitted successfully for PSU Officer approval.',
      application: {
        id: appId,
        walletAddress: normalizedAddress,
        companyName: companyName.trim(),
        gstin: cleanGstin,
        pan: cleanPan,
        kycCid: kycCid ? kycCid.trim() : null,
        status: 'PENDING',
        createdAt: nowIso
      }
    });
  } catch (err) {
    console.error('[Vendor Apply Error]:', err);
    return res.status(500).json({ error: 'Failed to process vendor KYC application.' });
  }
});

/**
 * Officer List Vendor Applications (Pending, Approved, Rejected)
 */
app.get('/api/vendors/applications', authenticateAdminOrOfficer, async (req, res) => {
  try {
    const { status } = req.query;
    let query = 'SELECT * FROM vendor_applications';
    const params = [];

    if (status && ['PENDING', 'APPROVED', 'REJECTED'].includes(String(status).toUpperCase())) {
      query += ' WHERE status = ?';
      params.push(String(status).toUpperCase());
    }
    query += ' ORDER BY created_at DESC';

    const applications = db.prepare(query).all(...params);
    return res.json({
      success: true,
      count: applications.length,
      applications: applications.map(app => ({
        id: app.id,
        walletAddress: app.wallet_address,
        companyName: app.company_name,
        gstin: app.gstin,
        pan: app.pan,
        kycCid: app.kyc_cid,
        status: app.status,
        txHash: app.tx_hash,
        rejectionReason: app.rejection_reason,
        createdAt: app.created_at,
        updatedAt: app.updated_at
      }))
    });
  } catch (err) {
    console.error('[Vendor Applications Query Error]:', err);
    return res.status(500).json({ error: 'Failed to retrieve vendor applications.' });
  }
});

/**
 * Officer Approve Vendor Application -> Registers On-Chain
 */
app.post('/api/vendors/applications/:id/approve', authenticateAdminOrOfficer, async (req, res) => {
  try {
    const { id } = req.params;
    const application = db.prepare('SELECT * FROM vendor_applications WHERE id = ?').get(id);

    if (!application) {
      return res.status(404).json({ error: `Vendor application "${id}" not found.` });
    }

    if (application.status === 'APPROVED') {
      return res.json({
        success: true,
        alreadyApproved: true,
        message: 'Vendor application is already approved.',
        application: {
          id: application.id,
          walletAddress: application.wallet_address,
          status: 'APPROVED',
          txHash: application.tx_hash
        }
      });
    }

    const gstinHash = ethers.id(application.gstin);
    const panHash = ethers.id(application.pan);
    const kycCid = application.kyc_cid || 'QmDefaultKYCVerified';

    let txHash = null;
    try {
      const isAlreadyOnChain = await contractInstance.registeredVendors(application.wallet_address);
      if (!isAlreadyOnChain) {
        const tx = await contractInstance.registerVendor(
          application.wallet_address,
          gstinHash,
          panHash,
          kycCid
        );
        const receipt = await tx.wait();
        txHash = tx.hash;
      }
    } catch (contractErr) {
      if (process.env.NODE_ENV === 'test') {
        txHash = '0x' + crypto.randomBytes(32).toString('hex');
      } else {
        throw contractErr;
      }
    }

    const nowIso = new Date().toISOString();
    db.prepare(`
      UPDATE vendor_applications SET
        status = 'APPROVED',
        tx_hash = COALESCE(?, tx_hash),
        updated_at = ?
      WHERE id = ?
    `).run(txHash, nowIso, id);

    return res.json({
      success: true,
      message: 'Vendor application approved and registered on-chain.',
      applicationId: id,
      walletAddress: application.wallet_address,
      status: 'APPROVED',
      txHash
    });
  } catch (err) {
    console.error('[Vendor Approve Error]:', err);
    return res.status(500).json({ error: err.reason || err.message || 'Failed to approve vendor application.' });
  }
});

/**
 * Officer Reject Vendor Application
 */
app.post('/api/vendors/applications/:id/reject', authenticateAdminOrOfficer, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body || {};
    const application = db.prepare('SELECT * FROM vendor_applications WHERE id = ?').get(id);

    if (!application) {
      return res.status(404).json({ error: `Vendor application "${id}" not found.` });
    }

    const cleanReason = reason && typeof reason === 'string' ? reason.trim() : 'Application did not meet statutory compliance criteria.';
    const nowIso = new Date().toISOString();
    db.prepare(`
      UPDATE vendor_applications SET
        status = 'REJECTED',
        rejection_reason = ?,
        updated_at = ?
      WHERE id = ?
    `).run(cleanReason, nowIso, id);

    return res.json({
      success: true,
      message: 'Vendor application rejected.',
      applicationId: id,
      walletAddress: application.wallet_address,
      status: 'REJECTED',
      rejectionReason: cleanReason
    });
  } catch (err) {
    console.error('[Vendor Reject Error]:', err);
    return res.status(500).json({ error: 'Failed to reject vendor application.' });
  }
});

/**
 * Public Vendor KYC Status Check
 * Returns NONE / PENDING / APPROVED / REJECTED combining DB state and on-chain state.
 */
app.get('/api/vendors/status/:address', async (req, res) => {
  try {
    const { address } = req.params;
    if (!address || !ethers.isAddress(address)) {
      return res.status(400).json({ error: 'Invalid Ethereum address.' });
    }
    const normalizedAddress = ethers.getAddress(address);

    let isRegisteredOnChain = false;
    try {
      isRegisteredOnChain = Boolean(await contractInstance.registeredVendors(normalizedAddress));
    } catch (e) {
      // In testing or offline RPC, continue with DB check
    }

    const appRow = db.prepare(`
      SELECT * FROM vendor_applications
      WHERE LOWER(wallet_address) = LOWER(?)
      ORDER BY updated_at DESC LIMIT 1
    `).get(normalizedAddress);

    if (isRegisteredOnChain) {
      return res.json({
        status: 'APPROVED',
        walletAddress: normalizedAddress,
        onChainRegistered: true,
        companyName: appRow ? appRow.company_name : null,
        gstin: appRow ? appRow.gstin : null,
        pan: appRow ? appRow.pan : null,
        kycCid: appRow ? appRow.kyc_cid : null,
        txHash: appRow ? appRow.tx_hash : null
      });
    }

    if (!appRow) {
      return res.json({
        status: 'NONE',
        walletAddress: normalizedAddress,
        onChainRegistered: false
      });
    }

    return res.json({
      status: appRow.status, // 'PENDING' | 'REJECTED' | 'APPROVED'
      walletAddress: normalizedAddress,
      onChainRegistered: false,
      applicationId: appRow.id,
      companyName: appRow.company_name,
      gstin: appRow.gstin,
      pan: appRow.pan,
      kycCid: appRow.kyc_cid,
      rejectionReason: appRow.rejection_reason || null,
      createdAt: appRow.created_at,
      updatedAt: appRow.updated_at
    });
  } catch (err) {
    console.error('[Vendor Status Error]:', err);
    return res.status(500).json({ error: 'Failed to retrieve vendor registration status.' });
  }
});

/**
 * Direct Officer Vendor Registration (Admin/Officer Only)
 */
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
    const normalized = ethers.getAddress(vendorAddress);

    const gstinHash = ethers.id(gstin);
    const panHash = ethers.id(pan);

    try {
      const isAlreadyReg = await contractInstance.registeredVendors(normalized);
      if (isAlreadyReg) {
        db.prepare(`
          INSERT INTO vendor_applications (
            id, wallet_address, company_name, gstin, pan, kyc_cid, status, tx_hash, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, 'APPROVED', NULL, ?, ?)
          ON CONFLICT(wallet_address) DO UPDATE SET
            status = 'APPROVED',
            updated_at = excluded.updated_at
        `).run(
          `APP-DIRECT-${normalized.slice(2, 8).toUpperCase()}`,
          normalized,
          req.body.companyName || `Vendor (${normalized.slice(0, 6)}…${normalized.slice(-4)})`,
          gstin,
          pan,
          kycIpfsHash,
          new Date().toISOString(),
          new Date().toISOString()
        );

        return res.json({
          success: true,
          alreadyRegistered: true,
          vendorAddress: normalized,
          message: 'Vendor wallet is already registered and verified on-chain.'
        });
      }

      const tx = await contractInstance.registerVendor(
        normalized,
        gstinHash,
        panHash,
        kycIpfsHash
      );

      const receipt = await tx.wait();

      db.prepare(`
        INSERT INTO vendor_applications (
          id, wallet_address, company_name, gstin, pan, kyc_cid, status, tx_hash, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'APPROVED', ?, ?, ?)
        ON CONFLICT(wallet_address) DO UPDATE SET
          status = 'APPROVED',
          tx_hash = excluded.tx_hash,
          updated_at = excluded.updated_at
      `).run(
        `APP-DIRECT-${normalized.slice(2, 8).toUpperCase()}`,
        normalized,
        req.body.companyName || `Vendor (${normalized.slice(0, 6)}…${normalized.slice(-4)})`,
        gstin,
        pan,
        kycIpfsHash,
        tx.hash,
        new Date().toISOString(),
        new Date().toISOString()
      );

      return res.json({
        success: true,
        txHash: tx.hash,
        blockNumber: receipt.blockNumber,
        vendorAddress: normalized,
        kycIpfsHash
      });
    } catch (contractErr) {
      if (process.env.NODE_ENV === 'test') {
        const simTxHash = '0x' + crypto.randomBytes(32).toString('hex');
        db.prepare(`
          INSERT INTO vendor_applications (
            id, wallet_address, company_name, gstin, pan, kyc_cid, status, tx_hash, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, 'APPROVED', ?, ?, ?)
          ON CONFLICT(wallet_address) DO UPDATE SET
            status = 'APPROVED',
            tx_hash = excluded.tx_hash,
            updated_at = excluded.updated_at
        `).run(
          `APP-DIRECT-${normalized.slice(2, 8).toUpperCase()}`,
          normalized,
          req.body.companyName || `Vendor (${normalized.slice(0, 6)}…${normalized.slice(-4)})`,
          gstin,
          pan,
          kycIpfsHash,
          simTxHash,
          new Date().toISOString(),
          new Date().toISOString()
        );

        return res.json({
          success: true,
          simulated: true,
          vendorAddress: normalized,
          kycIpfsHash,
          txHash: simTxHash
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
    const syncResult = await indexer.syncFromChain({ isStartup: true });
    if (syncResult && syncResult.success) {
      console.log(`[STARTUP] Ephemeral database synchronized with blockchain.`);
    } else {
      console.error(`[STARTUP] Blockchain sync failed during startup: ${indexer.getLastError() || 'Unknown error'}. Server starting in degraded mode; indexer will continue retrying in background.`);
    }

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

if (process.argv[1] && (process.argv[1] === __filename || process.argv[1].endsWith('server.js') || process.argv[1].endsWith('server'))) {
  startServer();
}

export default app;
