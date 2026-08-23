#!/usr/bin/env node
/**
 * Seed site access gate credentials into MongoDB (persists across Vercel env issues).
 *
 * Usage:
 *   MONGODB_URI="mongodb+srv://..." node server/scripts/seedSiteAccess.js CuriVault KjxAzTKJcXY6LuJqKkaMLVGh
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { connectDB } = require('../src/config/database');
const { persistToDb } = require('../src/services/siteAccessService');

async function main() {
  const username = process.argv[2];
  const accessCode = process.argv[3];

  if (!username || !accessCode) {
    console.error('Usage: node server/scripts/seedSiteAccess.js <username> <accessCode>');
    process.exit(1);
  }

  await connectDB();
  await persistToDb({ username, accessCode, source: 'seed-script' });
  console.log('Site access gate configured in MongoDB.');
  console.log('Username:', username);
  process.exit(0);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
