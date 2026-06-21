const { getDefaultAccount } = require('../config/social');

const normalizePlatform = (platform) => {
  if (platform === 'x') return 'twitter';
  if (platform === 'universal') return 'instagram';
  return platform;
};

const resolveSocialAccount = (user, platform) => {
  const resolved = normalizePlatform(platform);
  const userAccount = user?.socialAccounts?.find(
    (a) => a.platform === resolved || a.platform === platform,
  );
  if (userAccount?.accessToken) {
    return {
      platform: resolved,
      accountId: userAccount.accountId,
      accountName: userAccount.accountName,
      accessToken: userAccount.accessToken,
      refreshToken: userAccount.refreshToken,
      source: 'user',
    };
  }

  const envAccount = getDefaultAccount(resolved);
  if (envAccount?.accessToken) return envAccount;

  return null;
};

const listAccountsForUser = (user) => {
  const platforms = ['linkedin', 'twitter', 'instagram', 'facebook'];
  return platforms.map((platform) => {
    const userAccount = user?.socialAccounts?.find((a) => a.platform === platform);
    const envAccount = getDefaultAccount(platform);
    const connected = Boolean(userAccount?.accessToken || envAccount?.accessToken);
    return {
      platform,
      connected,
      accountName: userAccount?.accountName || envAccount?.accountName || null,
      source: userAccount?.accessToken ? 'user' : (envAccount?.accessToken ? 'workspace' : null),
    };
  });
};

module.exports = { resolveSocialAccount, listAccountsForUser, normalizePlatform };
