const CHANNELS = {
  instagram: { label: 'Instagram', width: 1080, height: 1080, safeZone: 'center-weighted' },
  facebook: { label: 'Facebook', width: 1200, height: 628, safeZone: 'text-left' },
  linkedin: { label: 'LinkedIn', width: 1200, height: 628, safeZone: 'professional' },
  tiktok: { label: 'TikTok', width: 1080, height: 1920, safeZone: 'vertical-center' },
  twitter: { label: 'X', width: 1200, height: 675, safeZone: 'minimal-text' },
  pinterest: { label: 'Pinterest', width: 1000, height: 1500, safeZone: 'vertical' },
  youtube: { label: 'YouTube', width: 1920, height: 1080, safeZone: 'thumbnail-safe' },
  google_ads: { label: 'Google Ads', width: 1200, height: 628, safeZone: 'cta-right' },
  display: { label: 'Display Ads', width: 300, height: 250, safeZone: 'compact' },
  email: { label: 'Email', width: 600, height: 400, safeZone: 'email-header' },
  website: { label: 'Website', width: 1920, height: 1080, safeZone: 'hero' },
};

const DIMENSIONS = [
  { id: '1080x1080', label: '1080 x 1080', width: 1080, height: 1080 },
  { id: '1080x1350', label: '1080 x 1350', width: 1080, height: 1350 },
  { id: '1080x1920', label: '1080 x 1920', width: 1080, height: 1920 },
  { id: '1920x1080', label: '1920 x 1080', width: 1920, height: 1080 },
  { id: '1200x628', label: '1200 x 628', width: 1200, height: 628 },
];

const CREATIVE_TYPES = [
  'social_post', 'carousel', 'story', 'ad_creative', 'banner', 'thumbnail',
  'infographic', 'presentation', 'email_graphic', 'website_hero', 'product_showcase', 'event_promotion',
];

const DESIGN_STYLES = [
  'modern', 'luxury', 'corporate', 'startup', 'minimal', 'bold', 'retro',
  'futuristic', 'luxury_fashion', 'tech', 'saas', 'gaming', 'ai_native',
];

const VIDEO_TYPES = [
  'talking_head', 'ai_avatar', 'motion_graphics', 'product_showcase',
  'animated_explainer', 'ugc_style', 'broll_storytelling', 'slideshow', 'podcast_clip',
];

const VIDEO_STYLES = [
  'professional', 'energetic', 'friendly', 'luxury', 'corporate', 'influencer',
  'alex_hormozi', 'apple', 'nike', 'mr_beast', 'luxury_brand', 'startup', 'ai_saas',
];

const VOICES = ['professional', 'energetic', 'friendly', 'luxury', 'corporate', 'influencer'];

module.exports = {
  CHANNELS, DIMENSIONS, CREATIVE_TYPES, DESIGN_STYLES, VIDEO_TYPES, VIDEO_STYLES, VOICES,
};
