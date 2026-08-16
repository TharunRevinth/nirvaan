import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, 'data', 'officers.json');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'cvc_secure_oil_psu_consortium_jwt_secret_2026';

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

// Start Express Server
app.listen(PORT, () => {
  console.log(`PSU Officer Authentication & Gateway Backend running on http://localhost:${PORT}`);
});
