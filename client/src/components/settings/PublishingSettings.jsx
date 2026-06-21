import { useState, useEffect } from 'react'
import { API } from '../../context/AuthContext'
import toast from 'react-hot-toast'
import { Link2, Unlink, CheckCircle2, AlertCircle } from 'lucide-react'

const PLATFORMS = [
  { id: 'linkedin', label: 'LinkedIn', oauth: true },
  { id: 'twitter', label: 'X (Twitter)', oauth: true },
  { id: 'instagram', label: 'Instagram', oauth: true, meta: true },
  { id: 'facebook', label: 'Facebook', oauth: true, meta: true },
]

export default function PublishingSettings({ oauthConnected, oauthError }) {
  const [accounts, setAccounts] = useState([])
  const [oauthAvailable, setOauthAvailable] = useState([])
  const [configuredPlatforms, setConfiguredPlatforms] = useState([])
  const [loading, setLoading] = useState(true)
  const [manualPlatform, setManualPlatform] = useState(null)
  const [manualForm, setManualForm] = useState({ accessToken: '', accountId: '', accountName: '' })
  const [metaOAuth, setMetaOAuth] = useState(false)

  const [connecting, setConnecting] = useState(null)

  const loadAccounts = async () => {
    setLoading(true)
    try {
      const { data } = await API.get('/publish/accounts')
      setAccounts(data.accounts || [])
      setOauthAvailable(data.oauthAvailable || [])
      setConfiguredPlatforms(data.configuredPlatforms || [])
      setMetaOAuth(Boolean(data.metaOAuth))
    } catch {
      toast.error('Could not load publishing accounts')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadAccounts() }, [])

  useEffect(() => {
    if (oauthConnected) {
      const names = oauthConnected.split(',').map((p) => p.trim()).filter(Boolean)
      toast.success(names.length > 1 ? `${names.join(' & ')} connected` : `${oauthConnected} connected`)
      loadAccounts()
    }
  }, [oauthConnected])

  useEffect(() => {
    if (oauthError) toast.error(oauthError)
  }, [oauthError])

  const connectOAuth = async (platform) => {
    setConnecting(platform)
    try {
      const { data } = await API.get(`/publish/oauth/${platform}`)
      window.location.href = data.url
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not start OAuth flow')
      setConnecting(null)
    }
  }

  const connectManual = async (e) => {
    e.preventDefault()
    if (!manualPlatform) return
    try {
      const { data } = await API.post(`/publish/connect/${manualPlatform}`, manualForm)
      setAccounts(data.accounts || [])
      setManualPlatform(null)
      setManualForm({ accessToken: '', accountId: '', accountName: '' })
      toast.success(`${manualPlatform} connected`)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not connect account')
    }
  }

  const disconnect = async (platform) => {
    if (!confirm(`Disconnect your ${platform} account? Workspace defaults will still apply if configured.`)) return
    try {
      const { data } = await API.delete(`/publish/connect/${platform}`)
      setAccounts(data.accounts || [])
      toast.success(`${platform} disconnected`)
    } catch {
      toast.error('Could not disconnect account')
    }
  }

  const accountFor = (platform) => accounts.find((a) => a.platform === platform)

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="page-card">
        <h2 className="font-bold text-theme-text text-lg mb-2">Publishing Accounts</h2>
        <p className="text-sm text-theme-muted/50 mb-6">
          Connect social accounts to publish and schedule content. LinkedIn and X use OAuth.
          Instagram and Facebook connect together via one Facebook login — your Page and linked
          Instagram Business account are configured automatically.
        </p>

        {metaOAuth && !loading && (
          <div className="mb-6 p-4 rounded-xl bg-curi-blue/10 border border-curi-blue/20">
            <div className="font-bold text-theme-text mb-1">Instagram + Facebook</div>
            <p className="text-sm text-theme-muted/50 mb-3">
              One Meta login connects your Facebook Page and linked Instagram Business account.
            </p>
            <button
              type="button"
              onClick={() => connectOAuth('facebook')}
              disabled={connecting === 'facebook'}
              className="btn-primary text-sm flex items-center gap-1.5"
            >
              <Link2 size={14} />
              {connecting === 'facebook' ? 'Redirecting to Facebook...' : 'Connect Instagram & Facebook'}
            </button>
          </div>
        )}

        {loading ? (
          <p className="text-sm text-theme-muted/40">Loading accounts...</p>
        ) : (
          <div className="space-y-4">
            {PLATFORMS.map((p) => {
              const acc = accountFor(p.id)
              const canOAuth = p.oauth && oauthAvailable.includes(p.id) && !p.meta
              const workspaceReady = configuredPlatforms.includes(p.id) && acc?.source === 'workspace'

              return (
                <div key={p.id} className="p-4 rounded-xl bg-theme-subtle/5 border border-theme-subtle/10">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="font-bold text-theme-text">{p.label}</div>
                      {acc?.connected ? (
                        <div className="flex items-center gap-1.5 text-sm text-curi-green mt-1">
                          <CheckCircle2 size={14} />
                          {acc.accountName || 'Connected'}
                          {acc.source === 'workspace' && (
                            <span className="badge bg-curi-blue/15 text-curi-blue text-[10px] ml-1">Workspace</span>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-sm text-theme-muted/50 mt-1">
                          <AlertCircle size={14} /> Not connected
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 justify-end">
                      {canOAuth && (
                        <button
                          type="button"
                          onClick={() => connectOAuth(p.id)}
                          disabled={connecting === p.id}
                          className="btn-primary text-sm flex items-center gap-1.5"
                        >
                          <Link2 size={14} />
                          {connecting === p.id ? 'Redirecting...' : 'Connect with OAuth'}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setManualPlatform(manualPlatform === p.id ? null : p.id)
                          setManualForm({ accessToken: '', accountId: '', accountName: '' })
                        }}
                        className="btn-secondary text-sm"
                      >
                        {manualPlatform === p.id ? 'Cancel' : 'Manual token'}
                      </button>
                      {acc?.connected && acc.source === 'user' && (
                        <button
                          type="button"
                          onClick={() => disconnect(p.id)}
                          className="btn-secondary text-sm flex items-center gap-1.5 text-red-400"
                        >
                          <Unlink size={14} /> Disconnect
                        </button>
                      )}
                    </div>
                  </div>

                  {manualPlatform === p.id && (
                    <form onSubmit={connectManual} className="mt-4 pt-4 border-t border-theme-subtle/10 grid gap-3">
                      <input
                        className="input text-sm"
                        placeholder="Access token"
                        value={manualForm.accessToken}
                        onChange={(e) => setManualForm((f) => ({ ...f, accessToken: e.target.value }))}
                        required
                      />
                      <input
                        className="input text-sm"
                        placeholder={p.id === 'linkedin' ? 'LinkedIn person ID (sub from profile)' : 'Account / page ID'}
                        value={manualForm.accountId}
                        onChange={(e) => setManualForm((f) => ({ ...f, accountId: e.target.value }))}
                      />
                      <input
                        className="input text-sm"
                        placeholder="Display name (optional)"
                        value={manualForm.accountName}
                        onChange={(e) => setManualForm((f) => ({ ...f, accountName: e.target.value }))}
                      />
                      <button type="submit" className="btn-primary text-sm w-fit">Save connection</button>
                    </form>
                  )}

                  {workspaceReady && (
                    <p className="text-xs text-theme-muted/40 mt-3">
                      Using workspace credentials from server environment — no user action needed.
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="page-card text-sm text-theme-muted/50">
        <p className="font-semibold text-theme-text mb-2">Scheduling</p>
        <p>
          Scheduled posts appear under Scheduled Posts and publish automatically at the chosen time.
          LinkedIn and X support text posts; Instagram and Facebook require an image on the content.
        </p>
      </div>
    </div>
  )
}
