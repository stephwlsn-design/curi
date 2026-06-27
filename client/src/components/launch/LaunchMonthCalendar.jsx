import { useMemo, useState } from 'react'
import {
  addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, format, isSameMonth, isSameDay, isToday,
} from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'

const PLATFORM_DOT = {
  linkedin: 'bg-blue-500',
  twitter: 'bg-sky-400',
  instagram: 'bg-pink-500',
  facebook: 'bg-blue-400',
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function LaunchMonthCalendar({
  posts = [],
  dateField = 'scheduledAt',
  accent = 'blue',
  emptyHint = 'No posts on this calendar yet.',
}) {
  const [month, setMonth] = useState(() => startOfMonth(new Date()))
  const [selected, setSelected] = useState(null)

  const postsByDay = useMemo(() => {
    const map = new Map()
    posts.forEach((post) => {
      const raw = post[dateField]
      if (!raw) return
      const key = format(new Date(raw), 'yyyy-MM-dd')
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(post)
    })
    return map
  }, [posts, dateField])

  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(month))
    const end = endOfWeek(endOfMonth(month))
    return eachDayOfInterval({ start, end })
  }, [month])

  const selectedPosts = useMemo(() => {
    if (!selected) return []
    return postsByDay.get(format(selected, 'yyyy-MM-dd')) || []
  }, [selected, postsByDay])

  const accentRing = accent === 'green' ? 'ring-curi-green/50 bg-curi-green/15' : 'ring-curi-blue/50 bg-curi-blue/15'
  const accentDot = accent === 'green' ? 'bg-curi-green' : 'bg-curi-blue'
  const accentText = accent === 'green' ? 'text-curi-green' : 'text-curi-blue'

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={() => setMonth((m) => subMonths(m, 1))}
          className="p-1.5 rounded-lg hover:bg-theme-subtle/10 text-theme-muted/60"
          aria-label="Previous month"
        >
          <ChevronLeft size={18} />
        </button>
        <span className="text-sm font-bold text-theme-text">{format(month, 'MMMM yyyy')}</span>
        <button
          type="button"
          onClick={() => setMonth((m) => addMonths(m, 1))}
          className="p-1.5 rounded-lg hover:bg-theme-subtle/10 text-theme-muted/60"
          aria-label="Next month"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAYS.map((d) => (
          <div key={d} className="text-center text-[10px] font-bold text-theme-muted/40 uppercase py-1">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((day) => {
          const key = format(day, 'yyyy-MM-dd')
          const dayPosts = postsByDay.get(key) || []
          const inMonth = isSameMonth(day, month)
          const isSelected = selected && isSameDay(day, selected)
          const today = isToday(day)

          return (
            <button
              key={key}
              type="button"
              onClick={() => setSelected(isSelected ? null : day)}
              className={`min-h-[52px] rounded-lg border p-1 text-left transition-all ${
                !inMonth
                  ? 'border-transparent opacity-30'
                  : isSelected
                    ? `border-transparent ring-2 ${accentRing}`
                    : today
                      ? 'border-curi-pink/30 bg-curi-pink/5'
                      : 'border-theme-subtle/10 bg-theme-subtle/5 hover:border-theme-border'
              }`}
            >
              <span className={`text-xs font-semibold ${inMonth ? 'text-theme-text' : 'text-theme-muted/40'}`}>
                {format(day, 'd')}
              </span>
              {dayPosts.length > 0 && (
                <div className="flex flex-wrap gap-0.5 mt-1">
                  {dayPosts.slice(0, 3).map((post) => (
                    <span
                      key={post._id}
                      className={`w-1.5 h-1.5 rounded-full ${PLATFORM_DOT[post.platform] || accentDot}`}
                    />
                  ))}
                  {dayPosts.length > 3 && (
                    <span className={`text-[9px] font-bold ${accentText}`}>+{dayPosts.length - 3}</span>
                  )}
                </div>
              )}
            </button>
          )
        })}
      </div>

      <div className="mt-4 min-h-[72px]">
        {selected && selectedPosts.length > 0 ? (
          <div className="space-y-2">
            <div className="text-xs font-bold text-theme-muted/50">
              {format(selected, 'EEEE, MMMM d')}
            </div>
            {selectedPosts.map((post) => (
              <div key={post._id} className="rounded-lg border border-theme-subtle/10 bg-theme-subtle/5 p-2">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="badge capitalize text-[10px] bg-theme-subtle/10">{post.platform}</span>
                  <span className="text-[10px] text-theme-muted/45 ml-auto">
                    {format(new Date(post[dateField]), 'h:mm a')}
                  </span>
                </div>
                <p className="text-xs text-theme-text line-clamp-2">{post.content || post.title}</p>
              </div>
            ))}
          </div>
        ) : selected ? (
          <p className="text-xs text-theme-muted/45 py-2">No posts on this day.</p>
        ) : (
          <p className="text-xs text-theme-muted/45 py-2">
            {posts.length ? 'Click a day to see posts.' : emptyHint}
          </p>
        )}
      </div>
    </div>
  )
}
