const axios = require('axios');
const crypto = require('crypto');
const { PLATFORM_ENV_KEYS, oauthRedirectUri, getMetaLoginConfigId } = require('../config/social');

const oauthStates = new Map();
const STATE_TTL_MS = 15 * 60 * 1000;

const rememberState = (state, payload) => {
  oauthStates.set(state, { ...payload, createdAt: Date.now() });
};

const consumeState = (state) => {
  const entry = oauthStates.get(state);
  oauthStates.delete(state);
  if (!entry || Date.now() - entry.createdAt > STATE_TTL_MS) return null;
  return entry;
};

const getLinkedInAuthUrl = (userId, options = {}) => {
  const clientId = PLATFORM_ENV_KEYS.linkedin.clientId();
  if (!clientId) throw new Error('LinkedIn OAuth is not configured');

  const state = crypto.randomBytes(24).toString('hex');
  rememberState(state, { userId, platform: 'linkedin', returnTo: options.returnTo });

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: oauthRedirectUri('linkedin'),
    state,
    scope: 'openid profile w_member_social email',
  });

  return `https://www.linkedin.com/oauth/v2/authorization?${params}`;
};

const getTwitterAuthUrl = (userId, options = {}) => {
  const clientId = PLATFORM_ENV_KEYS.twitter.clientId();
  if (!clientId) throw new Error('X / Twitter OAuth is not configured');

  const state = crypto.randomBytes(24).toString('hex');
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');

  rememberState(state, { userId, platform: 'twitter', codeVerifier, returnTo: options.returnTo });

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: oauthRedirectUri('twitter'),
    scope: 'tweet.read tweet.write users.read offline.access',
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });

  return `https://twitter.com/i/oauth2/authorize?${params}`;
};

const exchangeLinkedInCode = async (code) => {
  const clientId = PLATFORM_ENV_KEYS.linkedin.clientId();
  const clientSecret = PLATFORM_ENV_KEYS.linkedin.clientSecret();

  const tokenRes = await axios.post(
    'https://www.linkedin.com/oauth/v2/accessToken',
    new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: oauthRedirectUri('linkedin'),
      client_id: clientId,
      client_secret: clientSecret,
    }),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
  );

  const accessToken = tokenRes.data.access_token;
  const profile = await axios.get('https://api.linkedin.com/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  return {
    platform: 'linkedin',
    accessToken,
    refreshToken: tokenRes.data.refresh_token,
    accountId: profile.data.sub,
    accountName: profile.data.name || profile.data.email || 'LinkedIn',
    expiresAt: tokenRes.data.expires_in
      ? new Date(Date.now() + tokenRes.data.expires_in * 1000)
      : undefined,
  };
};

const exchangeTwitterCode = async (code, codeVerifier) => {
  const clientId = PLATFORM_ENV_KEYS.twitter.clientId();
  const clientSecret = PLATFORM_ENV_KEYS.twitter.clientSecret();

  const tokenRes = await axios.post(
    'https://api.twitter.com/2/oauth2/token',
    new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: oauthRedirectUri('twitter'),
      code_verifier: codeVerifier,
      client_id: clientId,
    }),
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      },
    },
  );

  const accessToken = tokenRes.data.access_token;
  const profile = await axios.get('https://api.twitter.com/2/users/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  return {
    platform: 'twitter',
    accessToken,
    refreshToken: tokenRes.data.refresh_token,
    accountId: profile.data.data.id,
    accountName: profile.data.data.username ? `@${profile.data.data.username}` : 'X / Twitter',
    expiresAt: tokenRes.data.expires_in
      ? new Date(Date.now() + tokenRes.data.expires_in * 1000)
      : undefined,
  };
};

const META_SCOPES = [
  'instagram_basic',
  'instagram_content_publish',
  'pages_show_list',
  'pages_read_engagement',
  'pages_manage_posts',
  'business_management',
].join(',');

const getMetaAppCredentials = () => ({
  clientId: PLATFORM_ENV_KEYS.instagram.clientId(),
  clientSecret: PLATFORM_ENV_KEYS.instagram.clientSecret(),
});

const getMetaAuthUrl = (userId, options = {}) => {
  const { clientId } = getMetaAppCredentials();
  if (!clientId) throw new Error('Meta/Facebook OAuth is not configured');

  const state = crypto.randomBytes(24).toString('hex');
  rememberState(state, { userId, platform: 'meta', returnTo: options.returnTo });

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: oauthRedirectUri('facebook'),
    state,
    response_type: 'code',
  });

  const configId = getMetaLoginConfigId();
  if (configId) {
    params.set('config_id', configId);
    params.set('override_default_response_type', 'true');
  } else {
    params.set('scope', META_SCOPES);
  }

  return `https://www.facebook.com/v20.0/dialog/oauth?${params.toString()}`;
};

const exchangeForLongLivedUserToken = async (shortToken) => {
  const { clientId, clientSecret } = getMetaAppCredentials();
  const res = await axios.get('https://graph.facebook.com/v20.0/oauth/access_token', {
    params: {
      grant_type: 'fb_exchange_token',
      client_id: clientId,
      client_secret: clientSecret,
      fb_exchange_token: shortToken,
    },
  });
  return res.data.access_token;
};

const exchangeMetaCode = async (code) => {
  const { clientId, clientSecret } = getMetaAppCredentials();
  const redirectUri = oauthRedirectUri('facebook');

  const tokenRes = await axios.get('https://graph.facebook.com/v20.0/oauth/access_token', {
    params: {
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      code,
    },
  });

  const longLivedUserToken = await exchangeForLongLivedUserToken(tokenRes.data.access_token);

  const pagesRes = await axios.get('https://graph.facebook.com/v20.0/me/accounts', {
    params: {
      access_token: longLivedUserToken,
      fields: 'id,name,access_token,instagram_business_account{id,username,name}',
    },
  });

  const pages = pagesRes.data?.data || [];
  if (!pages.length) {
    throw new Error('No Facebook Pages found on this account. Create a Facebook Page and try again.');
  }

  const page = pages.find((p) => p.instagram_business_account) || pages[0];
  if (!page.access_token) {
    throw new Error('Could not get a Page access token. Confirm you are an admin on the Page.');
  }

  const accounts = [{
    platform: 'facebook',
    accessToken: page.access_token,
    accountId: page.id,
    accountName: page.name || 'Facebook Page',
  }];

  const ig = page.instagram_business_account;
  if (ig?.id) {
    accounts.push({
      platform: 'instagram',
      accessToken: page.access_token,
      accountId: ig.id,
      accountName: ig.username ? `@${ig.username}` : (ig.name || 'Instagram'),
    });
  }

  return accounts;
};

const getOAuthUrl = (platform, userId, options = {}) => {
  if (platform === 'linkedin') return getLinkedInAuthUrl(userId, options);
  if (platform === 'twitter') return getTwitterAuthUrl(userId, options);
  if (platform === 'instagram' || platform === 'facebook') return getMetaAuthUrl(userId, options);
  throw new Error(`OAuth is not available for ${platform} yet — connect manually with an access token`);
};

const exchangeOAuthCode = async (platform, code, statePayload) => {
  if (platform === 'linkedin') return exchangeLinkedInCode(code);
  if (platform === 'twitter') return exchangeTwitterCode(code, statePayload.codeVerifier);
  if (platform === 'meta') return exchangeMetaCode(code);
  throw new Error(`OAuth callback not supported for ${platform}`);
};

const saveAccountsOnUser = (user, accounts) => {
  for (const account of accounts) {
    const existingIdx = user.socialAccounts.findIndex((a) => a.platform === account.platform);
    if (existingIdx >= 0) user.socialAccounts[existingIdx] = account;
    else user.socialAccounts.push(account);
  }
};

module.exports = {
  getOAuthUrl,
  exchangeOAuthCode,
  exchangeMetaCode,
  saveAccountsOnUser,
  rememberState,
  consumeState,
};
