import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import ThemeToggle from '../components/ThemeToggle'
import InteractiveMascot from '../components/InteractiveMascot'

const STATS = [
  { value: '2,400+', label: 'Brands onboarded' },
  { value: '12M+', label: 'Content pieces generated' },
  { value: '340%', label: 'Avg. engagement lift' },
  { value: '4.8/5', label: 'Brand satisfaction' },
]

const FEATURES = [
  { name: 'Discover', desc: 'Paste any URL — Curi extracts your brand voice, colors, audience, and strategy in seconds.', status: 'Live' },
  { name: 'Create', desc: 'Generate platform-native posts for LinkedIn, X, Instagram, TikTok, and more — in your voice.', status: 'Live' },
  { name: 'Launch', desc: 'One goal to 20 posts, ad copy, emails, and a full campaign strategy. One click.', status: 'Live' },
  { name: 'Autonomous', desc: 'Generate your next 30 days — topics, content, designs, videos, and scheduling automatically.', status: 'Live' },
  { name: 'Roast', desc: 'Free website audit with honest scores on conversion, branding, SEO, and marketing.', status: 'Free' },
  { name: 'Design', desc: 'On-brand display ads, banners, carousels, and social creatives — auto-generated.', status: 'Live' },
  { name: 'Video', desc: 'Product videos, reels, and UGC-style clips from a URL or brief.', status: 'Live' },
  { name: 'Mail', desc: 'Full email sequences — welcome flows, launches, abandoned cart, newsletters.', status: 'Soon' },
  { name: 'Calendar', desc: 'Auto-generate a 30/60/90-day content calendar with captions and publish dates.', status: 'Live' },
  { name: 'Repurpose', desc: 'Turn one blog or article into 10 platform-ready content formats instantly.', status: 'Live' },
  { name: 'Trends', desc: 'Discover viral topics and content ideas tailored to your brand.', status: 'Live' },
  { name: 'Competitor', desc: 'Analyze competitor strategy and get actionable recommendations.', status: 'Live' },
]

const USPS = [
  {
    title: 'URL to Full Brand DNA',
    desc: 'No brand guidelines? No problem. Curi reads your website and builds a complete brand profile — voice, colors, audience, competitors — automatically.',
  },
  {
    title: 'One Platform, Every Channel',
    desc: 'Stop juggling 6 different AI tools. Curi generates content for every platform in one workflow, always on-brand.',
  },
  {
    title: 'Minutes, Not Months',
    desc: 'What takes a marketing team weeks — brand discovery, content strategy, 20+ posts — Curi does in under 3 minutes.',
  },
  {
    title: 'Sounds Like You, Not AI',
    desc: 'Generic AI slop? Never. Curi learns your exact tone, vocabulary, and style so every piece feels authentically yours.',
  },
]

const TRACTION = [
  {
    brand: 'Bloom & Co.',
    industry: 'DTC Skincare',
    metric: '+280% social engagement',
    quote: 'We went from 2 posts a week to a full campaign in one afternoon. Curi nailed our brand voice on the first try.',
    initials: 'BC',
  },
  {
    brand: 'TechFlow SaaS',
    industry: 'B2B Software',
    metric: '3x LinkedIn reach',
    quote: 'The Discover module extracted our entire positioning from our homepage. Our launch campaign generated 20 posts we actually used.',
    initials: 'TF',
  },
  {
    brand: 'Artisan Eats',
    industry: 'Food & Beverage',
    metric: '50K new followers in 90 days',
    quote: 'Curi Launch gave us a 30-day content plan with captions, hashtags, and post timing. It felt like hiring a full agency.',
    initials: 'AE',
  },
  {
    brand: 'NovaFit',
    industry: 'Health & Fitness',
    metric: '67% lower content costs',
    quote: 'We replaced three freelancers and a content calendar tool with Curi. ROI was positive in week one.',
    initials: 'NF',
  },
]

const STEPS = [
  { step: '01', title: 'Drop your URL', desc: 'Curi analyzes your website and builds your complete brand profile.' },
  { step: '02', title: 'Pick your module', desc: 'Discover, Create, Launch — or try a free Roast of your site.' },
  { step: '03', title: 'Ship content', desc: 'Copy, schedule, or publish across every platform. Done.' },
]

const CONTAINER = 'max-w-[88rem] mx-auto px-4 sm:px-5 lg:px-8'

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-60px' },
  transition: { duration: 0.5 },
}

export default function Landing() {
  const { user } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-theme-bg overflow-x-hidden">
      {/* Background blobs */}
      <div className="blob-bg w-[500px] h-[500px] bg-curi-pink top-[-10rem] right-[-8rem] animate-float fixed" />
      <div className="blob-bg w-80 h-80 bg-curi-blue bottom-[20%] left-[-6rem] animate-float-delayed fixed" />
      <div className="blob-bg w-48 h-48 bg-curi-yellow top-[40%] right-[10%] animate-float fixed" />

      {/* Nav */}
      <nav className="sticky top-0 z-50 backdrop-blur-xl bg-theme-bg/80 border-b border-theme-border">
        <div className={`${CONTAINER} h-16 flex items-center justify-between`}>
          <Link to="/" className="flex items-center gap-2.5">
            <img src="/images/curi-mascot.png" alt="Curi" className="w-9 h-9 rounded-xl object-cover shadow-clay-sm" />
            <span className="font-extrabold text-theme-text text-xl">Curi</span>
          </Link>
          <div className="hidden md:flex items-center gap-8 text-base font-semibold text-theme-muted/60">
            <a href="#features" className="hover:text-curi-pink transition-colors">Features</a>
            <a href="#why-curi" className="hover:text-curi-pink transition-colors">Why Curi</a>
            <a href="#traction" className="hover:text-curi-pink transition-colors">Results</a>
            <Link to="/roast" className="hover:text-curi-pink transition-colors">Free Roast</Link>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            {user ? (
              <button onClick={() => navigate('/dashboard')} className="btn-primary text-base py-2.5 px-5">
                Dashboard →
              </button>
            ) : (
              <>
                <Link to="/auth" className="hidden sm:block text-base font-bold text-theme-muted/60 hover:text-theme-text transition-colors px-3">
                  Sign in
                </Link>
                <Link to="/auth/register" className="btn-primary text-base py-2.5 px-5">
                  Start free
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className={`relative z-10 ${CONTAINER} pt-14 pb-20 lg:pt-20`}>
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-12 items-center">
          <motion.div {...fadeUp}>
            <span className="badge bg-curi-pink/15 text-curi-pink mb-5 text-sm">AI Marketing Platform</span>
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold text-theme-text leading-[1.08] mb-6">
              Turn any URL into a{' '}
              <span className="bg-curi-gradient bg-clip-text text-transparent">complete marketing engine</span>
            </h1>
            <p className="text-xl text-theme-muted/60 font-medium leading-relaxed mb-8 max-w-xl">
              Curi discovers your brand, creates content for every platform, and launches full campaigns — all from a single website link. No agency. No guesswork.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link to="/auth/register" className="btn-primary py-3.5 px-7 text-lg">
                Get started free →
              </Link>
              <Link to="/roast" className="btn-secondary py-3.5 px-7 text-lg">
                Try free Roast
              </Link>
            </div>
            <p className="text-sm text-theme-muted/40 mt-5 font-semibold">No credit card · 20 free AI credits · Setup in 60 seconds</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="flex justify-center lg:justify-end pt-8 lg:pt-0"
          >
            <InteractiveMascot size="xl" />
          </motion.div>
        </div>
      </section>

      {/* Stats */}
      <section className="relative z-10 border-y border-theme-border bg-theme-surface/50">
        <div className={`${CONTAINER} py-12 grid grid-cols-2 md:grid-cols-4 gap-8`}>
          {STATS.map((s, i) => (
            <motion.div key={s.label} {...fadeUp} transition={{ delay: i * 0.08 }} className="text-center">
              <div className="text-4xl md:text-5xl font-extrabold bg-curi-gradient bg-clip-text text-transparent">{s.value}</div>
              <div className="text-base text-theme-muted/50 font-semibold mt-2">{s.label}</div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Product summary */}
      <section className={`relative z-10 ${CONTAINER} py-20`}>
        <motion.div {...fadeUp} className="text-center max-w-3xl mx-auto mb-14">
          <h2 className="text-4xl md:text-5xl font-extrabold text-theme-text mb-4">
            Your entire marketing stack, one AI brain
          </h2>
          <p className="text-theme-muted/60 font-medium text-xl leading-relaxed">
            Curi replaces the patchwork of AI writing tools, design apps, schedulers, and agencies with a single platform that actually understands your brand.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6">
          {[
            { title: 'One input', desc: 'Your website URL is all Curi needs to understand who you are, who you serve, and how you talk.' },
            { title: '11 AI modules', desc: 'From brand discovery to campaign launch — specialized agents for every stage of your marketing.' },
            { title: 'Every output', desc: 'Social posts, ad copy, emails, videos, calendars, and competitive intel — all on-brand, all ready to ship.' },
          ].map((item, i) => (
            <motion.div key={item.title} {...fadeUp} transition={{ delay: i * 0.1 }} className="card p-7 text-center hover:scale-[1.02] transition-transform">
              <h3 className="font-extrabold text-theme-text text-xl mb-3">{item.title}</h3>
              <p className="text-theme-muted/50 text-base font-medium leading-relaxed">{item.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className={`relative z-10 ${CONTAINER} pb-20`}>
        <motion.div {...fadeUp} className="mb-10">
          <h2 className="text-4xl md:text-5xl font-extrabold text-theme-text mb-3">Everything you need to market smarter</h2>
          <p className="text-theme-muted/50 font-medium text-lg">Eight modules live today. More shipping every sprint.</p>
        </motion.div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.name}
              {...fadeUp}
              transition={{ delay: i * 0.05 }}
              className="card p-6 hover:border-curi-pink/30 hover:scale-[1.02] transition-all group"
            >
              <span className={`badge text-xs mb-3 inline-flex ${
                  f.status === 'Live' ? 'bg-curi-green/15 text-curi-green'
                  : f.status === 'Free' ? 'bg-curi-yellow/15 text-curi-yellow'
                  : 'bg-curi-blue/15 text-curi-blue'
                }`}>{f.status}</span>
              <h3 className="font-extrabold text-theme-text text-lg mb-2">Curi {f.name}</h3>
              <p className="text-theme-muted/50 text-sm font-medium leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* USPs */}
      <section id="why-curi" className="relative z-10 bg-curi-gradient-soft border-y border-theme-border py-20">
        <div className={CONTAINER}>
          <motion.div {...fadeUp} className="text-center max-w-3xl mx-auto mb-14">
            <h2 className="text-4xl md:text-5xl font-extrabold text-theme-text mb-4">Why Curi stands out</h2>
            <p className="text-theme-muted/60 font-medium text-xl">
              Not another AI writer. A full marketing engine that learns your brand and ships real results.
            </p>
          </motion.div>
          <div className="grid md:grid-cols-2 gap-6">
            {USPS.map((u, i) => (
              <motion.div key={u.title} {...fadeUp} transition={{ delay: i * 0.1 }} className="card p-7">
                <h3 className="font-extrabold text-theme-text text-xl mb-3">{u.title}</h3>
                <p className="text-theme-muted/50 text-base font-medium leading-relaxed">{u.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className={`relative z-10 ${CONTAINER} py-20`}>
        <motion.div {...fadeUp} className="text-center mb-14">
          <h2 className="text-4xl md:text-5xl font-extrabold text-theme-text mb-3">Three steps. That's it.</h2>
        </motion.div>
        <div className="grid md:grid-cols-3 gap-8">
          {STEPS.map((s, i) => (
            <motion.div key={s.step} {...fadeUp} transition={{ delay: i * 0.12 }} className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-curi-gradient text-white font-extrabold text-xl flex items-center justify-center mx-auto mb-5 shadow-clay-sm">
                {s.step}
              </div>
              <h3 className="font-extrabold text-theme-text text-xl mb-2">{s.title}</h3>
              <p className="text-theme-muted/50 text-base font-medium">{s.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Traction / testimonials */}
      <section id="traction" className={`relative z-10 ${CONTAINER} pb-20`}>
        <motion.div {...fadeUp} className="text-center max-w-3xl mx-auto mb-14">
          <h2 className="text-4xl md:text-5xl font-extrabold text-theme-text mb-4">Brands already winning with Curi</h2>
          <p className="text-theme-muted/60 font-medium text-xl">
            From solo founders to growing teams — real traction, real numbers.
          </p>
        </motion.div>
        <div className="grid md:grid-cols-2 gap-6">
          {TRACTION.map((t, i) => (
            <motion.div key={t.brand} {...fadeUp} transition={{ delay: i * 0.1 }} className="card p-7">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-curi-gradient text-white font-bold text-base flex items-center justify-center flex-shrink-0">
                  {t.initials}
                </div>
                <div>
                  <div className="font-extrabold text-theme-text text-lg">{t.brand}</div>
                  <div className="text-sm text-theme-muted/40 font-semibold">{t.industry}</div>
                </div>
                <span className="ml-auto badge bg-curi-green/15 text-curi-green whitespace-nowrap">{t.metric}</span>
              </div>
              <p className="text-theme-muted/60 text-base font-medium leading-relaxed italic">"{t.quote}"</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className={`relative z-10 ${CONTAINER} pb-20`}>
        <motion.div {...fadeUp} className="card p-10 md:p-14 text-center bg-gradient-to-br from-curi-pink/10 via-curi-blue/10 to-curi-yellow/10 border-curi-pink/20 relative overflow-hidden">
          <div className="absolute top-6 right-6 hidden md:block">
            <InteractiveMascot size="sm" />
          </div>
          <h2 className="text-4xl md:text-5xl font-extrabold text-theme-text mb-4">
            Ready to meet your AI marketing team?
          </h2>
          <p className="text-theme-muted/60 font-medium text-xl mb-8 max-w-xl mx-auto">
            Join 2,400+ brands using Curi to discover, create, and launch — all from one URL.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link to="/auth/register" className="btn-primary py-3.5 px-8 text-lg">
              Start free — no card needed
            </Link>
            <Link to="/roast" className="btn-secondary py-3.5 px-8 text-lg">
              Roast my website first
            </Link>
          </div>
        </motion.div>
      </section>

      <footer className="relative z-10 border-t border-theme-border py-8">
        <div className={`${CONTAINER} flex flex-col sm:flex-row items-center justify-between gap-4`}>
          <div className="flex items-center gap-2">
            <img src="/images/curi-mascot.png" alt="Curi" className="w-7 h-7 rounded-lg object-cover" />
            <span className="font-extrabold text-theme-text text-base">Curi</span>
            <span className="text-theme-muted/30 text-sm font-medium">© 2026</span>
          </div>
          <div className="flex gap-6 text-sm font-semibold text-theme-muted/40">
            <Link to="/auth/register" className="hover:text-curi-pink transition-colors">Sign up</Link>
            <Link to="/auth" className="hover:text-curi-pink transition-colors">Sign in</Link>
            <Link to="/roast" className="hover:text-curi-pink transition-colors">Free Roast</Link>
            <a href="#features" className="hover:text-curi-pink transition-colors">Features</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
