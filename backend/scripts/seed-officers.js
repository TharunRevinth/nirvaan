import bcrypt from 'bcryptjs';
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

async function seed() {
  console.log('Seeding PSU Officer Accounts with bcrypt password hashes...');
  const tempPassword = 'TempOfficerPassword123!';
  const hashedPassword = await bcrypt.hash(tempPassword, 10);

  const initialOfficers = [
    { id: '1', username: 'iocl_officer', psu: 'IOCL', passwordHash: hashedPassword, mustChangePassword: true, officerId: '88-X92-IOC' },
    { id: '2', username: 'bpcl_officer', psu: 'BPCL', passwordHash: hashedPassword, mustChangePassword: true, officerId: '91-Y44-BPC' },
    { id: '3', username: 'hpcl_officer', psu: 'HPCL', passwordHash: hashedPassword, mustChangePassword: true, officerId: '74-Z12-HPC' },
    { id: '4', username: 'ongc_officer', psu: 'ONGC', passwordHash: hashedPassword, mustChangePassword: true, officerId: '63-K88-ONG' },
    { id: '5', username: 'gail_officer', psu: 'GAIL', passwordHash: hashedPassword, mustChangePassword: true, officerId: '52-M33-GAI' },
  ];

  fs.writeFileSync(dbPath, JSON.stringify(initialOfficers, null, 2));
  console.log(`Successfully seeded ${initialOfficers.length} officer accounts in data/officers.json!`);
  console.log(`Default Temporary Password for all officers: ${tempPassword}`);
}

seed().catch(console.error);
