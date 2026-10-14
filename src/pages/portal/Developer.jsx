import { useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import { Plus, Copy } from 'lucide-react'
import { usePortal } from './PortalApp'
import { Panel, PageHead, Tabs, Modal, Field, Pill, Empty, Toggle } from '../../components/ui'
import { act, useStore } from '../../store'
import * as M from '../../lib/modules'
import { PLATFORM } from '../../lib/reference'
import { fmtDate } from '../../lib/util'

export default function Developer() {
  return (
    <>
      <PageHead title="Developer" sub="Connect your own website or systems. API keys, webhooks and the audit trail for this MSB." />
      <Tabs items={[{ to: '/portal/developer', label: 'API keys', end: true }, { to: '/portal/developer/webhooks', label: 'Webhooks' }, { to: '/portal/developer/audit', label: 'Audit log' }]} />
      <Routes><Route index element={<Keys />} /><Route path="webhooks" element={<Webhooks />} /><Route path="audit" element={<Audit />} /></Routes>
    </>
  )
}

function Keys() {
  const { t, actor, role } = usePortal()
  const [label, setLabel] = useState('')
  const [shown, setShown] = useState(null)
  const create = () => { const k = act((d) => M.createApiKey(d, t.id, label, actor)); if (k) { setShown(k); setLabel('') } }
  return (
    <div className="grid2">
      <Panel title="API keys" actions={role === 'Admin' && <div className="row"><input id="key-l" className="inp" style={{ width: 200 }} placeholder="Label, e.g. Website" value={label} onChange={(e) => setLabel(e.target.value)} /><button className="btn sm pri" onClick={create}><Plus />Create key</button></div>}>
        {shown && <div className="banner good" style={{ margin: 16 }}>Copy this key now — it is shown once. <code className="mono" style={{ wordBreak: 'break-all' }}>{shown}</code><button className="btn sm" onClick={() => navigator.clipboard?.writeText(shown).catch(() => {})}><Copy />Copy</button></div>}
        {t.apiKeys.length ? <div className="tbl-wrap"><table><thead><tr><th>Label</th><th>Key</th><th>Created</th><th>Last used</th><th>Status</th><th></th></tr></thead><tbody>{t.apiKeys.map((k) => <tr key={k.id}><td><b>{k.label}</b></td><td className="mono small">{k.prefix}</td><td className="muted">{fmtDate(k.createdAt, false)} · {k.by}</td><td className="muted">{k.lastUsed ? fmtDate(k.lastUsed) : 'never'}</td><td>{k.revoked ? <Pill tone="mute">Revoked</Pill> : <Pill tone="good">Active</Pill>}</td><td className="r">{!k.revoked && role === 'Admin' && <button className="btn sm danger" onClick={() => act((d) => M.revokeApiKey(d, t.id, k.id, actor), 'Key revoked')}>Revoke</button>}</td></tr>)}</tbody></table></div> : <Empty>No keys yet.</Empty>}
      </Panel>
      <Panel title="Using the API" pad>
        <p className="small">Base URL <code className="mono">https://api.{PLATFORM.domain}/v1</code>, header <code className="mono">Authorization: Bearer &lt;key&gt;</code>. Every call is scoped to your MSB.</p>
        <pre className="mono small" style={{ background: 'var(--surface-2)', padding: 12, borderRadius: 8, overflow: 'auto', marginTop: 10 }}>{`POST /v1/quotes        { "cur": "PKR", "sendAmount": 500 }
POST /v1/customers     { "name": "...", "email": "...", "dob": "..." }
POST /v1/recipients    { "customerId": "...", "cur": "PKR", "account": "..." }
POST /v1/transfers     { "customerId": "...", "recipientId": "...", "sendAmount": 500, "purpose": "..." }
GET  /v1/transfers/:ref
GET  /v1/rates`}</pre>
        <p className="muted small" style={{ marginTop: 8 }}>In this demo the API is documented but not served; the engine in <code className="mono">src/lib/engine.js</code> is what each endpoint will call.</p>
      </Panel>
    </div>
  )
}

function Webhooks() {
  const { t, actor, role } = usePortal()
  const [edit, setEdit] = useState(null)
  const toggle = (w) => act((d) => M.saveWebhook(d, t.id, { ...w, active: !w.active }, actor))
  return (
    <>
      <Panel title="Webhooks" actions={role === 'Admin' && <button className="btn sm pri" onClick={() => setEdit({ url: '', events: ['transfer.paid'] })}><Plus />Add endpoint</button>}>
        {t.webhooks.length ? <div className="list">{t.webhooks.map((w) => <div className="li" key={w.id}><div className="grow"><b className="mono small">{w.url}</b><small>{w.events.join(', ')} · secret <span className="mono">{w.secret.slice(0, 12)}…</span></small></div><div className="row"><Toggle on={w.active} disabled={role !== 'Admin'} onChange={() => toggle(w)} label="Active" />{role === 'Admin' && <><button className="btn sm" onClick={() => setEdit({ ...w })}>Edit</button><button className="btn sm ghost" onClick={() => act((d) => M.deleteWebhook(d, t.id, w.id, actor), 'Deleted')}>Delete</button></>}</div></div>)}</div> : <Empty>No webhooks. Add one to be told when transfers change status.</Empty>}
      </Panel>
      {edit && <Modal title={edit.id ? 'Edit webhook' : 'New webhook'} onClose={() => setEdit(null)} footer={<><button className="btn" onClick={() => setEdit(null)}>Cancel</button><button className="btn pri" onClick={() => act((d) => M.saveWebhook(d, t.id, edit, actor), 'Webhook saved') && setEdit(null)}>Save</button></>}>
        <Field label="HTTPS endpoint" id="wh-u"><input id="wh-u" className="inp mono" value={edit.url} onChange={(e) => setEdit({ ...edit, url: e.target.value })} placeholder="https://yourdomain.co.uk/hooks/coremit" /></Field>
        <Field label="Events"><div className="checks">{M.WEBHOOK_EVENTS.map((ev) => <label key={ev} className="check"><input type="checkbox" checked={edit.events.includes(ev)} onChange={(e) => setEdit({ ...edit, events: e.target.checked ? [...edit.events, ev] : edit.events.filter((x) => x !== ev) })} /><span className="mono small">{ev}</span></label>)}</div></Field>
        <p className="muted small">Payloads are signed with the endpoint's secret (HMAC-SHA256 in the <code className="mono">X-CoRemit-Signature</code> header).</p>
      </Modal>}
    </>
  )
}

function Audit() {
  const { db, t } = usePortal()
  const [q, setQ] = useState('')
  const rows = db.audit.filter((a) => a.tenantId === t.id && (!q || `${a.action} ${a.target} ${a.actor}`.toLowerCase().includes(q.toLowerCase()))).slice(0, 200)
  return (
    <>
      <div className="filters"><input id="au-q" className="inp" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} /><span className="muted small">{rows.length} entries</span></div>
      <Panel><div className="tbl-wrap"><table><thead><tr><th>When</th><th>Who</th><th>Action</th></tr></thead><tbody>{rows.map((a) => <tr key={a.id}><td className="nowrap mono small">{fmtDate(a.at)}</td><td>{a.actor}</td><td>{a.action}{a.target ? <span className="muted"> · {a.target}</span> : ''}</td></tr>)}</tbody></table></div></Panel>
    </>
  )
}
