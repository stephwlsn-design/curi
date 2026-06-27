import { Rocket, Calendar, CheckCircle2 } from 'lucide-react'
import LaunchMonthCalendar from './LaunchMonthCalendar'

export default function LaunchActivity({ overview, loading }) {
  if (loading) {
    return (
      <div className="page-card py-10 text-center text-sm text-theme-muted/50">
        Loading launch activity…
      </div>
    )
  }

  const launched = overview?.launched || []
  const scheduled = overview?.scheduled || []
  const campaigns = overview?.campaigns || []

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="page-card">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle2 size={18} className="text-curi-green" />
            <h3 className="font-bold text-theme-text">Launched</h3>
            <span className="badge bg-curi-green/15 text-curi-green text-xs ml-auto">{launched.length}</span>
          </div>
          <LaunchMonthCalendar
            posts={launched}
            dateField="publishedAt"
            accent="green"
            emptyHint="Published launch posts will appear on this calendar."
          />
        </div>

        <div className="page-card">
          <div className="flex items-center gap-2 mb-4">
            <Calendar size={18} className="text-curi-blue" />
            <h3 className="font-bold text-theme-text">Scheduled</h3>
            <span className="badge bg-curi-blue/15 text-curi-blue text-xs ml-auto">{scheduled.length}</span>
          </div>
          <LaunchMonthCalendar
            posts={scheduled}
            dateField="scheduledAt"
            accent="blue"
            emptyHint="Scheduled and upcoming launch posts will appear on this calendar."
          />
        </div>
      </div>

      {campaigns.length > 0 && (
        <div className="page-card">
          <div className="flex items-center gap-2 mb-4">
            <Rocket size={18} className="text-curi-pink" />
            <h3 className="font-bold text-theme-text">Campaign history</h3>
          </div>
          <div className="space-y-3">
            {campaigns.map((campaign) => (
              <div key={campaign._id} className="rounded-xl border border-theme-subtle/10 bg-theme-subtle/5 p-4">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="font-semibold text-theme-text text-sm">{campaign.goal?.slice(0, 80) || campaign.name}</span>
                  <span className="badge bg-theme-subtle/10 text-theme-muted/60 capitalize text-xs">{campaign.status}</span>
                </div>
                <div className="flex flex-wrap gap-3 text-xs text-theme-muted/50 mt-2">
                  <span>{campaign.stats?.published || 0} published</span>
                  <span>{campaign.stats?.scheduled || 0} scheduled</span>
                  <span>{campaign.stats?.review || 0} in review</span>
                  <span>{(campaign.platforms || []).join(', ') || '—'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
