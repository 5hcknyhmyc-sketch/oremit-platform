import { useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import { Save, Plus } from 'lucide-react'
import { usePortal } from './PortalApp'
import { Panel, PageHead, Tabs, Field, Toggle, Modal, Pill } from '../../components/ui'
import { act, useStore } from '../../store'
import * as E from '../../lib/engine'
import { MODULES, CURRENCIES, PARTNERS, KYC_PROVIDERS, PAYIN_BANKS, partnersOf } from '../../lib/reference'
import { AppPreview } from '../app/CustomerApp'
import { uid, fmtDate } from '../../lib/util'

const SWATCHES = ['#0E5E6F', '#1D5C4D', '#24409E', '#8C3B2E', '#5B2A86', '#1B2559', '#B4472A', '#2D3748']

export default function Settings() {
  return (
    <>
      <PageHead title="Settings" sub="Brand, corridors, team, domain and business details." />
      <Tabs items={[{ to: '/portal/settings', label: 'Branding', end: true }, { to: '/portal/settings/corridors', label: 'Corridors & pricing' }, { to: '/portal/settings/integrations', label: 'Integrations' }, { to: '/portal/settings/team', label: 'Staff & roles' }, { to: '/portal/settings/domain', label: 'Domain' }, { to: '/portal/settings/business', label: 'Business' }]} />
      <Routes>
        <Route index element={<Branding />} />
        <Route path="corridors" element={<Corridors />} />
        <Route path="integrations" element={<Integrations />} />
        <Route path="team" element={<Team />} />
        <Route path="domain" element={<Domain />} />
        <Route path="business" element={<Business />} />
      </Routes>
    </>
  )
}

const saveTenant = (t, actor, patch, msg, what) => act((d) => { const tt = d.tenants.find((x) => x.id === t.id); patch(tt); E.audit(d, { tenantId: t.id, actor, action: what, target: '' }) }, msg)

function Branding() {
  const { t, actor } = usePortal()
  const [b, setB] = useState({ ...t.brand })
  const [name, setName] = useState(t.name)
  const preview = { ...t, name, brand: b }
  const onFile = (e) => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => setB({ ...b, logo: r.result }); r.readAsDataURL(f) }
  return (
    <div className="grid2">
      <Panel title="Brand" actions={<button className="btn pri sm" onClick={() => saveTenant(t, actor, (tt) => { tt.brand = b; tt.name = name }, 'Brand saved — live for customers now', 'Updated branding')}><Save />Save</button>} pad>
        <div className="stack">
          <Field label="Business name" id="br-name"><input id="br-name" className="inp" value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="App name customers see" id="br-app"><input id="br-app" className="inp" value={b.appName} onChange={(e) => setB({ ...b, appName: e.target.value })} /></Field>
          <Field label="Primary colour"><div className="swatches">{SWATCHES.map((c) => <button key={c} className="sw" style={{ background: c }} aria-label={c} aria-pressed={b.color.toLowerCase() === c} onClick={() => setB({ ...b, color: c })} />)}<input type="color" id="br-color" value={b.color} onChange={(e) => setB({ ...b, color: e.target.value })} /></div></Field>
          <Field label="Accent colour"><div className="swatches">{['#F2A541', '#F0B44C', '#53C4B0', '#E8C468', '#EF6F6C', '#9AD1D4'].map((c) => <button key={c} className="sw" style={{ background: c }} aria-label={c} aria-pressed={b.accent.toLowerCase() === c.toLowerCase()} onClick={() => setB({ ...b, accent: c })} />)}<input type="color" id="br-accent" value={b.accent} onChange={(e) => setB({ ...b, accent: e.target.value })} /></div></Field>
          <Field label="Logo" id="br-logo" hint="Square PNG or SVG, at least 256px"><div className="row"><input id="br-logo" type="file" accept="image/*" onChange={onFile} />{b.logo && <button className="btn sm" onClick={() => setB({ ...b, logo: null })}>Remove</button>}</div></Field>
        </div>
      </Panel>
      <div className="stack" style={{ alignItems: 'center' }}><div className="phone"><AppPreview t={preview} /></div><span className="muted small mono">Live preview · customer app</span></div>
    </div>
  )
}

function Corridors() {
  const { t, actor } = usePortal()
  const [rows, setRows] = useState(t.corridors.map((c) => ({ ...c })))
  const upd = (i, k, v) => setRows(rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)))
  const addable = Object.keys(CURRENCIES).filter((c) => !rows.some((r) => r.cur === c))
  const save = () => saveTenant(t, actor, (tt) => { tt.corridors = rows.map((r) => ({ ...r, fee: +r.fee, margin: +r.margin, min: +r.min, max: +r.max })) }, 'Corridors saved', 'Updated corridors and pricing')
  return (
    <div className="stack">
      <Panel title="Corridors & pricing" actions={<div className="row">{addable.length > 0 && <select id="cor-add" className="sel" value="" onChange={(e) => e.target.value && setRows([...rows, { cur: e.target.value, enabled: true, fee: 2.99, margin: 1.2, min: 10, max: 10000 }])}><option value="">Add corridor…</option>{addable.map((c) => <option key={c} value={c}>GBP → {c} ({CURRENCIES[c].country})</option>)}</select>}<button className="btn pri sm" onClick={save}><Save />Save</button></div>}>
        <div className="tbl-wrap"><table>
          <thead><tr><th>On</th><th>Corridor</th><th className="r">Partner rate</th><th>Margin %</th><th>Fee £</th><th>Min £</th><th>Max £</th><th className="r">Customer rate</th></tr></thead>
          <tbody>{rows.map((r, i) => <tr key={r.cur}><td><Toggle on={r.enabled} onChange={(v) => upd(i, 'enabled', v)} label={r.cur} /></td><td className="mono">GBP → {r.cur} <span className="muted small">{CURRENCIES[r.cur].country}</span></td><td className="r num">{CURRENCIES[r.cur].rate}</td>
            {['margin', 'fee', 'min', 'max'].map((k) => <td key={k}><input className="inp num" style={{ width: 90 }} value={r[k]} onChange={(e) => upd(i, k, e.target.value)} aria-label={`${k} for ${r.cur}`} /></td>)}
            <td className="r num"><b>{(CURRENCIES[r.cur].rate * (1 - (+r.margin || 0) / 100)).toFixed(4)}</b></td></tr>)}</tbody>
        </table></div>
      </Panel>
      <p className="muted small">Payout partners are chosen under Settings → Integrations. A corridor only works when a connected partner covers its currency.</p>
    </div>
  )
}

function Integrations() {
  const { db, t, actor, role } = usePortal()
  const [req, setReq] = useState(null)
  const canEdit = role === 'Admin'
  const kyc = KYC_PROVIDERS.find((k) => k.id === t.integrations.kyc.provider)
  const myReqs = db.integrationRequests.filter((r) => r.tenantId === t.id)
  const setKyc = (id) => saveTenant(t, actor, (tt) => { tt.integrations.kyc = { provider: id, status: 'connected' }; tt.checks.kyc = true }, `KYC provider set to ${KYC_PROVIDERS.find((k) => k.id === id).name}`, `Changed KYC provider to ${id}`)
  const togglePartner = (p) => saveTenant(t, actor, (tt) => { const i = tt.partners.indexOf(p.id); if (i >= 0) tt.partners.splice(i, 1); else { tt.partners.push(p.id); tt.treasury[p.id] = tt.treasury[p.id] || 0; E.ensurePrefundAccount(db, tt, p.id) } }, null, `Toggled payout partner ${p.name}`)
  const toggleBank = (b) => saveTenant(t, actor, (tt) => { const i = tt.integrations.payin.indexOf(b.id); if (i >= 0) tt.integrations.payin.splice(i, 1); else { tt.integrations.payin.push(b.id); if (!tt.accounts.find((a) => a.id === `bank_${b.id}`)) tt.accounts.push({ id: `bank_${b.id}`, name: `${b.name} (GBP)`, type: 'bank', cur: 'GBP' }) } }, null, `Toggled pay-in bank ${b.name}`)
  const statusPill = { requested: <Pill tone="warn">Requested</Pill>, quoted: <Pill tone="info">Quote ready</Pill>, accepted: <Pill tone="info">In build</Pill>, live: <Pill tone="good">Live</Pill>, declined: <Pill tone="mute">Declined</Pill> }
  return (
    <div className="stack">
      <div className="banner">Included integrations are ready to switch on. Anything marked <b>custom</b> is scoped and quoted separately by TheFXSoft.</div>
      <div className="grid2e">
        <Panel title="Identity verification (KYC)" pad>
          <div className="stack-s">{KYC_PROVIDERS.filter((k) => k.id !== 'custom').map((k) => <label key={k.id} className="check"><input type="radio" name="kyc" disabled={!canEdit} checked={t.integrations.kyc.provider === k.id} onChange={() => setKyc(k.id)} /><span>{k.name} <Pill tone="good">Included</Pill><small>{k.desc}</small></span></label>)}
            {t.integrations.kyc.provider === 'custom' && <label className="check"><input type="radio" name="kyc" checked readOnly /><span>{t.integrations.kyc.name || 'Custom provider'} <Pill tone={t.integrations.kyc.status === 'connected' ? 'good' : 'warn'}>{t.integrations.kyc.status}</Pill><small>Custom integration</small></span></label>}
          </div>
          <button className="btn sm" style={{ marginTop: 10 }} disabled={!canEdit} onClick={() => setReq('kyc')}>Request a custom KYC integration (extra cost)</button>
        </Panel>
        <Panel title="Pay-in banks and card acquirers" pad>
          <div className="checks">{PAYIN_BANKS.filter((b) => b.id !== 'custom').map((b) => <label key={b.id} className="check"><input type="checkbox" disabled={!canEdit} checked={t.integrations.payin.includes(b.id)} onChange={() => toggleBank(b)} /><span>{b.name}<small>{b.kind} · included</small></span></label>)}</div>
          <button className="btn sm" style={{ marginTop: 10 }} disabled={!canEdit} onClick={() => setReq('payin')}>Request a custom bank integration (extra cost)</button>
        </Panel>
      </div>
      <Panel title="Payout partners" pad>
        <div className="checks">{partnersOf(db).filter((p) => !p.tenantId || p.tenantId === t.id).map((p) => <label key={p.id} className="check"><input type="checkbox" disabled={!canEdit} checked={t.partners.includes(p.id)} onChange={() => togglePartner(p)} /><span>{p.name} {p.included ? <Pill tone="good">Included</Pill> : <Pill tone="info">Custom</Pill>}<small>{p.cur.join(', ')} · {p.methods.join(', ')}</small></span></label>)}</div>
        <button className="btn sm" style={{ marginTop: 10 }} disabled={!canEdit} onClick={() => setReq('payout')}>Request a custom payout partner (extra cost)</button>
      </Panel>
      {myReqs.length > 0 && <Panel title="Integration requests"><div className="list">{myReqs.map((r) => <div className="li" key={r.id}><div className="grow"><b>{r.name} <span className="tag">{r.kind}</span></b><small>{r.notes} · requested {fmtDate(r.createdAt, false)}{r.quote ? ` · Quote: £${r.quote.setup.toLocaleString('en-GB')} setup + £${r.quote.monthly}/month, ~${r.quote.weeks} weeks${r.quote.note ? ` — ${r.quote.note}` : ''}` : ''}</small></div><div className="row">{statusPill[r.status]}{r.status === 'quoted' && canEdit && <button className="btn sm pri" onClick={() => act((d) => E.setIntegrationStatus(d, r.id, 'accepted', actor), 'Quote accepted — TheFXSoft will start the build')}>Accept quote</button>}</div></div>)}</div></Panel>}
      {req && <RequestModal kind={req} onClose={() => setReq(null)} />}
    </div>
  )
}
function RequestModal({ kind, onClose }) {
  const { t, actor } = usePortal()
  const [f, setF] = useState({ name: '', notes: '' })
  const label = { kyc: 'KYC provider', payout: 'payout partner', payin: 'bank or acquirer' }[kind]
  const ok = () => act((d) => E.requestIntegration(d, t.id, { kind, ...f, cur: t.corridors.map((c) => c.cur) }, actor), 'Request sent to TheFXSoft — you will get a quote') && onClose()
  return (
    <Modal title={`Request a custom ${label}`} onClose={onClose} footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn pri" onClick={ok}>Send request</button></>}>
      <p className="muted small">Custom integrations are scoped and quoted separately: a one-off setup fee, a monthly fee and a build time. Included integrations carry no extra cost.</p>
      <Field label={`${label[0].toUpperCase() + label.slice(1)} name`} id="rq-n"><input id="rq-n" className="inp" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
      <Field label="Why / what you need" id="rq-t"><textarea id="rq-t" className="ta" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
    </Modal>
  )
}

function Team() {
  const { t, actor, role } = usePortal()
  const [inv, setInv] = useState(false)
  const [f, setF] = useState({ name: '', email: '', role: 'Cashier' })
  const roles = Object.keys(t.roles)
  const toggle = (r, m) => saveTenant(t, actor, (tt) => { const l = tt.roles[r]; const i = l.indexOf(m); i >= 0 ? l.splice(i, 1) : l.push(m) }, null, `Changed ${r} permissions`)
  const invite = () => { if (!f.name.trim() || !f.email.trim()) return useStore.getState().notify('Name and email are required', 'err'); saveTenant(t, actor, (tt) => tt.staff.push({ id: uid('stf'), ...f }), `Invite sent to ${f.email}`, `Invited ${f.name} as ${f.role}`); setInv(false) }
  const remove = (s) => saveTenant(t, actor, (tt) => { tt.staff = tt.staff.filter((x) => x.id !== s.id) }, 'Removed', `Removed ${s.name}`)
  return (
    <div className="stack">
      <Panel title="Roles & permissions" actions={<span className="muted small">What each role can open. Admin always has everything.</span>}>
        <div className="tbl-wrap"><table className="matrix"><thead><tr><th>Role</th>{MODULES.map((m) => <th key={m.id} style={{ textAlign: 'center' }}>{m.label}</th>)}</tr></thead>
          <tbody>{roles.map((r) => <tr key={r}><td><b>{r}</b>{r === 'MLRO' && <br />}{r === 'MLRO' && <small className="muted">decides SARs & blocking releases</small>}</td>{MODULES.map((m) => <td key={m.id} style={{ textAlign: 'center' }}><Toggle on={t.roles[r].includes(m.id)} disabled={r === 'Admin' || role !== 'Admin'} onChange={() => toggle(r, m.id)} label={`${r}: ${m.label}`} /></td>)}</tr>)}</tbody>
        </table></div>
      </Panel>
      <Panel title={`Staff (${t.staff.length})`} actions={role === 'Admin' && <button className="btn sm pri" onClick={() => setInv(true)}><Plus />Invite</button>}>
        <div className="tbl-wrap"><table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>2FA</th><th></th></tr></thead>
          <tbody>{t.staff.map((s) => <tr key={s.id}><td><b>{s.name}</b></td><td className="muted">{s.email || '—'}</td><td>{s.role}</td><td><Pill tone="good">On</Pill></td><td className="r">{role === 'Admin' && s.role !== 'Admin' && <button className="btn sm ghost" onClick={() => remove(s)}>Remove</button>}</td></tr>)}</tbody>
        </table></div>
      </Panel>
      {inv && <Modal title="Invite a staff member" onClose={() => setInv(false)} footer={<><button className="btn" onClick={() => setInv(false)}>Cancel</button><button className="btn pri" onClick={invite}>Send invite</button></>}>
        <div className="form"><Field label="Name" id="in-n"><input id="in-n" className="inp" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field><Field label="Email" id="in-e"><input id="in-e" className="inp" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field><Field label="Role" id="in-r"><select id="in-r" className="sel" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>{roles.map((r) => <option key={r}>{r}</option>)}</select></Field></div>
      </Modal>}
    </div>
  )
}

function Domain() {
  const { t, actor } = usePortal()
  const [dom, setDom] = useState(t.domain)
  return (
    <Panel title="Domain" pad>
      <div className="stack">
        <Field label="Platform address"><div className="linkbox"><code>https://{t.slug}.coremit.app</code><Pill tone="good">Active</Pill></div></Field>
        <Field label="Custom domain" id="dom" hint="Add a CNAME record for this hostname pointing to tenants.coremit.app. SSL is issued automatically once DNS resolves."><div className="row"><input id="dom" className="inp" style={{ flex: 1 }} placeholder="send.yourbusiness.co.uk" value={dom} onChange={(e) => setDom(e.target.value.trim().toLowerCase())} /><button className="btn pri" onClick={() => saveTenant(t, actor, (tt) => { tt.domain = dom }, 'Domain saved', `Set custom domain ${dom}`)}>Save</button></div></Field>
        {t.domain && <div className="banner good">https://{t.domain} — SSL active (demo)</div>}
      </div>
    </Panel>
  )
}

function Business() {
  const { t, actor } = usePortal()
  const [f, setF] = useState({ legalName: t.legalName, frn: t.frn, mlr: t.mlr, email: t.email })
  return (
    <Panel title="Business details" actions={<button className="btn pri sm" onClick={() => saveTenant(t, actor, (tt) => Object.assign(tt, f), 'Saved', 'Updated business details')}><Save />Save</button>} pad>
      <div className="form">
        <Field label="Legal entity" id="bz-l"><input id="bz-l" className="inp" value={f.legalName} onChange={(e) => setF({ ...f, legalName: e.target.value })} /></Field>
        <Field label="FCA firm reference (FRN)" id="bz-f"><input id="bz-f" className="inp mono" value={f.frn} onChange={(e) => setF({ ...f, frn: e.target.value })} /></Field>
        <Field label="HMRC MLR registration" id="bz-m"><input id="bz-m" className="inp mono" value={f.mlr} onChange={(e) => setF({ ...f, mlr: e.target.value })} /></Field>
        <Field label="Admin email" id="bz-e"><input id="bz-e" className="inp" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
      </div>
      <p className="muted small" style={{ marginTop: 12 }}>Plan: <b>{t.plan}</b> · Live since {t.liveAt ? new Date(t.liveAt).toLocaleDateString('en-GB') : 'not yet'} · Set up in {t.setupSeconds ? `${Math.floor(t.setupSeconds / 60)}m ${t.setupSeconds % 60}s` : '—'}</p>
    </Panel>
  )
}
