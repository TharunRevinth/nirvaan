import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultDataDir = path.join(__dirname, 'data');

// Render free tier has no persistent disk - support /tmp or custom ephemeral path
const dbPath = process.env.DB_PATH || (process.env.NODE_ENV === 'production' ? '/tmp/nirvaan.db' : path.join(defaultDataDir, 'nirvaan.db'));

const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

console.log(`[DATABASE] Connecting SQLite database at: ${dbPath}`);
const db = new DatabaseSync(dbPath);

// Initialize SQLite Schema
db.exec(`
  PRAGMA journal_mode = WAL;

  CREATE TABLE IF NOT EXISTS officers (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    psu TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    must_change_password INTEGER NOT NULL DEFAULT 1,
    officer_id TEXT UNIQUE NOT NULL,
    email TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS tenders (
    on_chain_id INTEGER PRIMARY KEY,
    code TEXT NOT NULL,
    psu TEXT NOT NULL,
    category TEXT,
    title TEXT NOT NULL,
    description TEXT,
    budget TEXT,
    min_emd_wei TEXT NOT NULL,
    min_emd_eth TEXT NOT NULL,
    submission_deadline TEXT NOT NULL,
    opening_time TEXT NOT NULL,
    reveal_deadline TEXT NOT NULL,
    appeal_deadline TEXT,
    status TEXT NOT NULL,
    cid TEXT NOT NULL,
    tx_hash TEXT,
    block_number INTEGER,
    winner_address TEXT,
    winner_name TEXT,
    winning_amount TEXT,
    award_tx_hash TEXT,
    award_block TEXT,
    dispute_active INTEGER DEFAULT 0,
    challenger TEXT,
    dispute_tx_hash TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS bids (
    id TEXT PRIMARY KEY,
    tender_id INTEGER NOT NULL,
    vendor_address TEXT NOT NULL,
    bid_index INTEGER,
    vendor_name TEXT,
    vid TEXT,
    amount_wei TEXT,
    amount_eth TEXT,
    commitment_hash TEXT NOT NULL,
    cid TEXT NOT NULL,
    is_qualified INTEGER DEFAULT 0,
    tech_score INTEGER DEFAULT 0,
    status TEXT NOT NULL,
    submission_time TEXT NOT NULL,
    tx_hash TEXT,
    FOREIGN KEY(tender_id) REFERENCES tenders(on_chain_id)
  );

  CREATE TABLE IF NOT EXISTS vendor_applications (
    id TEXT PRIMARY KEY,
    wallet_address TEXT UNIQUE NOT NULL,
    company_name TEXT NOT NULL,
    gstin TEXT NOT NULL,
    pan TEXT NOT NULL,
    kyc_cid TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING',
    tx_hash TEXT,
    rejection_reason TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS indexer_state (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

/**
 * Seed PSU Officers from environment variables or generate initial random credentials
 * Printed once on initial boot if empty
 */
export function seedOfficersFromEnv() {
  const countRow = db.prepare('SELECT COUNT(*) as count FROM officers').get();
  if (countRow.count > 0) {
    return;
  }

  const insert = db.prepare(`
    INSERT INTO officers (id, username, psu, password_hash, must_change_password, officer_id, email, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Option 1: Explicit JSON list in OFFICER_SEED_JSON
  if (process.env.OFFICER_SEED_JSON) {
    try {
      const seedList = JSON.parse(process.env.OFFICER_SEED_JSON);
      if (Array.isArray(seedList) && seedList.length > 0) {
        for (const item of seedList) {
          const id = item.id || `OFF-${crypto.randomBytes(4).toString('hex')}`;
          const pass = item.password || crypto.randomBytes(8).toString('hex');
          const passHash = bcrypt.hashSync(pass, 10);
          insert.run(
            id,
            item.username,
            item.psu,
            passHash,
            item.mustChangePassword === false ? 0 : 1,
            item.officerId || `ID-${item.username}`,
            item.email || '',
            new Date().toISOString()
          );
        }
        console.log(`[OFFICER SEED] Seeded ${seedList.length} officers from OFFICER_SEED_JSON.`);
        return;
      }
    } catch (err) {
      console.warn('[OFFICER SEED] Failed to parse OFFICER_SEED_JSON:', err.message);
    }
  }

  // Option 2: Check for existing local officers.json (dev fallback)
  const localOfficersJson = path.join(defaultDataDir, 'officers.json');
  if (fs.existsSync(localOfficersJson)) {
    try {
      const officers = JSON.parse(fs.readFileSync(localOfficersJson, 'utf8'));
      if (Array.isArray(officers) && officers.length > 0) {
        for (const o of officers) {
          insert.run(
            o.id,
            o.username,
            o.psu,
            o.passwordHash,
            o.mustChangePassword ? 1 : 0,
            o.officerId,
            o.email || '',
            new Date().toISOString()
          );
        }
        console.log(`[OFFICER SEED] Imported ${officers.length} officers from local officers.json.`);
        return;
      }
    } catch (e) {}
  }

  // Option 3: Default PSU Officers with generated temporary passwords (printed once on boot)
  const defaultPsus = [
    { psu: 'IOCL', username: 'iocl_officer', id: 'OFF-IOCL-01', officerId: 'IOCL-8821' },
    { psu: 'ONGC', username: 'ongc_officer', id: 'OFF-ONGC-01', officerId: 'ONGC-4412' },
    { psu: 'BPCL', username: 'bpcl_officer', id: 'OFF-BPCL-01', officerId: 'BPCL-9923' },
    { psu: 'HPCL', username: 'hpcl_officer', id: 'OFF-HPCL-01', officerId: 'HPCL-7714' },
    { psu: 'GAIL', username: 'gail_officer', id: 'OFF-GAIL-01', officerId: 'GAIL-3315' }
  ];

  console.log('================================================================');
  console.log(' [OFFICER SEED] INITIAL CREDENTIALS GENERATED (PRINTED ONCE)');
  console.log(' Change passwords immediately upon initial sign in.');
  console.log('================================================================');

  for (const o of defaultPsus) {
    // Check if password passed via SEED_<PSU>_PASSWORD
    const envPass = process.env[`SEED_${o.psu}_PASSWORD`];
    const plainPass = envPass || `InitPass_${crypto.randomBytes(4).toString('hex')}!`;
    const hash = bcrypt.hashSync(plainPass, 10);

    insert.run(
      o.id,
      o.username,
      o.psu,
      hash,
      1, // must_change_password
      o.officerId,
      `${o.username}@procurement.gov.in`,
      new Date().toISOString()
    );

    console.log(` PSU: ${o.psu.padEnd(5)} | Username: ${o.username.padEnd(14)} | Temp Password: ${plainPass}`);
  }
  console.log('================================================================\n');
}

export default db;
