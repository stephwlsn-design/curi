import { useState, useEffect, useMemo, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { API, useAuth } from '../context/AuthContext'
import { PageShell, PageHeader } from '../components/layout/PageShell'
import toast from 'react-hot-toast'
import {
  Inbox, MessageCircle, MessagesSquare, Zap, Bot, Send, Search,
  Link2, CheckCircle2, Plus, Trash2, ToggleLeft, ToggleRight,
} from 'lucide-react'

const TABS = [
  { id: 'inbox', label: 'Inbox', icon: Inbox },
  { id: 'comments', label: 'Comments', icon: MessageCircle },
  { id: 'messages', label: 'Messages', icon: MessagesSquare },
  { id: 'automations', label: 'Automations', icon: Zap },
]

const PLATFORM_META = {
  instagram: { label: 'Instagram', className: 'bg-curi-pink/15 text-curi-pink' },
  facebook: { label: 'Facebook', className: 'bg-curi-blue/15 text-curi-blue' },
  linkedin: { label: 'LinkedIn', className: 'bg-[#0A66C2]/15 text-[#0A66C2]' },
  twitter: { label: 'X', className: 'bg-theme-subtle/10 text-theme-text' },
}

const FEATURES = [
  {
    title: 'Comment Management',
    desc: 'View, reply to, and manage comments on published posts.',
    icon: MessageCircle,
  },
  {
    title: 'Message Management',
    desc: 'Respond to DMs and messages from Instagram, Facebook, and more.',
    icon: MessagesSquare,
  },
  {
    title: 'Comment-to-DM Automation',
    desc: 'Automatically send a DM when someone comments on a post.',
    icon: Send,
  },
  {
    title: 'Automated Replies',
    desc: 'Trigger predefined responses based on comments, keywords, or actions.',
    icon: Bot,
  },
  {
    title: 'DM Automation',
    desc: 'Automatically send messages based on user interactions.',
    icon: Zap,
  },
  {
    title: 'Conversation Inbox',
    desc: 'Centralised inbox for comments, DMs, and enquiries.',
    icon: Inbox,
  },
]

const STORAGE_KEY_PREFIX = 'curi_engagement_automations'

const automationStorageKey = (workspaceId) => `${STORAGE_KEY_PREFIX}_${workspaceId || 'default'}`

const defaultAutomations = () => ({
  commentToDm: [
    {
      id: 'ctdm-1',
      name: 'Guide commenters to link',
      keyword: 'link',
      dmTemplate: 'Thanks for commenting! Here\'s the link you asked for: [your-link]',
      enabled: true,
      platform: 'instagram',
    },
  ],
  autoReplies: [
    {
      id: 'ar-1',
      name: 'Thank you reply',
      keyword: 'thanks',
      replyTemplate: 'Appreciate you! Glad this was helpful 🙌',
      enabled: true,
      platform: 'all',
    },
  ],
  dmAutomation: [
    {
      id: 'dm-1',
      name: 'Welcome message',
      trigger: 'new_follower',
      messageTemplate: 'Hey! Thanks for following — let us know if you have any questions.',
      enabled: false,
      platform: 'instagram',
    },
  ],
})

const loadAutomations = (workspaceId) => {
  try {
    const raw = localStorage.getItem(automationStorageKey(workspaceId))
    if (raw) return { ...defaultAutomations(), ...JSON.parse(raw) }
  } catch { /* ignore */ }
  return defaultAutomations()
}

const saveAutomations = (workspaceId, data) => {
  localStorage.setItem(automationStorageKey(workspaceId), JSON.stringify(data))
}

const buildSampleThreads = (brandName) => {
  const brand = brandName || 'your brand'
  return [
    {
      id: 'thread-1',
      type: 'comment',
      platform: 'instagram',
      author: 'sarah.designs',
      avatar: 'S',
      preview: 'Love this! Where can I get the template?',
      postTitle: `New carousel — ${brand} launch tips`,
      time: '12m ago',
      unread: true,
      messages: [
        { id: 'm1', from: 'sarah.designs', text: 'Love this! Where can I get the template?', time: '12m ago', mine: false },
      ],
    },
    {
      id: 'thread-2',
      type: 'dm',
      platform: 'instagram',
      author: 'mike.creates',
      avatar: 'M',
      preview: 'Hey, do you offer consulting for small teams?',
      postTitle: null,
      time: '1h ago',
      unread: true,
      messages: [
        { id: 'm2', from: 'mike.creates', text: 'Hey, do you offer consulting for small teams?', time: '1h ago', mine: false },
      ],
    },
    {
      id: 'thread-3',
      type: 'comment',
      platform: 'facebook',
      author: 'Alex Rivera',
      avatar: 'A',
      preview: 'Pricing link please 🙏',
      postTitle: 'How we doubled engagement in 30 days',
      time: '3h ago',
      unread: false,
      messages: [
        { id: 'm3', from: 'Alex Rivera', text: 'Pricing link please 🙏', time: '3h ago', mine: false },
        { id: 'm4', from: brand, text: 'Sent you a DM with details — check your inbox!', time: '2h ago', mine: true },
      ],
    },
    {
      id: 'thread-4',
      type: 'dm',
      platform: 'facebook',
      author: 'Jamie Lee',
      avatar: 'J',
      preview: 'Is this available for agencies?',
      postTitle: null,
      time: 'Yesterday',
      unread: false,
      messages: [
        { id: 'm5', from: 'Jamie Lee', text: 'Is this available for agencies?', time: 'Yesterday', mine: false },
        { id: 'm6', from: brand, text: 'Yes! We work with agencies — happy to share our partner deck.', time: 'Yesterday', mine: true },
      ],
    },
  ]
}

const PlatformBadge = ({ platform }) => {
  const meta = PLATFORM_META[platform] || { label: platform, className: 'bg-theme-subtle/10 text-theme-muted/60' }
  return (
    <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${meta.className}`}>
      {meta.label}
    </span>
  )
}

const ConnectBanner = ({ accounts }) => {
  const messagingPlatforms = ['instagram', 'facebook']
  const connected = messagingPlatforms.filter((p) => accounts.some((a) => a.platform === p))
  const missing = messagingPlatforms.filter((p) => !connected.includes(p))

  if (missing.length === 0) return null

  return (
    <div className="page-card mb-6 border border-curi-yellow/30 bg-curi-yellow/5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm font-bold text-theme-text mb-1">
            <Link2 size={16} className="text-curi-yellow" />
            Connect channels for live engagement
          </div>
          <p className="text-sm text-theme-muted/60 max-w-2xl">
            Comment and DM management works with Instagram and Facebook once connected.
            {connected.length > 0 && ` Connected: ${connected.join(', ')}.`}
            {missing.length > 0 && ` Still needed: ${missing.join(', ')}.`}
          </p>
        </div>
        <Link to="/channels" className="btn-primary text-sm whitespace-nowrap">
          Connect in Social Channels
        </Link>
      </div>
    </div>
  )
}

function ThreadList({ threads, selectedId, onSelect, filter, onFilterChange, search, onSearchChange }) {
  const filtered = useMemo(() => {
    let list = threads
    if (filter === 'comments') list = list.filter((t) => t.type === 'comment')
    if (filter === 'dms') list = list.filter((t) => t.type === 'dm')
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter((t) => (
        t.author.toLowerCase().includes(q)
        || t.preview.toLowerCase().includes(q)
        || (t.postTitle || '').toLowerCase().includes(q)
      ))
    }
    return list
  }, [threads, filter, search])

  return (
    <div className="page-card p-0 overflow-hidden flex flex-col h-[560px]">
      <div className="p-4 border-b border-theme-border/40 space-y-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-muted/40" />
          <input
            className="input pl-9 text-sm"
            placeholder="Search conversations…"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          {[
            { id: 'all', label: 'All' },
            { id: 'comments', label: 'Comments' },
            { id: 'dms', label: 'DMs' },
          ].map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => onFilterChange(f.id)}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                filter === f.id
                  ? 'bg-curi-pink/15 text-curi-pink'
                  : 'bg-theme-subtle/5 text-theme-muted/50 hover:text-theme-text'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto divide-y divide-theme-border/30">
        {filtered.length === 0 && (
          <div className="p-8 text-center text-sm text-theme-muted/50">No conversations match your filters.</div>
        )}
        {filtered.map((thread) => (
          <button
            key={thread.id}
            type="button"
            onClick={() => onSelect(thread.id)}
            className={`w-full text-left p-4 hover:bg-theme-subtle/5 transition-colors ${
              selectedId === thread.id ? 'bg-curi-pink/5 border-l-2 border-curi-pink' : ''
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-curi-gradient text-white text-sm font-bold flex items-center justify-center flex-shrink-0">
                {thread.avatar}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <span className={`text-sm font-bold truncate ${thread.unread ? 'text-theme-text' : 'text-theme-muted/70'}`}>
                    {thread.author}
                  </span>
                  <span className="text-[10px] text-theme-muted/40 flex-shrink-0">{thread.time}</span>
                </div>
                <div className="flex items-center gap-2 mb-1">
                  <PlatformBadge platform={thread.platform} />
                  <span className="text-[10px] uppercase tracking-wide text-theme-muted/40 font-bold">
                    {thread.type === 'comment' ? 'Comment' : 'DM'}
                  </span>
                  {thread.unread && <span className="w-2 h-2 rounded-full bg-curi-pink" />}
                </div>
                <p className="text-xs text-theme-muted/60 truncate">{thread.preview}</p>
                {thread.postTitle && (
                  <p className="text-[10px] text-theme-muted/40 truncate mt-1">On: {thread.postTitle}</p>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

function ThreadDetail({ thread, replyText, onReplyChange, onSend, onMarkRead }) {
  if (!thread) {
    return (
      <div className="page-card h-[560px] flex flex-col items-center justify-center text-theme-muted/50">
        <Inbox size={32} className="mb-3 opacity-40" />
        <p className="text-sm font-medium">Select a conversation</p>
        <p className="text-xs mt-1">Comments and DMs appear here in one place.</p>
      </div>
    )
  }

  return (
    <div className="page-card p-0 overflow-hidden flex flex-col h-[560px]">
      <div className="p-4 border-b border-theme-border/40 flex items-center justify-between gap-3">
        <div>
          <div className="font-bold text-theme-text">{thread.author}</div>
          <div className="flex items-center gap-2 mt-1">
            <PlatformBadge platform={thread.platform} />
            <span className="text-xs text-theme-muted/50 capitalize">{thread.type}</span>
          </div>
        </div>
        {thread.unread && (
          <button type="button" onClick={() => onMarkRead(thread.id)} className="btn-secondary text-xs">
            Mark read
          </button>
        )}
      </div>

      {thread.postTitle && (
        <div className="px-4 py-2 bg-theme-subtle/5 border-b border-theme-border/30 text-xs text-theme-muted/60">
          <span className="font-bold text-theme-muted/70">Post:</span> {thread.postTitle}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {thread.messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.mine ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
              msg.mine
                ? 'bg-curi-pink/15 text-theme-text rounded-br-md'
                : 'bg-theme-subtle/8 text-theme-muted/80 rounded-bl-md'
            }`}>
              {!msg.mine && <div className="text-[10px] font-bold text-theme-muted/50 mb-1">{msg.from}</div>}
              {msg.text}
              <div className="text-[10px] text-theme-muted/40 mt-1">{msg.time}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 border-t border-theme-border/40">
        <div className="flex gap-2">
          <input
            className="input flex-1 text-sm"
            placeholder={thread.type === 'comment' ? 'Reply to comment…' : 'Send a message…'}
            value={replyText}
            onChange={(e) => onReplyChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && onSend()}
          />
          <button type="button" onClick={onSend} disabled={!replyText.trim()} className="btn-primary px-4">
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}

function AutomationSection({ title, description, items, fields, onAdd, onToggle, onDelete, onUpdate }) {
  return (
    <div className="page-card">
      <div className="mb-4">
        <h3 className="font-bold text-theme-text text-lg">{title}</h3>
        <p className="text-sm text-theme-muted/60 mt-1">{description}</p>
      </div>

      <div className="space-y-3">
        {items.length === 0 && (
          <p className="text-sm text-theme-muted/50 py-4 text-center">No rules yet — add one below.</p>
        )}
        {items.map((item) => (
          <div key={item.id} className="rounded-xl border border-theme-border/40 p-4 bg-theme-subtle/3">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onToggle(item.id)}
                  className="text-curi-pink"
                  title={item.enabled ? 'Disable' : 'Enable'}
                >
                  {item.enabled ? <ToggleRight size={22} /> : <ToggleLeft size={22} className="text-theme-muted/40" />}
                </button>
                <span className="font-bold text-sm text-theme-text">{item.name}</span>
                {item.enabled && (
                  <span className="text-[10px] font-bold uppercase tracking-wide text-curi-green bg-curi-green/10 px-2 py-0.5 rounded-full">
                    Active
                  </span>
                )}
              </div>
              <button type="button" onClick={() => onDelete(item.id)} className="text-theme-muted/40 hover:text-red-400">
                <Trash2 size={16} />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {fields.map((field) => (
                <div key={field.key} className={field.full ? 'md:col-span-2' : ''}>
                  <label className="text-[10px] font-bold uppercase tracking-wide text-theme-muted/45 mb-1 block">
                    {field.label}
                  </label>
                  {field.type === 'select' ? (
                    <select
                      className="input text-sm"
                      value={item[field.key]}
                      onChange={(e) => onUpdate(item.id, field.key, e.target.value)}
                    >
                      {field.options.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  ) : field.type === 'textarea' ? (
                    <textarea
                      className="input text-sm min-h-[72px]"
                      value={item[field.key]}
                      onChange={(e) => onUpdate(item.id, field.key, e.target.value)}
                    />
                  ) : (
                    <input
                      className="input text-sm"
                      value={item[field.key]}
                      onChange={(e) => onUpdate(item.id, field.key, e.target.value)}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <button type="button" onClick={onAdd} className="btn-secondary text-sm mt-4 flex items-center gap-2">
        <Plus size={14} /> Add rule
      </button>
    </div>
  )
}

export default function Engagement() {
  const { workspace, workspaceId } = useAuth()
  const brandName = workspace?.brandProfile?.name || workspace?.onboarding?.companyName || 'Curi'
  const [tab, setTab] = useState('inbox')
  const [accounts, setAccounts] = useState([])
  const [loadingAccounts, setLoadingAccounts] = useState(true)
  const [threads, setThreads] = useState(() => buildSampleThreads(brandName))
  const [selectedThreadId, setSelectedThreadId] = useState('thread-1')
  const [replyText, setReplyText] = useState('')
  const [inboxFilter, setInboxFilter] = useState('all')
  const [inboxSearch, setInboxSearch] = useState('')
  const [automations, setAutomations] = useState(() => loadAutomations(workspaceId))

  const messagingPlatforms = ['instagram', 'facebook']
  const connectedMessaging = messagingPlatforms.filter((p) => accounts.some((a) => a.platform === p))
  const isPreviewMode = connectedMessaging.length === 0

  const selectedThread = threads.find((t) => t.id === selectedThreadId) || null
  const commentThreads = useMemo(() => threads.filter((t) => t.type === 'comment'), [threads])
  const dmThreads = useMemo(() => threads.filter((t) => t.type === 'dm'), [threads])
  const unreadCount = threads.filter((t) => t.unread).length

  useEffect(() => {
    saveAutomations(workspaceId, automations)
  }, [automations, workspaceId])

  useEffect(() => {
    setAutomations(loadAutomations(workspaceId))
  }, [workspaceId])

  useEffect(() => {
    if (tab === 'comments') {
      const first = commentThreads[0]
      if (first && (!selectedThread || selectedThread.type !== 'comment')) {
        setSelectedThreadId(first.id)
      }
    } else if (tab === 'messages') {
      const first = dmThreads[0]
      if (first && (!selectedThread || selectedThread.type !== 'dm')) {
        setSelectedThreadId(first.id)
      }
    }
  }, [tab, commentThreads, dmThreads, selectedThread])

  useEffect(() => {
    API.get('/publish/accounts')
      .then(({ data }) => setAccounts(data.accounts || []))
      .catch(() => {})
      .finally(() => setLoadingAccounts(false))
  }, [])

  const sendReply = useCallback(() => {
    const text = replyText.trim()
    if (!text || !selectedThread) return

    const newMsg = {
      id: `msg-${Date.now()}`,
      from: brandName,
      text,
      time: 'Just now',
      mine: true,
    }

    setThreads((prev) => prev.map((t) => (
      t.id === selectedThread.id
        ? {
          ...t,
          unread: false,
          preview: text,
          messages: [...t.messages, newMsg],
        }
        : t
    )))
    setReplyText('')
    toast.success(selectedThread.type === 'comment' ? 'Reply sent' : 'Message sent')
  }, [replyText, selectedThread, brandName])

  const markRead = (threadId) => {
    setThreads((prev) => prev.map((t) => (t.id === threadId ? { ...t, unread: false } : t)))
  }

  const updateAutomationList = (key, updater) => {
    setAutomations((prev) => ({ ...prev, [key]: updater(prev[key]) }))
  }

  const addRule = (key, template) => {
    updateAutomationList(key, (list) => [...list, { ...template, id: `${key}-${Date.now()}` }])
    toast.success('Rule added')
  }

  const toggleRule = (key, id) => {
    updateAutomationList(key, (list) => list.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)))
  }

  const deleteRule = (key, id) => {
    updateAutomationList(key, (list) => list.filter((r) => r.id !== id))
    toast.success('Rule removed')
  }

  const updateRule = (key, id, field, value) => {
    updateAutomationList(key, (list) => list.map((r) => (r.id === id ? { ...r, [field]: value } : r)))
  }

  return (
    <PageShell>
      <PageHeader
        title="Engage+"
        description="Inbox and automation for comments and DMs on published posts. For performance metrics, use Social Channels — Engage+ is for conversations and replies."
        action={(
          <div className="flex items-center gap-2 text-sm">
            {unreadCount > 0 && isPreviewMode && (
              <span className="px-3 py-1.5 rounded-full bg-theme-subtle/10 text-theme-muted/60 font-bold text-xs">
                Preview
              </span>
            )}
            {unreadCount > 0 && !isPreviewMode && (
              <span className="px-3 py-1.5 rounded-full bg-curi-pink/15 text-curi-pink font-bold text-xs">
                {unreadCount} unread
              </span>
            )}
            <Link to="/channels" className="btn-secondary text-sm flex items-center gap-2">
              <Link2 size={14} /> Social Channels
            </Link>
          </div>
        )}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
        {FEATURES.map(({ title, desc, icon: Icon }) => (
          <div key={title} className="page-card py-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-curi-pink/10 text-curi-pink flex items-center justify-center flex-shrink-0">
                <Icon size={18} />
              </div>
              <div>
                <div className="text-sm font-bold text-theme-text">{title}</div>
                <p className="text-xs text-theme-muted/55 mt-1 leading-relaxed">{desc}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {!loadingAccounts && <ConnectBanner accounts={accounts} />}

      {isPreviewMode && (
        <div className="page-card mb-6 border border-theme-border/50 bg-theme-subtle/5">
          <p className="text-sm text-theme-muted/70">
            <span className="font-bold text-theme-text">Preview inbox.</span>{' '}
            Sample conversations are shown until Instagram or Facebook are connected in Social Channels.
            Replies and automations are saved per workspace in your browser.
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-6">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
              tab === id
                ? 'bg-curi-pink/15 text-curi-pink shadow-sm'
                : 'bg-theme-subtle/5 text-theme-muted/60 hover:text-theme-text'
            }`}
          >
            <Icon size={16} />
            {label}
            {id === 'inbox' && unreadCount > 0 && (
              <span className="ml-1 w-5 h-5 rounded-full bg-curi-pink text-white text-[10px] font-bold flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === 'inbox' && (
        <div>
          <div className="flex items-center gap-2 mb-4 text-sm text-theme-muted/60">
            <Inbox size={16} className="text-curi-pink" />
            <span>Centralised inbox for comments, DMs, and enquiries</span>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
            <div className="lg:col-span-2">
              <ThreadList
                threads={threads}
                selectedId={selectedThreadId}
                onSelect={setSelectedThreadId}
                filter={inboxFilter}
                onFilterChange={setInboxFilter}
                search={inboxSearch}
                onSearchChange={setInboxSearch}
              />
            </div>
            <div className="lg:col-span-3">
              <ThreadDetail
                thread={selectedThread}
                replyText={replyText}
                onReplyChange={setReplyText}
                onSend={sendReply}
                onMarkRead={markRead}
              />
            </div>
          </div>
        </div>
      )}

      {tab === 'comments' && (
        <div>
          <div className="flex items-center gap-2 mb-4 text-sm text-theme-muted/60">
            <MessageCircle size={16} className="text-curi-pink" />
            <span>View, reply to, and manage comments on published posts</span>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
            <div className="lg:col-span-2">
              <ThreadList
                threads={commentThreads}
                selectedId={selectedThreadId}
                onSelect={setSelectedThreadId}
                filter="all"
                onFilterChange={() => {}}
                search={inboxSearch}
                onSearchChange={setInboxSearch}
              />
            </div>
            <div className="lg:col-span-3">
              <ThreadDetail
                thread={
                  selectedThread?.type === 'comment'
                    ? selectedThread
                    : commentThreads.find((t) => t.id === selectedThreadId) || commentThreads[0] || null
                }
                replyText={replyText}
                onReplyChange={setReplyText}
                onSend={sendReply}
                onMarkRead={markRead}
              />
            </div>
          </div>
        </div>
      )}

      {tab === 'messages' && (
        <div>
          <div className="flex items-center gap-2 mb-4 text-sm text-theme-muted/60">
            <MessagesSquare size={16} className="text-curi-pink" />
            <span>Respond to DMs and messages from Instagram, Facebook, and more</span>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
            <div className="lg:col-span-2">
              <ThreadList
                threads={dmThreads}
                selectedId={selectedThreadId}
                onSelect={setSelectedThreadId}
                filter="all"
                onFilterChange={() => {}}
                search={inboxSearch}
                onSearchChange={setInboxSearch}
              />
            </div>
            <div className="lg:col-span-3">
              <ThreadDetail
                thread={
                  selectedThread?.type === 'dm'
                    ? selectedThread
                    : dmThreads.find((t) => t.id === selectedThreadId) || dmThreads[0] || null
                }
                replyText={replyText}
                onReplyChange={setReplyText}
                onSend={sendReply}
                onMarkRead={markRead}
              />
            </div>
          </div>
        </div>
      )}

      {tab === 'automations' && (
        <div className="space-y-5">
          <AutomationSection
            title="Comment-to-DM Automation"
            description="When someone comments with a trigger keyword, automatically send them a DM — perfect for lead magnets and link requests."
            items={automations.commentToDm}
            fields={[
              { key: 'name', label: 'Rule name' },
              { key: 'keyword', label: 'Trigger keyword' },
              {
                key: 'platform',
                label: 'Platform',
                type: 'select',
                options: [
                  { value: 'instagram', label: 'Instagram' },
                  { value: 'facebook', label: 'Facebook' },
                  { value: 'all', label: 'All' },
                ],
              },
              { key: 'dmTemplate', label: 'DM message', type: 'textarea', full: true },
            ]}
            onAdd={() => addRule('commentToDm', {
              name: 'New comment-to-DM rule',
              keyword: '',
              dmTemplate: '',
              enabled: false,
              platform: 'instagram',
            })}
            onToggle={(id) => toggleRule('commentToDm', id)}
            onDelete={(id) => deleteRule('commentToDm', id)}
            onUpdate={(id, field, value) => updateRule('commentToDm', id, field, value)}
          />

          <AutomationSection
            title="Automated Replies"
            description="Reply automatically to comments that match specific keywords or phrases."
            items={automations.autoReplies}
            fields={[
              { key: 'name', label: 'Rule name' },
              { key: 'keyword', label: 'Trigger keyword' },
              {
                key: 'platform',
                label: 'Platform',
                type: 'select',
                options: [
                  { value: 'all', label: 'All platforms' },
                  { value: 'instagram', label: 'Instagram' },
                  { value: 'facebook', label: 'Facebook' },
                  { value: 'linkedin', label: 'LinkedIn' },
                ],
              },
              { key: 'replyTemplate', label: 'Reply message', type: 'textarea', full: true },
            ]}
            onAdd={() => addRule('autoReplies', {
              name: 'New auto-reply',
              keyword: '',
              replyTemplate: '',
              enabled: false,
              platform: 'all',
            })}
            onToggle={(id) => toggleRule('autoReplies', id)}
            onDelete={(id) => deleteRule('autoReplies', id)}
            onUpdate={(id, field, value) => updateRule('autoReplies', id, field, value)}
          />

          <AutomationSection
            title="DM Automation"
            description="Send messages automatically based on user interactions — new followers, story replies, and more."
            items={automations.dmAutomation}
            fields={[
              { key: 'name', label: 'Rule name' },
              {
                key: 'trigger',
                label: 'Trigger',
                type: 'select',
                options: [
                  { value: 'new_follower', label: 'New follower' },
                  { value: 'story_reply', label: 'Story reply' },
                  { value: 'first_message', label: 'First message' },
                  { value: 'keyword', label: 'Keyword in DM' },
                ],
              },
              {
                key: 'platform',
                label: 'Platform',
                type: 'select',
                options: [
                  { value: 'instagram', label: 'Instagram' },
                  { value: 'facebook', label: 'Facebook' },
                ],
              },
              { key: 'messageTemplate', label: 'Message', type: 'textarea', full: true },
            ]}
            onAdd={() => addRule('dmAutomation', {
              name: 'New DM automation',
              trigger: 'new_follower',
              messageTemplate: '',
              enabled: false,
              platform: 'instagram',
            })}
            onToggle={(id) => toggleRule('dmAutomation', id)}
            onDelete={(id) => deleteRule('dmAutomation', id)}
            onUpdate={(id, field, value) => updateRule('dmAutomation', id, field, value)}
          />

          <div className="page-card bg-theme-subtle/5 border border-theme-border/30">
            <div className="flex items-start gap-3">
              <CheckCircle2 size={18} className="text-curi-green mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-bold text-theme-text">Automation rules are saved locally</p>
                <p className="text-xs text-theme-muted/55 mt-1">
                  Rules persist per workspace in your browser until live channel APIs are connected.
                  Connect Instagram or Facebook in Social Channels to prepare for live inbox sync.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  )
}
