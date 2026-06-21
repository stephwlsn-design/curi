#!/usr/bin/env node
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { getOAuthUrl } = require('../src/services/socialOAuthService');

const userId = process.argv[2] || 'demo-user';
const url = getOAuthUrl('facebook', userId);
console.log('\nMeta OAuth URL (open while logged into Facebook as Page admin):\n');
console.log(url);
console.log('\nAdd this redirect URI in Meta Developer Console → Facebook Login → Settings:\n');
console.log(process.env.PUBLIC_API_URL || 'http://localhost:5001', '+ /api/publish/callback/facebook\n');
