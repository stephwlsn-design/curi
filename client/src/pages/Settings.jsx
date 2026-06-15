import { useState, useEffect } from 'react'
import { API, useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import { User, Users, Copy, Trash2, UserPlus, Mail } from 'lucide-react'

const ROLES = [
  { id: 'admin', label: 'Admin' },
  { id: 'editor', label: 'Editor' },
  { id: 'viewer', label: 'Viewer' },
  { id: 'client', label: 'Client' },
]

const TABS = [
  { id: 'account', label: 'Account', icon: User },
  { id: 'team', label: 'Team & Users', icon: Users },
]

export default function Settings() {
  const { user, workspaceId, fetchMe } = useAuth()
  const [tab, setTab] = useState('account')
  const [name, setName] = useState(user?.name || '')
  const [saving, setSaving] = useState(false)
  const [team, setTeam] = useState({ owner: null, members: [], pendingInvites: [] })
  const [loadingTeam, setLoadingTeam] = useState(false)
  const [inviteForm, setInviteForm] = useState({ email: '', role: 'editor' })
  const [createForm, setCreateForm] = useState({ name: '', email: '', password: '', role: 'editor' })
  const [showCreate, setShowCreate] = useState(false)

  useEffect(() => { setName(user?.name || '') }, [user?.name])

  const loadTeam = async () => {
    if (!workspaceId) return
    setLoadingTeam(true)
    try {
      const { data } = await API.get(`/workspace/members?workspaceId=${workspaceId}`)
      setTeam(data)
    } catch {
      toast.error('Could not load team')
    } finally {
      setLoadingTeam(false)
    }
  }

  useEffect(() => {
    if (tab === 'team') loadTeam()
  }, [tab, workspaceId])

  const saveProfile = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await API.patch('/auth/me', { name })
      await fetchMe()
      toast.success('Profile updated')
    } catch {
      toast.error('Could not update profile')
    } finally {
      setSaving(false)
    }
  }

  const inviteUser = async (e) => {
    e.preventDefault()
    try {
      const { data } = await API.post('/workspace/members/invite', { ...inviteForm, workspaceId })
      setTeam(data.team)
      setInviteForm({ email: '', role: 'editor' })
      if (data.type === 'added') toast.success('User added to workspace')
      else toast.success('Invitation sent — share the signup link')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not invite user')
    }
  }

  const createUser = async (e) => {
    e.preventDefault()
    try {
      const { data } = await API.post('/workspace/members/create', { ...createForm, workspaceId })
      setTeam(data.team)
      setCreateForm({ name: '', email: '', password: '', role: 'editor' })
      setShowCreate(false)
      toast.success('User account created')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not create user')
    }
  }

  const updateRole = async (userId, role) => {
    try {
      const { data } = await API.patch(`/workspace/members/${userId}`, { role, workspaceId })
      setTeam(data.team)
      toast.success('Role updated')
    } catch {
      toast.error('Could not update role')
    }
  }

  const removeMember = async (userId) => {
    if (!confirm('Remove this user from the workspace?')) return
    try {
      const { data } = await API.delete(`/workspace/members/${userId}?workspaceId=${workspaceId}`)
      setTeam(data.team)
      toast.success('Member removed')
    } catch {
      toast.error('Could not remove member')
    }
  }

  const cancelInvite = async (email) => {
    try {
      const { data } = await API.delete(`/workspace/invites/${encodeURIComponent(email)}?workspaceId=${workspaceId}`)
      setTeam(data.team)
      toast.success('Invite cancelled')
    } catch {
      toast.error('Could not cancel invite')
    }
  }

  const copyInviteLink = (path) => {
    const url = `${window.location.origin}${path}`
    navigator.clipboard.writeText(url)
    toast.success('Invite link copied')
  }

  const isOwner = team.owner && String(team.owner._id) === String(user?.id)

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-theme-text mb-2">Settings</h1>
        <p className="text-theme-muted/50">Manage your account and workspace team.</p>
      </div>

      <div className="flex gap-2 mb-6">
        {TABS.map(t => {
          const Icon = t.icon
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all ${
                tab === t.id ? 'bg-curi-gradient text-white' : 'bg-theme-subtle/5 text-theme-muted/50 hover:text-theme-text'
              }`}
            >
              <Icon size={14} /> {t.label}
            </button>
          )
        })}
      </div>

      {tab === 'account' && (
        <div className="card p-6 max-w-lg">
          <h2 className="font-bold text-theme-text mb-4">Your Account</h2>
          <form onSubmit={saveProfile} className="space-y-4">
            <div>
              <label className="label">Full Name</label>
              <input className="input" value={name} onChange={e => setName(e.target.value)} required />
            </div>
            <div>
              <label className="label">Email</label>
              <input className="input" value={user?.email || ''} disabled />
              <p className="text-[10px] text-theme-muted/40 mt-1">Email cannot be changed here.</p>
            </div>
            <div className="flex gap-3 text-sm">
              <span className="badge bg-curi-blue/15 text-curi-blue capitalize">{user?.plan} plan</span>
              <span className="badge bg-curi-yellow/15 text-curi-yellow">{user?.credits ?? 0} credits</span>
            </div>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </form>
        </div>
      )}

      {tab === 'team' && (
        <div className="space-y-6">
          {!isOwner && !loadingTeam && (
            <div className="card p-4 text-sm text-theme-muted/50">
              Only the workspace owner can invite or create users. You are a team member of this workspace.
            </div>
          )}

          {isOwner && (
            <>
              <div className="card p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-bold text-theme-text flex items-center gap-2">
                    <Mail size={16} /> Invite by Email
                  </h2>
                </div>
                <p className="text-sm text-theme-muted/50 mb-4">
                  Invite someone to join your workspace. If they don't have an account, they'll get a signup link.
                </p>
                <form onSubmit={inviteUser} className="grid sm:grid-cols-[1fr_auto_auto] gap-3">
                  <input
                    className="input"
                    type="email"
                    placeholder="colleague@company.com"
                    value={inviteForm.email}
                    onChange={e => setInviteForm(f => ({ ...f, email: e.target.value }))}
                    required
                  />
                  <select
                    className="input"
                    value={inviteForm.role}
                    onChange={e => setInviteForm(f => ({ ...f, role: e.target.value }))}
                  >
                    {ROLES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                  </select>
                  <button type="submit" className="btn-primary whitespace-nowrap">Send Invite</button>
                </form>
              </div>

              <div className="card p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-bold text-theme-text flex items-center gap-2">
                    <UserPlus size={16} /> Create User Account
                  </h2>
                  <button type="button" onClick={() => setShowCreate(v => !v)} className="btn-secondary text-sm">
                    {showCreate ? 'Cancel' : 'New User'}
                  </button>
                </div>
                {showCreate && (
                  <form onSubmit={createUser} className="grid sm:grid-cols-2 gap-3">
                    <input className="input" placeholder="Full name" value={createForm.name} onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))} required />
                    <input className="input" type="email" placeholder="Email" value={createForm.email} onChange={e => setCreateForm(f => ({ ...f, email: e.target.value }))} required />
                    <input className="input" type="password" placeholder="Password (min 8 chars)" value={createForm.password} onChange={e => setCreateForm(f => ({ ...f, password: e.target.value }))} required minLength={8} />
                    <select className="input" value={createForm.role} onChange={e => setCreateForm(f => ({ ...f, role: e.target.value }))}>
                      {ROLES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                    </select>
                    <button type="submit" className="btn-primary sm:col-span-2">Create Account & Add to Team</button>
                  </form>
                )}
                {!showCreate && (
                  <p className="text-sm text-theme-muted/50">
                    Create a login for a teammate directly — useful for agencies onboarding clients.
                  </p>
                )}
              </div>
            </>
          )}

          <div className="card p-6">
            <h2 className="font-bold text-theme-text mb-4">Team Members</h2>
            {loadingTeam ? (
              <p className="text-sm text-theme-muted/40">Loading team...</p>
            ) : (
              <div className="space-y-3">
                {team.owner && (
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-theme-subtle/5">
                    <div className="w-9 h-9 rounded-full bg-curi-gradient flex items-center justify-center text-white font-bold text-sm">
                      {team.owner.name?.[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm text-theme-text">{team.owner.name}</div>
                      <div className="text-xs text-theme-muted/50">{team.owner.email}</div>
                    </div>
                    <span className="badge bg-curi-pink/15 text-curi-pink text-[10px]">Owner</span>
                  </div>
                )}

                {team.members.map(member => (
                  <div key={member._id} className="flex items-center gap-3 p-3 rounded-xl bg-theme-subtle/5">
                    <div className="w-9 h-9 rounded-full bg-curi-blue/20 flex items-center justify-center text-curi-blue font-bold text-sm">
                      {member.name?.[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm text-theme-text">{member.name}</div>
                      <div className="text-xs text-theme-muted/50">{member.email}</div>
                    </div>
                    {isOwner ? (
                      <>
                        <select
                          className="input text-xs py-1.5 w-28"
                          value={member.role}
                          onChange={e => updateRole(member._id, e.target.value)}
                        >
                          {ROLES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                        </select>
                        <button type="button" onClick={() => removeMember(member._id)} className="text-theme-muted/40 hover:text-red-400 p-1">
                          <Trash2 size={14} />
                        </button>
                      </>
                    ) : (
                      <span className="badge bg-theme-subtle/10 text-theme-muted/50 text-[10px] capitalize">{member.role}</span>
                    )}
                  </div>
                ))}

                {team.pendingInvites?.length > 0 && (
                  <div className="pt-3 border-t border-theme-subtle/10">
                    <div className="text-xs font-semibold text-theme-muted/40 uppercase mb-2">Pending Invites</div>
                    {team.pendingInvites.map(inv => (
                      <div key={inv.email} className="flex items-center gap-3 p-3 rounded-xl bg-curi-yellow/5 mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-theme-text">{inv.email}</div>
                          <div className="text-xs text-theme-muted/50 capitalize">{inv.role} · invited {new Date(inv.invitedAt).toLocaleDateString()}</div>
                        </div>
                        {isOwner && (
                          <>
                            <button type="button" onClick={() => copyInviteLink(inv.inviteLink)} className="btn-secondary text-xs flex items-center gap-1">
                              <Copy size={12} /> Copy link
                            </button>
                            <button type="button" onClick={() => cancelInvite(inv.email)} className="text-theme-muted/40 hover:text-red-400 p-1">
                              <Trash2 size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {!team.owner && !team.members?.length && !team.pendingInvites?.length && (
                  <p className="text-sm text-theme-muted/40">No team members yet.</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
