#!/usr/bin/env node

/**
 * Working Tree Secret Scanner
 * Scans all git-tracked files for exposed 64-hex private keys and credentials.
 * Fails with exit code 1 if any private key is found.
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('===============================================================');
console.log('  NIRVAAN REPOSITORY SECURITY AUDIT: SCANNING FOR SECRETS');
console.log('===============================================================');

// Private key pattern matching 64 hex characters (with or without 0x prefix)
const privateKeyAssignmentPattern = /(?:private_?key|signer_?key|deployer_?key|officer_?key|keeper_?key|admin_?key|secret)\s*[:=]\s*['"]?(?:0x)?([a-fA-F0-9]{64})['"]?/i;
const standaloneHex64KeyPattern = /^\s*(?:0x)?([a-fA-F0-9]{64})\s*$/;

let trackedFiles = [];
try {
  trackedFiles = execSync('git ls-files', { encoding: 'utf8' })
    .split('\n')
    .map(f => f.trim())
    .filter(Boolean);
} catch (err) {
  console.error('[SCANNER ERROR] Failed to list git files:', err.message);
  process.exit(1);
}

let violations = [];

for (const file of trackedFiles) {
  if (!fs.existsSync(file)) continue;

  // Ignore binary assets (images, fonts)
  const ext = path.extname(file).toLowerCase();
  if (['.png', '.jpg', '.jpeg', '.gif', '.ico', '.pdf', '.woff', '.woff2', '.ttf'].includes(ext)) {
    continue;
  }

  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');

  lines.forEach((line, index) => {
    // 1. Explicit private key assignments
    if (privateKeyAssignmentPattern.test(line)) {
      violations.push({
        file,
        line: index + 1,
        match: line.trim(),
        type: 'Private key assignment detected'
      });
    }

    // 2. Standalone 64-hex strings in key/env files
    if (file.includes('key') && standaloneHex64KeyPattern.test(line)) {
      violations.push({
        file,
        line: index + 1,
        match: line.trim(),
        type: 'Standalone 64-hex private key file'
      });
    }
  });
}

if (violations.length > 0) {
  console.error(`\n[SECURITY FAILURE] Found ${violations.length} exposed private key(s) in working tree:\n`);
  for (const v of violations) {
    console.error(`  - ${v.file}:${v.line} (${v.type})`);
    console.error(`    ${v.match}\n`);
  }
  process.exit(1);
} else {
  console.log(`\n[PASS] Verified ${trackedFiles.length} tracked files.`);
  console.log('[PASS] Zero 64-hex private keys detected in working tree.\n');
  process.exit(0);
}
