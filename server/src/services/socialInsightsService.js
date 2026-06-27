const axios = require('axios');
const mongoose = require('mongoose');
const Content = require('../models/Content');
const PublishJob = require('../models/PublishJob');
const { findAccessibleWorkspace } = require('../utils/workspaceAccess');
const { listAccountsForUser, resolveSocialAccount } = require('./socialAccountService');

const PLATFORMS = ['linkedin', 'twitter', 'instagram', 'facebook'];

const emptyMetrics = () => ({
  impressions: 0,
  reach: 0,
  likes: 0,
  comments: 0,
  shares: 0,
  clicks: 0,
  saves: 0,
  publishedPosts: 0,
  scheduledPosts: 0,
});

const sumAnalytics = (target, analytics = {}) => {
  target.impressions += analytics.impressions || 0;
  target.reach += analytics.reach || 0;
  target.likes += analytics.likes || 0;
  target.comments += analytics.comments || 0;
  target.shares += analytics.shares || 0;
  target.clicks += analytics.clicks || 0;
  target.saves += analytics.saves || 0;
};

const engagementTotal = (m) => (m.likes || 0) + (m.comments || 0) + (m.shares || 0) + (m.saves || 0);

const engagementRate = (m) => {
  const base = m.impressions || m.reach || 0;
  if (!base) return 0;
  return Math.round((engagementTotal(m) / base) * 1000) / 10;
};

const fetchMetaPageInsights = async (account) => {
  if (!account?.accessToken || !account?.accountId) return null;
  try {
    const { data } = await axios.get(`https://graph.facebook.com/v20.0/${account.accountId}/insights`, {
      params: {
        metric: 'page_impressions,page_post_engagements,page_engaged_users',
        period: 'days_28',
        access_token: account.accessToken,
      },
    });
    const values = Object.fromEntries(
      (data.data || []).map((row) => [row.name, row.values?.[0]?.value || 0]),
    );
    return {
      impressions: Number(values.page_impressions || 0),
      reach: Number(values.page_engaged_users || 0),
      likes: 0,
      comments: 0,
      shares: 0,
      clicks: 0,
      saves: 0,
      engagements: Number(values.page_post_engagements || 0),
      source: 'platform',
    };
  } catch {
    return null;
  }
};

const fetchInstagramInsights = async (account) => {
  if (!account?.accessToken || !account?.accountId) return null;
  try {
    const { data } = await axios.get(`https://graph.facebook.com/v20.0/${account.accountId}/insights`, {
      params: {
        metric: 'impressions,reach,profile_views',
        period: 'days_28',
        access_token: account.accessToken,
      },
    });
    const values = Object.fromEntries(
      (data.data || []).map((row) => [row.name, row.values?.[0]?.value || 0]),
    );
    return {
      impressions: Number(values.impressions || 0),
      reach: Number(values.reach || 0),
      likes: 0,
      comments: 0,
      shares: 0,
      clicks: Number(values.profile_views || 0),
      saves: 0,
      source: 'platform',
    };
  } catch {
    return null;
  }
};

async function getSocialStats({ workspaceId, user }) {
  const workspace = await findAccessibleWorkspace(workspaceId, user._id);
  if (!workspace) {
    const err = new Error('Workspace not found');
    err.status = 404;
    throw err;
  }

  const accounts = listAccountsForUser(user);
  const platformMap = Object.fromEntries(PLATFORMS.map((p) => [p, { platform: p, ...emptyMetrics(), connected: false, accountName: null, source: null }]));

  accounts.forEach((acc) => {
    if (!platformMap[acc.platform]) return;
    platformMap[acc.platform].connected = acc.connected;
    platformMap[acc.platform].accountName = acc.accountName;
    platformMap[acc.platform].source = acc.source;
  });

  const contentItems = await Content.find({
    workspace: workspaceId,
    platform: { $in: PLATFORMS },
    status: { $in: ['published', 'scheduled', 'approved'] },
  }).select('platform status analytics content title publishedAt scheduledAt metadata').lean();

  contentItems.forEach((item) => {
    const bucket = platformMap[item.platform];
    if (!bucket) return;
    if (item.status === 'published') bucket.publishedPosts += 1;
    if (item.status === 'scheduled' || item.status === 'approved') bucket.scheduledPosts += 1;
    sumAnalytics(bucket, item.analytics);
    bucket.source = bucket.source || 'curi';
  });

  const wsId = new mongoose.Types.ObjectId(String(workspaceId));
  const publishJobs = await PublishJob.aggregate([
    { $match: { workspace: wsId } },
    { $group: { _id: { platform: '$platform', status: '$status' }, count: { $sum: 1 } } },
  ]);

  publishJobs.forEach((row) => {
    const platform = row._id.platform;
    const bucket = platformMap[platform];
    if (!bucket) return;
    if (row._id.status === 'published') bucket.publishedPosts = Math.max(bucket.publishedPosts, row.count);
    if (row._id.status === 'queued') bucket.scheduledPosts = Math.max(bucket.scheduledPosts, row.count);
  });

  for (const platform of ['facebook', 'instagram']) {
    const account = resolveSocialAccount(user, platform);
    if (!account?.accessToken) continue;
    const insights = platform === 'instagram'
      ? await fetchInstagramInsights(account)
      : await fetchMetaPageInsights(account);
    if (!insights) continue;
    const bucket = platformMap[platform];
    if (insights.impressions > bucket.impressions) bucket.impressions = insights.impressions;
    if (insights.reach > bucket.reach) bucket.reach = insights.reach;
    if (insights.clicks > bucket.clicks) bucket.clicks = insights.clicks;
    bucket.source = 'platform';
  }

  const platforms = PLATFORMS.map((platform) => {
    const m = platformMap[platform];
    return {
      ...m,
      engagement: engagementTotal(m),
      engagementRate: engagementRate(m),
    };
  });

  const totals = emptyMetrics();
  platforms.forEach((p) => {
    sumAnalytics(totals, p);
    totals.publishedPosts += p.publishedPosts;
    totals.scheduledPosts += p.scheduledPosts;
  });

  const topPosts = await Content.find({
    workspace: workspaceId,
    platform: { $in: PLATFORMS },
    status: 'published',
  })
    .sort({ 'analytics.impressions': -1, publishedAt: -1 })
    .limit(8)
    .select('platform content title analytics publishedAt')
    .lean();

  return {
    accounts,
    totals: {
      ...totals,
      engagement: engagementTotal(totals),
      engagementRate: engagementRate(totals),
    },
    platforms,
    topPosts: topPosts.map((post) => ({
      id: post._id,
      platform: post.platform,
      title: post.title,
      content: post.content,
      publishedAt: post.publishedAt,
      analytics: post.analytics || {},
      engagement: engagementTotal(post.analytics || {}),
    })),
    brandName: workspace.brandProfile?.name || workspace.name || 'Your brand',
  };
}

module.exports = { getSocialStats };
