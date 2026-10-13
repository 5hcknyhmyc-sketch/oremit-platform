import { useState } from 'react'
import { Routes, Route, NavLink, Navigate, Link, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Building2, CheckCircle2, Globe2, Receipt, ScrollText, Plus, Copy, ExternalLink } from 'lucide-react'
import { useStore, act } from '../../store'
import TopBar from '../../components/TopBar'
import { Logo, Panel, PageHead, Kpi, Pill, Empty, Modal } from '../../components/ui'
import * as E from '../../lib/engine'
import { PARTNERS } from '../../lib/reference'
import { gbp, gbp2, fmtDate, DAY, ago } from '../../lib/util'

const NAV = [['/admin', 'Overview', LayoutDashboard, true], ['/admin/msbs', 'MSBs', Building2], ['/admin/approvals', 'Approvals', CheckCircle2], ['/admin/network', 'Payout network', Globe2], ['/admin/billing', 'Billing', Receipt], ['/admin/audit', 'Audit log', ScrollText]]

export default function AdminApp() {
  const session = useStore((s) => s.session)
  const db = useStore((s) => s.db)
  if (!session || session.kind !== 'super') return <Navigate to="/" replace />
  const review = db.tenants.filter((t) => t.status === 'review').length
  return (
    <>
      <TopBar label="Super Admin · TheFXSoft" />
      <div className="shell">
        <aside className="side">
          <div className="tenant-id"><div className="logo" style={{ '--brand': 'var(--chrome)', '--brand-ink': '#fff' }}>FX</div><div><b>TheFXSoft</b><span>admin.coremit.app</span></div></div>
          <nav className="nav">{NAV.map(([to, l, I, end]) => <NavLink key={to} to={to} end={end} className={({ isActive }) => (isActive ? 'active' : '')}><I />{l}{l === 'Approvals' && review ? <span className="count">{review}</span> : null}</NavLink>)}</nav>
          <div className="side-foot"><span>Signed in as <b>Zaland Shah</b></span><span>Owner</span></div>
        </aside>
        <main className="main">
          <Routes>
            <Route index element={<Overview />} />
            <Route path="msbs" element={<Msbs />} />
            <Route path="approvals" element={<Approvals />} />
            <Route path="network" element={<Network />} />
            <Route path="billing" element={<Billing />} />
            <Route path="audit" element={<Audit />} />
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Routes>
        </main>
      </div>
    </>
  )
}

const statusPill = (s) => ({ live: <Pill tone="good">Live</Pill>, review: <Pill tone="warn">Awaiting approval</Pill>, suspended: <Pill tone="crit">Suspended</Pill>, invite: <Pill tone="mute">Link sent</Pill> }[s])
const setup = (t) => (t.setupSeconds ? `${Math.floor(t.setupSeconds / 60)}m ${String(t.setupSeconds % 60).padStart(2, '0')}s` : '—')
const vol30 = (db, t) => db.transactions.filter((x) => x.tenantId === t.id && x.status === 'paid' && Date.now() - x.createdAt < 30 * DAY).reduce((a, x) => a + x.sendAmount, 0)

function useImpersonate() {
  const login = useStore((s) => s.login)
  const nav = useNavigate()
  return (t) => { login({ kind: 'msb', tenantId: t.id, role: 'Admin', name: 'Zaland Shah (TheFXSoft)', impersonating: true }); nav('/portal') }
}

function InviteBox() {
  const db = useStore((s) => s.db)
  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState('')
  const [last, setLast] = useState(null)
  const create = () => { const inv = act((d) => { const i = E.createInvite(d, 'Zaland Shah'); i.label = label.trim(); return i }, 'Onboarding link created'); if (inv) { setLast(inv); setOpen(false); setLabel('') } }
  const url = (inv) => `${location.origin}/onboard/${inv.token}`
  const pending = db.invites.filter((i) => !i.usedBy && i.expiresAt > Date.now())
  return (
    <Panel title="Onboard a new MSB" actions={<button className="btn pri sm" onClick={() => setOpen(true)}><Plus />Create onboarding link</button>}>
      <div className="panel-b stack-s">
        {last && <div className="linkbox"><code>{url(last)}</code><button className="btn sm" onClick={() => navigator.clipboard?.writeText(url(last))}><Copy />Copy</button><Link className="btn sm" to={`/onboard/${last.token}`}><ExternalLink />Open as the MSB</Link></div>}
        <p className="muted small">Send the MSB one link. They enter their business, brand, corridors, partners and compliance settings; their portal and app are generated in minutes. You approve before real money moves.</p>
        {pending.length > 0 && <div className="list" style={{ borderTop: '1px solid var(--line)' }}>{pending.map((i) => <div className="li" key={i.token} style={{ padding: '8px 0' }}><div className="grow"><b>{i.label || 'Unnamed link'}</b><small>Sent {fmtDate(i.createdAt, false)} · expires {fmtDate(i.expiresAt, false)}</small></div><Link className="btn sm" to={`/onboard/${i.token}`}>Open</Link></div>)}</div>}
      </div>
      {open && <Modal title="New onboarding link" onClose={() => setOpen(false)} footer={<><button className="btn" onClick={() => setOpen(false)}>Cancel</button><button className="btn pri" onClick={create}>Create link</button></>}>
        <div className="field"><label htmlFor="inv-l">MSB name (for your records)</label><input id="inv-l" className="inp" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Barking Money Express" autoFocus /></div>
        <p className="muted small">Single use, expires in 7 days.</p>
      </Modal>}
    </Panel>
  )
}

function Overview() {
  const db = useStore((s) => s.db)
  const live = db.tenants.filter((t) => t.status === 'live'), review = db.tenants.filter((t) => t.status === 'review')
  const vol = live.reduce((a, t) => a + vol30(db, t), 0)
  const mx = Math.max(...live.map((t) => vol30(db, t)), 1)
  const avg = db.tenants.filter((t) => t.setupSeconds).reduce((a, t, _, arr) => a + t.setupSeconds / arr.length, 0)
  return (
    <>
      <PageHead title="Platform overview" sub="Every MSB running on CoRemit · last 30 days" />
      <div className="kpis">
        <Kpi label="Live MSBs" value={live.length} sub={`${db.tenants.length} on the platform`} tone="good" to="/admin/msbs" />
        <Kpi label="Awaiting approval" value={review.length} sub={review.length ? 'Check KYB before go-live' : 'Nothing waiting'} tone={review.length ? 'warn' : ''} to="/admin/approvals" />
        <Kpi label="Platform volume" value={gbp(vol)} sub={`${db.transactions.filter((x) => x.status === 'paid' && Date.now() - x.createdAt < 30 * DAY).length} paid transfers`} />
        <Kpi label="Avg. setup time" value={`${Math.floor(avg / 60)}m ${String(Math.round(avg % 60)).padStart(2, '0')}s`} sub="Target: under 15 minutes" />
      </div>
      {review.length > 0 && <div className="banner warn"><b>{review.map((t) => t.name).join(', ')}</b> finished onboarding and {review.length > 1 ? 'are' : 'is'} waiting for your approval.<Link className="btn sm" to="/admin/approvals" style={{ marginLeft: 'auto' }}>Review</Link></div>}
      <div className="grid2">
        <Panel title="Volume by MSB" pad>{live.map((t) => <div className="hbar" key={t.id}><span>{t.name}</span><div className="track"><div className="fill" style={{ width: `${(vol30(db, t) / mx) * 100}%`, background: t.brand.color }} /></div><span className="num" style={{ textAlign: 'right' }}>{gbp(vol30(db, t))}</span></div>)}</Panel>
        <InviteBox />
      </div>
      <Panel title="Recent platform activity"><div className="list">{db.audit.slice(0, 8).map((a) => <div className="li" key={a.id}><div className="grow"><b>{a.action}{a.target ? ` · ${a.target}` : ''}</b><small>{db.tenants.find((t) => t.id === a.tenantId)?.name || 'Platform'} · {a.actor} · {ago(a.at)}</small></div></div>)}</div></Panel>
    </>
  )
}

function Msbs() {
  const db = useStore((s) => s.db)
  const imp = useImpersonate()
  const rows = [...db.tenants.map((t) => ({ t })), ...db.invites.filter((i) => !i.usedBy).map((i) => ({ inv: i }))]
  return (
    <>
      <PageHead title="MSBs" sub="Every business on the platform, each with its own domain, brand and data." />
      <InviteBox />
      <Panel>
        <div className="tbl-wrap"><table>
          <thead><tr><th>MSB</th><th>Status</th><th>Domain</th><th>FCA FRN</th><th className="r">30-day volume</th><th>Setup</th><th></th></tr></thead>
          <tbody>{rows.map(({ t, inv }) => t ? (
            <tr key={t.id}><td><div className="cell-t"><Logo t={t} /><div><b>{t.name}</b><small>{t.liveAt ? `Live since ${fmtDate(t.liveAt, false)}` : `Submitted ${fmtDate(t.createdAt, false)}`}</small></div></div></td><td>{statusPill(t.status)}</td>
              <td className="mono small">{t.slug}.coremit.app{t.domain && <><br /><span className="muted">{t.domain}</span></>}</td><td className="mono">{t.frn || '—'}</td><td className="r num">{t.status === 'live' ? gbp(vol30(db, t)) : '—'}</td><td className="mono">{setup(t)}</td>
              <td><div className="row" style={{ justifyContent: 'flex-end' }}>
                {t.status === 'review' && <Link className="btn sm pri" to="/admin/approvals">Review</Link>}
                <button className="btn sm" onClick={() => imp(t)}>Open admin</button>
                <Link className="btn sm" to={`/app/${t.slug}`}>View app</Link>
                {t.status === 'live' && <button className="btn sm danger" onClick={() => act((d) => E.setTenantStatus(d, t.id, 'suspended', 'Zaland Shah'), `${t.name} suspended`)}>Suspend</button>}
                {t.status === 'suspended' && <button className="btn sm" onClick={() => act((d) => E.setTenantStatus(d, t.id, 'live', 'Zaland Shah'), `${t.name} reactivated`)}>Reactivate</button>}
              </div></td></tr>
          ) : (
            <tr key={inv.token}><td><div className="cell-t"><div className="logo" style={{ '--brand': 'var(--line)', '--brand-ink': 'var(--muted)' }}>?</div><div><b>{inv.label || 'Unnamed link'}</b><small>Link sent {fmtDate(inv.createdAt, false)}</small></div></div></td><td>{statusPill(inv.expiresAt < Date.now() ? 'expired' : 'invite') || <Pill tone="crit">Expired</Pill>}</td><td className="muted">—</td><td className="muted">—</td><td className="r muted">—</td><td className="muted">—</td>
              <td><div className="row" style={{ justifyContent: 'flex-end' }}><Link className="btn sm" to={`/onboard/${inv.token}`}>Open link</Link></div></td></tr>
          ))}</tbody>
        </table></div>
      </Panel>
    </>
  )
}

function Approvals() {
  const db = useStore((s) => s.db)
  const rev = db.tenants.filter((t) => t.status === 'review')
  const toggle = (t, k, v) => act((d) => { d.tenants.find((x) => x.id === t.id).checks[k] = v })
  return (
    <>
      <PageHead title="Approvals" sub="Automated checks run on submission. Complete the manual ones, then approve to go live." />
      {rev.length ? rev.map((t) => {
        const all = E.APPROVAL_CHECKS.every(([k]) => t.checks[k])
        return (
          <Panel key={t.id} title={<div className="cell-t"><Logo t={t} /><div><h2>{t.name}</h2><small className="muted mono">FRN {t.frn} · MLR {t.mlr} · set up in {setup(t)} · {t.email}</small></div></div>} actions={<><Link className="btn sm" to={`/app/${t.slug}`}>Preview app</Link><button className="btn pri" disabled={!all} onClick={() => act((d) => E.setTenantStatus(d, t.id, 'live', 'Zaland Shah'), `${t.name} is live`)}>Approve & go live</button></>}>
            <div className="panel-b stack">
              <div className="checks">{E.APPROVAL_CHECKS.map(([k, l]) => <label key={k} className="check"><input type="checkbox" checked={!!t.checks[k]} onChange={(e) => toggle(t, k, e.target.checked)} /><span>{l}<small>{['ch', 'fca', 'mlr'].includes(k) ? 'Automated check' : 'Manual check'}</small></span></label>)}</div>
              <div className="muted small">Corridors: <b>{t.corridors.map((c) => 'GBP → ' + c.cur).join(', ')}</b> · Partners: {t.partners.map((p) => PARTNERS.find((x) => x.id === p)?.name).join(', ')} · MLRO: {t.compliance.mlro || '—'} · Auto-release up to {gbp(t.compliance.autoRelease.maxAmount)}</div>
              {!all && <p className="muted small">Tick every check to enable approval.</p>}
            </div>
          </Panel>
        )
      }) : <Panel><Empty>Nothing waiting. New MSBs appear here when they finish the onboarding link.</Empty></Panel>}
    </>
  )
}

function Network() {
  const db = useStore((s) => s.db)
  return (
    <>
      <PageHead title="Payout network" sub="Partners integrated once at platform level. Each MSB switches on the ones it has a contract for." />
      <Panel><div className="tbl-wrap"><table><thead><tr><th>Partner</th><th>Currencies</th><th>Methods</th><th>Used by</th><th className="r">Paid out, 30d</th><th>Status</th></tr></thead>
        <tbody>{PARTNERS.map((p) => { const users = db.tenants.filter((t) => t.partners.includes(p.id)); const v = db.transactions.filter((x) => x.partnerId === p.id && x.status === 'paid' && Date.now() - x.createdAt < 30 * DAY).reduce((a, x) => a + x.sendAmount, 0); return <tr key={p.id}><td><b>{p.name}</b></td><td className="mono">{p.cur.join(', ')}</td><td>{p.methods.join(', ')}</td><td>{users.length ? users.map((t) => t.name).join(', ') : <span className="muted">No MSBs yet</span>}</td><td className="r num">{gbp(v)}</td><td><Pill tone="good">Connected</Pill></td></tr> })}</tbody>
      </table></div></Panel>
      <p className="muted small">Partner names are placeholders for the demo.</p>
    </>
  )
}

function Billing() {
  const db = useStore((s) => s.db)
  const PLANS = { Starter: [199, 0.4], Growth: [499, 0.25] }
  return (
    <>
      <PageHead title="Billing" sub="What each MSB pays TheFXSoft. Plans and rates are placeholders." />
      <Panel><div className="tbl-wrap"><table><thead><tr><th>MSB</th><th>Plan</th><th className="r">Monthly fee</th><th className="r">Per paid transfer</th><th className="r">Transfers, 30d</th><th className="r">Due this month</th><th>Status</th></tr></thead>
        <tbody>{db.tenants.map((t) => { const [fee, per] = PLANS[t.plan] || [0, 0]; const n = db.transactions.filter((x) => x.tenantId === t.id && x.status === 'paid' && Date.now() - x.createdAt < 30 * DAY).length; return <tr key={t.id}><td><div className="cell-t"><Logo t={t} /><b>{t.name}</b></div></td><td>{t.plan}</td><td className="r num">{gbp(fee)}</td><td className="r num">{gbp2(per)}</td><td className="r num">{n}</td><td className="r num"><b>{gbp2(fee + per * n)}</b></td><td>{t.status === 'live' ? <Pill tone="good">Active</Pill> : <Pill tone="mute">Starts at go-live</Pill>}</td></tr> })}</tbody>
      </table></div></Panel>
    </>
  )
}

function Audit() {
  const db = useStore((s) => s.db)
  const [q, setQ] = useState('')
  const rows = db.audit.filter((a) => !q || `${a.action} ${a.target} ${a.actor}`.toLowerCase().includes(q.toLowerCase())).slice(0, 200)
  return (
    <>
      <PageHead title="Audit log" sub="Every significant action across the platform and all MSBs." />
      <div className="filters"><input id="au-q" className="inp" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <Panel><div className="tbl-wrap"><table><thead><tr><th>When</th><th>MSB</th><th>Actor</th><th>Action</th></tr></thead>
        <tbody>{rows.map((a) => <tr key={a.id}><td className="nowrap mono small">{fmtDate(a.at)}</td><td>{db.tenants.find((t) => t.id === a.tenantId)?.name || <span className="muted">Platform</span>}</td><td>{a.actor}</td><td>{a.action}{a.target ? <span className="muted"> · {a.target}</span> : ''}</td></tr>)}</tbody>
      </table></div></Panel>
    </>
  )
}
