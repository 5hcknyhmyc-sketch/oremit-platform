import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Upload } from 'lucide-react'
import { usePortal } from './PortalApp'
import { Panel, PageHead, Modal, Field, Pill, Kpi, Empty, KycPill, RiskPill } from '../../components/ui'
import { NewCustomer } from './Customers'
import { act, useStore } from '../../store'
import * as E from '../../lib/engine'
import * as M from '../../lib/modules'
import { riskLevel } from '../../lib/rules'
import { gbp, gbp2, DAY } from '../../lib/util'

export default function Corporate() {
  const { db, t, actor, role } = usePortal()
  const nav = useNavigate()
  const [add, setAdd] = useState(false)
  const [edit, setEdit] = useState(null)
  const [bulk, setBulk] = useState(null)
  const corp = db.customers.filter((c) => c.tenantId === t.id && c.type === 'business')
  const month = (c) => db.transactions.filter((x) => x.customerId === c.id && new Date(x.createdAt).getMonth() === new Date().getMonth() && !['cancelled', 'rejected', 'refunded'].includes(x.status)).reduce((s, x) => s + x.sendAmount, 0)
  return (
    <>
      <PageHead title="Corporate clients" sub="Business senders with contract limits, beneficial owners and bulk payments.">
        <button className="btn" onClick={() => setBulk({ customerId: corp[0]?.id, text: '' })}><Upload />Bulk payment file</button>
        <button className="btn pri" onClick={() => setAdd(true)}><Plus />Add corporate client</button>
      </PageHead>
      <div className="kpis">
        <Kpi label="Corporate clients" value={corp.length} />
        <Kpi label="Sent this month" value={gbp(corp.reduce((s, c) => s + month(c), 0))} />
        <Kpi label="Contract headroom" value={gbp(corp.reduce((s, c) => s + Math.max(0, (c.company?.monthlyLimit || 0) - month(c)), 0))} tone="info" />
      </div>
      <Panel>
        {corp.length ? <div className="tbl-wrap"><table><thead><tr><th>Company</th><th>Reg. no.</th><th>Sector</th><th>KYB</th><th>Risk</th><th className="r">This month</th><th className="r">Monthly limit</th><th>Used</th><th></th></tr></thead>
          <tbody>{corp.map((c) => { const used = c.company?.monthlyLimit ? month(c) / c.company.monthlyLimit : 0; return (
            <tr key={c.id} className="click" onClick={() => nav(`/portal/customers/${c.id}`)}><td><b>{c.name}</b><br /><small className="muted">{c.company?.contact}</small></td><td className="mono">{c.company?.regNo || '—'}</td><td>{c.company?.sector || '—'}</td><td><KycPill s={c.kyc.status} /></td><td><RiskPill level={riskLevel(c)} /></td><td className="r num">{gbp(month(c))}</td><td className="r num">{gbp(c.company?.monthlyLimit || 0)}</td>
              <td><div className="hbar" style={{ gridTemplateColumns: 'minmax(60px,1fr) 44px', padding: 0 }}><div className="track"><div className="fill" style={{ width: `${Math.min(100, used * 100)}%`, background: used > 0.9 ? 'var(--crit)' : used > 0.7 ? 'var(--warn)' : 'var(--brand)' }} /></div><span className="num small">{Math.round(used * 100)}%</span></div></td>
              <td className="r" onClick={(e) => e.stopPropagation()}>{['Admin', 'MLRO', 'Compliance officer'].includes(role) && <button className="btn sm" onClick={() => setEdit({ id: c.id, name: c.name, ...(c.company || {}) })}>Contract</button>}</td></tr>) })}</tbody></table></div> : <Empty>No corporate clients yet.</Empty>}
      </Panel>
      {add && <NewCustomer onClose={() => setAdd(false)} onCreated={(c) => setEdit({ id: c.id, name: c.name, regNo: '', contact: c.email, monthlyLimit: 25000, sector: '', ubos: '' })} />}
      {edit && <Modal title={`Contract: ${edit.name}`} onClose={() => setEdit(null)} footer={<><button className="btn" onClick={() => setEdit(null)}>Cancel</button><button className="btn pri" onClick={() => act((d) => M.setCompany(d, edit.id, edit, actor), 'Corporate profile saved') && setEdit(null)}>Save</button></>}>
        <div className="form">
          <Field label="Companies House number" id="co-r"><input id="co-r" className="inp mono" value={edit.regNo || ''} onChange={(e) => setEdit({ ...edit, regNo: e.target.value })} /></Field>
          <Field label="Sector" id="co-s"><input id="co-s" className="inp" value={edit.sector || ''} onChange={(e) => setEdit({ ...edit, sector: e.target.value })} /></Field>
          <Field label="Monthly contract limit (£)" id="co-l"><input id="co-l" className="inp num" value={edit.monthlyLimit || ''} onChange={(e) => setEdit({ ...edit, monthlyLimit: e.target.value })} /></Field>
          <Field label="Main contact" id="co-c"><input id="co-c" className="inp" value={edit.contact || ''} onChange={(e) => setEdit({ ...edit, contact: e.target.value })} /></Field>
        </div>
        <Field label="Beneficial owners (25%+)" id="co-u" hint="Names and % holding. Each should be screened like a customer."><textarea id="co-u" className="ta" value={edit.ubos || ''} onChange={(e) => setEdit({ ...edit, ubos: e.target.value })} /></Field>
      </Modal>}
      {bulk && <BulkModal corp={corp} state={bulk} setState={setBulk} onClose={() => setBulk(null)} />}
    </>
  )
}

function BulkModal({ corp, state, setState, onClose }) {
  const { db, t, actor } = usePortal()
  const c = corp.find((x) => x.id === state.customerId)
  const recs = db.recipients.filter((r) => r.customerId === state.customerId)
  const rows = state.text.split('\n').map((l) => l.split(',').map((x) => x.trim())).filter((r) => r.length >= 2 && r[0])
  const parsed = rows.map(([name, amount, purpose]) => { const r = recs.find((x) => x.name.toLowerCase() === name.toLowerCase()); return { name, amount: +amount, purpose: purpose || 'Business payment', rec: r, ok: !!r && +amount > 0 } })
  const run = () => {
    let n = 0
    act((d) => { for (const p of parsed.filter((x) => x.ok)) { E.createTransaction(d, { tenantId: t.id, customerId: c.id, recipientId: p.rec.id, sendAmount: p.amount, purpose: p.purpose, sof: 'Business income', channel: 'Web', fraudConfirm: true }, actor); n++ } }, () => `${n} transfers created — awaiting funds`)
    onClose()
  }
  return (
    <Modal title="Bulk payment file" onClose={onClose} wide footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn pri" disabled={!parsed.some((p) => p.ok)} onClick={run}>Create {parsed.filter((p) => p.ok).length} transfers</button></>}>
      <Field label="Corporate client" id="bk-c"><select id="bk-c" className="sel" value={state.customerId} onChange={(e) => setState({ ...state, customerId: e.target.value })}>{corp.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
      <Field label="Rows: recipient name, amount GBP, purpose" id="bk-t" hint={`Recipient names must match saved recipients: ${recs.map((r) => r.name).join(', ') || 'none saved'}`}><textarea id="bk-t" className="ta mono" placeholder={`${recs[0]?.name || 'Recipient name'}, 1500, Supplier invoice 1042`} value={state.text} onChange={(e) => setState({ ...state, text: e.target.value })} /></Field>
      {parsed.length > 0 && <div className="tbl-wrap"><table><thead><tr><th>Recipient</th><th className="r">Amount</th><th>Purpose</th><th>Check</th></tr></thead><tbody>{parsed.map((p, i) => <tr key={i}><td>{p.name}</td><td className="r num">{gbp2(p.amount)}</td><td>{p.purpose}</td><td>{p.ok ? <Pill tone="good">Ready</Pill> : <Pill tone="crit">{p.rec ? 'Bad amount' : 'Unknown recipient'}</Pill>}</td></tr>)}</tbody></table></div>}
      <p className="muted small">Each row becomes a normal transfer and goes through the same monitoring rules and contract-limit check.</p>
    </Modal>
  )
}
