import { Outlet, useLocation, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { motion, AnimatePresence } from 'framer-motion'
import ThemeToggle from '../ThemeToggle'
import SaveDraftButton from '../SaveDraftButton'
import SidebarCoreSteps from './SidebarCoreSteps'

const PRIMARY_NAV = [
  { path: '/dashboard', label: 'Dashboard', hash: '' },
  { path: '/dashboard', label: 'Brand Hub', hash: '#brand-hub' },
]

const SECONDARY_NAV = [
  { path: '/drafts', label: 'Drafts', section: 'CORE' },
  { path: '/scheduled', label: 'Scheduled Posts', section: 'CORE' },
  { path: '/calendar', label: 'Curi Calendar', section: 'GROWTH' },
  { path: '/repurpose', label: 'Curi Repurpose', section: 'GROWTH' },
  { path: '/trends', label: 'Curi Trends', section: 'GROWTH' },
  { path: '/competitor', label: 'Competitor Watch', section: 'GROWTH' },
  { path: '/analytics', label: 'Analytics', section: 'INSIGHTS' },
  { path: '/settings', label: 'Settings', section: 'INSIGHTS' },
]

export default function Layout() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  let lastSection = null

  const isPrimaryActive = (item) => {
    if (location.pathname !== '/dashboard' && location.pathname !== '/brand-hub') return false
    if (item.hash === '#brand-hub') {
      return location.hash === '#brand-hub' || location.pathname === '/brand-hub'
    }
    return location.pathname === '/dashboard' && location.hash !== '#brand-hub'
  }

  const goPrimary = (item) => {
    navigate(`${item.path}${item.hash || ''}`)
  }

  return (
    <div className="flex h-screen overflow-hidden bg-theme-bg relative">
      <div className="blob-bg w-72 h-72 bg-curi-pink top-[-4rem] right-[20%] animate-float" />
      <div className="blob-bg w-48 h-48 bg-curi-blue bottom-[10%] right-[5%] animate-float-delayed" />
      <div className="blob-bg w-32 h-32 bg-curi-yellow top-[40%] left-[30%] animate-float" />

      <aside className="w-72 flex-shrink-0 bg-theme-surface border-r border-theme-border flex flex-col relative z-10">
        <div className="p-5 border-b border-theme-border">
          <div className="flex items-center justify-between gap-3">
            <Link to="/dashboard" className="flex items-center gap-3 min-w-0 hover:opacity-80 transition-opacity">
              <img
                src="/images/curi-mascot.png"
                alt="Curi mascot"
                className="w-10 h-10 rounded-2xl object-cover shadow-clay-sm"
              />
              <div>
                <div className="font-extrabold text-theme-text leading-none">Curi</div>
                <div className="text-xs text-theme-muted/50 mt-0.5 font-medium">AI Marketing Platform</div>
              </div>
            </Link>
            <ThemeToggle />
          </div>
        </div>

        <div className="px-4 py-3 border-b border-theme-border space-y-2">
          <div className="flex items-center justify-between text-xs text-theme-muted/60 mb-1.5 font-semibold">
            <span>AI Credits</span>
            <span className="text-curi-yellow font-bold">{user?.credits || 0}</span>
          </div>
          <div className="h-2 bg-theme-subtle/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-curi-gradient rounded-full transition-all"
              style={{ width: `${Math.min(100, ((user?.credits || 0) / 500) * 100)}%` }}
            />
          </div>
          <SaveDraftButton compact className="w-full justify-center" />
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          <div className="pb-2">
            <div className="text-xs font-bold text-theme-muted/30 tracking-widest uppercase px-1 pb-2">
              Home
            </div>
            {PRIMARY_NAV.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => goPrimary(item)}
                className={`sidebar-link w-full ${isPrimaryActive(item) ? 'active' : ''}`}
              >
                <span className="flex-1 text-left">{item.label}</span>
              </button>
            ))}
          </div>

          <div className="border-t border-theme-border/60 my-2" />

          <SidebarCoreSteps />

          <div className="border-t border-theme-border/60 my-3" />

          {SECONDARY_NAV.map((item) => {
            const showSection = item.section !== lastSection
            if (showSection) lastSection = item.section

            const active = location.pathname === item.path
            return (
              <div key={item.path}>
                {showSection && item.section && (
                  <div className="text-xs font-bold text-theme-muted/30 tracking-widest uppercase px-3 pt-3 pb-1.5">
                    {item.section === 'CORE' ? 'MORE' : item.section}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => navigate(item.path)}
                  className={`sidebar-link w-full ${active ? 'active' : ''}`}
                >
                  <span className="flex-1 text-left">{item.label}</span>
                </button>
              </div>
            )
          })}
        </nav>

        <div className="p-3 border-t border-theme-border">
          <div className="flex items-center gap-3 px-2">
            <div className="w-8 h-8 rounded-full bg-curi-gradient flex items-center justify-center text-sm font-bold text-white shadow-clay-sm">
              {user?.name?.[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-theme-text truncate">{user?.name}</div>
              <div className="text-xs text-theme-muted/50 capitalize font-medium">{user?.plan} plan</div>
            </div>
            <button
              onClick={logout}
              className="text-theme-muted/40 hover:text-curi-pink text-xs transition-colors font-bold px-1"
              title="Sign out"
            >
              Out
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto relative z-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname + location.hash}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="h-full"
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  )
}
