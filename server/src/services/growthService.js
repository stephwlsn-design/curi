const Content = require('../models/Content');
const CalendarEntry = require('../models/CalendarEntry');
const WorkflowDraft = require('../models/WorkflowDraft');
const Topic = require('../models/Topic');

const parsePublishTime = (day, publishTime = '09:00') => {
  const when = new Date();
  when.setDate(when.getDate() + Math.max(0, Number(day || 1) - 1));
  const [h, m] = String(publishTime).split(':');
  when.setHours(parseInt(h, 10) || 9, parseInt(m, 10) || 0, 0, 0);
  return when;
};

const saveCalendarToQueue = async ({ workspaceId, userId, entries = [], goal }) => {
  const saved = [];

  for (const entry of entries) {
    const scheduledAt = parsePublishTime(entry.day, entry.publishTime);
    const calendarEntry = await CalendarEntry.create({
      workspace: workspaceId,
      day: entry.day,
      date: entry.date ? new Date(entry.date) : scheduledAt,
      platform: entry.platform,
      type: entry.type || 'post',
      topic: entry.topic,
      caption: entry.caption,
      publishTime: entry.publishTime || '09:00',
      status: 'planned',
    });

    const content = await Content.create({
      workspace: workspaceId,
      createdBy: userId,
      type: 'post',
      platform: entry.platform || 'linkedin',
      title: entry.topic || 'Calendar post',
      content: entry.caption || entry.topic || '',
      status: 'review',
      calendarEntry: calendarEntry._id,
      metadata: {
        module: 'calendar',
        suggestedScheduledAt: scheduledAt,
        suggestedPlatform: entry.platform,
        campaignDay: entry.day,
        calendarGoal: goal || undefined,
      },
    });

    calendarEntry.content = content._id;
    await calendarEntry.save();
    saved.push({ contentId: content._id, calendarEntryId: calendarEntry._id });
  }

  return { saved, count: saved.length };
};

const saveRepurposedFormats = async ({ workspaceId, userId, formats = [], sourceType }) => {
  const saved = [];
  for (const format of formats) {
    const item = await Content.create({
      workspace: workspaceId,
      createdBy: userId,
      type: 'post',
      platform: format.type === 'tweet' ? 'twitter' : (format.type || 'universal'),
      title: format.title || `${format.type} repurposed content`,
      content: format.content,
      status: 'draft',
      metadata: { module: 'repurpose', format: format.type, sourceType },
    });
    saved.push(item);
  }
  return { saved, count: saved.length };
};

const saveTrends = async ({ workspaceId, userId, trends = [], industry }) => {
  const saved = [];
  for (const trend of trends) {
    const topic = await Topic.create({
      workspace: workspaceId,
      topic: trend.topic,
      relevance: trend.relevance || 70,
      source: 'trend',
      metadata: {
        platform: trend.platform,
        contentIdea: trend.contentIdea,
        hashtags: trend.hashtags || [],
        industry,
        scannedBy: userId,
      },
    });
    saved.push(topic);
  }
  return { saved, count: saved.length };
};

const saveCompetitorAnalysis = async ({ workspaceId, userId, analysis, competitorUrl, competitorName }) => {
  const draft = await WorkflowDraft.create({
    workspace: workspaceId,
    createdBy: userId,
    title: `Competitor: ${analysis?.competitor || competitorName || competitorUrl || 'Analysis'}`,
    currentStep: 'competitor',
    currentPath: '/competitor',
    modules: {
      competitor: {
        url: competitorUrl,
        name: competitorName,
        analysis,
        savedAt: new Date(),
      },
    },
  });
  return draft;
};

module.exports = {
  saveCalendarToQueue,
  saveRepurposedFormats,
  saveTrends,
  saveCompetitorAnalysis,
  parsePublishTime,
};
