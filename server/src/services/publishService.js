const axios = require('axios');
const logger = require('../utils/logger');

const PUBLISHERS = {
  linkedin: async ({ content, account }) => {
    const res = await axios.post(
      'https://api.linkedin.com/v2/ugcPosts',
      {
        author: `urn:li:person:${account.accountId}`,
        lifecycleState: 'PUBLISHED',
        specificContent: {
          'com.linkedin.ugc.ShareContent': {
            shareCommentary: { text: content.content },
            shareMediaCategory: 'NONE',
          }
        },
        visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' }
      },
      { headers: { Authorization: `Bearer ${account.accessToken}`, 'Content-Type': 'application/json' } }
    );
    return { platformPostId: res.headers['x-restli-id'], url: `https://linkedin.com/feed/update/${res.headers['x-restli-id']}` };
  },

  twitter: async ({ content, account }) => {
    const res = await axios.post(
      'https://api.twitter.com/2/tweets',
      { text: content.content.slice(0, 280) },
      { headers: { Authorization: `Bearer ${account.accessToken}`, 'Content-Type': 'application/json' } }
    );
    return { platformPostId: res.data.data.id, url: `https://x.com/i/web/status/${res.data.data.id}` };
  },
};

const publish = async ({ content, socialAccount, platform }) => {
  const publisher = PUBLISHERS[platform];
  if (!publisher) throw new Error(`Publisher not implemented for ${platform}`);
  logger.info(`Publishing to ${platform} for account ${socialAccount.accountId}`);
  return publisher({ content, account: socialAccount });
};

module.exports = { publish };
