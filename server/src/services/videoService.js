const { generateJSON } = require('./llmService');
const logger = require('../utils/logger');
const pexelsService = require('./pexelsService');
const { buildBrandBrief } = require('../utils/strategyPrompt');

const SINGLE_VARIANT = 1;

const WORDS_PER_SEC = 2.2;

const conciseWords = (text, maxWords) => {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '';
  if (words.length <= maxWords) return words.join(' ');
  return words.slice(0, maxWords).join(' ');
};

const conciseLine = (text, durationSec = 5) => {
  const sec = Math.max(5, Number(durationSec) || 5);
  const maxWords = Math.max(8, Math.min(16, Math.round(sec * WORDS_PER_SEC)));
  return conciseWords(text, maxWords);
};

const conciseScenes = (scenes = []) => scenes.map((s) => ({
  ...s,
  script: conciseLine(s.script, s.duration || 5),
  visual: s.visual ? conciseWords(s.visual, 10) : s.visual,
}));

const maxNarrationWords = (durationSec = 30) => Math.max(30, Math.round((durationSec || 30) * WORDS_PER_SEC));

const SCENE_HEADER = /^(.+?)\s*\((\d+)\s*s(?:ec(?:ond)?s?)?\)\s*$/i;

const parseNarrationScenes = (text) => {
  const raw = String(text || '').trim();
  if (!raw) return [];

  const blocks = raw.split(/\n\s*\n+/).map((b) => b.trim()).filter(Boolean);
  const scenes = [];

  for (const block of blocks) {
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
    if (!lines.length) continue;

    let label = 'Scene';
    let duration = 5;
    let startIdx = 0;

    const headerMatch = lines[0].match(SCENE_HEADER);
    if (headerMatch) {
      label = headerMatch[1].trim();
      duration = Number(headerMatch[2]) || 5;
      startIdx = 1;
    }

    let visual = '';
    const scriptLines = [];
    for (let i = startIdx; i < lines.length; i += 1) {
      if (/^visual:/i.test(lines[i])) {
        visual = lines[i].replace(/^visual:\s*/i, '').trim();
      } else if (!/^visual:/i.test(lines[i])) {
        scriptLines.push(lines[i]);
      }
    }

    const script = scriptLines.join(' ').trim();
    if (!script || /^visual:/i.test(script)) continue;

    scenes.push({ label, duration, script, visual: visual || '' });
  }

  return scenes;
};

const isCtaScene = (label) => /^(final\s*)?(cta|call to action|subscribe|episode tease|real talk cta|results\s*&?\s*cta|resolution|final slide)/i.test(String(label || '').trim());
const isHookScene = (label) => /^(hook|opening|title reveal|intro|clip hook|selfie hook|establishing|on camera hook|avatar intro|hero shot|slide 1)/i.test(String(label || '').trim());

const buildVideoFromNarrationScenes = ({
  scenes,
  brandProfile,
  creativeBrief = '',
  videoType,
  style = 'professional',
  voice = 'professional',
  duration = 30,
  fullBrief = '',
}) => {
  if (!scenes?.length) return null;

  const brand = brandProfile?.name || 'Brand';
  const directive = getVideoTypeDirective(videoType);
  const trimmed = conciseScenes(scenes);

  let hook = trimmed[0].script;
  let bodyScenes = trimmed.slice(1);
  let cta = null;

  if (isHookScene(trimmed[0].label)) {
    hook = trimmed[0].script;
    bodyScenes = trimmed.slice(1);
  }

  if (bodyScenes.length && isCtaScene(bodyScenes[bodyScenes.length - 1].label)) {
    cta = bodyScenes[bodyScenes.length - 1].script;
    bodyScenes = bodyScenes.slice(0, -1);
  }

  if (!bodyScenes.length && trimmed.length > 1) {
    bodyScenes = trimmed.slice(1, cta ? -1 : undefined);
  }

  if (!cta && trimmed.length > 1) {
    cta = conciseLine(`Try ${brand}`, 4);
  }

  const titleSource = creativeBrief.split('\n')[0]?.trim()
    || trimmed[0].label
    || hook;

  return {
    title: `${brand} — ${conciseWords(titleSource.replace(/^[\w\s-]+ for .+ \(.+\)\.?\s*$/i, ''), 8) || trimmed[0].label}`.slice(0, 80),
    hook,
    hookVisual: trimmed[0].visual || '',
    scenes: bodyScenes.map((s) => ({
      label: s.label,
      script: s.script,
      visual: s.visual || '',
      duration: s.duration || 5,
    })),
    cta: cta || hook,
    outro: cta || hook,
    captions: [hook, ...bodyScenes.map((s) => s.script)].filter(Boolean).slice(0, 4),
    highlightWords: [brand.split(' ')[0]].filter(Boolean),
    musicMood: videoType === 'ugc_style' ? 'energetic' : 'upbeat',
    voiceDirection: `${voice} delivery for ${directive.label}`,
    platforms: ['tiktok', 'instagram', 'youtube'],
    engagementScore: 85,
    brandScore: 88,
    conversionScore: 82,
    platformScore: 85,
    videoType,
    style,
    voice,
    duration,
    sourceBrief: fullBrief,
  };
};

const extractNarrationText = (prompt, narrationBrief = '') => {
  const explicit = String(narrationBrief || '').trim();
  if (explicit && !/^Writing concise|^Generating |Hook · Scene beats/i.test(explicit)) return explicit;

  const combined = String(prompt || '').trim();
  const split = combined.split(/\n---\s*NARRATION\s*---\n/i);
  if (split[1]?.trim()) return split[1].trim();

  if (SCENE_HEADER.test(combined) || /\n[A-Z0-9\s—-]+ \(\d+s\)\n/i.test(combined)) {
    return combined;
  }
  return explicit;
};

const combineBriefForGenerate = (creativeBrief, narrationBrief) => {
  const creative = String(creativeBrief || '').trim();
  const narration = String(narrationBrief || '').trim();
  if (creative && narration) return `${creative}\n\n--- NARRATION ---\n\n${narration}`;
  return narration || creative;
};

const parseVideoBrief = (rawBrief, brand = '', industry = '') => {
  const brief = String(rawBrief || '').trim();
  if (!brief) {
    return {
      hook: `${brand || 'This'} helps ${industry || 'teams'} move faster`,
      problem: `Teams in ${industry || 'your space'} struggle to stay consistent`,
      solution: `${brand || 'Our product'} solves the workflow gap`,
      cta: `Try ${brand || 'it'} today — link in bio`,
      narrative: '',
      audience: '',
      coreMessage: '',
      feature: '',
      focus: '',
      keywords: [],
    };
  }

  const getField = (label) => {
    const re = new RegExp(`^${label}\\s*:\\s*(.+)$`, 'im');
    const match = brief.match(re);
    return match?.[1]?.trim() || '';
  };

  const narrationSplit = brief.split(/\n---\s*NARRATION\s*---\n/i);
  const narrationSection = narrationSplit[1]?.trim() || '';
  const strategySection = narrationSplit[0]?.trim() || brief;
  const parseSource = narrationSection || strategySection;

  const audience = getField('Audience');
  const coreMessage = getField('Core message');
  const feature = getField('Feature/product to highlight') || getField('Feature');
  const focus = getField('Focus angle') || getField('Focus');

  const isMetaLine = (line) => {
    const l = line.trim();
    if (!l) return true;
    if (/^(Audience|Core message|Feature\/product to highlight|Feature|Focus angle|Focus|Structure|Tone)\s*:/i.test(l)) return true;
    if (/^[\w\s-]+ for .+ \(.+\)\.?\s*$/i.test(l) && l.length < 90) return true;
    return false;
  };

  const contentLines = parseSource
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => {
      if (!l.length) return false;
      if (/^[A-Z0-9\s-]+ \(\d+s\)$/.test(l)) return false;
      if (/^visual:/i.test(l)) return false;
      return !isMetaLine(l);
    });

  const narrationScripts = narrationSection
    ? narrationSection.split(/\n\n+/).map((block) => {
      const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
      const scriptLine = lines.find((l) => !/^[A-Z0-9\s-]+ \(\d+s\)$/.test(l) && !/^visual:/i.test(l));
      return scriptLine || '';
    }).filter(Boolean)
    : [];

  const narrative = narrationScripts.length
    ? narrationScripts.join(' ')
    : contentLines.join(' ').trim() || parseSource;

  const scriptSentences = narrative
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 12 && !/^(Audience|Core message|Feature|Focus|Structure|Tone)\s*:/i.test(s));

  const hook = scriptSentences[0]
    || (focus ? focus : '')
    || coreMessage
    || contentLines[0]?.slice(0, 140)
    || `Here's why ${brand || 'this'} matters for ${audience || industry || 'you'}`;

  const mid = Math.max(1, Math.floor(scriptSentences.length / 2));
  const problem = scriptSentences.slice(0, mid).join(' ')
    || coreMessage
    || narrative.slice(0, 220);
  const solution = scriptSentences.slice(mid, Math.max(mid + 1, scriptSentences.length - 1)).join(' ')
    || feature
    || focus
    || narrative.slice(Math.min(220, narrative.length), 480)
    || coreMessage;
  const cta = scriptSentences[scriptSentences.length - 1]
    || (brand ? `Get started with ${brand} — link in bio` : 'Learn more — link in bio');

  return {
    hook,
    problem,
    solution,
    cta,
    narrative,
    audience,
    coreMessage,
    feature,
    focus,
    keywords: [audience, coreMessage, feature, focus].filter(Boolean),
  };
};

const sanitizeTopicHint = (hint, videoType) => {
  let text = String(hint || '').trim();
  if (!text) return '';
  if (/^Writing concise|^Generating |Hook · Scene beats/i.test(text)) return '';

  const currentLabel = getVideoTypeDirective(videoType).label;
  for (const directive of Object.values(VIDEO_TYPE_DIRECTIVES)) {
    if (directive.label !== currentLabel) {
      text = text.replace(new RegExp(`${directive.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} for[^\\n]*`, 'gi'), '').trim();
    }
  }

  const focus = text.match(/^Focus angle:\s*(.+)$/im)?.[1]?.trim();
  if (/^(Audience|Core message|Structure|Tone):/im.test(text)) {
    return focus || '';
  }

  return text.slice(0, 240);
};

const buildTypeNarrationContext = ({
  videoType,
  brand,
  industry,
  audience,
  value,
  products,
  focus,
  duration,
  topicHint = '',
}) => {
  const product = String(products || brand).split(' and ')[0]?.trim() || brand;
  const angle = conciseWords(focus || topicHint?.split(/(?<=[.!?])\s+/)[0] || value, 10);

  const templates = {
    talking_head: {
      hook: `Here's why ${audience || industry} teams choose ${brand}`,
      body: `${brand} helps you ${conciseWords(value, 6)}`,
      problem: `Most ${industry} teams hit content bottlenecks weekly`,
      solution: `${product} removes the busywork so you can focus`,
      cta: `Start with ${brand} today`,
    },
    ai_avatar: {
      hook: `Welcome — let's talk ${industry} growth with ${brand}`,
      body: `${product} automates what used to take your team hours`,
      problem: `Manual workflows drain ${industry} teams every week`,
      solution: `${brand}'s AI handles it — you ship faster`,
      cta: `Explore ${brand} now`,
    },
    motion_graphics: {
      hook: angle || `${brand} for modern ${industry} teams`,
      body: conciseWords(value, 10),
      problem: `${industry} teams lose hours on repetitive content work`,
      solution: `${brand} · ${product} automates your workflow end-to-end`,
      cta: `Try ${brand}`,
    },
    product_showcase: {
      hook: `Meet ${product} — built for ${industry}`,
      body: conciseWords(value, 10),
      problem: `Generic tools weren't made for ${industry} teams`,
      solution: `${product} delivers results you can see immediately`,
      cta: `Get ${product} today`,
    },
    animated_explainer: {
      hook: `${industry} teams have a workflow problem`,
      body: `${brand} fixes it in three simple steps`,
      problem: `Manual tasks pile up. Deadlines slip. Teams burn out.`,
      solution: `Step one: ${product}. Step two: automate. Step three: ship.`,
      cta: `See how ${brand} works`,
    },
    ugc_style: {
      hook: `Okay — I didn't expect ${brand} to work this well`,
      body: `I've been using ${product} for my ${industry} content`,
      problem: `I was spending hours on manual posts every week`,
      solution: `Honestly, ${brand} cut that time in half`,
      cta: `Not gonna lie — try ${brand}`,
    },
    broll_storytelling: {
      hook: `Every ${industry} team reaches the same crossroads`,
      body: `Slow workflows stall growth. ${brand} changes the pace.`,
      problem: `The cost of waiting adds up fast`,
      solution: `${product} unlocks what your team builds next`,
      cta: `${brand} — link below`,
    },
    slideshow: {
      hook: angle || `${brand}: the ${industry} advantage`,
      body: conciseWords(value, 10),
      problem: `Slide one: the ${industry} challenge teams face today`,
      solution: `Slide two: how ${product} solves it`,
      cta: `Final slide: start with ${brand}`,
    },
    podcast_clip: {
      hook: `"${angle || conciseWords(value, 8)}" — that's the line.`,
      body: `Host: What does that mean for ${industry}? Guest: ${conciseWords(value, 10)}`,
      problem: `Everyone in ${industry} is asking the same question right now`,
      solution: `${brand} is how top teams are answering it`,
      cta: `Full episode — follow ${brand}`,
    },
  };

  const t = templates[videoType] || templates.motion_graphics;
  return {
    brand,
    industry,
    duration,
    brief: topicHint || value || '',
    hook: conciseWords(t.hook, 10),
    body: conciseWords(t.body, 12),
    problem: conciseWords(t.problem, 10),
    solution: conciseWords(t.solution, 10),
    cta: conciseWords(t.cta, 6),
  };
};

const parseBriefSections = (brief, brand, industry) => parseVideoBrief(brief, brand, industry);

const VIDEO_TYPE_DIRECTIVES = {
  talking_head: {
    label: 'Talking Head',
    sceneCount: '3–4',
    structure: 'Presenter speaks directly to camera. Conversational first-person script. Short punchy sentences. Cut to b-roll only for emphasis.',
    visualStyle: 'Close-up presenter, studio or office backdrop, subtle lower-thirds. Visuals describe camera framing, not abstract graphics.',
    stockHint: 'professional presenter talking office',
    stockHook: 'business person speaking camera',
    preferVideo: true,
    fallbackScenes: (ctx) => [
      { label: 'On camera hook', duration: 4, script: ctx.hook, visual: 'Presenter direct-to-camera, medium close-up' },
      { label: 'Main message', duration: Math.max(10, Math.floor(ctx.duration / 2)), script: ctx.body, visual: 'Presenter explaining with hand gestures, cutaway b-roll' },
      { label: 'CTA', duration: 5, script: ctx.cta, visual: 'Presenter pointing to CTA, end card' },
    ],
  },
  ai_avatar: {
    label: 'AI Avatar',
    sceneCount: '3–4',
    structure: 'Digital avatar host delivers the script. Polished, friendly, slightly futuristic tone. Clear section transitions.',
    visualStyle: 'AI presenter on branded virtual background, subtle motion graphics overlays, avatar lip-sync friendly phrasing.',
    stockHint: 'digital technology presenter virtual',
    stockHook: 'futuristic digital avatar technology',
    preferVideo: true,
    fallbackScenes: (ctx) => [
      { label: 'Avatar intro', duration: 4, script: ctx.hook, visual: 'AI avatar welcome, virtual studio' },
      { label: 'Explain', duration: Math.max(10, Math.floor(ctx.duration / 2)), script: ctx.body, visual: 'Avatar with animated bullet points' },
      { label: 'CTA', duration: 5, script: ctx.cta, visual: 'Avatar gesture to link, branded end card' },
    ],
  },
  motion_graphics: {
    label: 'Motion Graphics',
    sceneCount: '4–5',
    structure: 'Kinetic typography and animated data points. No on-camera presenter. Script drives text-on-screen beats.',
    visualStyle: 'Bold text animations, icon reveals, chart motion, brand color transitions. Each scene = one animated concept.',
    stockHint: 'abstract motion graphics technology',
    stockHook: 'animated data visualization tech',
    preferVideo: false,
    fallbackScenes: (ctx) => [
      { label: 'Title reveal', duration: 4, script: ctx.hook, visual: 'Kinetic typography title' },
      { label: 'Problem', duration: 6, script: ctx.problem || ctx.body, visual: 'Animated pain-point icons' },
      { label: 'Solution', duration: Math.max(8, Math.floor(ctx.duration / 3)), script: ctx.solution || ctx.body, visual: 'Motion graphic highlights' },
      { label: 'CTA', duration: 5, script: ctx.cta, visual: 'Animated CTA button' },
    ],
  },
  product_showcase: {
    label: 'Product Showcase',
    sceneCount: '4',
    structure: 'Product-led narrative: hero shot → features → benefits → purchase CTA. Script references specific product value.',
    visualStyle: 'Hero product shots, macro details, lifestyle context, before/after if relevant. Visuals name product angles and settings.',
    stockHint: 'product showcase demo lifestyle',
    stockHook: 'product hero shot commercial',
    preferVideo: true,
    fallbackScenes: (ctx) => [
      { label: 'Hero shot', duration: 4, script: ctx.hook, visual: 'Product hero on clean background, slow push-in' },
      { label: 'Features', duration: Math.max(8, Math.floor(ctx.duration / 2)), script: ctx.body, visual: 'Close-up product details and UI' },
      { label: 'CTA', duration: 5, script: ctx.cta, visual: 'Product in use, price/offer end card' },
    ],
  },
  animated_explainer: {
    label: 'Animated Explainer',
    sceneCount: '4',
    structure: 'Classic explainer arc: problem → agitate → solution (step-by-step) → CTA. Simple language, analogy-friendly.',
    visualStyle: 'Flat or 2.5D character animation, step-by-step diagrams, process flows. Visuals describe illustrated scenes tied to the brief topic.',
    stockHint: 'illustration business explainer concept',
    stockHook: 'animated explainer concept diagram',
    preferVideo: false,
    briefGuidance: 'Name one specific problem from the brand/brief, then explain the product solution in 2–3 plain steps with a concrete outcome.',
    scriptRules: [
      'Open with a specific pain point FROM THE BRIEF — not a generic industry problem',
      'Scene 2 shows the cost of inaction using details from the brief',
      'Scene 3 walks through how the brand/product solves it in numbered steps',
      'Use simple words and optional analogy — avoid corporate jargon',
      'CTA names the brand and one concrete next step from the brief',
    ],
    forbiddenPatterns: 'Generic "introducing our platform" copy, vague benefits, or scenes unrelated to the brief topic.',
    fallbackScenes: (ctx) => [
      { label: 'The problem', duration: 5, script: ctx.hook, visual: `Animated character struggling — ${ctx.problem}` },
      { label: 'Why it hurts', duration: 5, script: ctx.problem, visual: 'Animation of chaos, red X icons, stressed character' },
      { label: 'How it works', duration: Math.max(10, Math.floor(ctx.duration / 2)), script: ctx.solution, visual: 'Step 1 → Step 2 → Step 3 animated workflow diagram' },
      { label: 'Results & CTA', duration: 5, script: ctx.cta, visual: 'Happy outcome animation with brand logo and CTA button' },
    ],
  },
  ugc_style: {
    label: 'UGC Style',
    sceneCount: '3–4',
    structure: 'Authentic, casual, phone-filmed feel. First-person "I tried this" or honest review tone. Imperfect, relatable language with filler words okay.',
    visualStyle: 'Selfie angle, handheld movement, natural lighting, bedroom/car/kitchen settings. Visuals feel user-generated, not polished.',
    stockHint: 'casual selfie lifestyle authentic phone',
    stockHook: 'young person selfie talking phone',
    preferVideo: true,
    briefGuidance: 'Write as if a real customer is sharing their honest experience with the brand/product — specific results, not ad copy.',
    scriptRules: [
      'Use first person ("I", "my", "honestly") throughout — never sound like a brand spokesperson',
      'Hook must feel like a TikTok confession or hot take about the brief topic',
      'Middle scene shares a specific before/after or moment of discovery from the brief',
      'Include one casual phrase like "okay so" or "not gonna lie"',
      'CTA feels like a friend recommendation, not a sales pitch',
    ],
    forbiddenPatterns: 'Corporate voice, third-person marketing, polished ad language, or ignoring the brief topic.',
    fallbackScenes: (ctx) => [
      { label: 'Selfie hook', duration: 3, script: ctx.hook, visual: 'Handheld front-camera selfie, casual room lighting' },
      { label: 'My experience', duration: Math.max(10, Math.floor(ctx.duration / 2)), script: ctx.body, visual: 'Phone POV showing product in real-life use' },
      { label: 'Real talk CTA', duration: 4, script: ctx.cta, visual: 'Selfie wrap-up, pointing down for link' },
    ],
  },
  broll_storytelling: {
    label: 'B-Roll Storytelling',
    sceneCount: '4–5',
    structure: 'Voiceover-driven cinematic story. No on-camera presenter. Narration tells a mini-story arc drawn from the brief; visuals carry emotion.',
    visualStyle: 'Cinematic b-roll sequences, slow motion, wide establishing shots, detail cutaways. Each visual must illustrate the narration line-by-line.',
    stockHint: 'cinematic b-roll storytelling',
    stockHook: 'cinematic aerial establishing shot',
    preferVideo: true,
    briefGuidance: 'Turn the brief into a short narrative arc — setting, tension, turning point, resolution — with poetic voiceover lines.',
    scriptRules: [
      "Voiceover only — no \"hi I'm...\" presenter intros",
      'Scene 1 sets the world/mood using a specific detail from the brief',
      'Build tension or curiosity in scene 2 tied to the audience pain in the brief',
      'Scene 3 is the turning point where the brand/product enters the story',
      'Closing scene resolves with emotional payoff + soft CTA from the brief',
      'Write narration that could play over silent cinematic footage',
    ],
    forbiddenPatterns: 'Presenter-style scripts, bullet-point feature lists, or visuals disconnected from the narration.',
    fallbackScenes: (ctx) => [
      { label: 'Establishing', duration: 4, script: ctx.hook, visual: `Wide cinematic ${ctx.industry} establishing shot, golden hour` },
      { label: 'Tension', duration: 6, script: ctx.problem, visual: 'Slow-motion detail shots, muted tones, hands at work' },
      { label: 'Turning point', duration: Math.max(8, Math.floor(ctx.duration / 3)), script: ctx.solution, visual: 'Montage accelerates — light, movement, industry b-roll' },
      { label: 'Resolution', duration: 5, script: ctx.cta, visual: 'Emotional closing wide shot, logo fade on black' },
    ],
  },
  slideshow: {
    label: 'Slideshow',
    sceneCount: '5–6',
    structure: 'One key idea per slide. Short headline-style script per scene. Designed for static image + text overlay.',
    visualStyle: 'Full-bleed photos with bold headline text. Each scene = one slide with image direction and overlay copy.',
    stockHint: 'professional presentation slide photo',
    stockHook: 'minimal presentation background',
    preferVideo: false,
    fallbackScenes: (ctx) => {
      const chunks = ctx.body.split(/(?<=[.!?])\s+/).filter(Boolean);
      const slides = chunks.length >= 2 ? chunks.slice(0, 3) : [ctx.body];
      return [
        { label: 'Slide 1 — Title', duration: 4, script: ctx.hook, visual: 'Full-bleed hero image with title overlay' },
        ...slides.map((text, i) => ({
          label: `Slide ${i + 2}`,
          duration: 5,
          script: text,
          visual: `Slide image ${i + 1} with headline text overlay`,
        })),
        { label: 'Final slide — CTA', duration: 4, script: ctx.cta, visual: 'CTA slide with brand logo' },
      ];
    },
  },
  podcast_clip: {
    label: 'Podcast Clip',
    sceneCount: '3–4',
    structure: 'Clip from a longer conversation. Hook with the most provocative quote from the brief. Host + guest dialogue feel. Tease the full episode.',
    visualStyle: 'Podcast studio, microphones, waveform overlay, guest/host split or single speaker. Visuals describe studio setup and speaker reactions.',
    stockHint: 'podcast studio microphone recording',
    stockHook: 'podcast host microphone studio',
    preferVideo: true,
    briefGuidance: 'Turn the brief into a clip-worthy podcast moment — bold quote, debate, or insight — with host setup and subscribe tease.',
    scriptRules: [
      'Hook must be a bold quoted line or hot take pulled from the brief topic',
      'Include host and guest dynamic — use "Host:" and "Guest:" or natural back-and-forth',
      'Middle scene adds context or a counterpoint from the brief',
      'Reference the episode topic and brand explicitly',
      'Close teases "full episode" with subscribe/follow CTA',
    ],
    forbiddenPatterns: 'Single-voice ad read, generic podcast intro, or content unrelated to the brief.',
    fallbackScenes: (ctx) => [
      { label: 'Clip hook', duration: 4, script: ctx.hook, visual: 'Podcast studio close-up, waveform pulse on quote' },
      { label: 'Host & guest', duration: Math.max(10, Math.floor(ctx.duration / 2)), script: ctx.body, visual: 'Split screen host and guest, studio mics' },
      { label: 'Episode tease', duration: 4, script: ctx.cta, visual: 'Podcast cover art, subscribe animation' },
    ],
  },
};

const getVideoTypeDirective = (videoType) => (
  VIDEO_TYPE_DIRECTIVES[videoType] || VIDEO_TYPE_DIRECTIVES.motion_graphics
);

const formatVideoTypeLabel = (videoType) => (
  getVideoTypeDirective(videoType).label
    || String(videoType || 'motion_graphics').replace(/_/g, ' ')
);

const TYPE_STOCK_QUERIES = {
  talking_head: {
    hook: 'professional presenter talking camera office medium close-up',
    default: 'business person speaking presentation office b-roll',
    presenter: 'presenter explaining hand gestures office',
  },
  ai_avatar: {
    hook: 'futuristic digital avatar virtual presenter studio',
    default: 'virtual studio digital technology presenter screen',
  },
  motion_graphics: {
    hook: 'abstract motion graphics kinetic typography animation',
    default: 'motion graphics data visualization animated icons technology',
    problem: 'abstract frustration icons animated technology problem',
    solution: 'digital workflow automation motion graphics animation',
  },
  product_showcase: {
    hook: 'product hero shot commercial clean background push-in',
    default: 'product demo close-up commercial lifestyle showcase',
    features: 'product detail macro shot commercial',
  },
  animated_explainer: {
    hook: 'animated explainer whiteboard illustration character',
    default: 'flat illustration explainer animation business process',
    problem: 'animated character struggling workflow illustration',
    solution: 'step by step animated workflow diagram explainer',
  },
  ugc_style: {
    hook: 'young person selfie talking phone casual authentic room',
    default: 'casual phone video lifestyle authentic user generated',
    experience: 'person using smartphone POV lifestyle authentic',
    selfie: 'handheld selfie front camera casual influencer',
  },
  broll_storytelling: {
    hook: 'cinematic aerial establishing shot golden hour wide',
    default: 'cinematic b-roll slow motion storytelling footage',
    establishing: 'cinematic wide establishing shot landscape city',
    tension: 'slow motion detail hands working moody cinematic',
    turning: 'dynamic montage light movement cinematic b-roll',
    resolution: 'cinematic emotional closing wide shot sunset',
  },
  slideshow: {
    hook: 'minimal presentation slide professional photo background',
    default: 'business presentation slide deck professional photo',
    slide: 'professional slide presentation photo headline',
  },
  podcast_clip: {
    hook: 'podcast microphone studio recording close-up host',
    default: 'podcast studio microphone interview recording',
    guest: 'podcast interview two people studio microphones split',
    clip: 'podcast host speaking microphone waveform studio',
    episode: 'podcast studio headphones cover art subscribe',
  },
};

const normalizeStockLabel = (label) => String(label || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').trim();

const buildTypeStockQuery = (videoType, { scene, isHook, index = 0 }, brandProfile) => {
  const directive = getVideoTypeDirective(videoType);
  const typeMap = TYPE_STOCK_QUERIES[videoType] || TYPE_STOCK_QUERIES.motion_graphics;
  const label = normalizeStockLabel(scene?.label);
  const visual = String(scene?.visual || '').replace(/[^a-z0-9\s-]/gi, ' ').trim();

  let typeQuery = typeMap.hook;
  if (!isHook) {
    const labelMatch = Object.entries(typeMap).find(
      ([key]) => key !== 'hook' && key !== 'default' && label.includes(key),
    );
    typeQuery = labelMatch?.[1] || typeMap.default;
  }

  const industry = brandProfile?.industry?.trim() || '';
  return [typeQuery, visual, directive.stockHint, industry].filter(Boolean).join(' ').slice(0, 80);
};

const scenePrefersVideo = (videoType, index = 0) => {
  const directive = getVideoTypeDirective(videoType);
  if (directive.preferVideo === false) return false;
  if (directive.preferVideo === true) return true;
  return index % 2 === 0;
};

const buildVideoPrompt = ({ brandProfile, onboarding, prompt, videoType, style, voice, duration }) => {
  const directive = getVideoTypeDirective(videoType);
  const brand = brandProfile?.name || 'Brand';
  const briefText = String(prompt || '').trim().slice(0, 2400);
  const parsed = parseVideoBrief(briefText, brand, brandProfile?.industry);
  const brandBrief = buildBrandBrief(brandProfile, onboarding || {}, true);
  const scriptRules = (directive.scriptRules || [])
    .map((rule, i) => `${i + 1}. ${rule}`)
    .join('\n');

  const briefAnchors = [
    parsed.audience && `Audience: ${parsed.audience}`,
    parsed.coreMessage && `Core message: ${parsed.coreMessage}`,
    parsed.feature && `Feature/product: ${parsed.feature}`,
    parsed.focus && `Focus: ${parsed.focus}`,
    parsed.narrative && `Narrative:\n${parsed.narrative.slice(0, 900)}`,
  ].filter(Boolean).join('\n');

  return {
    system: `You convert video briefs into ${directive.label} scene scripts.

Your job is to transform the USER BRIEF into spoken narration — NOT to write a new unrelated ad.
At least 70% of the spoken words must come directly from the brief's narrative, messages, and focus.
Return ONLY valid JSON.`,
    user: `=== USER BRIEF (mandatory source — do not ignore) ===
${briefText}

=== EXTRACTED BRIEF ANCHORS (must appear across scenes) ===
${briefAnchors || briefText}

=== BRAND CONTEXT (supporting only) ===
${brandBrief}

=== OUTPUT REQUIREMENTS ===
Video type: ${directive.label} (${videoType})
Format: ${directive.structure}
Visual style: ${directive.visualStyle}
Scene count: ${directive.sceneCount}
Style preset: ${style}
Voice delivery: ${voice}
Target duration: ${duration} seconds
${directive.briefGuidance ? `Director note: ${directive.briefGuidance}` : ''}
${scriptRules ? `\nScript rules:\n${scriptRules}` : ''}
${directive.forbiddenPatterns ? `\nDo NOT: ${directive.forbiddenPatterns}` : ''}

Turn the USER BRIEF into ONE ${directive.label} video script.
- CONCISE narration: each scene script max 8-14 words; total spoken words max ${maxNarrationWords(duration)}
- Short punchy lines — one idea per scene, no filler or long sentences
- Title must reference the brief topic (not a generic brand tagline).
- Hook must use the brief's opening idea — not "Introducing [brand]".
- Each scene script must reuse phrases, facts, and angles from the brief anchors above.
- Scene labels must match ${directive.label} conventions.
- Scene durations should sum to roughly ${duration} seconds.
- Include "videoType": "${videoType}".

Return JSON:
{
  "videos": [
    {
      "title": "...",
      "videoType": "${videoType}",
      "hook": "...",
      "scenes": [
        { "label": "...", "duration": 5, "script": "...", "visual": "..." }
      ],
      "cta": "...",
      "outro": "...",
      "captions": ["..."],
      "highlightWords": ["..."],
      "musicMood": "upbeat",
      "voiceDirection": "...",
      "platforms": ["tiktok", "instagram", "youtube"],
      "engagementScore": 88,
      "brandScore": 92,
      "conversionScore": 80,
      "platformScore": 85
    }
  ]
}`,
  };
};

const pickRandom = (items, max = 3) => {
  if (!items?.length) return null;
  const pool = items.slice(0, max);
  return pool[Math.floor(Math.random() * pool.length)];
};

const toStockPayload = (item) => {
  if (!item?.url) return null;
  return {
    type: item.type,
    url: item.url,
    thumbnailUrl: item.thumbnailUrl,
    photographer: item.photographer,
    photographerUrl: item.photographerUrl,
  };
};

const fetchStockMedia = async (query, preferVideo = true) => {
  const q = String(query || '').trim().slice(0, 80);
  if (!q) return null;
  const reqMs = process.env.VERCEL ? 3_500 : 5_000;
  const withCap = (promise) => Promise.race([
    promise,
    new Promise((_, reject) => { setTimeout(() => reject(new Error('stock fetch timeout')), reqMs); }),
  ]);
  try {
    if (preferVideo) {
      const videos = await withCap(pexelsService.searchVideos({ query: q, perPage: 4 }));
      const picked = pickRandom(videos.items);
      if (picked) return toStockPayload(picked);
    }
    const photos = await withCap(pexelsService.searchPhotos({ query: q, perPage: 4 }));
    return toStockPayload(pickRandom(photos.items));
  } catch (err) {
    logger.warn(`[video] Stock media skipped: ${err.message}`);
    return null;
  }
};

const industryStockQuery = (brandProfile, hint = '') => {
  const industry = brandProfile?.industry?.trim() || 'business';
  const brand = brandProfile?.name?.trim() || '';
  return [industry, hint, brand].filter(Boolean).join(' ').slice(0, 80);
};

const attachStockMedia = async (video, brandProfile, videoType, briefKeywords = []) => {
  const type = videoType || video?.videoType || 'motion_graphics';
  const industry = brandProfile?.industry?.trim() || 'General';
  const stockBudget = process.env.VERCEL ? 7_000 : 14_000;

  const attachAll = async () => {
    const hookQuery = buildTypeStockQuery(
      type,
      { scene: { label: 'hook', visual: video.hookVisual }, isHook: true, index: 0 },
      brandProfile,
    );

    const sceneHints = (video.scenes || []).map((scene, i) => ({
      scene,
      i,
      query: buildTypeStockQuery(type, { scene, isHook: false, index: i }, brandProfile),
      preferVideo: scenePrefersVideo(type, i),
    }));

    const [hookStockMedia, ...sceneStock] = await Promise.all([
      fetchStockMedia(hookQuery, scenePrefersVideo(type, 0)),
      ...sceneHints.map(({ query, preferVideo }) => fetchStockMedia(query, preferVideo)),
    ]);

    const scenes = sceneHints.map(({ scene }, idx) => ({
      ...scene,
      stockMedia: sceneStock[idx] || null,
    }));

    let ctaStockMedia = null;
    if (video.cta) {
      const ctaQuery = buildTypeStockQuery(
        type,
        { scene: { label: 'cta', visual: 'call to action end card' }, isHook: false, index: scenes.length },
        brandProfile,
      );
      ctaStockMedia = await fetchStockMedia(ctaQuery, scenePrefersVideo(type, scenes.length));
    }

    return {
      ...video,
      videoType: type,
      hookStockMedia,
      ctaStockMedia,
      scenes,
      stockIndustry: industry,
      stockSource: 'pexels',
      videoTypeLabel: formatVideoTypeLabel(type),
    };
  };

  try {
    const result = await Promise.race([
      attachAll(),
      new Promise((resolve) => { setTimeout(() => resolve(null), stockBudget); }),
    ]);
    if (result) return result;
    logger.warn('[video] Stock media budget exceeded — script saved without stock');
  } catch (err) {
    logger.warn(`[video] Stock attach failed: ${err.message}`);
  }

  return {
    ...video,
    videoType: type,
    hookStockMedia: video.hookStockMedia || null,
    scenes: video.scenes || [],
    stockIndustry: industry,
    stockSource: 'none',
    videoTypeLabel: formatVideoTypeLabel(type),
  };
};

const buildFallbackVideo = ({
  brandProfile,
  prompt,
  videoType,
  style,
  voice,
  duration,
  narrationBrief = '',
  creativeBrief = '',
}) => {
  const brand = brandProfile?.name || 'Brand';
  const industry = brandProfile?.industry || 'your industry';
  const directive = getVideoTypeDirective(videoType);
  const brief = String(prompt || '').trim();
  const narrationText = extractNarrationText(brief, narrationBrief);
  const narrationScenes = parseNarrationScenes(narrationText);

  if (narrationScenes.length >= 1) {
    const fromNarration = buildVideoFromNarrationScenes({
      scenes: narrationScenes,
      brandProfile,
      creativeBrief: creativeBrief || brief.split(/\n---\s*NARRATION\s*---\n/i)[0]?.trim(),
      videoType,
      style,
      voice,
      duration,
      fullBrief: brief,
    });
    if (fromNarration) return fromNarration;
  }

  const parsed = parseVideoBrief(brief, brand, industry);
  const ctx = {
    brand,
    industry,
    hook: parsed.hook,
    body: parsed.narrative || parsed.solution || parsed.problem,
    problem: parsed.problem,
    solution: parsed.solution,
    cta: parsed.cta,
    duration,
    brief,
    parsed,
  };

  const titleTopic = parsed.focus || parsed.feature || parsed.coreMessage || parsed.hook;
  return {
    title: `${brand} — ${String(titleTopic).slice(0, 60)}`,
    hook: parsed.hook,
    scenes: directive.fallbackScenes(ctx),
    cta: parsed.cta,
    outro: parsed.cta,
    captions: [parsed.hook, parsed.problem?.slice(0, 80), parsed.solution?.slice(0, 80)].filter(Boolean),
    highlightWords: parsed.keywords.length ? parsed.keywords : [brand.split(' ')[0]].filter(Boolean),
    musicMood: videoType === 'ugc_style' ? 'energetic' : 'upbeat',
    voiceDirection: `${voice} delivery for ${directive.label}`,
    platforms: ['tiktok', 'instagram', 'youtube'],
    engagementScore: 80,
    brandScore: 82,
    conversionScore: 74,
    platformScore: 80,
    videoType,
    style,
    voice,
    duration,
    sourceBrief: brief,
  };
};

const normalizeVideo = (video, { videoType, style, voice, duration }) => ({
  ...video,
  id: video.id || `video-${Date.now()}`,
  videoType,
  videoTypeLabel: formatVideoTypeLabel(videoType),
  style: video.style || style,
  voice: video.voice || voice,
  duration: video.duration || duration,
  scores: {
    engagement: video.engagementScore ?? 80,
    brand: video.brandScore ?? 85,
    conversion: video.conversionScore ?? 75,
    platform: video.platformScore ?? 82,
    overall: Math.round(
      ((video.engagementScore || 80) + (video.brandScore || 85) + (video.conversionScore || 75) + (video.platformScore || 82)) / 4,
    ),
  },
});

const generateVideos = async ({
  brandProfile,
  onboarding,
  prompt,
  narrationBrief = '',
  creativeBrief = '',
  videoType,
  style = 'professional',
  voice = 'professional',
  duration = 30,
}) => {
  const brief = String(prompt || '').trim()
    || combineBriefForGenerate(creativeBrief, narrationBrief);
  const brand = brandProfile?.name || 'Brand';
  const parsed = parseVideoBrief(brief, brand, brandProfile?.industry);
  const narrationText = extractNarrationText(brief, narrationBrief);
  const narrationScenes = parseNarrationScenes(narrationText);

  const aiCap = process.env.VERCEL ? 34_000 : 80_000;
  let baseVideo = null;
  let source = 'fallback';
  let stockWarning;

  if (narrationScenes.length >= 1) {
    baseVideo = buildVideoFromNarrationScenes({
      scenes: narrationScenes,
      brandProfile,
      creativeBrief: creativeBrief || brief.split(/\n---\s*NARRATION\s*---\n/i)[0]?.trim(),
      videoType,
      style,
      voice,
      duration,
      fullBrief: brief,
    });
    if (baseVideo) source = 'narration';
  }

  if (!baseVideo) {
    const { system, user } = buildVideoPrompt({
      brandProfile, onboarding, prompt: brief, videoType, style, voice, duration,
    });

    try {
      const parsedAi = await Promise.race([
        generateJSON({
          system,
          user,
          temperature: 0.55,
          label: 'Video',
          timeoutMs: aiCap - 2_000,
          once: true,
        }),
        new Promise((resolve) => { setTimeout(() => resolve(null), aiCap); }),
      ]);

      const list = Array.isArray(parsedAi?.videos) ? parsedAi.videos.filter((v) => v?.hook || v?.title) : [];
      if (list.length) {
        baseVideo = list[0];
        source = 'ai';
      } else {
        logger.warn('[video] AI returned no usable video — using brief-based fallback');
      }
    } catch (err) {
      logger.warn(`[video] AI generation failed: ${err.message}`);
    }
  }

  if (!baseVideo) {
    baseVideo = buildFallbackVideo({
      brandProfile, prompt: brief, narrationBrief, creativeBrief, videoType, style, voice, duration,
    });
  }

  if (source !== 'narration') {
    if (baseVideo.hook) baseVideo.hook = conciseLine(baseVideo.hook, 5);
    if (baseVideo.cta) baseVideo.cta = conciseLine(baseVideo.cta, 5);
    if (baseVideo.scenes?.length) {
      baseVideo.scenes = conciseScenes(baseVideo.scenes);
    }
  } else if (baseVideo.scenes?.length) {
    baseVideo.scenes = baseVideo.scenes.map((s) => ({
      ...s,
      script: conciseLine(s.script, s.duration || 5),
      visual: s.visual ? conciseWords(s.visual, 12) : s.visual,
    }));
  }

  const normalized = normalizeVideo(baseVideo, { videoType, style, voice, duration });
  normalized.sourceBrief = brief;
  const withStock = await attachStockMedia(normalized, brandProfile, videoType, parsed.keywords);
  if (withStock.stockSource === 'none') {
    stockWarning = 'Stock media skipped — preview uses gradients; script is ready to edit';
  }

  return {
    videos: [withStock],
    source,
    warning: [
      source === 'narration' ? 'Video loaded from your narration brief — review before launch' : null,
      source === 'fallback' ? 'Script built directly from your brief — review scenes before launch' : null,
      stockWarning,
    ].filter(Boolean).join(' ') || undefined,
  };
};

const generateVideosEmergency = ({
  brandProfile,
  prompt,
  narrationBrief = '',
  creativeBrief = '',
  videoType,
  style = 'professional',
  voice = 'professional',
  duration = 30,
}) => {
  const brief = String(prompt || '').trim();
  const baseVideo = buildFallbackVideo({
    brandProfile,
    prompt: brief,
    narrationBrief,
    creativeBrief,
    videoType,
    style,
    voice,
    duration,
  });
  const normalized = normalizeVideo(baseVideo, { videoType, style, voice, duration });
  normalized.sourceBrief = brief;
  return {
    videos: [normalized],
    source: 'fallback',
    warning: 'Created from your brief — review scenes and add stock in edit if needed',
  };
};

const formatNarrationBrief = (scenes = []) => scenes
  .filter((s) => s?.script?.trim())
  .map((s) => {
    const label = s.label || 'Scene';
    const dur = s.duration || 5;
    const visual = s.visual ? `\nVisual: ${s.visual}` : '';
    return `${label.toUpperCase()} (${dur}s)\n${s.script.trim()}${visual}`;
  })
  .join('\n\n');

const buildNarrationScenes = ({
  directive,
  videoType,
  brand,
  industry,
  audience,
  value,
  products,
  focus,
  duration,
  topicHint = '',
}) => {
  const cleanHint = sanitizeTopicHint(topicHint, videoType);
  const ctx = buildTypeNarrationContext({
    videoType,
    brand,
    industry,
    audience,
    value,
    products,
    focus: focus || cleanHint,
    duration,
    topicHint: cleanHint,
  });
  return directive.fallbackScenes(ctx);
};

const formatBriefResponse = ({
  creativeBrief,
  narrationScenes,
  source = 'fallback',
  warning,
  duration = 30,
  videoType,
}) => {
  const trimmed = conciseScenes(narrationScenes).slice(0, Math.max(4, Math.min(5, Math.ceil(duration / 8))));
  const narrationBrief = formatNarrationBrief(trimmed);
  const brief = [creativeBrief.trim(), narrationBrief.trim()].filter(Boolean).join('\n\n--- NARRATION ---\n\n');
  const directive = videoType ? getVideoTypeDirective(videoType) : null;
  return {
    creativeBrief: creativeBrief.trim(),
    narrationBrief,
    narrationScenes: trimmed,
    brief,
    source,
    videoType,
    videoTypeLabel: directive?.label,
    ...(warning ? { warning } : {}),
  };
};

const buildFallbackBrief = ({
  brandProfile,
  onboarding = {},
  videoType,
  style = 'professional',
  duration = 30,
  topicHint = '',
}) => {
  const directive = getVideoTypeDirective(videoType);
  const brand = brandProfile?.name || onboarding?.companyName || 'the brand';
  const industry = brandProfile?.industry || onboarding?.industry || 'your industry';
  const audience = brandProfile?.audience || onboarding?.targetAudience || 'professionals';
  const value = brandProfile?.valueProposition || `help ${industry} teams grow faster`;
  const products = (brandProfile?.products || []).slice(0, 2).join(' and ') || 'core offering';
  const cleanHint = sanitizeTopicHint(topicHint, videoType);
  const focus = cleanHint;
  const creativeBrief = [
    `${directive.label} for ${brand} (${industry}).`,
    '',
    `Audience: ${audience}.`,
    `Core message: ${value}.`,
    `Feature/product to highlight: ${products}.`,
    focus ? `Focus angle: ${focus}.` : '',
    '',
    `Structure: ${directive.structure}`,
    `Tone: ${style}. Target length: ${duration} seconds.`,
    directive.briefGuidance || '',
  ].filter(Boolean).join('\n');

  const narrationScenes = buildNarrationScenes({
    directive,
    videoType,
    brand,
    industry,
    audience,
    value,
    products,
    focus,
    duration,
    topicHint: cleanHint,
  });

  return formatBriefResponse({ creativeBrief, narrationScenes, source: 'fallback', duration, videoType });
};

const tryAiVideoBrief = async ({
  brandProfile,
  onboarding = {},
  videoType,
  style = 'professional',
  duration = 30,
  topicHint = '',
}) => {
  const directive = getVideoTypeDirective(videoType);
  const brandBrief = buildBrandBrief(brandProfile, onboarding, true);
  const brand = brandProfile?.name || onboarding?.companyName || 'the brand';
  const aiBudget = process.env.VERCEL ? 10_000 : 16_000;

  const system = `You write ${directive.label} video briefs with separate creative strategy and concise scene narration. Return ONLY JSON.`;
  const user = `${brandBrief}
Video type: ${directive.label}
Format: ${directive.structure}
Visual style: ${directive.visualStyle}
${directive.briefGuidance ? `Narration must: ${directive.briefGuidance}` : ''}
Style: ${style} | Voice: professional | Duration: ${duration}s
${topicHint ? `Topic/seed: ${String(topicHint).slice(0, 240)}` : ''}

Return JSON:
{
  "creativeBrief": "80-120 word strategy — audience, message, angle for ${brand}",
  "narrationScenes": [
    { "label": "${directive.label} scene name", "duration": 5, "script": "exact words spoken aloud", "visual": "short motion direction" }
  ]
}

Rules:
- CONCISE narration — each scene script max 8-14 words (short punchy voiceover, no filler)
- Total spoken words across all scenes: max ${maxNarrationWords(duration)} words
- One idea per scene — tight, spoken, conversational
- Visual field: max 8 words
- For ${directive.label}, match format conventions exactly
- ${Math.max(3, Math.min(5, Math.ceil(duration / 10)))} scenes, durations sum to ~${duration}s
- Use ${brand} and specifics from the brand profile`;

  const parsed = await generateJSON({
    system,
    user,
    temperature: 0.7,
    label: 'VideoBrief',
    timeoutMs: aiBudget,
    once: true,
  });

  const creativeBrief = parsed?.creativeBrief ?? parsed?.brief ?? parsed?.strategy;
  const scenes = Array.isArray(parsed?.narrationScenes)
    ? parsed.narrationScenes.filter((s) => s?.script?.trim())
    : [];

  if (typeof creativeBrief === 'string' && creativeBrief.trim() && scenes.length) {
    return formatBriefResponse({
      creativeBrief,
      narrationScenes: scenes,
      source: 'ai',
      duration,
      videoType,
    });
  }

  if (scenes.length) {
    return formatBriefResponse({
      creativeBrief: typeof creativeBrief === 'string' && creativeBrief.trim()
        ? creativeBrief
        : `${directive.label} for ${brand}. ${directive.briefGuidance || ''}`,
      narrationScenes: scenes,
      source: 'ai',
      duration,
      videoType,
    });
  }

  const text = parsed?.brief ?? parsed?.text ?? parsed?.content;
  if (typeof text === 'string' && text.trim()) {
    const narrationScenes = buildNarrationScenes({
      directive,
      videoType,
      brand,
      industry: brandProfile?.industry || onboarding?.industry || 'your industry',
      audience: brandProfile?.audience || onboarding?.targetAudience || 'professionals',
      value: brandProfile?.valueProposition || '',
      products: (brandProfile?.products || []).slice(0, 2).join(' and ') || 'core offering',
      focus: topicHint,
      duration,
      topicHint: text.trim(),
    });
    return formatBriefResponse({
      creativeBrief: text.trim(),
      narrationScenes,
      source: 'ai',
      duration,
      videoType,
    });
  }

  return null;
};

const generateVideoBrief = async (params) => {
  const sanitized = {
    ...params,
    topicHint: sanitizeTopicHint(params.topicHint, params.videoType),
  };
  const aiCap = process.env.VERCEL ? 11_000 : 17_000;

  try {
    const aiResult = await Promise.race([
      tryAiVideoBrief(sanitized),
      new Promise((resolve) => { setTimeout(() => resolve(null), aiCap); }),
    ]);
    if (aiResult?.brief) return aiResult;
  } catch (err) {
    logger.warn(`[video] Brief AI skipped: ${err.message}`);
  }

  return buildFallbackBrief(sanitized);
};

module.exports = {
  generateVideos,
  generateVideoBrief,
  buildFallbackBrief,
  buildFallbackVideo,
  attachStockMedia,
  getVideoTypeDirective,
  formatVideoTypeLabel,
  parseVideoBrief,
  parseNarrationScenes,
  buildVideoFromNarrationScenes,
  formatNarrationBrief,
  combineBriefForGenerate,
  generateVideosEmergency,
  SINGLE_VARIANT,
};
