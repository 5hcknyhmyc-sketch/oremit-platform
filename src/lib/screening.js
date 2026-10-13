// Name screening against watchlists using Jaro-Winkler similarity on normalised, token-sorted names.
import { WATCHLIST, PEP_LIST } from './reference'

const norm = (s) => (s || '').toLowerCase().normalize('NFKD').replace(/[^a-z\s]/g, ' ').split(/\s+/).filter((t) => t && !['mr', 'mrs', 'ms', 'dr', 'senator', 'al'].includes(t)).sort().join(' ')

export function jaroWinkler(a, b) {
  if (a === b) return 1
  if (!a || !b) return 0
  const md = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1)
  const am = new Array(a.length).fill(false), bm = new Array(b.length).fill(false)
  let m = 0
  for (let i = 0; i < a.length; i++) {
    for (let j = Math.max(0, i - md); j < Math.min(b.length, i + md + 1); j++) {
      if (!bm[j] && a[i] === b[j]) { am[i] = bm[j] = true; m++; break }
    }
  }
  if (!m) return 0
  let t = 0, k = 0
  for (let i = 0; i < a.length; i++) if (am[i]) { while (!bm[k]) k++; if (a[i] !== b[k]) t++; k++ }
  const j = (m / a.length + m / b.length + (m - t / 2) / m) / 3
  let p = 0
  while (p < 4 && a[p] === b[p]) p++
  return j + p * 0.1 * (1 - j)
}

export function screenName(name, threshold = 85) {
  const n = norm(name)
  let best = { score: 0 }
  for (const w of WATCHLIST) {
    const s = Math.round(jaroWinkler(n, norm(w.name)) * 100)
    if (s > best.score) best = { score: s, match: w.name, list: w.list, reason: w.reason }
  }
  let pep = null
  for (const p of PEP_LIST) {
    const s = Math.round(jaroWinkler(n, norm(p.name)) * 100)
    if (s >= 90) pep = { match: p.name, role: p.role, score: s }
  }
  return {
    status: best.score >= threshold ? 'potential_match' : 'clear',
    score: best.score,
    match: best.score >= threshold ? best : null,
    pep,
    at: Date.now(),
  }
}
