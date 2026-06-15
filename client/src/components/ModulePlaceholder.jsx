import { motion } from 'framer-motion'

const META = {
  Design:     { desc: 'Generate on-brand display ads, banners, carousels and social creatives automatically.' },
  Video:      { desc: 'Create product videos, reels, UGC-style clips and explainer videos from a URL or brief.' },
  Mail:       { desc: 'Generate full email sequences — welcome flows, launches, abandoned cart and newsletters.' },
  Calendar:   { desc: 'Auto-generate a 30/60/90-day content calendar with creatives, captions and publish dates.', v2: true },
  Repurpose:  { desc: 'Turn 1 blog post into 10 tweets, 3 LinkedIn posts, a video script, email and ad concepts.', v2: true },
  Trends:     { desc: 'Scan Reddit, X and LinkedIn for trending topics — then generate content automatically.', v2: true },
  Competitor: { desc: 'Track competitor ads, social content and landing pages. Get recommendations to beat them.', v2: true },
  Analytics:  { desc: 'Track performance across all published content and campaigns in one dashboard.' },
  Settings:   { desc: 'Manage your workspace, brand profile, connected accounts and billing.' },
}

export default function ModulePlaceholder({ name }) {
  const m = META[name]
  return (
    <div className="p-8 flex flex-col items-center justify-center min-h-[60vh]">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center max-w-md">
        <div className="flex items-center justify-center gap-2 mb-3">
          <h1 className="text-2xl font-bold text-theme-text">Curi {name}</h1>
          {m.v2 && <span className="badge bg-curi-blue/20 text-curi-blue">V2</span>}
        </div>
        <p className="text-theme-muted/50 text-sm leading-relaxed mb-6">{m.desc}</p>
        <div className="card p-5 text-left">
          <div className="mb-2">
            <span className="text-theme-muted/70 font-medium text-sm">
              {m.v2 ? 'Coming in V2 — Week 17-28' : 'In Development — Sprint 3-6'}
            </span>
          </div>
          <p className="text-theme-muted/30 text-xs">This module is actively being built. Check the project roadmap for timeline details.</p>
        </div>
      </motion.div>
    </div>
  )
}
