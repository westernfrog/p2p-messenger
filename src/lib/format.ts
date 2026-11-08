export function sameDay(a: number, b: number): boolean {
  return new Date(a).toDateString() === new Date(b).toDateString()
}

export function dayLabel(ts: number): string {
  const now = new Date()
  const d = new Date(ts)
  if (sameDay(ts, now.getTime())) return 'Today'
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (sameDay(ts, yesterday.getTime())) return 'Yesterday'
  if (now.getTime() - ts < 6 * 86_400_000) return d.toLocaleDateString([], { weekday: 'long' })
  return d.toLocaleDateString([], {
    day: 'numeric',
    month: 'short',
    year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric',
  })
}

export function timeLabel(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

/** Chat list: a time for today, otherwise the day. */
export function listTime(ts: number): string {
  return sameDay(ts, Date.now()) ? timeLabel(ts) : dayLabel(ts)
}

/** "just now", "5 min ago", "2 hr ago", then a day. */
export function agoLabel(ts: number): string {
  const s = Math.round((Date.now() - ts) / 1000)
  if (s < 60) return 'just now'
  const m = Math.round(s / 60)
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 24 && sameDay(ts, Date.now())) return `${h} hr ago`
  return `${dayLabel(ts).toLowerCase() === 'yesterday' ? 'yesterday' : dayLabel(ts)} at ${timeLabel(ts)}`
}
