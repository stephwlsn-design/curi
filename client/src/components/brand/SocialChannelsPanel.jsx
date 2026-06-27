import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { API } from '../../context/AuthContext'
import toast from 'react-hot-toast'
import { Link2, Unlink, CheckCircle2, AlertCircle, Share2 } from 'lucide-react'

const PLATFORMS = [
  { id: 'linkedin', label: 'LinkedIn', oauth: true },
  { id: 'twitter', label: 'X (Twitter)', oauth: true },
  { id: 'instagram', label: 'Instagram', oauth: true, meta: true },
  { id: 'facebook', label: 'Facebook', oauth: true, meta: true },
]

export default function SocialChannelsPanel({ compact = false, oauthReturnTo, onAccountsChange }) {
  const navigate = useNavigate()
  const [accounts, setAccounts] = useState([])
  const [oauthAvailable, setOauthAvailable] = useState([])
  const [metaOAuth, setMetaOAuth] = useState(false)
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(null)
  const [manualPlatform, setManualPlatform] = useState(null)
  const [manualForm, setManualForm] = useState({ accessToken: '', accountId: '', accountName: '' })

  const loadAccounts = async () => {
    setLoading(true)
    try {
      const { data } = await API.get('/publish/accounts')
      setAccounts(data.accounts || [])
      setOauthAvailable(data.oauthAvailable || [])
      setMetaOAuth(Boolean(data.metaOAuth))
      onAccountsChange?.()
    } catch {
      toast.error('Could not load connected channels')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadAccounts() }, [])

  const connectOAuth = async (platform) => {
    setConnecting(platform)
    try {
      const { data } = await API.get(`/publish/oauth/${platform}${oauthReturnTo ? `?returnTo=${oauthReturnTo}` : ''}`)
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
    if (!confirm(`Disconnect your ${platform} account?`)) return
    try {
      const { data } = await API.delete(`/publish/disconnect/${platform}`)
      setAccounts(data.accounts || [])
      toast.success(`${platform} disconnected`)
    } catch {
      toast.error('Could not disconnect account')
    }
  }

  const accountFor = (platform) => accounts.find((a) => a.platform === platform)
  const connectedCount = accounts.filter((a) => a.connected).length

  return (
    <div className={compact ? 'space-y-4' : 'space-y-6 max-w-2xl'}>
      <div className="page-card">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Share2 size={18} className="text-curi-pink" />
              <h3 className="font-bold text-theme-text text-lg">Social channels</h3>
            </div>
            <p className="text-sm text-theme-muted/50">
              Connect platforms here so Curi Launch can publish to your selected channels.
              {connectedCount > 0
                ? ` ${connectedCount} channel${connectedCount === 1 ? '' : 's'} connected.`
                : ' No channels connected yet.'}
            </p>
          </div>
          {!compact && (
            <button type="button" onClick={() => navigate('/settings?tab=publishing')} className="btn-secondary text-sm shrink-0">
              Full settings
            </button>
          )}
        </div>

        {metaOAuth && !loading && (
          <div className="mb-4 p-4 rounded-xl bg-curi-blue/10 border border-curi-blue/20">
            <div className="font-bold text-theme-text mb-1 text-sm">Instagram + Facebook</div>
            <p className="text-xs text-theme-muted/50 mb-3">
              One Meta login connects your Facebook Page and linked Instagram Business account.
            </p>
            <button
              type="button"
              onClick={() => connectOAuth('facebook')}
              disabled={connecting === 'facebook'}
              className="btn-primary text-sm flex items-center gap-1.5"
            >
              <Link2 size={14} />
              {connecting === 'facebook' ? 'Redirecting…' : 'Connect Instagram & Facebook'}
            </button>
          </div>
        )}

        {loading ? (
          <p className="text-sm text-theme-muted/40">Loading channels…</p>
        ) : (
          <div className="space-y-3">
            {PLATFORMS.map((p) => {
              const acc = accountFor(p.id)
              const canOAuth = p.oauth && oauthAvailable.includes(p.id) && !p.meta

              return (
                <div key={p.id} className="p-4 rounded-xl bg-theme-subtle/5 border border-theme-subtle/10">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-bold text-theme-text text-sm">{p.label}</div>
                      {acc?.connected ? (
                        <div className="flex items-center gap-1.5 text-xs text-curi-green mt-1">
                          <CheckCircle2 size={13} />
                          {acc.accountName || 'Connected'}
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-xs text-theme-muted/50 mt-1">
                          <AlertCircle size={13} /> Not connected
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 justify-end">
                      {canOAuth && (
                        <button
                          type="button"
                          onClick={() => connectOAuth(p.id)}
                          disabled={connecting === p.id}
                          className="btn-primary text-xs flex items-center gap-1"
                        >
                          <Link2 size={12} />
                          {connecting === p.id ? '…' : 'Connect'}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setManualPlatform(manualPlatform === p.id ? null : p.id)
                          setManualForm({ accessToken: '', accountId: '', accountName: '' })
                        }}
                        className="btn-secondary text-xs"
                      >
                        {manualPlatform === p.id ? 'Cancel' : 'Token'}
                      </button>
                      {acc?.connected && acc.source === 'user' && (
                        <button
                          type="button"
                          onClick={() => disconnect(p.id)}
                          className="btn-secondary text-xs flex items-center gap-1 text-red-400"
                        >
                          <Unlink size={12} />
                        </button>
                      )}
                    </div>
                  </div>

                  {manualPlatform === p.id && (
                    <form onSubmit={connectManual} className="mt-3 pt-3 border-t border-theme-subtle/10 grid gap-2">
                      <input
                        className="input text-xs"
                        placeholder="Access token"
                        value={manualForm.accessToken}
                        onChange={(e) => setManualForm((f) => ({ ...f, accessToken: e.target.value }))}
                        required
                      />
                      <input
                        className="input text-xs"
                        placeholder="Account / page ID"
                        value={manualForm.accountId}
                        onChange={(e) => setManualForm((f) => ({ ...f, accountId: e.target.value }))}
                      />
                      <input
                        className="input text-xs"
                        placeholder="Display name (optional)"
                        value={manualForm.accountName}
                        onChange={(e) => setManualForm((f) => ({ ...f, accountName: e.target.value }))}
                      />
                      <button type="submit" className="btn-primary text-xs w-fit">Save</button>
                    </form>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
