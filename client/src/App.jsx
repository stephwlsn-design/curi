import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Layout from './components/layout/Layout'
import Landing from './pages/Landing'
import Auth from './pages/Auth'
import Dashboard from './pages/Dashboard'
import Discover from './pages/Discover'
import Create from './pages/Create'
import DesignStudio from './pages/DesignStudio'
import DesignTemplates from './pages/DesignTemplates'
import DesignCanvas from './pages/DesignCanvas'
import Video from './pages/Video'
import Mail from './pages/Mail'
import Launch from './pages/Launch'
import Calendar from './pages/Calendar'
import Repurpose from './pages/Repurpose'
import Trends from './pages/Trends'
import Competitor from './pages/Competitor'
import Autonomous from './pages/Autonomous'
import Approvals from './pages/Approvals'
import Analytics from './pages/Analytics'
import Drafts from './pages/Drafts'
import Scheduled from './pages/Scheduled'
import Settings from './pages/Settings'
import Roast from './pages/Roast'

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth()
  if (loading) return (
    <div className="min-h-screen bg-theme-bg flex items-center justify-center">
      <img src="/images/curi-mascot.png" alt="Loading" className="w-20 h-20 animate-float object-contain" />
    </div>
  )
  return user ? children : <Navigate to="/auth" replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/auth" element={<Auth />} />
      <Route path="/auth/register" element={<Auth />} />
      <Route path="/roast" element={<Roast />} />
      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/discover" element={<Discover />} />
        <Route path="/create" element={<Create />} />
        <Route path="/design" element={<Navigate to="/design/studio?step=1&panel=templates" replace />} />
        <Route path="/design/templates" element={<DesignTemplates />} />
        <Route path="/design/canvas/:designId" element={<DesignCanvas />} />
        <Route path="/design/canvas" element={<DesignCanvas />} />
        <Route path="/design/studio/:designId" element={<DesignStudio />} />
        <Route path="/design/studio" element={<DesignStudio />} />
        <Route path="/video" element={<Video />} />
        <Route path="/mail" element={<Mail />} />
        <Route path="/launch" element={<Launch />} />
        <Route path="/calendar" element={<Calendar />} />
        <Route path="/repurpose" element={<Repurpose />} />
        <Route path="/trends" element={<Trends />} />
        <Route path="/competitor" element={<Competitor />} />
        <Route path="/autonomous" element={<Autonomous />} />
        <Route path="/approvals" element={<Approvals />} />
        <Route path="/drafts" element={<Drafts />} />
        <Route path="/scheduled" element={<Scheduled />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
    </Routes>
  )
}
