import { useState } from 'react'
import { Routes, Route, NavLink, Navigate, Link, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Building2, CheckCircle2, Globe2, Receipt, ScrollText, Plus, Copy, ExternalLink, Plug, SlidersHorizontal } from 'lucide-react'
import { useStore, act } from '../../store'
import TopBar from '../../components/TopBar'
import { Logo, Panel, PageHead, Kpi, Pill, Empty, Modal, Field, Toggle } from '../../components/ui'
import * as E from '../../lib/engine'
import { PARTNERS, KYC_PROVIDERS, PAYIN_BANKS, partnersOf, PLANS, PLATFORM, MODULES } from '../../lib/reference'
import * as M from '../../lib/modules'
import PlatformSettings from './PlatformSettings'
import { gbp, gbp2, fmtDate, DAY, ago } from '../../lib/util'

const NAV = [['/admin', 'Overview', LayoutDashboard, true], ['/admin/msbs', 'MSBs', Building2], ['/admin/approvals', 'Approvals', CheckCircle2], ['/admin/integrations', 'Integration requests', Plug], ['/admin/network', 'Integrations catalogue', Globe2], ['/admin/billing', 'Billing', Receipt], ['/admin/platform', 'Platform settings', SlidersHorizontal], ['/admin/audit', 'Audit log', ScrollText]]

export default function AdminApp() {
  const session = useStore((s) => s.session)
  const db = useStore((s) => s.db)
  if (!session || session.kind !== 'super') return <Navigate to="/" replace />
  const review = db.tenants.filter((t) => t.status === 'review').length
  const reqs = db.integrationRequests.filter((r) => ['requested', 'accepted'].includes(r.status)).length
  return (
    <>
      <TopBar label="Super Admin · TheFXSoft" />
      <div className="shell">
        <aside className="side">
          <div className="tenant-id"><div className="logo" style={{ '--brand': 'var(--chrome)', '--brand-ink': '#fff' }}>{PLATFORM.owner.slice(0, 2).toUpperCase()}</div><div><b>{PLATFORM.owner}</b><span>admin.{PLATFORM.domain}</span></div></div>
          <nav className="nav">{NAV.map(([to, l, I, end]) => <NavLink key={to} to={to} end={end} className={({ isActive }) => (isActive ? 'active' : '')}><I />{l}{l === 'Approvals' && review ? <span className="count">{review}</span> : null}{l === 'Integration requests' && reqs ? <span className="count">{reqs}</span> : null}</NavLink>)}</nav>
          <div className="side-foot"><span>Signed in as <b>Zaland Shah</b></span><span>Owner</span></div>
        </aside>
        <main className="main">
          <Routes>
            <Route index element={<Overview />} />
            <Route path="msbs" element={<Msbs />} />
            <Route path="approvals" element={<Approvals />} />
            <Route path="network" element={<Network />} />
            <Route path="integrations" element={<Requests />} />
            <Route path="billing" element={<Billing />} />
            <Route path="audit" element={<Audit />} />
            <Route path="platform/*" element={<PlatformSettings />} />
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
  const [mods, setMods] = useState(null)
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
                <button className="btn sm" onClick={() => setMods(t)}>Modules</button>
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
      {mods && (() => { const t = db.tenants.find((x) => x.id === mods.id); const plan = PLANS.find((x) => x.id === t.plan); return (
        <Modal title={`Modules for ${t.name}`} onClose={() => setMods(null)}>
          <p className="muted small">Plan <b>{t.plan}</b>. Modules outside the plan can still be switched on here as an add-on.</p>
          <div className="list">{MODULES.filter((m) => !m.core).map((m) => <div className="li" key={m.id}><div className="grow"><b>{m.label}</b><small>{m.desc}{plan?.modules.includes(m.id) ? ' · in plan' : ' · add-on'}</small></div><Toggle on={t.modules.includes(m.id)} onChange={() => act((d) => M.setTenantModules(d, t.id, t.modules.includes(m.id) ? t.modules.filter((x) => x !== m.id) : [...t.modules, m.id], 'Zaland Shah'))} label={m.label} /></div>)}</div>
        </Modal>) })()}
    </>
  )
}

function Approvals() {
  const db = useStore((s) => s.db)
  const rev = db.tenants.filter((t) => t.status === 'review')
  const toggle = (t, k, v) => act((d) => { d.tenants.find((x) => x.id === t.id).checks[k] = v })
  return (
    <>
      <PageHead title="Approvals" sub="Go-live checklist: agreement, integrations, prefunding and domain. Regulatory status is self-declared by the MSB and remains its responsibility." />
      {rev.length ? rev.map((t) => {
        const all = E.APPROVAL_CHECKS.every(([k]) => t.checks[k])
        return (
          <Panel key={t.id} title={<div className="cell-t"><Logo t={t} /><div><h2>{t.name}</h2><small className="muted mono">FRN {t.frn} · MLR {t.mlr} · set up in {setup(t)} · {t.email}</small></div></div>} actions={<><Link className="btn sm" to={`/app/${t.slug}`}>Preview app</Link><button className="btn pri" disabled={!all} onClick={() => act((d) => E.setTenantStatus(d, t.id, 'live', 'Zaland Shah'), `${t.name} is live`)}>Approve & go live</button></>}>
            <div className="panel-b stack">
              <div className="checks">{E.APPROVAL_CHECKS.map(([k, l]) => <label key={k} className="check"><input type="checkbox" checked={!!t.checks[k]} onChange={(e) => toggle(t, k, e.target.checked)} /><span>{l}<small>{['reg', 'kyc', 'payout', 'domain'].includes(k) ? 'Set automatically from onboarding' : 'Manual check'}</small></span></label>)}</div>
              <div className="muted small">Corridors: <b>{t.corridors.map((c) => 'GBP → ' + c.cur).join(', ')}</b> · KYC: {t.integrations.kyc.provider === 'custom' ? `custom (${t.integrations.kyc.status})` : KYC_PROVIDERS.find((k) => k.id === t.integrations.kyc.provider)?.name} · Payout: {t.partners.map((p) => partnersOf(db).find((x) => x.id === p)?.name).join(', ') || 'none yet'} · Pay-in: {t.integrations.payin.map((b) => PAYIN_BANKS.find((x) => x.id === b)?.name).join(', ')} · MLRO: {t.compliance.mlro || '—'}</div>
              <div className="muted small">Declaration {t.declaration?.accepted ? <Pill tone="good">accepted by {t.declaration.by}</Pill> : <Pill tone="crit">not accepted</Pill>} · FRN {t.frn || '—'} · MLR {t.mlr || '—'} (self-declared)</div>
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
  const users = (pred) => db.tenants.filter(pred).map((t) => t.name).join(', ') || <span className="muted">No MSBs yet</span>
  return (
    <>
      <PageHead title="Integrations catalogue" sub="What every MSB can switch on at sign-up. Included items are already built; anything else is quoted as a custom integration." />
      <Panel title="Identity verification (KYC)"><div className="tbl-wrap"><table><thead><tr><th>Provider</th><th>What it does</th><th>Used by</th><th>Cost</th></tr></thead><tbody>{KYC_PROVIDERS.map((k) => <tr key={k.id}><td><b>{k.name}</b></td><td className="small">{k.desc}</td><td>{users((t) => t.integrations.kyc.provider === k.id)}</td><td>{k.included ? <Pill tone="good">Included</Pill> : <Pill tone="info">Quoted</Pill>}</td></tr>)}</tbody></table></div></Panel>
      <Panel title="Payout partners"><div className="tbl-wrap"><table><thead><tr><th>Partner</th><th>Currencies</th><th>Methods</th><th>Used by</th><th className="r">Paid out, 30d</th><th>Cost</th></tr></thead>
        <tbody>{partnersOf(db).map((p) => { const v = db.transactions.filter((x) => x.partnerId === p.id && x.status === 'paid' && Date.now() - x.createdAt < 30 * DAY).reduce((a, x) => a + x.sendAmount, 0); return <tr key={p.id}><td><b>{p.name}</b></td><td className="mono">{p.cur.join(', ')}</td><td>{p.methods.join(', ')}</td><td>{users((t) => t.partners.includes(p.id))}</td><td className="r num">{gbp(v)}</td><td>{p.included ? <Pill tone="good">Included</Pill> : <Pill tone="info">Custom</Pill>}</td></tr> })}</tbody>
      </table></div></Panel>
      <Panel title="Pay-in banks and card acquirers"><div className="tbl-wrap"><table><thead><tr><th>Provider</th><th>Type</th><th>Used by</th><th>Cost</th></tr></thead><tbody>{PAYIN_BANKS.map((b) => <tr key={b.id}><td><b>{b.name}</b></td><td className="small">{b.kind}</td><td>{users((t) => t.integrations.payin.includes(b.id))}</td><td>{b.included ? <Pill tone="good">Included</Pill> : <Pill tone="info">Quoted</Pill>}</td></tr>)}</tbody></table></div></Panel>
    </>
  )
}

function Requests() {
  const db = useStore((s) => s.db)
  const [q, setQ] = useState(null)
  const [f, setF] = useState({ setup: '', monthly: '', weeks: '', note: '' })
  const rows = [...db.integrationRequests].sort((a, b) => b.createdAt - a.createdAt)
  const pill = { requested: <Pill tone="warn">Awaiting quote</Pill>, quoted: <Pill tone="info">Quoted — waiting for MSB</Pill>, accepted: <Pill tone="info">Accepted — in build</Pill>, live: <Pill tone="good">Live</Pill>, declined: <Pill tone="mute">Declined</Pill> }
  const send = () => act((d) => E.quoteIntegration(d, q.id, f, 'Zaland Shah'), 'Quote sent to the MSB') && setQ(null)
  return (
    <>
      <PageHead title="Integration requests" sub="Custom KYC, payout and banking integrations MSBs have asked for. Quote them, then mark live when built." />
      <Panel>{rows.length ? <div className="list">{rows.map((r) => { const t = db.tenants.find((x) => x.id === r.tenantId); return (
        <div className="li" key={r.id}><div className="grow"><b>{t?.name} · {r.name} <span className="tag">{r.kind}</span></b><small>{r.notes} · {fmtDate(r.createdAt, false)} · by {r.by}{r.quote ? ` · £${r.quote.setup.toLocaleString('en-GB')} setup + £${r.quote.monthly}/mo, ~${r.quote.weeks} wks` : ''}</small></div>
          <div className="row">{pill[r.status]}
            {r.status === 'requested' && <button className="btn sm pri" onClick={() => { setQ(r); setF({ setup: '', monthly: '', weeks: '', note: '' }) }}>Send quote</button>}
            {r.status === 'accepted' && <button className="btn sm good" onClick={() => act((d) => E.setIntegrationStatus(d, r.id, 'live', 'Zaland Shah'), `${r.name} is live for ${t?.name}`)}>Mark live</button>}
            {['requested', 'quoted'].includes(r.status) && <button className="btn sm ghost" onClick={() => act((d) => E.setIntegrationStatus(d, r.id, 'declined', 'Zaland Shah'), 'Declined')}>Decline</button>}
          </div></div>) })}</div> : <Empty>No requests.</Empty>}</Panel>
      {q && <Modal title={`Quote: ${q.name} for ${db.tenants.find((x) => x.id === q.tenantId)?.name}`} onClose={() => setQ(null)} footer={<><button className="btn" onClick={() => setQ(null)}>Cancel</button><button className="btn pri" onClick={send}>Send quote</button></>}>
        <div className="form"><Field label="Setup fee (£)" id="q-s"><input id="q-s" className="inp num" value={f.setup} onChange={(e) => setF({ ...f, setup: e.target.value })} /></Field><Field label="Monthly fee (£)" id="q-m"><input id="q-m" className="inp num" value={f.monthly} onChange={(e) => setF({ ...f, monthly: e.target.value })} /></Field><Field label="Build time (weeks)" id="q-w"><input id="q-w" className="inp num" value={f.weeks} onChange={(e) => setF({ ...f, weeks: e.target.value })} /></Field></div>
        <Field label="Note to the MSB" id="q-n"><textarea id="q-n" className="ta" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
      </Modal>}
    </>
  )
}

function Billing() {
  const db = useStore((s) => s.db)
  return (
    <>
      <PageHead title="Billing" sub={`What each MSB pays ${PLATFORM.owner}. Plans are defined under Platform settings.`} />
      <Panel><div className="tbl-wrap"><table><thead><tr><th>MSB</th><th>Plan</th><th className="r">Monthly fee</th><th className="r">Per paid transfer</th><th className="r">Transfers, 30d</th><th className="r">Due this month</th><th>Status</th></tr></thead>
        <tbody>{db.tenants.map((t) => { const pl = PLANS.find((x) => x.id === t.plan) || { monthly: 0, perTx: 0 }; const fee = pl.monthly, per = pl.perTx; const n = db.transactions.filter((x) => x.tenantId === t.id && x.status === 'paid' && Date.now() - x.createdAt < 30 * DAY).length; return <tr key={t.id}><td><div className="cell-t"><Logo t={t} /><b>{t.name}</b></div></td><td><select className="sel" value={t.plan} onChange={(e) => act((d) => M.setTenantPlan(d, t.id, e.target.value, 'Zaland Shah'), 'Plan changed')} aria-label={`Plan for ${t.name}`}>{PLANS.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></td><td className="r num">{gbp(fee)}</td><td className="r num">{gbp2(per)}</td><td className="r num">{n}</td><td className="r num"><b>{gbp2(fee + per * n)}</b></td><td>{t.status === 'live' ? <Pill tone="good">Active</Pill> : <Pill tone="mute">Starts at go-live</Pill>}</td></tr> })}</tbody>
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
