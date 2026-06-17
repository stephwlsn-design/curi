#!/usr/bin/env node
/**
 * Test a MongoDB Atlas connection string before adding it to Vercel.
 *
 * Usage:
 *   MONGODB_URI='mongodb+srv://USER:PASS@cluster....mongodb.net/curi' node scripts/verify-mongodb-uri.js
 */

const path = require('path');

module.paths.unshift(
  path.join(__dirname, '..', 'server', 'node_modules'),
  path.join(__dirname, '..', 'api', 'node_modules'),
);

const mongoose = require('mongoose');

const normalizeMongoUri = (value) => {
  if (!value) return '';
  let uri = value.trim();
  if (
    (uri.startsWith('"') && uri.endsWith('"'))
    || (uri.startsWith("'") && uri.endsWith("'"))
  ) {
    uri = uri.slice(1, -1).trim();
  }
  return uri;
};

const maskUri = (uri) => {
  try {
    const withoutProtocol = uri.replace(/^mongodb(\+srv)?:\/\//, '');
    const at = withoutProtocol.lastIndexOf('@');
    if (at === -1) return uri;
    const creds = withoutProtocol.slice(0, at);
    const host = withoutProtocol.slice(at + 1);
    const colon = creds.indexOf(':');
    const user = colon === -1 ? creds : creds.slice(0, colon);
    return `mongodb+srv://${user}:****@${host}`;
  } catch {
    return '(could not parse URI)';
  }
};

const validateUri = (uri) => {
  const issues = [];

  if (!uri) {
    issues.push('MONGODB_URI is empty.');
    return issues;
  }
  if (!uri.startsWith('mongodb://') && !uri.startsWith('mongodb+srv://')) {
    issues.push('URI must start with mongodb:// or mongodb+srv://');
  }
  if (/<\s*password\s*>/i.test(uri)) {
    issues.push('URI still contains the <password> placeholder — replace it with your real password.');
  }
  if (uri.includes(' ')) {
    issues.push('URI contains spaces — remove accidental whitespace.');
  }
  if (!/@/.test(uri)) {
    issues.push('URI is missing credentials (expected user:pass@host).');
  }

  const credsPart = uri.replace(/^mongodb(\+srv)?:\/\//, '').split('@')[0] || '';
  const password = credsPart.includes(':') ? credsPart.split(':').slice(1).join(':') : '';
  const needsEncoding = /[@#%/:?&=*\s]/.test(password);
  if (needsEncoding && password === decodeURIComponent(password)) {
    issues.push(
      'Password contains special characters (@ # % / : ? etc.) but may not be URL-encoded. '
      + 'Encode it at https://www.urlencoder.org/ or use a password with only letters and numbers.',
    );
  }

  return issues;
};

const run = async () => {
  const uri = normalizeMongoUri(process.env.MONGODB_URI);
  const issues = validateUri(uri);

  console.log('Testing:', maskUri(uri));
  console.log('');

  if (issues.length) {
    console.log('Problems found:');
    issues.forEach((issue) => console.log(`  - ${issue}`));
    console.log('');
  }

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
    });
    console.log('SUCCESS — connected to', mongoose.connection.host);
    console.log('Database:', mongoose.connection.name);
    await mongoose.disconnect();
    process.exit(issues.length ? 1 : 0);
  } catch (err) {
    console.error('FAILED —', err.message);
    if (err.message?.includes('authentication failed')) {
      console.log('');
      console.log('Fix checklist:');
      console.log('  1. Atlas → Database Access → confirm username (not your Atlas login email)');
      console.log('  2. Reset DB user password to something simple (e.g. MyDbPass2024)');
      console.log('  3. Atlas → Connect → Drivers → copy string, replace <password>');
      console.log('  4. If password has special chars, URL-encode them');
      console.log('  5. Paste the full string into Vercel MONGODB_URI (Production) and redeploy');
    }
    process.exit(1);
  }
};

run();
