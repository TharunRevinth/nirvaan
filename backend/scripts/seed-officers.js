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
  return 'Temp-' + crypto.randomBytes(8).toString('hex') + '!';
}

async function seed() {
  console.log('=======================================================');
  console.log('  SEEDING PSU OFFICER ACCOUNTS WITH BCRYPT HASHES     ');
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
      officerId: item.officerId
    });

    credentialsLog.push({ username: item.username, psu: item.psu, tempPassword });
  }

  fs.writeFileSync(dbPath, JSON.stringify(officers, null, 2));

  console.log(`Successfully seeded ${officers.length} officer accounts in data/officers.json!\n`);
  console.log('Generated Temporary Credentials (one-time display for initial admin provisioning):');
  console.table(credentialsLog);
  console.log('\nNote: On first login, officers must change their password before dashboard access.');
}

seed().catch(console.error);
