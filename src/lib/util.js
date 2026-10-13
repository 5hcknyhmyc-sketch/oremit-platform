// Small shared helpers: ids, randomness (seedable for demo data), formatting.

let rand = Math.random
export const random = () => rand()
export function withSeed(seed, fn) {
  let h = 2166136261
  for (const c of String(seed)) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0
  const prev = rand
  rand = () => { h = (Math.imul(h, 1664525) + 1013904223) >>> 0; return h / 4294967296 }
  try { return fn() } finally { rand = prev }
}
export const pick = (arr) => arr[Math.floor(random() * arr.length)]
export const between = (a, b) => a + random() * (b - a)

export function uid(prefix) {
  let s = ''
  for (let i = 0; i < 10; i++) s += 'abcdefghijkmnpqrstuvwxyz23456789'[Math.floor(random() * 32)]
  return `${prefix}_${s}`
}
export function shortCode(n = 6) {
  let s = ''
  for (let i = 0; i < n; i++) s += 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(random() * 32)]
  return s
}

export const DAY = 86400000
export const now = () => Date.now()

export const gbp = (n) => '£' + Math.round(+n || 0).toLocaleString('en-GB')
export const gbp2 = (n) => '£' + (+n || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
export const num = (n, d = 2) => (+n || 0).toLocaleString('en-GB', { maximumFractionDigits: d })
export const initials = (s) => (s || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase()

export function fmtDate(ts, withTime = true) {
  if (!ts) return '—'
  const d = new Date(ts)
  const today = new Date()
  const sameDay = d.toDateString() === today.toDateString()
  const date = sameDay ? 'Today' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric' })
  return withTime ? `${date} ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}` : date
}
export function ago(ts) {
  const s = Math.max(0, (Date.now() - ts) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}
export function ageFrom(dob) {
  if (!dob) return null
  const d = new Date(dob), t = new Date()
  let a = t.getFullYear() - d.getFullYear()
  if (t < new Date(t.getFullYear(), d.getMonth(), d.getDate())) a--
  return a
}
export function inkOn(hex) {
  const h = (hex || '#000000').replace('#', '')
  const r = parseInt(h.substr(0, 2), 16), g = parseInt(h.substr(2, 2), 16), b = parseInt(h.substr(4, 2), 16)
  return 0.299 * r + 0.587 * g + 0.114 * b > 160 ? '#111827' : '#FFFFFF'
}
export function toCsv(rows) {
  if (!rows.length) return ''
  const cols = Object.keys(rows[0])
  const q = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
  return [cols.join(','), ...rows.map((r) => cols.map((c) => q(r[c])).join(','))].join('\n')
}
export function download(name, text, type = 'text/csv') {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url; a.download = name; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
