const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Health Check Endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ONLINE',
    system: 'Oil E-Tendering Blockchain API Gateway',
    consortiumNodes: 7,
    network: 'Hyperledger Besu (QBFT zero-gas)',
    timestamp: new Date().toISOString()
  });
});

// KYC Verification Mock Endpoint (GSTIN / PAN / MCA21)
app.post('/api/kyc/verify', (req, res) => {
  const { gstin, pan, companyName } = req.body;

  if (!gstin || !pan) {
    return res.status(400).json({ error: 'GSTIN and PAN are required for Indian vendor verification' });
  }

  // Simulated hash derivation
  const crypto = require('crypto');
  const gstinHash = '0x' + crypto.createHash('sha256').update(gstin).digest('hex');
  const panHash = '0x' + crypto.createHash('sha256').update(pan).digest('hex');

  res.json({
    verified: true,
    companyName: companyName || 'Verified Oil Sector Vendor Ltd',
    gstinHash,
    panHash,
    status: 'ACTIVE_TAXPAYER',
    verifiedAt: new Date().toISOString()
  });
});

// IPFS File Upload Simulation Endpoint
app.post('/api/ipfs/upload', (req, res) => {
  const crypto = require('crypto');
  const sampleHash = 'Qm' + crypto.randomBytes(23).toString('hex');
  
  res.json({
    success: true,
    ipfsHash: sampleHash,
    sha256DocHash: '0x' + crypto.randomBytes(32).toString('hex'),
    storageLocation: 'NIC Data Center / IPFS Private Swarm'
  });
});

app.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(` Oil E-Tendering API Gateway running on port ${PORT}`);
  console.log(`==================================================`);
});
