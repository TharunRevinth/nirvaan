import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.join(__dirname, '..', 'data');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'officers.json');

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

  for (let i = 0; i < psuList.length; i++) {
    const item = psuList[i];
    const tempPassword = generateSecureRandomPassword();
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    officers.push({
      id: String(i + 1),
      username: item.username,
      psu: item.psu,
      passwordHash: hashedPassword,
      mustChangePassword: true,
      officerId: item.officerId,
      email: `${item.username}@${item.psu.toLowerCase()}.res.in`
    });

    credentialsLog.push({
      PSU: item.psu,
      OfficerID: item.officerId,
      Username: item.username,
      'Temporary Password': tempPassword,
      'Status': 'Must Change On First Login'
    });
  }

  fs.writeFileSync(dbPath, JSON.stringify(officers, null, 2));

  console.log(`Successfully generated and provisioned ${officers.length} officer accounts in data/officers.json!\n`);
  console.log('Generated One-Time Temporary Credentials (securely printed for initial provisioning):');
  console.table(credentialsLog);
  console.log('\n[SECURITY NOTE]: Passwords are randomly generated and hashed with bcrypt.');
  console.log('Officers are required to establish a permanent password upon first login.');
  console.log('To reset passwords at any time, run: npm run reset:officers\n');
}

seed().catch(console.error);

