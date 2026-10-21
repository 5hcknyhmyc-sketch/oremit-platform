import { useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import { Save, Plus, Mail, Smartphone, Monitor } from 'lucide-react'
import { usePortal } from './PortalApp'
import { Panel, PageHead, Tabs, Field, Toggle, Modal, Pill } from '../../components/ui'
import { act, useStore } from '../../store'
import * as E from '../../lib/engine'
import { MODULES, CURRENCIES, PARTNERS, KYC_PROVIDERS, PAYIN_BANKS, partnersOf, PLANS, PLATFORM } from '../../lib/reference'
import * as M from '../../lib/modules'
import { AppPreview } from '../app/CustomerApp'
import { WebPreview, AdminPreview } from '../onboard/Onboard'
import { renderEmail, EMAIL_VARS, defaultEmails } from '../../lib/emails'
import PricingTable, { DEFAULT_PRICING, PricingHint } from '../../components/PricingTable'
import { uid, fmtDate } from '../../lib/util'

const SWATCHES = ['#0E5E6F', '#1D5C4D', '#24409E', '#8C3B2E', '#5B2A86', '#1B2559', '#B4472A', '#2D3748']

export default function Settings() {
  return (
    <>
      <PageHead title="Settings" sub="Brand, corridors, team, domain and business details." />
      <Tabs items={[{ to: '/portal/settings', label: 'Branding', end: true }, { to: '/portal/settings/corridors', label: 'Corridors & pricing' }, { to: '/portal/settings/integrations', label: 'Integrations' }, { to: '/portal/settings/emails', label: 'Emails' }, { to: '/portal/settings/admin', label: 'Admin portal' }, { to: '/portal/settings/team', label: 'Staff & roles' }, { to: '/portal/settings/modules', label: 'Modules' }, { to: '/portal/settings/domain', label: 'Domain' }, { to: '/portal/settings/business', label: 'Business' }]} />
      <Routes>
        <Route index element={<Branding />} />
        <Route path="corridors" element={<Corridors />} />
        <Route path="integrations" element={<Integrations />} />
        <Route path="emails" element={<Emails />} />
        <Route path="admin" element={<AdminTheme />} />
        <Route path="team" element={<Team />} />
        <Route path="modules" element={<Modules />} />
        <Route path="domain" element={<Domain />} />
        <Route path="business" element={<Business />} />
      </Routes>
    </>
  )
}

const saveTenant = (t, actor, patch, msg, what) => act((d) => { const tt = d.tenants.find((x) => x.id === t.id); patch(tt); E.audit(d, { tenantId: t.id, actor, action: what, target: '' }) }, msg)

const FONTS = ['Inter', 'Manrope', 'DM Sans', 'Poppins', 'Nunito', 'Roboto', 'Plus Jakarta Sans', 'Lato']
function Branding() {
  const { t, actor } = usePortal()
  const [b, setB] = useState({ font: 'Inter', fontSize: 'M', radius: 14, mode: 'light', tagline: '', ...t.brand })
  const [name, setName] = useState(t.name)
  const [tab, setTab] = useState('app')
  const preview = { ...t, name, brand: b }
  const onFile = (e) => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => setB({ ...b, logo: r.result }); r.readAsDataURL(f) }
  return (
    <div className="grid2">
      <Panel title="Brand — web portal and app together" actions={<button className="btn pri sm" onClick={() => saveTenant(t, actor, (tt) => { tt.brand = b; tt.name = name }, 'Brand saved — live for customers now', 'Updated branding')}><Save />Save</button>} pad>
        <div className="stack">
          <div className="form">
            <Field label="Business name" id="br-name"><input id="br-name" className="inp" value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <Field label="App / portal name" id="br-app"><input id="br-app" className="inp" value={b.appName} onChange={(e) => setB({ ...b, appName: e.target.value })} /></Field>
            <Field label="Tagline" id="br-tag"><input id="br-tag" className="inp" value={b.tagline || ''} onChange={(e) => setB({ ...b, tagline: e.target.value })} /></Field>
          </div>
          <Field label="Primary colour"><div className="swatches">{SWATCHES.map((c) => <button key={c} className="sw" style={{ background: c }} aria-label={c} aria-pressed={b.color.toLowerCase() === c.toLowerCase()} onClick={() => setB({ ...b, color: c })} />)}<input type="color" id="br-color" value={b.color} onChange={(e) => setB({ ...b, color: e.target.value })} /></div></Field>
          <Field label="Accent colour"><div className="swatches">{['#F2A541', '#F0B44C', '#53C4B0', '#E8C468', '#EF6F6C', '#9AD1D4'].map((c) => <button key={c} className="sw" style={{ background: c }} aria-label={c} aria-pressed={b.accent.toLowerCase() === c.toLowerCase()} onClick={() => setB({ ...b, accent: c })} />)}<input type="color" id="br-accent" value={b.accent} onChange={(e) => setB({ ...b, accent: e.target.value })} /></div></Field>
          <div className="form">
            <Field label="Font" id="br-font"><select id="br-font" className="sel" value={b.font} onChange={(e) => setB({ ...b, font: e.target.value })}>{FONTS.map((f) => <option key={f}>{f}</option>)}</select></Field>
            <Field label="Text size"><div className="seg" role="radiogroup">{[['S', 'Small'], ['M', 'Medium'], ['L', 'Large']].map(([v, l]) => <button key={v} type="button" role="radio" aria-checked={b.fontSize === v} onClick={() => setB({ ...b, fontSize: v })}>{l}</button>)}</div></Field>
            <Field label={`Corner roundness · ${b.radius}px`} id="br-rad"><input id="br-rad" type="range" min="0" max="28" value={b.radius} onChange={(e) => setB({ ...b, radius: +e.target.value })} /></Field>
            <Field label="Appearance"><div className="seg" role="radiogroup">{[['light', 'Light'], ['dark', 'Dark'], ['system', 'Match device']].map(([v, l]) => <button key={v} type="button" role="radio" aria-checked={b.mode === v} onClick={() => setB({ ...b, mode: v })}>{l}</button>)}</div></Field>
          </div>
          <Field label="Logo" id="br-logo" hint="Square PNG or SVG, at least 256px"><div className="row"><input id="br-logo" type="file" accept="image/*" onChange={onFile} />{b.logo && <button className="btn sm" onClick={() => setB({ ...b, logo: null })}>Remove</button>}</div></Field>
          <div className="banner good">Changes apply to the web portal immediately and to the app on its next launch. Both always match.</div>
        </div>
      </Panel>
      <div className="stack" style={{ alignItems: 'center' }}>
        <div className="seg" role="tablist"><button type="button" role="tab" aria-selected={tab === 'app'} onClick={() => setTab('app')}><Smartphone size={14} />App</button><button type="button" role="tab" aria-selected={tab === 'web'} onClick={() => setTab('web')}><Monitor size={14} />Web portal</button></div>
        {tab === 'app' ? <div className="phone"><AppPreview t={preview} /></div> : <WebPreview t={preview} />}
        <span className="muted small mono">Live preview</span>
      </div>
    </div>
  )
}

function Emails() {
  const { t, actor } = usePortal()
  const [list, setList] = useState(() => (t.emailTemplates || defaultEmails()).map((e) => ({ ...e })))
  const [sel, setSel] = useState(list[0].id)
  const tpl = list.find((x) => x.id === sel)
  const upd = (k, v) => setList(list.map((x) => (x.id === sel ? { ...x, [k]: v } : x)))
  const r = renderEmail(tpl, { brand: t.brand.appName || t.name, support: t.email })
  return (
    <div className="grid2">
      <Panel title="Customer emails" actions={<div className="row"><button className="btn sm" onClick={() => { if (window.confirm('Restore the default wording for every email?')) setList(defaultEmails()) }}>Restore defaults</button><button className="btn pri sm" onClick={() => saveTenant(t, actor, (tt) => { tt.emailTemplates = list }, 'Emails saved', 'Updated email templates')}><Save />Save</button></div>} pad>
        <div className="emails">
          <div className="email-list">{list.map((e) => <button key={e.id} type="button" className={e.id === sel ? 'on' : ''} onClick={() => setSel(e.id)}><Mail /><span>{e.event}</span></button>)}</div>
          <div className="stack-s">
            <Field label="Subject" id="em-s"><input id="em-s" className="inp" value={tpl.subject} onChange={(e) => upd('subject', e.target.value)} /></Field>
            <Field label="Message" id="em-b"><textarea id="em-b" className="ta" rows={9} value={tpl.body} onChange={(e) => upd('body', e.target.value)} /></Field>
            <div className="row">{EMAIL_VARS.map((v) => <button key={v} type="button" className="tag" style={{ cursor: 'pointer' }} onClick={() => upd('body', tpl.body + ' ' + v)}>{v}</button>)}</div>
          </div>
        </div>
      </Panel>
      <div className="stack" style={{ alignItems: 'center' }}>
        <div className="email-prev" style={{ '--brand': t.brand.color, '--brand-ink': '#fff', '--accent': t.brand.accent, '--accent-ink': '#111' }}>
          <div className="ep-head"><div className="lg">{t.brand.logo ? <img src={t.brand.logo} alt="" /> : (t.brand.appName || t.name).slice(0, 2).toUpperCase()}</div><b>{t.brand.appName || t.name}</b></div>
          <div className="ep-body"><b>{r.subject}</b><p>{r.body}</p></div>
          <div className="ep-foot">{t.brand.appName || t.name} · Made by TheFXSoft Limited</div>
        </div>
        <span className="muted small mono">Preview with sample values</span>
      </div>
    </div>
  )
}

function AdminTheme() {
  const { t, actor } = usePortal()
  const [a, setA] = useState({ sidebar: 'light', accent: '', showLogo: true, ...(t.adminTheme || {}), accent: t.adminTheme?.accent || '' })
  const preview = { ...t, adminTheme: { ...a, accent: a.accent || null } }
  return (
    <div className="grid2">
      <Panel title="Admin portal look" actions={<button className="btn pri sm" onClick={() => saveTenant(t, actor, (tt) => { tt.adminTheme = { ...a, accent: a.accent || null } }, 'Admin portal updated', 'Updated admin theme')}><Save />Save</button>} pad>
        <div className="stack">
          <Field label="Sidebar style"><div className="seg" role="radiogroup">{[['light', 'Light'], ['brand', 'Brand colour'], ['dark', 'Dark']].map(([v, l]) => <button key={v} type="button" role="radio" aria-checked={a.sidebar === v} onClick={() => setA({ ...a, sidebar: v })}>{l}</button>)}</div></Field>
          <Field label="Accent colour" hint="Buttons, active menu and charts in the back office. Leave blank to use your primary colour."><div className="swatches">{['', ...SWATCHES].map((c) => <button key={c || 'auto'} className="sw" style={{ background: c || t.brand.color, outline: c ? 'none' : '2px dashed var(--muted)' }} aria-label={c || 'Same as primary'} aria-pressed={a.accent === c} onClick={() => setA({ ...a, accent: c })} />)}</div></Field>
          <label className="check"><input type="checkbox" checked={a.showLogo !== false} onChange={(e) => setA({ ...a, showLogo: e.target.checked })} /><span>Show my logo in the sidebar</span></label>
        </div>
      </Panel>
      <div className="stack" style={{ alignItems: 'center' }}><AdminPreview t={preview} /><span className="muted small mono">Live preview · saved changes apply on next page load</span></div>
    </div>
  )
}

function Corridors() {
  const { t, actor } = usePortal()
  const [rows, setRows] = useState(t.corridors.map((c) => ({ ...DEFAULT_PRICING, ...c })))
  const addable = Object.keys(CURRENCIES).filter((c) => !rows.some((r) => r.cur === c))
  const save = () => saveTenant(t, actor, (tt) => { tt.corridors = rows.map((r) => ({ ...r, fee: +r.fee || 0, feePct: +r.feePct || 0, threshold: +r.threshold || 0, aboveFee: +r.aboveFee || 0, aboveFeePct: +r.aboveFeePct || 0, margin: +r.margin || 0, min: +r.min || 0, max: +r.max || 0 })) }, 'Pricing saved — live for customers now', 'Updated corridors and pricing')
  return (
    <div className="stack">
      <Panel title="Corridors & pricing" actions={<div className="row">{addable.length > 0 && <select id="cor-add" className="sel" value="" onChange={(e) => e.target.value && setRows([...rows, { cur: e.target.value, enabled: true, ...DEFAULT_PRICING, min: 10, max: 10000 }])}><option value="">Add corridor…</option>{addable.map((c) => <option key={c} value={c}>GBP → {c} ({CURRENCIES[c].country})</option>)}</select>}<button className="btn pri sm" onClick={save}><Save />Save</button></div>}>
        <PricingTable rows={rows} onChange={setRows} extra={(r, i) => <Toggle on={r.enabled} onChange={(v) => setRows(rows.map((x, j) => (j === i ? { ...x, enabled: v } : x)))} label={r.cur} />} />
        <div className="panel-b" style={{ paddingTop: 0 }}><PricingHint /></div>
      </Panel>
      <Panel title="Limits per corridor" pad>
        <div className="tbl-wrap"><table><thead><tr><th>Corridor</th><th>Min £</th><th>Max £</th><th className="r">Customer rate</th></tr></thead>
          <tbody>{rows.map((r, i) => <tr key={r.cur}><td className="mono">GBP → {r.cur}</td>{['min', 'max'].map((k) => <td key={k}><input className="inp num" style={{ width: 90 }} value={r[k]} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, [k]: e.target.value } : x)))} aria-label={`${k} for ${r.cur}`} /></td>)}<td className="r num"><b>{(CURRENCIES[r.cur].rate * (1 - (+r.margin || 0) / 100)).toFixed(4)}</b></td></tr>)}</tbody></table></div>
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
  const [edit, setEdit] = useState(null) // { name, modules, rename }
  const [f, setF] = useState({ name: '', email: '', role: 'Cashier' })
  const roles = Object.keys(t.roles)
  const mods = MODULES.filter((m) => t.modules.includes(m.id))
  const invite = () => { if (!f.name.trim() || !f.email.trim()) return useStore.getState().notify('Name and email are required', 'err'); saveTenant(t, actor, (tt) => tt.staff.push({ id: uid('stf'), ...f }), `Invite sent to ${f.email}`, `Invited ${f.name} as ${f.role}`); setInv(false) }
  const remove = (s) => saveTenant(t, actor, (tt) => { tt.staff = tt.staff.filter((x) => x.id !== s.id) }, 'Removed', `Removed ${s.name}`)
  const changeRole = (s, r) => saveTenant(t, actor, (tt) => { tt.staff.find((x) => x.id === s.id).role = r }, 'Role updated', `Changed ${s.name} to ${r}`)
  const saveRole = () => act((d) => M.saveRole(d, t.id, edit.name, edit.modules, actor, edit.rename), 'Role saved') && setEdit(null)
  return (
    <div className="stack">
      <Panel title="Roles & permissions" actions={role === 'Admin' && <button className="btn sm pri" onClick={() => setEdit({ name: '', modules: ['dashboard', 'transactions'], rename: null })}><Plus />New role</button>}>
        <div className="tbl-wrap"><table><thead><tr><th>Role</th>{mods.map((m) => <th key={m.id} style={{ textAlign: 'center' }}>{m.label}</th>)}<th></th></tr></thead>
          <tbody>{roles.map((r) => <tr key={r}><td><b>{r}</b>{['MLRO', 'Admin'].includes(r) && <><br /><small className="muted">{r === 'Admin' ? 'everything, always' : 'decides SARs & blocking releases'}</small></>}</td>{mods.map((m) => <td key={m.id} style={{ textAlign: 'center' }}>{M.roleModules(t, r).includes(m.id) ? <Pill tone="good">on</Pill> : <span className="muted">—</span>}</td>)}<td className="r">{role === 'Admin' && r !== 'Admin' && <div className="row" style={{ justifyContent: 'flex-end' }}><button className="btn sm" onClick={() => setEdit({ name: r, modules: [...t.roles[r]], rename: r })}>Edit</button><button className="btn sm ghost" onClick={() => act((d) => M.deleteRole(d, t.id, r, actor), 'Role deleted')}>Delete</button></div>}</td></tr>)}</tbody>
        </table></div>
      </Panel>
      <Panel title={`Staff (${t.staff.length})`} actions={role === 'Admin' && <button className="btn sm pri" onClick={() => setInv(true)}><Plus />Invite</button>}>
        <div className="tbl-wrap"><table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>2FA</th><th></th></tr></thead>
          <tbody>{t.staff.map((s) => <tr key={s.id}><td><b>{s.name}</b>{s.agentId && <span className="tag" style={{ marginLeft: 6 }}>agent</span>}</td><td className="muted">{s.email || '—'}</td><td>{role === 'Admin' && s.role !== 'Admin' ? <select className="sel" value={s.role} onChange={(e) => changeRole(s, e.target.value)} aria-label={`Role for ${s.name}`}>{roles.map((r) => <option key={r}>{r}</option>)}</select> : s.role}</td><td><Pill tone="good">On</Pill></td><td className="r">{role === 'Admin' && s.role !== 'Admin' && <button className="btn sm ghost" onClick={() => remove(s)}>Remove</button>}</td></tr>)}</tbody>
        </table></div>
      </Panel>
      {inv && <Modal title="Invite a staff member" onClose={() => setInv(false)} footer={<><button className="btn" onClick={() => setInv(false)}>Cancel</button><button className="btn pri" onClick={invite}>Send invite</button></>}>
        <div className="form"><Field label="Name" id="in-n"><input id="in-n" className="inp" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field><Field label="Email" id="in-e"><input id="in-e" className="inp" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field><Field label="Role" id="in-r"><select id="in-r" className="sel" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>{roles.map((r) => <option key={r}>{r}</option>)}</select></Field></div>
      </Modal>}
      {edit && <Modal title={edit.rename ? `Edit role: ${edit.rename}` : 'New role'} onClose={() => setEdit(null)} footer={<><button className="btn" onClick={() => setEdit(null)}>Cancel</button><button className="btn pri" onClick={saveRole}><Save />Save role</button></>}>
        <Field label="Role name" id="rl-n"><input id="rl-n" className="inp" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
        <Field label="Can open"><div className="checks">{mods.map((m) => <label key={m.id} className="check"><input type="checkbox" checked={edit.modules.includes(m.id)} onChange={(e) => setEdit({ ...edit, modules: e.target.checked ? [...edit.modules, m.id] : edit.modules.filter((x) => x !== m.id) })} /><span>{m.label}</span></label>)}</div></Field>
      </Modal>}
    </div>
  )
}

function Modules() {
  const { t, actor, role } = usePortal()
  const plan = PLANS.find((p) => p.id === t.plan)
  const toggle = (m) => act((d) => M.setTenantModules(d, t.id, t.modules.includes(m.id) ? t.modules.filter((x) => x !== m.id) : [...t.modules, m.id], actor), null)
  return (
    <Panel title="Modules" actions={<span className="muted small">Plan: <b>{t.plan}</b></span>}>
      <div className="list">{MODULES.map((m) => { const inPlan = plan?.modules.includes(m.id); const on = t.modules.includes(m.id); return (
        <div className="li" key={m.id}><div className="grow"><b>{m.label}{m.core && <span className="tag" style={{ marginLeft: 6 }}>core</span>}</b><small>{m.desc || 'Always on'}{!inPlan && !m.core ? ' · not in your plan — ask TheFXSoft to upgrade' : ''}</small></div>
          <Toggle on={on} disabled={m.core || !inPlan || role !== 'Admin'} onChange={() => toggle(m)} label={m.label} /></div>) })}</div>
    </Panel>
  )
}

function Domain() {
  const { t, actor } = usePortal()
  const [dom, setDom] = useState(t.domain)
  return (
    <Panel title="Domain" pad>
      <div className="stack">
        <Field label="Platform address"><div className="linkbox"><code>https://{t.slug}.{PLATFORM.domain}</code><Pill tone="good">Active</Pill></div></Field>
        <Field label="Custom domain" id="dom" hint="Add a CNAME record for this hostname pointing to tenants.{PLATFORM.domain}. SSL is issued automatically once DNS resolves."><div className="row"><input id="dom" className="inp" style={{ flex: 1 }} placeholder="send.yourbusiness.co.uk" value={dom} onChange={(e) => setDom(e.target.value.trim().toLowerCase())} /><button className="btn pri" onClick={() => saveTenant(t, actor, (tt) => { tt.domain = dom }, 'Domain saved', `Set custom domain ${dom}`)}>Save</button></div></Field>
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
