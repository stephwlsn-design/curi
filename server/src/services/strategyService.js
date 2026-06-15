const Strategy = require('../models/Strategy');
const CalendarEntry = require('../models/CalendarEntry');
const { generateJSON } = require('./llmService');

const FORMATS = ['post', 'carousel', 'story', 'video', 'reel'];

const normalizeFormat = (format) => {
  const t = String(format || 'post').toLowerCase();
  if (t.includes('carousel')) return 'carousel';
  if (t.includes('story')) return 'story';
  if (t.includes('reel')) return 'reel';
  if (t.includes('video')) return 'video';
  if (t.includes('ad')) return 'ad_creative';
  return 'post';
};

const normalizeChannel = (channel) => {
  const c = String(channel || 'linkedin').toLowerCase().replace(/[^a-z]/g, '');
  const map = { linkedin: 'linkedin', twitter: 'twitter', x: 'twitter', instagram: 'instagram', facebook: 'facebook', tiktok: 'tiktok' };
  return map[c] || 'linkedin';
};

const generateStrategy = async ({ workspaceId, userId, brandProfile, topics, days = 30, channels = ['linkedin', 'instagram'], preferences = null, runId = null, maxEntries = null }) => {
  const entryCount = maxEntries || Math.min(days, 30);
  const prefHint = preferences
    ? `User preferences: styles=${preferences.styles?.map(s => s.name).join(',')}, formats=${preferences.formats?.map(f => f.name).join(',')}`
    : '';

  const parsed = await generateJSON({
    label: 'Strategy',
    system: 'You are a content strategist. Return ONLY valid JSON. Use format values exactly: post, carousel, story, video, reel.',
    user: `${prefHint}
Brand: ${brandProfile?.name}, Industry: ${brandProfile?.industry}
Channels: ${channels.join(', ')}
Days: ${days}
Topics: ${topics.slice(0, 15).map(t => t.topic).join(', ')}

Generate exactly ${entryCount} calendar items spread across ${days} days. Mix formats (post, carousel, story, video, reel) across channels.
Return JSON:
{
  "name": "30-Day Strategy",
  "items": [{ "day": 1, "topic": "...", "channel": "linkedin", "format": "carousel", "publishTime": "09:00", "priority": 1 }],
  "clusters": [{ "name": "AI Agents Week", "topics": ["..."], "channels": ["linkedin"] }]
}`,
    temperature: 0.75,
  });

  const items = (parsed.items || []).slice(0, entryCount);

  const strategy = await Strategy.create({
    workspace: workspaceId,
    createdBy: userId,
    name: parsed.name || `${days}-Day Content Strategy`,
    days,
    items: items,
    clusters: parsed.clusters || [],
    status: 'active',
    autonomousRun: runId,
  });

  const entries = [];
  for (const item of strategy.items) {
    const entry = await CalendarEntry.create({
      workspace: workspaceId,
      day: item.day,
      platform: normalizeChannel(item.channel),
      type: normalizeFormat(item.format),
      topic: item.topic,
      publishTime: item.publishTime || '09:00',
      strategy: strategy._id,
      autonomousRun: runId,
      status: 'planned',
    });
    entries.push(entry);
  }

  return { strategy, entries };
};

module.exports = { generateStrategy, FORMATS, normalizeFormat, normalizeChannel };
