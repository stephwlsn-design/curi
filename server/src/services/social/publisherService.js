const axios = require('axios');
const logger = require('../../utils/logger');

/**
 * Publish to LinkedIn
 */
async function publishToLinkedIn({ accessToken, accountId, text, mediaUrls = [] }) {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    'X-Restli-Protocol-Version': '2.0.0',
  };

  // Build share content
  const shareContent = {
    author: `urn:li:person:${accountId}`,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': {
        shareCommentary: { text },
        shareMediaCategory: mediaUrls.length ? 'IMAGE' : 'NONE',
      },
    },
    visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
  };

  const response = await axios.post('https://api.linkedin.com/v2/ugcPosts', shareContent, { headers });
  return { platformPostId: response.data.id, url: `https://linkedin.com/feed/update/${response.data.id}` };
}

/**
 * Publish to X/Twitter
 */
async function publishToTwitter({ accessToken, accessTokenSecret, text, mediaIds = [] }) {
  // Using Twitter API v2
  const body = { text };
  if (mediaIds.length) body.media = { media_ids: mediaIds };

  const response = await axios.post('https://api.twitter.com/2/tweets', body, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  const tweetId = response.data.data.id;
  return { platformPostId: tweetId, url: `https://x.com/i/web/status/${tweetId}` };
}

/**
 * Publish to Instagram via Graph API
 */
async function publishToInstagram({ accessToken, accountId, imageUrl, caption }) {
  // Step 1: Create container
  const containerResponse = await axios.post(
    `https://graph.facebook.com/v20.0/${accountId}/media`,
    { image_url: imageUrl, caption, access_token: accessToken }
  );

  const containerId = containerResponse.data.id;

  // Step 2: Publish container
  const publishResponse = await axios.post(
    `https://graph.facebook.com/v20.0/${accountId}/media_publish`,
    { creation_id: containerId, access_token: accessToken }
  );

  const postId = publishResponse.data.id;
  return { platformPostId: postId, url: `https://instagram.com/p/${postId}` };
}

/**
 * Publish to Facebook Page
 */
async function publishToFacebook({ accessToken, pageId, message, mediaUrl }) {
  const body = { message, access_token: accessToken };
  if (mediaUrl) body.url = mediaUrl;

  const endpoint = mediaUrl
    ? `https://graph.facebook.com/v20.0/${pageId}/photos`
    : `https://graph.facebook.com/v20.0/${pageId}/feed`;

  const response = await axios.post(endpoint, body);
  return { platformPostId: response.data.id, url: `https://facebook.com/${response.data.id}` };
}

/**
 * Main publish dispatcher — routes to correct platform
 */
async function publishContent({ platform, content, socialAccount }) {
  logger.info(`Publishing to ${platform}: ${content._id}`);

  try {
    let result;

    switch (platform) {
      case 'linkedin':
        result = await publishToLinkedIn({
          accessToken: socialAccount.accessToken,
          accountId: socialAccount.accountId,
          text: content.text,
          mediaUrls: content.assets?.map(a => a.url) || [],
        });
        break;

      case 'twitter':
        result = await publishToTwitter({
          accessToken: socialAccount.accessToken,
          text: content.text,
        });
        break;

      case 'instagram':
        result = await publishToInstagram({
          accessToken: socialAccount.accessToken,
          accountId: socialAccount.accountId,
          imageUrl: content.assets?.[0]?.url,
          caption: `${content.text}\n\n${content.hashtags?.map(h => `#${h}`).join(' ') || ''}`,
        });
        break;

      case 'facebook':
        result = await publishToFacebook({
          accessToken: socialAccount.accessToken,
          pageId: socialAccount.accountId,
          message: content.text,
          mediaUrl: content.assets?.[0]?.url,
        });
        break;

      default:
        throw new Error(`Platform ${platform} not yet supported`);
    }

    return {
      success: true,
      platform,
      platformPostId: result.platformPostId,
      url: result.url,
      publishedAt: new Date(),
    };
  } catch (err) {
    logger.error(`Publish error on ${platform}:`, err.message);
    return { success: false, platform, error: err.message };
  }
}

/**
 * OAuth URL generators
 */
function getLinkedInOAuthUrl(redirectUri, state) {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.LINKEDIN_CLIENT_ID,
    redirect_uri: redirectUri,
    scope: 'r_liteprofile r_emailaddress w_member_social',
    state,
  });
  return `https://www.linkedin.com/oauth/v2/authorization?${params}`;
}

function getTwitterOAuthUrl(redirectUri, state) {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.TWITTER_CLIENT_ID,
    redirect_uri: redirectUri,
    scope: 'tweet.read tweet.write users.read offline.access',
    state,
    code_challenge: 'challenge',
    code_challenge_method: 'plain',
  });
  return `https://twitter.com/i/oauth2/authorize?${params}`;
}

module.exports = {
  publishContent,
  getLinkedInOAuthUrl,
  getTwitterOAuthUrl,
};
