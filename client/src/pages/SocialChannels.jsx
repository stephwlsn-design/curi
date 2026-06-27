import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { API, useAuth } from '../context/AuthContext'
import { PageShell, PageHeader } from '../components/layout/PageShell'
import SocialChannelsPanel from '../components/brand/SocialChannelsPanel'
import SocialEngagementStats from '../components/social/SocialEngagementStats'
import toast from 'react-hot-toast'
import { RefreshCw } from 'lucide-react'

export default function SocialChannels() {
  const { workspaceId } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [stats, setStats] = useState(null)
  const [loadingStats, setLoadingStats] = useState(true)

  const oauthConnected = searchParams.get('connected')
  const oauthError = searchParams.get('error')

  const loadStats = async () => {
    if (!workspaceId) {
      setStats(null)
      setLoadingStats(false)
      return
    }
    setLoadingStats(true)
    try {
      const { data } = await API.get(`/publish/social-stats?workspaceId=${workspaceId}`)
      setStats(data)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not load social statistics')
    } finally {
      setLoadingStats(false)
    }
  }

  useEffect(() => { loadStats() }, [workspaceId])

  useEffect(() => {
    if (!oauthConnected && !oauthError) return
    const next = new URLSearchParams(searchParams)
    next.delete('connected')
    next.delete('error')
    setSearchParams(next, { replace: true })
    if (oauthConnected) {
      toast.success(`${oauthConnected} connected`)
      loadStats()
    }
    if (oauthError) toast.error(oauthError)
  }, [oauthConnected, oauthError])

  return (
    <PageShell>
      <PageHeader
        title="Social Channels"
        description="Connect your brand's social accounts, track engagement, and power Curi Launch publishing."
        action={(
          <button type="button" onClick={loadStats} className="btn-secondary text-sm flex items-center gap-1.5">
            <RefreshCw size={14} />
            Refresh stats
          </button>
        )}
      />

      <div className="space-y-8">
        <SocialEngagementStats stats={stats} loading={loadingStats} />
        <SocialChannelsPanel oauthReturnTo="channels" onAccountsChange={loadStats} />
      </div>
    </PageShell>
  )
}
