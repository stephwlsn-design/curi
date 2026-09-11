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

const WHATS_NEW = [
  {
    badge: 'New',
    title: 'Video Studio',
    desc: 'Pick from 9 video formats — UGC, podcast clips, B-Roll, motion graphics, and more. Curi writes a type-specific brief and narration, matches industry stock b-roll, and lets you preview & edit before launch.',
  },
  {
    badge: 'New',
    title: 'Planner',
    desc: 'Upload a creative, write your caption, and schedule or publish straight to connected Instagram, LinkedIn, Facebook, and X — without leaving Curi.',
  },
  {
    badge: 'New',
    title: 'Engage+',
    desc: 'One inbox for comments and DMs. Reply faster with comment-to-DM automations, keyword auto-replies, and conversation management across your channels.',
  },
  {
    badge: 'Updated',
    title: 'Design Studio',
    desc: 'Drop in inspiration, get on-brand layouts instantly, and auto-save as you edit. Display ads, carousels, stories, and social creatives — all from your Brand Hub profile.',
  },
  {
    badge: 'New',
    title: 'Grow+',
    desc: 'Purchase real follower and engagement growth across Instagram, Facebook, YouTube, TikTok, and LinkedIn. Separate packages from AI credits — policy-compliant acquisition via paid social and creator distribution.',
    link: '/grow',
  },
]

const FEATURES = [
  { name: 'Discover', desc: 'Paste any URL — Curi extracts your brand voice, colors, audience, and strategy in seconds.', status: 'Live' },
  { name: 'Create', desc: 'Generate platform-native posts for LinkedIn, X, Instagram, TikTok, and more — in your voice.', status: 'Live' },
  { name: 'Launch', desc: 'One goal to 20 posts, ad copy, emails, and a full campaign strategy — with channel validation before you ship.', status: 'Live' },
  { name: 'Autonomous', desc: 'Generate your next 30 days — topics, content, designs, videos, and scheduling automatically.', status: 'Live' },
  { name: 'Video', desc: 'Nine video types with brand-aware briefs, scene narration, storyboard preview, and industry stock media. Edit every scene before launch.', status: 'Live', highlight: true },
  { name: 'Design', desc: 'Design Studio with inspiration upload, canvas editor, and auto-save. Ads, carousels, stories, and banners on-brand.', status: 'Live', highlight: true },
  { name: 'Planner', desc: 'Upload creative, add a caption, and schedule or publish to connected social channels from one screen.', status: 'Live', highlight: true },
  { name: 'Engage+', desc: 'Unified inbox for comments and DMs — plus automations for comment-to-DM, keyword replies, and faster community management.', status: 'Live', highlight: true },
  { name: 'Scheduled', desc: 'See every queued post across Planner and Autonomous — edit timing, platforms, and captions before go-live.', status: 'Live' },
  { name: 'Grow+', desc: 'Buy follower and engagement growth across all major social platforms. One-time packages from $59 or monthly subscriptions — separate from AI credits.', status: 'Live', highlight: true, link: '/grow' },
  { name: 'Roast', desc: 'Free website audit with honest scores on conversion, branding, SEO, and marketing.', status: 'Free', link: '/roast' },
  { name: 'Calendar', desc: 'Auto-generate a 30/60/90-day content calendar with captions and publish dates.', status: 'Live' },
  { name: 'Repurpose', desc: 'Turn one blog or article into 10 platform-ready content formats instantly.', status: 'Live' },
  { name: 'Trends', desc: 'Discover viral topics and content ideas tailored to your brand.', status: 'Live' },
  { name: 'Competitor', desc: 'Instant competitor previews with ads, social content, and actionable recommendations to beat them.', status: 'Live' },
  { name: 'Mail', desc: 'Full email sequences — welcome flows, launches, abandoned cart, newsletters.', status: 'Soon' },
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
  { step: '01', title: 'Drop your URL', desc: 'Curi analyzes your website and builds your complete brand profile in Brand Hub.' },
  { step: '02', title: 'Create & refine', desc: 'Posts, designs, and type-specific videos — briefs, narration, and storyboard previews included.' },
  { step: '03', title: 'Plan & publish', desc: 'Schedule in Planner, queue in Curi Scheduler, and manage replies in Engage+.' },
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
            <a href="#whats-new" className="hover:text-curi-pink transition-colors">What's new</a>
            <a href="#features" className="hover:text-curi-pink transition-colors">Features</a>
            <a href="#why-curi" className="hover:text-curi-pink transition-colors">Why Curi</a>
            <a href="#traction" className="hover:text-curi-pink transition-colors">Results</a>
            <Link to="/grow" className="hover:text-curi-pink transition-colors">Grow+</Link>
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
              Curi discovers your brand, creates content for every platform, produces type-specific videos with stock b-roll, and publishes through Planner and Engage+ — all from a single website link.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link to="/auth/register" className="btn-primary py-3.5 px-7 text-lg">
                Get started free →
              </Link>
              <Link to="/grow" className="btn-secondary py-3.5 px-7 text-lg">
                Explore Grow+
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
            { title: '15+ AI modules', desc: 'From brand discovery to video studio, design, scheduling, and engagement — specialized agents for every stage.' },
            { title: 'Create to publish', desc: 'Social posts, ad copy, videos, designs, calendars, and a full publish stack — all on-brand, ready to ship.' },
          ].map((item, i) => (
            <motion.div key={item.title} {...fadeUp} transition={{ delay: i * 0.1 }} className="card p-7 text-center hover:scale-[1.02] transition-transform">
              <h3 className="font-extrabold text-theme-text text-xl mb-3">{item.title}</h3>
              <p className="text-theme-muted/50 text-base font-medium leading-relaxed">{item.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* What's new */}
      <section id="whats-new" className="relative z-10 bg-curi-gradient-soft border-y border-theme-border py-20">
        <div className={CONTAINER}>
          <motion.div {...fadeUp} className="text-center max-w-3xl mx-auto mb-14">
            <span className="badge bg-curi-pink/15 text-curi-pink mb-4 text-sm">Just shipped</span>
            <h2 className="text-4xl md:text-5xl font-extrabold text-theme-text mb-4">What's new in Curi</h2>
            <p className="text-theme-muted/60 font-medium text-xl leading-relaxed">
              Video Studio, Planner, Engage+, Grow+, and a rebuilt Design Studio — the full create-to-publish loop, in one platform.
            </p>
          </motion.div>
          <div className="grid md:grid-cols-2 gap-6">
            {WHATS_NEW.map((item, i) => {
              const Card = item.link ? Link : 'div'
              const cardProps = item.link ? { to: item.link } : {}
              return (
                <motion.div key={item.title} {...fadeUp} transition={{ delay: i * 0.08 }}>
                  <Card
                    {...cardProps}
                    className="card p-7 border-curi-pink/20 hover:border-curi-pink/40 hover:scale-[1.01] transition-all block h-full"
                  >
                    <span className={`badge text-xs mb-3 inline-flex ${
                      item.badge === 'New' ? 'bg-curi-pink/15 text-curi-pink' : 'bg-curi-blue/15 text-curi-blue'
                    }`}>{item.badge}</span>
                    <h3 className="font-extrabold text-theme-text text-xl mb-3">{item.title}</h3>
                    <p className="text-theme-muted/50 text-base font-medium leading-relaxed">{item.desc}</p>
                    {item.link && (
                      <span className="inline-flex items-center gap-1 text-curi-pink font-bold text-sm mt-4">
                        Learn more →
                      </span>
                    )}
                  </Card>
                </motion.div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className={`relative z-10 ${CONTAINER} pb-20 pt-20`}>
        <motion.div {...fadeUp} className="mb-10">
          <h2 className="text-4xl md:text-5xl font-extrabold text-theme-text mb-3">Everything you need to market smarter</h2>
          <p className="text-theme-muted/50 font-medium text-lg">Fifteen modules live today. More shipping every sprint.</p>
        </motion.div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {FEATURES.map((f, i) => {
            const Card = f.link ? Link : 'div'
            const cardProps = f.link ? { to: f.link } : {}
            return (
              <motion.div key={f.name} {...fadeUp} transition={{ delay: i * 0.05 }}>
                <Card
                  {...cardProps}
                  className={`card p-6 hover:border-curi-pink/30 hover:scale-[1.02] transition-all group block h-full ${
                    f.highlight ? 'ring-1 ring-curi-pink/15' : ''
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <span className={`badge text-xs inline-flex ${
                      f.status === 'Live' ? 'bg-curi-green/15 text-curi-green'
                      : f.status === 'Free' ? 'bg-curi-yellow/15 text-curi-yellow'
                      : 'bg-curi-blue/15 text-curi-blue'
                    }`}>{f.status}</span>
                    {f.highlight && (
                      <span className="badge text-xs bg-curi-pink/15 text-curi-pink">New</span>
                    )}
                  </div>
                  <h3 className="font-extrabold text-theme-text text-lg mb-2">Curi {f.name}</h3>
                  <p className="text-theme-muted/50 text-sm font-medium leading-relaxed">{f.desc}</p>
                </Card>
              </motion.div>
            )
          })}
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

      {/* Grow+ */}
      <section id="grow-plus" className="relative z-10 bg-curi-gradient-soft border-y border-theme-border py-20">
        <div className={CONTAINER}>
          <motion.div {...fadeUp} className="grid lg:grid-cols-2 gap-10 items-center">
            <div>
              <span className="badge bg-curi-green/15 text-curi-green mb-4 text-sm">New · Separate pricing</span>
              <h2 className="text-4xl md:text-5xl font-extrabold text-theme-text mb-4">
                Grow+ — real followers, every platform
              </h2>
              <p className="text-theme-muted/60 font-medium text-lg leading-relaxed mb-6">
                Purchase policy-compliant follower and engagement growth across Instagram, Facebook, YouTube, TikTok, and LinkedIn. No bots, no fake accounts — paid social, creator distribution, and optimization bundled into clear packages.
              </p>
              <ul className="space-y-3 mb-8">
                {[
                  'One-time packages from $59 · subscriptions from $99/mo',
                  'Separate from AI credits — dedicated growth budgets',
                  'Multi-platform campaigns with live dashboard tracking',
                ].map((line) => (
                  <li key={line} className="flex items-start gap-2 text-theme-muted/60 font-medium">
                    <span className="text-curi-green font-bold mt-0.5">✓</span>
                    {line}
                  </li>
                ))}
              </ul>
              <Link to="/grow" className="btn-primary py-3.5 px-8 text-lg inline-flex">
                View Grow+ packages →
              </Link>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              {[
                { name: 'Starter', price: '$59', desc: '14-day kickstart · Instagram & Facebook' },
                { name: 'Growth', price: '$119', desc: '30-day multi-channel · Most popular', popular: true },
                { name: 'Pro', price: '$299', desc: '45-day cross-platform scale' },
                { name: 'Scale', price: '$599', desc: '60-day enterprise acquisition' },
              ].map((pkg) => (
                <div
                  key={pkg.name}
                  className={`card p-5 ${pkg.popular ? 'ring-2 ring-curi-pink/30 border-curi-pink/30' : ''}`}
                >
                  {pkg.popular && (
                    <span className="badge text-xs bg-curi-pink/15 text-curi-pink mb-2">Popular</span>
                  )}
                  <div className="font-extrabold text-theme-text text-lg">{pkg.name}</div>
                  <div className="text-2xl font-extrabold text-curi-pink my-1">{pkg.price}</div>
                  <p className="text-theme-muted/50 text-sm font-medium">{pkg.desc}</p>
                </div>
              ))}
            </div>
          </motion.div>
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
            <Link to="/grow" className="btn-secondary py-3.5 px-8 text-lg">
              Buy Grow+ packages
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
            <Link to="/grow" className="hover:text-curi-pink transition-colors">Grow+</Link>
            <Link to="/roast" className="hover:text-curi-pink transition-colors">Free Roast</Link>
            <a href="#features" className="hover:text-curi-pink transition-colors">Features</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
