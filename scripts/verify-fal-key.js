#!/usr/bin/env node
/**
 * Verify Fal API key and lip-sync availability.
 * Usage: node scripts/verify-fal-key.js
 */
const path = require('path');

module.paths.unshift(
  path.join(__dirname, '..', 'server', 'node_modules'),
  path.join(__dirname, '..', 'api', 'node_modules'),
);

require('dotenv').config({ path: path.join(__dirname, '../server/.env') });

async function main() {
  const lipSync = require('../server/src/services/lipSyncService');
  const key = lipSync.getFalApiKey();

  if (!lipSync.isValidKey(key)) {
    console.error('FAIL: FAL_KEY or FAL_API_KEY is not set in server/.env or environment.');
    console.error('Add your key from https://fal.ai/dashboard/keys');
    process.exit(1);
  }

  console.log('OK: Fal API key is configured (length', key.length + ')');
  console.log('Checking fal.ai lip-sync availability…');

  const result = await lipSync.checkFalAvailability();
  if (result.ok) {
    console.log('OK: Fal SadTalker is ready for lip-sync.');
    process.exit(0);
  }

  console.error('FAIL:', result.reason);
  if (result.hint) console.error('Hint:', result.hint);
  if (result.code === 'FAL_BALANCE_EXHAUSTED') {
    console.error('\nLip-sync requires fal.ai credits. Top up at: https://fal.ai/dashboard/billing');
  }
  process.exit(1);
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
