import { useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import { X } from 'lucide-react'
import { useStore } from '../store'
import { TX_STATUS } from '../lib/reference'
import { initials, inkOn } from '../lib/util'
import { PLATFORM } from '../lib/reference'

// Platform wordmark: highlights the second capital letter (Co[R]emit) when there is one.
export function Wordmark() {
  const n = PLATFORM.name || ''
  const up = (ch) => ch >= 'A' && ch <= 'Z'
  const caps = [...n].map((ch, i) => (i > 0 && up(ch) ? i : -1)).filter((i) => i > 0)
  const i = caps[0]
  let j = i
  while (i && j + 1 < n.length && up(n[j + 1]) && (j + 2 >= n.length || up(n[j + 2]))) j++
  return <span className="wordmark">{i ? <>{n.slice(0, i)}<i>{n.slice(i, j + 1)}</i>{n.slice(j + 1)}</> : n}{PLATFORM.owner && PLATFORM.owner.replace(/ Ltd$/, '') !== n && <small>by {PLATFORM.owner}</small>}</span>
}

export const Pill = ({ tone = 'mute', children }) => <span className={`pill ${tone}`}>{children}</span>
export const TxStatus = ({ s }) => <Pill tone={TX_STATUS[s]?.tone}>{TX_STATUS[s]?.label || s}</Pill>
export const KycPill = ({ s }) => <Pill tone={{ verified: 'good', pending: 'warn', not_started: 'mute', rejected: 'crit' }[s]}>{{ verified: 'Verified', pending: 'Pending review', not_started: 'Not started', rejected: 'Rejected' }[s]}</Pill>
export const RiskPill = ({ level }) => <Pill tone={{ Low: 'good', Medium: 'warn', High: 'crit' }[level]}>{level} risk</Pill>
export const ScreenPill = ({ s }) => s ? <Pill tone={{ clear: 'good', cleared: 'good', potential_match: 'crit', confirmed_match: 'crit' }[s.status]}>{{ clear: 'Clear', cleared: 'Cleared (false positive)', potential_match: `Possible match ${s.score}%`, confirmed_match: 'Confirmed match' }[s.status]}</Pill> : null
export const CasePill = ({ s }) => <Pill tone={{ open: 'crit', in_review: 'warn', escalated: 'info', closed: 'mute' }[s]}>{{ open: 'Open', in_review: 'In review', escalated: 'Escalated to MLRO', closed: 'Closed' }[s]}</Pill>
export const SevStripe = ({ sev }) => <span className="stripe" style={{ background: `var(--${{ high: 'crit', medium: 'warn', low: 'info' }[sev] || 'line'})` }} />

export function Kpi({ label, value, sub, tone, to }) {
  const C = to ? NavLink : 'div'
  return <C className={`kpi ${tone || ''}`} {...(to ? { to } : {})}><span className="l">{label}</span><span className="v">{value}</span>{sub && <span className="s">{sub}</span>}</C>
}

export function Panel({ title, actions, children, pad, className = '' }) {
  return (
    <section className={`panel ${className}`}>
      {(title || actions) && <div className="panel-h">{typeof title === 'string' ? <h2>{title}</h2> : title}{actions && <div className="row">{actions}</div>}</div>}
      {pad ? <div className="panel-b">{children}</div> : children}
    </section>
  )
}

export function PageHead({ title, sub, crumb, children }) {
  return (
    <div className="ph">
      <div>{crumb && <div className="crumb">{crumb}</div>}<h1>{title}</h1>{sub && <p>{sub}</p>}</div>
      {children && <div className="row">{children}</div>}
    </div>
  )
}

export function Modal({ title, onClose, children, footer, wide }) {
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])
  return (
    <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-h"><h2>{title}</h2><button className="btn ghost sm" onClick={onClose} aria-label="Close"><X /></button></div>
        <div className="modal-b">{children}</div>
        {footer && <div className="modal-f">{footer}</div>}
      </div>
    </div>
  )
}

export function Drawer({ title, onClose, children, footer }) {
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])
  return (
    <>
      <div className="drawer-scrim" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-label={title}>
        <div className="modal-h"><h2>{title}</h2><button className="btn ghost sm" onClick={onClose} aria-label="Close"><X /></button></div>
        <div className="modal-b">{children}</div>
        {footer && <div className="modal-f">{footer}</div>}
      </aside>
    </>
  )
}

export const Field = ({ label, hint, children, id }) => (
  <div className="field">{label && <label htmlFor={id}>{label}</label>}{children}{hint && <span className="hint">{hint}</span>}</div>
)
export const Toggle = ({ on, onChange, label, disabled }) => (
  <button type="button" className="toggle" aria-pressed={!!on} aria-label={label} disabled={disabled} onClick={() => onChange(!on)} />
)
export const Empty = ({ children }) => <div className="empty">{children}</div>

export function Logo({ t, size = '' }) {
  return (
    <div className={`logo ${size}`} style={{ '--brand': t.brand.color, '--brand-ink': inkOn(t.brand.color) }}>
      {t.brand.logo ? <img src={t.brand.logo} alt="" /> : initials(t.name)}
    </div>
  )
}
const FS = { S: '13px', M: '14px', L: '15.5px' }
export const brandVars = (t) => {
  const b = t.brand || {}
  return { '--brand': b.color, '--brand-ink': inkOn(b.color), '--accent': b.accent, '--accent-ink': inkOn(b.accent), '--b-font': `"${b.font || 'Inter'}", var(--f-ui)`, '--b-r': `${b.radius ?? 14}px`, '--b-fs': FS[b.fontSize || 'M'] }
}
export const MadeBy = ({ style }) => <div className="madeby" style={style}>Made by TheFXSoft Limited</div>

export function Tabs({ items }) {
  return (
    <nav className="tabs">
      {items.map((i) => (
        <NavLink key={i.to} to={i.to} end={i.end} className={({ isActive }) => (isActive ? 'active' : '')}>
          {i.label}{i.count ? <span className="count">{i.count}</span> : null}
        </NavLink>
      ))}
    </nav>
  )
}

export function Toast() {
  const t = useStore((s) => s.toast)
  const clear = () => useStore.setState({ toast: null })
  useEffect(() => {
    if (!t) return
    const h = setTimeout(clear, t.tone === 'err' ? 4500 : 2500)
    return () => clearTimeout(h)
  }, [t])
  if (!t) return null
  return <div className={`toast ${t.tone === 'err' ? 'err' : ''}`} role="status">{t.msg}</div>
}

// Tiny markdown renderer for policies and AI output (headings, lists, bold, tables, paragraphs)
export function Markdown({ text }) {
  const lines = (text || '').split('\n')
  const out = []
  let i = 0
  const inline = (s) => s.split(/(\*\*[^*]+\*\*)/g).map((p, j) => (p.startsWith('**') ? <b key={j}>{p.slice(2, -2)}</b> : p))
  while (i < lines.length) {
    const l = lines[i]
    if (/^#\s/.test(l)) out.push(<h1 key={i}>{inline(l.slice(2))}</h1>)
    else if (/^##+\s/.test(l)) out.push(<h2 key={i}>{inline(l.replace(/^#+\s/, ''))}</h2>)
    else if (/^\s*[-*]\s/.test(l) || /^\s*\d+\.\s/.test(l)) {
      const ordered = /^\s*\d+\.\s/.test(l)
      const items = []
      while (i < lines.length && (/^\s*[-*]\s/.test(lines[i]) || /^\s*\d+\.\s/.test(lines[i]))) { items.push(lines[i].replace(/^\s*([-*]|\d+\.)\s/, '')); i++ }
      const L = ordered ? 'ol' : 'ul'
      out.push(<L key={i}>{items.map((x, j) => <li key={j}>{inline(x)}</li>)}</L>)
      continue
    } else if (/^\|/.test(l)) {
      const rows = []
      while (i < lines.length && /^\|/.test(lines[i])) { if (!/^\|[-|\s:]+\|$/.test(lines[i].trim())) rows.push(lines[i].split('|').slice(1, -1).map((c) => c.trim())); i++ }
      out.push(<div className="tbl-wrap" key={i}><table><thead><tr>{rows[0].map((c, j) => <th key={j}>{c}</th>)}</tr></thead><tbody>{rows.slice(1).map((r, k) => <tr key={k}>{r.map((c, j) => <td key={j}>{inline(c)}</td>)}</tr>)}</tbody></table></div>)
      continue
    } else if (l.trim()) out.push(<p key={i}>{inline(l)}</p>)
    i++
  }
  return <div className="doc">{out}</div>
}
