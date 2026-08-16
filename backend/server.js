import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ethers } from 'ethers';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, 'data', 'officers.json');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'cvc_secure_oil_psu_consortium_jwt_secret_2026';

// -----------------------------------------------------------------------
// BLOCKCHAIN SIGNING RELAY SETUP
// -----------------------------------------------------------------------
const RPC_URL = process.env.RPC_URL || 'http://127.0.0.1:8545';
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || '0x5FbDB2315678afecb367f032d93F642f64180aa3';
// Default to Anvil test account #0 private key if environment variable is omitted
const SERVER_PRIVATE_KEY = process.env.OFFICER_PRIVATE_KEY || '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

const provider = new ethers.JsonRpcProvider(RPC_URL);
const serverWallet = new ethers.Wallet(SERVER_PRIVATE_KEY, provider);

const CONTRACT_ABI = [
  "function createTender(string memory _ipfsHash, uint256 _submissionDeadline, uint256 _openingTime, uint256 _minEMD) external",
  "function awardTender(uint256 _tenderId, address _winner, uint256 _winningBidId, uint256 _winningBidAmount) external",
  "function tenders(uint256) external view returns (uint256 id, address psuAddress, string memory ipfsHashDoc, uint256 submissionDeadline, uint256 openingTime, uint256 appealDeadline, uint256 minEMDAmount, uint8 status, address winner, uint256 winningBidId, uint256 winningBidAmount)",
  "function tenderCounter() external view returns (uint256)"
];

const contractInstance = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, serverWallet);

app.use(cors());
app.use(express.json());

// Helper function to read officers
function getOfficers() {
  if (!fs.existsSync(dbPath)) return [];
  return JSON.parse(fs.readFileSync(dbPath, 'utf8'));
}

// Helper function to save officers
function saveOfficers(officers) {
  fs.writeFileSync(dbPath, JSON.stringify(officers, null, 2));
}

// Middleware to authenticate JWT session
function authenticateOfficerToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: PSU Officer JWT required.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'PSU') {
      return res.status(403).json({ error: 'Forbidden: Requires PSU Officer privileges.' });
    }
    req.officer = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired officer JWT session.' });
  }
}

// 1. Officer Login Endpoint
app.post('/api/auth/officer-login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  const officers = getOfficers();
  const officer = officers.find(o => o.username.toLowerCase() === username.toLowerCase());

  if (!officer) {
    return res.status(401).json({ error: 'Invalid PSU Officer credentials.' });
  }

  const match = await bcrypt.compare(password, officer.passwordHash);
  if (!match) {
    return res.status(401).json({ error: 'Invalid PSU Officer credentials.' });
  }

  // Check if first-time login with temporary password
  if (officer.mustChangePassword) {
    const tempToken = jwt.sign(
      { id: officer.id, username: officer.username, temp: true },
      JWT_SECRET,
      { expiresIn: '15m' }
    );
    return res.json({
      requirePasswordChange: true,
      tempToken,
      message: 'First-time login detected. Password change required.'
    });
  }

  // Issue full session JWT token
  const token = jwt.sign(
    { id: officer.id, username: officer.username, psu: officer.psu, officerId: officer.officerId, role: 'PSU' },
    JWT_SECRET,
    { expiresIn: '8h' }
  );

  return res.json({
    token,
    officer: {
      username: officer.username,
      psu: officer.psu,
      officerId: officer.officerId,
      role: 'PSU'
    }
  });
});

// 2. Change Password Endpoint for First-Time Login
app.post('/api/auth/change-password', async (req, res) => {
  const { tempToken, newPassword } = req.body;

  if (!tempToken || !newPassword || newPassword.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
  }

  try {
    const decoded = jwt.verify(tempToken, JWT_SECRET);
    if (!decoded.temp) {
      return res.status(400).json({ error: 'Invalid password change token.' });
    }

    const officers = getOfficers();
    const officerIndex = officers.findIndex(o => o.id === decoded.id);
    if (officerIndex === -1) {
      return res.status(404).json({ error: 'Officer account not found.' });
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    officers[officerIndex].passwordHash = newHash;
    officers[officerIndex].mustChangePassword = false;
    saveOfficers(officers);

    const officer = officers[officerIndex];
    const token = jwt.sign(
      { id: officer.id, username: officer.username, psu: officer.psu, officerId: officer.officerId, role: 'PSU' },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    return res.json({
      token,
      officer: {
        username: officer.username,
        psu: officer.psu,
        officerId: officer.officerId,
        role: 'PSU'
      }
    });
  } catch (err) {
    return res.status(401).json({ error: 'Session expired or invalid token.' });
  }
});

// 3. Verify Session Endpoint
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
// SERVER-SIDE BLOCKCHAIN SIGNING RELAY ENDPOINTS
// -----------------------------------------------------------------------

// POST /api/tenders/create — PSU Officer Server-side Signing Relay for Tender Creation
app.post('/api/tenders/create', authenticateOfficerToken, async (req, res) => {
  try {
    const { ipfsHash, submissionDeadline, openingTime, minEMD } = req.body;

    if (!ipfsHash || !submissionDeadline || !openingTime || !minEMD) {
      return res.status(400).json({ error: 'Missing required tender creation parameters.' });
    }

    const deadLineTimestamp = Math.floor(new Date(submissionDeadline).getTime() / 1000) || Number(submissionDeadline);
    const openingTimestamp = Math.floor(new Date(openingTime).getTime() / 1000) || Number(openingTime);
    const emdWei = ethers.parseEther(minEMD.toString());

    // Execute createTender on smart contract using server wallet
    const tx = await contractInstance.createTender(
      ipfsHash,
      deadLineTimestamp,
      openingTimestamp,
      emdWei
    );

    const receipt = await tx.wait();
    const newCounter = await contractInstance.tenderCounter();

    return res.json({
      success: true,
      txHash: tx.hash,
      blockNumber: receipt.blockNumber,
      tenderId: newCounter.toString(),
      officer: req.officer.username,
      psu: req.officer.psu
    });
  } catch (err) {
    console.error('Server-side tender creation error:', err);
    return res.status(500).json({ error: err.reason || err.message || 'On-chain transaction relay failed.' });
  }
});

// POST /api/tenders/:id/award — PSU Officer Server-side Signing Relay for Contract Award
app.post('/api/tenders/:id/award', authenticateOfficerToken, async (req, res) => {
  try {
    const tenderId = req.params.id;
    const { winner, winningBidId, winningBidAmount } = req.body;

    if (!winner || winningBidId === undefined || !winningBidAmount) {
      return res.status(400).json({ error: 'Missing required contract award parameters.' });
    }

    const winningAmountWei = ethers.parseEther(winningBidAmount.toString());

    // Execute awardTender on smart contract using server wallet
    const tx = await contractInstance.awardTender(
      tenderId,
      winner,
      winningBidId,
      winningAmountWei
    );

    const receipt = await tx.wait();

    return res.json({
      success: true,
      txHash: tx.hash,
      blockNumber: receipt.blockNumber,
      tenderId,
      winner,
      officer: req.officer.username
    });
  } catch (err) {
    console.error('Server-side tender award error:', err);
    return res.status(500).json({ error: err.reason || err.message || 'On-chain award relay failed.' });
  }
});

// Start Express Server
app.listen(PORT, () => {
  console.log(`PSU Officer Authentication & Blockchain Relay Server running on http://localhost:${PORT}`);
  console.log(`Relay Server Wallet Address: ${serverWallet.address}`);
  console.log(`Smart Contract Address: ${CONTRACT_ADDRESS}`);
});

