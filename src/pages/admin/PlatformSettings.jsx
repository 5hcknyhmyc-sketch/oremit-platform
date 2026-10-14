import { useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import { Plus, Save } from 'lucide-react'
import { useStore, act } from '../../store'
import { Panel, PageHead, Tabs, Modal, Field, Pill, Toggle, Empty } from '../../components/ui'
import * as M from '../../lib/modules'
import { fmtDate, gbp, gbp2, num } from '../../lib/util'

const ACTOR = 'Zaland Shah'

export default function PlatformSettings() {
  return (
    <>
      <PageHead title="Platform settings" sub="Everything the software offers to MSBs is defined here. Changes apply to every MSB immediately." />
      <Tabs items={[{ to: '/admin/platform', label: 'Currencies & rates', end: true }, { to: '/admin/platform/integrations', label: 'Integrations' }, { to: '/admin/platform/plans', label: 'Plans & modules' }, { to: '/admin/platform/lists', label: 'Lists' }, { to: '/admin/platform/brand', label: 'Platform' }]} />
      <Routes>
        <Route index element={<Currencies />} />
        <Route path="integrations" element={<Integrations />} />
        <Route path="plans" element={<Plans />} />
        <Route path="lists" element={<Lists />} />
        <Route path="brand" element={<Brand />} />
      </Routes>
    </>
  )
}

function Currencies() {
  const p = useStore((s) => s.db.platform)
  const db = useStore((s) => s.db)
  const [edit, setEdit] = useState(null)
  const codes = Object.keys(p.currencies).sort()
  const used = (c) => db.tenants.filter((t) => t.corridors.some((x) => x.cur === c)).length
  const save = () => act((d) => M.setCurrency(d, edit.code, { ...edit, rate: +edit.rate }, ACTOR), 'Saved') && setEdit(null)
  return (
    <div className="stack">
      <Panel title={`Currencies (${codes.length})`} actions={<button className="btn sm pri" onClick={() => setEdit({ code: '', country: '', rate: '', enabled: true, cash: false, source: 'Manual' })}><Plus />Add currency</button>}>
        <div className="tbl-wrap"><table><thead><tr><th>Code</th><th>Country</th><th className="r">Rate (per £1)</th><th>Cash</th><th>Enabled</th><th className="r">MSBs</th><th></th></tr></thead>
          <tbody>{codes.map((c) => { const v = p.currencies[c]; return <tr key={c} style={{ opacity: v.enabled === false ? 0.55 : 1 }}><td><b className="mono">{c}</b></td><td className="nowrap">{v.country}</td><td className="r num">{v.rate}</td><td>{v.cash ? <Pill tone="info">cash</Pill> : <span className="muted">—</span>}</td><td><Toggle on={v.enabled !== false} onChange={(on) => act((d) => M.setCurrency(d, c, { ...v, enabled: on }, ACTOR))} label={`Enable ${c}`} /></td><td className="r num">{used(c)}</td><td className="r nowrap"><div className="row" style={{ justifyContent: 'flex-end', flexWrap: 'nowrap' }}><button className="btn sm" onClick={() => setEdit({ code: c, ...v, source: 'Manual' })}>Edit / rate</button>{!used(c) && <button className="btn sm ghost" onClick={() => act((d) => M.removeCurrency(d, c, ACTOR), 'Removed')}>Remove</button>}</div></td></tr> })}</tbody>
        </table></div>
        <div className="panel-b muted small">Rates here are the platform mid rates. Each MSB adds its own margin per corridor; the bureau module adds its spread. In production, plug a rate feed in and keep the manual override.</div>
      </Panel>
      <Panel title="Rate history">{p.rateHistory?.length ? <div className="tbl-wrap"><table><thead><tr><th>When</th><th>Code</th><th className="r">Rate</th><th className="r">Previous</th><th>Source</th><th>By</th></tr></thead><tbody>{p.rateHistory.slice(0, 40).map((r) => <tr key={r.id}><td className="nowrap muted">{fmtDate(r.at)}</td><td className="mono">{r.code}</td><td className="r num">{r.rate}</td><td className="r num muted">{r.prev ?? '—'}</td><td>{r.source}</td><td className="muted">{r.by}</td></tr>)}</tbody></table></div> : <Empty>No rate changes yet.</Empty>}</Panel>
      {edit && <Modal title={edit.code && p.currencies[edit.code] ? `Edit ${edit.code}` : 'Add currency'} onClose={() => setEdit(null)} footer={<><button className="btn" onClick={() => setEdit(null)}>Cancel</button><button className="btn pri" onClick={save}><Save />Save</button></>}>
        <div className="form">
          <Field label="ISO code" id="cu-c"><input id="cu-c" className="inp mono" value={edit.code} disabled={!!p.currencies[edit.code]} onChange={(e) => setEdit({ ...edit, code: e.target.value.toUpperCase() })} /></Field>
          <Field label="Country / zone" id="cu-n"><input id="cu-n" className="inp" value={edit.country} onChange={(e) => setEdit({ ...edit, country: e.target.value })} /></Field>
          <Field label="Mid rate (units per £1)" id="cu-r"><input id="cu-r" className="inp num" value={edit.rate} onChange={(e) => setEdit({ ...edit, rate: e.target.value })} /></Field>
          <Field label="Rate source" id="cu-s"><input id="cu-s" className="inp" value={edit.source} onChange={(e) => setEdit({ ...edit, source: e.target.value })} /></Field>
        </div>
        <label className="check"><input type="checkbox" checked={!!edit.cash} onChange={(e) => setEdit({ ...edit, cash: e.target.checked })} /><span>Available as cash for bureau de change</span></label>
      </Modal>}
    </div>
  )
}

function Integrations() {
  const p = useStore((s) => s.db.platform)
  const [edit, setEdit] = useState(null) // { list, item }
  const curs = Object.keys(p.currencies)
  const save = () => act((d) => M.upsertCatalog(d, edit.list, edit.item, ACTOR), 'Saved') && setEdit(null)
  const Row = ({ list, x, extra }) => <tr key={x.id}><td><b>{x.name}</b><br /><small className="muted">{x.desc || x.kind || ''}</small></td>{extra}<td>{x.included ? <Pill tone="good">Included</Pill> : <Pill tone="info">Quoted</Pill>}</td><td className="r"><div className="row" style={{ justifyContent: 'flex-end' }}><button className="btn sm" onClick={() => setEdit({ list, item: { ...x } })}>Edit</button><button className="btn sm ghost" onClick={() => act((d) => M.removeCatalog(d, list, x.id, ACTOR), 'Removed')}>Remove</button></div></td></tr>
  return (
    <div className="stack">
      <Panel title="Payout partners" actions={<button className="btn sm pri" onClick={() => setEdit({ list: 'partners', item: { name: '', cur: [], methods: ['Bank'], included: true, desc: '', status: 'live' } })}><Plus />Add partner</button>}>
        <div className="tbl-wrap"><table><thead><tr><th>Partner</th><th>Currencies</th><th>Methods</th><th>Cost</th><th></th></tr></thead><tbody>{p.partners.map((x) => <Row key={x.id} list="partners" x={x} extra={<><td className="mono small">{x.cur.join(', ')}</td><td className="small">{x.methods.join(', ')}</td></>} />)}</tbody></table></div>
      </Panel>
      <div className="grid2e">
        <Panel title="KYC providers" actions={<button className="btn sm pri" onClick={() => setEdit({ list: 'kycProviders', item: { name: '', desc: '', included: true } })}><Plus />Add</button>}><div className="tbl-wrap"><table><thead><tr><th>Provider</th><th>Cost</th><th></th></tr></thead><tbody>{p.kycProviders.map((x) => <Row key={x.id} list="kycProviders" x={x} />)}</tbody></table></div></Panel>
        <Panel title="Pay-in banks & acquirers" actions={<button className="btn sm pri" onClick={() => setEdit({ list: 'payinBanks', item: { name: '', kind: '', included: true } })}><Plus />Add</button>}><div className="tbl-wrap"><table><thead><tr><th>Provider</th><th>Cost</th><th></th></tr></thead><tbody>{p.payinBanks.map((x) => <Row key={x.id} list="payinBanks" x={x} />)}</tbody></table></div></Panel>
      </div>
      {edit && <Modal title={edit.item.id ? `Edit ${edit.item.name}` : 'Add'} onClose={() => setEdit(null)} footer={<><button className="btn" onClick={() => setEdit(null)}>Cancel</button><button className="btn pri" onClick={save}><Save />Save</button></>}>
        <div className="form">
          <Field label="Name" id="it-n"><input id="it-n" className="inp" value={edit.item.name} onChange={(e) => setEdit({ ...edit, item: { ...edit.item, name: e.target.value } })} /></Field>
          <Field label={edit.list === 'payinBanks' ? 'Type' : 'Description'} id="it-d"><input id="it-d" className="inp" value={edit.item.desc ?? edit.item.kind ?? ''} onChange={(e) => setEdit({ ...edit, item: { ...edit.item, [edit.list === 'payinBanks' ? 'kind' : 'desc']: e.target.value } })} /></Field>
          {edit.list === 'partners' && <><Field label="Methods (comma separated)" id="it-m"><input id="it-m" className="inp" value={edit.item.methods.join(', ')} onChange={(e) => setEdit({ ...edit, item: { ...edit.item, methods: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) } })} /></Field></>}
        </div>
        {edit.list === 'partners' && <Field label="Currencies"><div className="checks">{curs.map((c) => <label key={c} className="check"><input type="checkbox" checked={edit.item.cur.includes(c)} onChange={(e) => setEdit({ ...edit, item: { ...edit.item, cur: e.target.checked ? [...edit.item.cur, c] : edit.item.cur.filter((x) => x !== c) } })} /><span>{c}</span></label>)}</div></Field>}
        <label className="check"><input type="checkbox" checked={!!edit.item.included} onChange={(e) => setEdit({ ...edit, item: { ...edit.item, included: e.target.checked } })} /><span>Included in plans (no extra cost)<small>Untick for integrations you quote separately</small></span></label>
      </Modal>}
    </div>
  )
}

function Plans() {
  const p = useStore((s) => s.db.platform)
  const db = useStore((s) => s.db)
  const [edit, setEdit] = useState(null)
  const save = () => act((d) => M.upsertCatalog(d, 'plans', { ...edit, monthly: +edit.monthly, perTx: +edit.perTx }, ACTOR), 'Plan saved') && setEdit(null)
  return (
    <div className="stack">
      <Panel title="Plans" actions={<button className="btn sm pri" onClick={() => setEdit({ name: '', monthly: 0, perTx: 0, modules: p.modules.filter((m) => m.core).map((m) => m.id) })}><Plus />Add plan</button>}>
        <div className="tbl-wrap"><table><thead><tr><th>Plan</th><th className="r">Monthly</th><th className="r">Per paid transfer</th><th>Modules</th><th className="r">MSBs</th><th></th></tr></thead>
          <tbody>{p.plans.map((pl) => <tr key={pl.id}><td><b>{pl.name}</b></td><td className="r num">{gbp(pl.monthly)}</td><td className="r num">{gbp2(pl.perTx)}</td><td className="small">{pl.modules.filter((m) => !p.modules.find((x) => x.id === m)?.core).map((m) => p.modules.find((x) => x.id === m)?.label || m).join(', ') || 'core only'}</td><td className="r num">{db.tenants.filter((t) => t.plan === pl.id).length}</td><td className="r"><div className="row" style={{ justifyContent: 'flex-end' }}><button className="btn sm" onClick={() => setEdit({ ...pl })}>Edit</button><button className="btn sm ghost" onClick={() => act((d) => M.removeCatalog(d, 'plans', pl.id, ACTOR), 'Removed')}>Remove</button></div></td></tr>)}</tbody>
        </table></div>
      </Panel>
      <Panel title="Modules in the software"><div className="list">{p.modules.map((m) => <div className="li" key={m.id}><div className="grow"><b>{m.label}{m.core && <span className="tag" style={{ marginLeft: 6 }}>core</span>}</b><small>{m.desc || 'Always on for every MSB'}</small></div><span className="muted small">{db.tenants.filter((t) => t.modules?.includes(m.id)).length} MSBs</span></div>)}</div></Panel>
      {edit && <Modal title={edit.id ? `Edit plan ${edit.name}` : 'New plan'} onClose={() => setEdit(null)} footer={<><button className="btn" onClick={() => setEdit(null)}>Cancel</button><button className="btn pri" onClick={save}><Save />Save</button></>}>
        <div className="form"><Field label="Name" id="pl-n"><input id="pl-n" className="inp" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field><Field label="Monthly fee (£)" id="pl-m"><input id="pl-m" className="inp num" value={edit.monthly} onChange={(e) => setEdit({ ...edit, monthly: e.target.value })} /></Field><Field label="Per paid transfer (£)" id="pl-t"><input id="pl-t" className="inp num" value={edit.perTx} onChange={(e) => setEdit({ ...edit, perTx: e.target.value })} /></Field></div>
        <Field label="Modules included"><div className="checks">{p.modules.map((m) => <label key={m.id} className="check"><input type="checkbox" disabled={m.core} checked={m.core || edit.modules.includes(m.id)} onChange={(e) => setEdit({ ...edit, modules: e.target.checked ? [...edit.modules, m.id] : edit.modules.filter((x) => x !== m.id) })} /><span>{m.label}</span></label>)}</div></Field>
      </Modal>}
    </div>
  )
}

function Lists() {
  const p = useStore((s) => s.db.platform)
  const keys = [['purposes', 'Purposes of transfer'], ['sourcesOfFunds', 'Sources of funds'], ['docTypes', 'Document types'], ['idDocTypes', 'Document types that count as photo ID'], ['occupations', 'Occupations'], ['relationships', 'Recipient relationships'], ['payoutMethods', 'Payout methods'], ['channels', 'Channels']]
  const [vals, setVals] = useState(Object.fromEntries(keys.map(([k]) => [k, (p.lists[k] || []).join('\n')])))
  return (
    <div className="grid2e">{keys.map(([k, l]) => <Panel key={k} title={l} actions={<button className="btn sm pri" onClick={() => act((d) => M.setList(d, k, vals[k].split('\n'), ACTOR), 'List saved')}><Save />Save</button>} pad>
      <textarea id={`ls-${k}`} className="ta" style={{ minHeight: 140 }} value={vals[k]} onChange={(e) => setVals({ ...vals, [k]: e.target.value })} /><span className="hint">One per line. Used in every MSB's portal and app.</span></Panel>)}</div>
  )
}

function Brand() {
  const p = useStore((s) => s.db.platform)
  const [f, setF] = useState({ name: p.name, owner: p.owner, domain: p.domain, supportEmail: p.supportEmail, rateSource: p.rateSource })
  return (
    <Panel title="Platform identity" actions={<button className="btn sm pri" onClick={() => act((d) => M.updatePlatform(d, f, ACTOR), 'Saved')}><Save />Save</button>} pad>
      <div className="form">
        <Field label="Platform name" id="pf-n" hint="Shown in the top bar and emails"><input id="pf-n" className="inp" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Owner company" id="pf-o"><input id="pf-o" className="inp" value={f.owner} onChange={(e) => setF({ ...f, owner: e.target.value })} /></Field>
        <Field label="Platform domain" id="pf-d" hint="MSBs get <slug>.<domain>; onboard.<domain>, admin.<domain>, api.<domain>"><input id="pf-d" className="inp mono" value={f.domain} onChange={(e) => setF({ ...f, domain: e.target.value })} /></Field>
        <Field label="Support email" id="pf-e"><input id="pf-e" className="inp" value={f.supportEmail} onChange={(e) => setF({ ...f, supportEmail: e.target.value })} /></Field>
        <Field label="Rate source label" id="pf-r"><input id="pf-r" className="inp" value={f.rateSource} onChange={(e) => setF({ ...f, rateSource: e.target.value })} /></Field>
      </div>
    </Panel>
  )
}
