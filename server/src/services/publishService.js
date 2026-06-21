const axios = require('axios');
const logger = require('../utils/logger');
const { clientUrl } = require('../config/social');

const absoluteUrl = (value) => {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  const base = clientUrl();
  return `${base}${value.startsWith('/') ? value : `/${value}`}`;
};

const buildPostText = (content) => {
  const body = String(content.content || content.title || '').trim();
  const tags = (content.hashtags || [])
    .map((h) => `#${String(h).replace(/^#+/, '')}`)
    .filter(Boolean);
  if (!tags.length) return body;
  return `${body}\n\n${tags.join(' ')}`.trim();
};

const publishToLinkedIn = async ({ content, account }) => {
  const text = buildPostText(content);
  const imageUrl = absoluteUrl(content.mediaUrl || content.thumbnailUrl);
  const headers = {
    Authorization: `Bearer ${account.accessToken}`,
    'Content-Type': 'application/json',
    'X-Restli-Protocol-Version': '2.0.0',
  };

  const shareContent = {
    shareCommentary: { text },
    shareMediaCategory: imageUrl ? 'IMAGE' : 'NONE',
  };

  if (imageUrl) {
    shareContent.media = [{
      status: 'READY',
      originalUrl: imageUrl,
    }];
  }

  const res = await axios.post(
    'https://api.linkedin.com/v2/ugcPosts',
    {
      author: `urn:li:person:${account.accountId}`,
      lifecycleState: 'PUBLISHED',
      specificContent: { 'com.linkedin.ugc.ShareContent': shareContent },
      visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
    },
    { headers },
  );

  const postId = res.headers['x-restli-id'] || res.data?.id;
  return { platformPostId: postId, url: postId ? `https://linkedin.com/feed/update/${postId}` : undefined };
};

const publishToTwitter = async ({ content, account }) => {
  const text = buildPostText(content).slice(0, 280);
  const res = await axios.post(
    'https://api.twitter.com/2/tweets',
    { text },
    {
      headers: {
        Authorization: `Bearer ${account.accessToken}`,
        'Content-Type': 'application/json',
      },
    },
  );
  const tweetId = res.data?.data?.id;
  return { platformPostId: tweetId, url: tweetId ? `https://x.com/i/web/status/${tweetId}` : undefined };
};

const publishToInstagram = async ({ content, account }) => {
  const imageUrl = absoluteUrl(content.mediaUrl || content.thumbnailUrl);
  if (!imageUrl) throw new Error('Instagram posts require an image — save or attach a design first');

  const caption = buildPostText(content);
  const container = await axios.post(
    `https://graph.facebook.com/v20.0/${account.accountId}/media`,
    { image_url: imageUrl, caption, access_token: account.accessToken },
  );

  const published = await axios.post(
    `https://graph.facebook.com/v20.0/${account.accountId}/media_publish`,
    { creation_id: container.data.id, access_token: account.accessToken },
  );

  const postId = published.data.id;
  return { platformPostId: postId, url: `https://instagram.com/p/${postId}` };
};

const publishToFacebook = async ({ content, account }) => {
  const message = buildPostText(content);
  const mediaUrl = absoluteUrl(content.mediaUrl || content.thumbnailUrl);
  const endpoint = mediaUrl
    ? `https://graph.facebook.com/v20.0/${account.accountId}/photos`
    : `https://graph.facebook.com/v20.0/${account.accountId}/feed`;

  const body = mediaUrl
    ? { url: mediaUrl, caption: message, access_token: account.accessToken }
    : { message, access_token: account.accessToken };

  const res = await axios.post(endpoint, body);
  const postId = res.data.id;
  return { platformPostId: postId, url: `https://facebook.com/${postId}` };
};

const PUBLISHERS = {
  linkedin: publishToLinkedIn,
  twitter: publishToTwitter,
  instagram: publishToInstagram,
  facebook: publishToFacebook,
};

const publish = async ({ content, socialAccount, platform }) => {
  const publisher = PUBLISHERS[platform];
  if (!publisher) throw new Error(`Publishing to ${platform} is not supported yet`);

  if (!socialAccount?.accessToken) {
    throw new Error(`No ${platform} account connected — connect in Settings → Publishing`);
  }
  if (platform === 'linkedin' && !socialAccount.accountId) {
    throw new Error('LinkedIn account ID missing — reconnect your LinkedIn account');
  }
  if (platform === 'instagram' && !socialAccount.accountId) {
    throw new Error('Instagram business account ID missing — add INSTAGRAM_BUSINESS_ACCOUNT_ID or reconnect');
  }
  if (platform === 'facebook' && !socialAccount.accountId) {
    throw new Error('Facebook page ID missing — add FACEBOOK_PAGE_ID or reconnect');
  }

  logger.info(`Publishing content ${content._id} to ${platform} (${socialAccount.accountName || socialAccount.source})`);
  return publisher({ content, account: socialAccount });
};

module.exports = { publish, buildPostText, absoluteUrl };
