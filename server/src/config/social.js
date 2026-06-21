const pick = (...values) => values.find((v) => typeof v === 'string' && v.trim())?.trim() || '';

const clientUrl = () => pick(
  process.env.PUBLIC_API_URL,
  process.env.CLIENT_URL?.split(',')[0],
  process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '',
  'http://localhost:5001',
).replace(/\/$/, '');

const oauthRedirectUri = (platform) => `${clientUrl()}/api/publish/callback/${platform}`;

const PLATFORM_ENV_KEYS = {
  linkedin: {
    clientId: () => pick(process.env.LINKEDIN_CLIENT_ID),
    clientSecret: () => pick(process.env.LINKEDIN_CLIENT_SECRET),
    accessToken: () => pick(process.env.LINKEDIN_ACCESS_TOKEN),
    accountId: () => pick(process.env.LINKEDIN_PERSON_ID, process.env.LINKEDIN_ACCOUNT_ID),
    accountName: () => pick(process.env.LINKEDIN_ACCOUNT_NAME, 'LinkedIn'),
  },
  twitter: {
    clientId: () => pick(process.env.TWITTER_CLIENT_ID, process.env.X_CONSUMER_KEY),
    clientSecret: () => pick(process.env.TWITTER_CLIENT_SECRET, process.env.X_SECRET_KEY),
    accessToken: () => pick(process.env.TWITTER_ACCESS_TOKEN, process.env.X_ACCESS_TOKEN),
    accessTokenSecret: () => pick(process.env.TWITTER_ACCESS_TOKEN_SECRET, process.env.X_ACCESS_TOKEN_SECRET),
    accountId: () => pick(process.env.TWITTER_USER_ID, process.env.X_USER_ID),
    accountName: () => pick(process.env.TWITTER_USERNAME, process.env.X_USERNAME, 'X / Twitter'),
    bearerToken: () => pick(process.env.TWITTER_BEARER_TOKEN, process.env.X_BEARER_TOKEN),
  },
  instagram: {
    clientId: () => pick(process.env.INSTAGRAM_APP_ID, process.env.INSTAGRAM_CLIENT_ID),
    clientSecret: () => pick(process.env.INSTAGRAM_APP_SECRET, process.env.INSTAGRAM_CLIENT_SECRET),
    accessToken: () => pick(process.env.INSTAGRAM_ACCESS_TOKEN),
    accountId: () => pick(process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID, process.env.INSTAGRAM_ACCOUNT_ID),
    accountName: () => pick(process.env.INSTAGRAM_ACCOUNT_NAME, 'Instagram'),
  },
  facebook: {
    clientId: () => pick(process.env.FACEBOOK_CLIENT_ID, process.env.INSTAGRAM_APP_ID),
    clientSecret: () => pick(process.env.FACEBOOK_CLIENT_SECRET, process.env.INSTAGRAM_APP_SECRET),
    accessToken: () => pick(process.env.FACEBOOK_PAGE_ACCESS_TOKEN, process.env.FACEBOOK_ACCESS_TOKEN),
    accountId: () => pick(process.env.FACEBOOK_PAGE_ID),
    accountName: () => pick(process.env.FACEBOOK_PAGE_NAME, 'Facebook Page'),
  },
};

const getDefaultAccount = (platform) => {
  const cfg = PLATFORM_ENV_KEYS[platform];
  if (!cfg) return null;

  const accessToken = cfg.accessToken?.();
  if (!accessToken) return null;

  return {
    platform,
    accountId: cfg.accountId?.() || '',
    accountName: cfg.accountName?.() || platform,
    accessToken,
    refreshToken: cfg.accessTokenSecret?.() || undefined,
    source: 'env',
  };
};

const isPlatformConfigured = (platform) => {
  const cfg = PLATFORM_ENV_KEYS[platform];
  if (!cfg) return false;
  return Boolean(cfg.accessToken?.());
};

const isOAuthConfigured = (platform) => {
  if (platform === 'instagram' || platform === 'facebook') return isMetaOAuthConfigured();
  const cfg = PLATFORM_ENV_KEYS[platform];
  if (!cfg) return false;
  return Boolean(cfg.clientId?.() && cfg.clientSecret?.());
};

const isMetaOAuthConfigured = () => Boolean(
  PLATFORM_ENV_KEYS.instagram.clientId?.()
  && PLATFORM_ENV_KEYS.instagram.clientSecret?.(),
);

const listConfiguredPlatforms = () => (
  ['linkedin', 'twitter', 'instagram', 'facebook'].filter(isPlatformConfigured)
);

const getMetaLoginConfigId = () => pick(
  process.env.FACEBOOK_LOGIN_CONFIG_ID,
  process.env.META_LOGIN_CONFIG_ID,
);

module.exports = {
  clientUrl,
  oauthRedirectUri,
  getMetaLoginConfigId,
  PLATFORM_ENV_KEYS,
  getDefaultAccount,
  isPlatformConfigured,
  isOAuthConfigured,
  isMetaOAuthConfigured,
  listConfiguredPlatforms,
};
