const createService = require('./createService');
const Content = require('../models/Content');
const Campaign = require('../models/Campaign');
const Workspace = require('../models/Workspace');
const logger = require('../utils/logger');
const { generateJSON, generateText } = require('./llmService');

const generateCampaign = async ({ campaignId, workspaceId, goal, timeline, budget, userId }) => {
  try {
    const workspace = await Workspace.findById(workspaceId);
    const campaign = await Campaign.findById(campaignId);
    const brandProfile = workspace.brandProfile || {};
    const contentIds = [];

    const platforms = ['linkedin', 'twitter', 'instagram', 'facebook'];
    const topics = await generateCampaignTopics(goal, brandProfile, 20);

    for (let i = 0; i < Math.min(topics.length, 20); i++) {
      const platform = platforms[i % platforms.length];
      try {
        const generated = await createService.generatePost({ brandProfile, platform, topic: topics[i], tone: brandProfile.voice || 'professional' });
        const content = await Content.create({
          workspace: workspaceId, createdBy: userId, type: 'post', platform,
          content: generated.content, hashtags: generated.hashtags, campaign: campaignId, status: 'draft'
        });
        contentIds.push(content._id);
      } catch (e) { logger.error(`Post generation failed: ${e.message}`); }
    }

    const strategy = await generateText({
      label: 'Launch',
      user: `Create a ${timeline}-day campaign strategy for: "${goal}". Brand: ${brandProfile.name}. Budget: ${budget || 'flexible'}. Return as a structured markdown document.`,
    });

    campaign.content = contentIds;
    campaign.status = 'draft';
    campaign.strategy = strategy;
    await campaign.save();

    logger.info(`Campaign ${campaignId} generated with ${contentIds.length} content pieces`);
  } catch (err) {
    logger.error(`Campaign generation failed: ${err.message}`);
    await Campaign.findByIdAndUpdate(campaignId, { status: 'draft' });
  }
};

const generateCampaignTopics = async (goal, brandProfile, count) => {
  const data = await generateJSON({
    label: 'LaunchTopics',
    system: 'Return ONLY valid JSON.',
    user: `Generate ${count} distinct content topic ideas for a campaign goal: "${goal}". Brand: ${brandProfile.name || 'startup'}, industry: ${brandProfile.industry || 'tech'}. Return JSON: { "topics": ["topic1", "..."] }`,
  });
  return data.topics || [];
};

module.exports = { generateCampaign };
