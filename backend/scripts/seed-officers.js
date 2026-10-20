import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import db from '../db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.join(__dirname, '..', 'data');
const jsonPath = path.join(dataDir, 'officers.json');

function generateSecureRandomPassword() {
  return 'Temp-' + crypto.randomBytes(6).toString('hex') + '!' + Math.floor(10 + Math.random() * 90);
}

async function seed() {
  console.log('=======================================================');
  console.log('  PSU OFFICER PROVISIONING: RANDOM TEMPORARY PASSWORDS  ');
  console.log('=======================================================\n');

  const psuList = [
    { username: 'iocl_officer', psu: 'IOCL', officerId: '88-X92-IOC' },
    { username: 'bpcl_officer', psu: 'BPCL', officerId: '91-Y44-BPC' },
    { username: 'hpcl_officer', psu: 'HPCL', officerId: '74-Z12-HPC' },
    { username: 'ongc_officer', psu: 'ONGC', officerId: '63-K88-ONG' },
    { username: 'gail_officer', psu: 'GAIL', officerId: '52-M33-GAI' },
  ];

  const officers = [];
  const credentialsLog = [];

  // Clear existing officers in SQLite
  db.exec('DELETE FROM officers');
  const insertStmt = db.prepare(`
    INSERT INTO officers (id, username, psu, password_hash, must_change_password, officer_id, email, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (let i = 0; i < psuList.length; i++) {
    const item = psuList[i];
    const tempPassword = generateSecureRandomPassword();
    const hashedPassword = await bcrypt.hash(tempPassword, 10);
    const nowIso = new Date().toISOString();

    officers.push({
      id: String(i + 1),
      username: item.username,
      psu: item.psu,
      passwordHash: hashedPassword,
      mustChangePassword: true,
      officerId: item.officerId,
      email: `${item.username}@${item.psu.toLowerCase()}.res.in`
    });

    insertStmt.run(
      String(i + 1),
      item.username,
      item.psu,
      hashedPassword,
      1,
      item.officerId,
      `${item.username}@${item.psu.toLowerCase()}.res.in`,
      nowIso
    );

    credentialsLog.push({
      PSU: item.psu,
      OfficerID: item.officerId,
      Username: item.username,
      'Temporary Password': tempPassword,
      'Status': 'Must Change On First Login'
    });
  }

  fs.writeFileSync(jsonPath, JSON.stringify(officers, null, 2));

  console.log(`Successfully provisioned ${officers.length} officer accounts in SQLite DB and data/officers.json!\n`);
  console.log('Generated One-Time Temporary Credentials:');
  console.table(credentialsLog);
  console.log('\n[SECURITY NOTE]: Passwords are randomly generated and hashed with bcrypt.');
  console.log('Officers are required to establish a permanent password upon first login.\n');
}

seed().catch(console.error);
