const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const TOKEN_KEY = 'curi_site_access';
const TOKEN_TYPE = 'site_access';

const isGateEnabled = () => Boolean(process.env.SITE_ACCESS_CODE?.trim());

const safeEqual = (a, b) => {
  const left = String(a ?? '');
  const right = String(b ?? '');
  if (!left || !right) return false;
  const ba = Buffer.from(left);
  const bb = Buffer.from(right);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
};

const signAccessToken = () => jwt.sign(
  { type: TOKEN_TYPE },
  process.env.JWT_SECRET,
  { expiresIn: '30d' },
);

const verifyAccessToken = (token) => {
  if (!token) return false;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded?.type === TOKEN_TYPE;
  } catch {
    return false;
  }
};

const verifyCredentials = (username, code) => {
  if (!isGateEnabled()) return true;
  const expectedUser = process.env.SITE_ACCESS_USERNAME?.trim() || '';
  const expectedCode = process.env.SITE_ACCESS_CODE?.trim() || '';
  return safeEqual(username, expectedUser) && safeEqual(code, expectedCode);
};

module.exports = {
  TOKEN_KEY,
  isGateEnabled,
  signAccessToken,
  verifyAccessToken,
  verifyCredentials,
};
