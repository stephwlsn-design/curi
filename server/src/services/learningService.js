const UserPreferences = require('../models/UserPreferences');

const bump = (arr, name, amount = 1) => {
  const idx = arr.findIndex(i => i.name === name);
  if (idx >= 0) arr[idx].weight += amount;
  else arr.push({ name, weight: amount });
  return arr;
};

const recordInteraction = async ({ workspaceId, userId, style, format, channel, theme, templateId, score }) => {
  let prefs = await UserPreferences.findOne({ workspace: workspaceId });
  if (!prefs) {
    prefs = new UserPreferences({ workspace: workspaceId, user: userId, styles: [], formats: [], channels: [], themes: [], templateUsage: [], creativePerformance: [] });
  }

  if (style) prefs.styles = bump(prefs.styles, style);
  if (format) prefs.formats = bump(prefs.formats, format);
  if (channel) prefs.channels = bump(prefs.channels, channel);
  if (theme) prefs.themes = bump(prefs.themes, theme);

  if (templateId) {
    const t = prefs.templateUsage.find(x => x.templateId === templateId);
    if (t) t.count += 1;
    else prefs.templateUsage.push({ templateId, count: 1, saves: 0 });
  }

  if (score && format) {
    const cp = prefs.creativePerformance.find(x => x.type === format);
    if (cp) {
      cp.count += 1;
      cp.avgScore = Math.round((cp.avgScore * (cp.count - 1) + score) / cp.count);
    } else {
      prefs.creativePerformance.push({ type: format, avgScore: score, count: 1 });
    }
  }

  await prefs.save();
  return prefs;
};

const getTopPreferences = (prefs) => {
  const sort = (arr) => [...(arr || [])].sort((a, b) => b.weight - a.weight).slice(0, 5);
  return {
    styles: sort(prefs?.styles),
    formats: sort(prefs?.formats),
    channels: sort(prefs?.channels),
    themes: sort(prefs?.themes),
  };
};

module.exports = { recordInteraction, getTopPreferences };
