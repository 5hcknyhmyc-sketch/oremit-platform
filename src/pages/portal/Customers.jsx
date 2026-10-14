import { useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { Plus, Snowflake, Sun } from 'lucide-react'
import { usePortal } from './PortalApp'
import { Panel, PageHead, Modal, Field, Empty, Pill, KycPill, RiskPill, ScreenPill, CasePill } from '../../components/ui'
import { TxTable } from './Transactions'
import { act } from '../../store'
import * as E from '../../lib/engine'
import { riskLevel } from '../../lib/rules'
import { DOC_TYPES, OCCUPATIONS, CURRENCIES, RELATIONSHIPS } from '../../lib/reference'
import { gbp, fmtDate, ageFrom, initials } from '../../lib/util'

export default function Customers() {
  const { db, t } = usePortal()
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState('all')
  const [add, setAdd] = useState(false)
  const all = db.customers.filter((c) => c.tenantId === t.id)
  const rows = all.filter((c) => (!q || c.name.toLowerCase().includes(q.toLowerCase()) || c.email.includes(q.toLowerCase())) && (filter === 'all' || (filter === 'kyc' ? c.kyc.status !== 'verified' : filter === 'high' ? riskLevel(c) === 'High' : filter === 'frozen' ? c.status === 'frozen' : true)))
  const sent = (c) => db.transactions.filter((x) => x.customerId === c.id && x.status === 'paid').reduce((a, x) => a + x.sendAmount, 0)
  return (
    <>
      <PageHead title="Customers" sub="Senders, their verification status and risk."><button className="btn pri" onClick={() => setAdd(true)}><Plus />Add customer</button></PageHead>
      <div className="filters">
        <input id="cu-q" className="inp" placeholder="Search name or email" value={q} onChange={(e) => setQ(e.target.value)} />
        <select id="cu-f" className="sel" value={filter} onChange={(e) => setFilter(e.target.value)}><option value="all">Everyone ({all.length})</option><option value="kyc">KYC incomplete ({all.filter((c) => c.kyc.status !== 'verified').length})</option><option value="high">High risk ({all.filter((c) => riskLevel(c) === 'High').length})</option><option value="frozen">Frozen ({all.filter((c) => c.status === 'frozen').length})</option></select>
      </div>
      <Panel>
        {rows.length ? <div className="tbl-wrap"><table>
          <thead><tr><th>Customer</th><th>KYC</th><th>Screening</th><th>Risk</th><th className="r">Sent (paid)</th><th>Since</th></tr></thead>
          <tbody>{rows.map((c) => (
            <tr key={c.id} className="click" onClick={() => nav(`/portal/customers/${c.id}`)}>
              <td><div className="cell-t"><span className="av" style={{ width: 32, height: 32, fontSize: 11 }}>{initials(c.name)}</span><div><b>{c.name}</b>{c.status === 'frozen' && <Pill tone="crit">Frozen</Pill>}{c.pep && <span className="tag" style={{ marginLeft: 6 }}>PEP</span>}<small>{c.email}</small></div></div></td>
              <td><KycPill s={c.kyc.status} /></td><td><ScreenPill s={c.screening} /></td><td><RiskPill level={riskLevel(c)} /></td><td className="r num">{gbp(sent(c))}</td><td className="muted nowrap">{fmtDate(c.createdAt, false)}</td>
            </tr>
          ))}</tbody>
        </table></div> : <Empty>No customers match.</Empty>}
      </Panel>
      {add && <NewCustomer onClose={() => setAdd(false)} />}
    </>
  )
}

export function CustomerDetail() {
  const { db, t, actor, canDecide } = usePortal()
  const { id } = useParams()
  const c = db.customers.find((x) => x.id === id)
  const [addRec, setAddRec] = useState(false)
  const [addDoc, setAddDoc] = useState(false)
  if (!c) return <Empty>Customer not found.</Empty>
  const tx = db.transactions.filter((x) => x.customerId === c.id)
  const recs = db.recipients.filter((r) => r.customerId === c.id)
  const cases = db.cases.filter((k) => k.customerId === c.id)
  const level = riskLevel(c)
  return (
    <>
      <PageHead crumb={<Link to="/portal/customers">Customers</Link>} title={c.name} sub={`${c.type === 'business' ? 'Business' : 'Individual'} · customer since ${fmtDate(c.createdAt, false)}`}>
        <KycPill s={c.kyc.status} /><RiskPill level={level} />{c.status === 'frozen' && <Pill tone="crit">Frozen</Pill>}
        {canDecide && (c.status === 'frozen'
          ? <button className="btn" onClick={() => act((d) => E.setCustomerStatus(d, c.id, 'active', actor), 'Customer unfrozen')}><Sun />Unfreeze</button>
          : <button className="btn danger" onClick={() => act((d) => E.setCustomerStatus(d, c.id, 'frozen', actor), 'Customer frozen — no new transfers')}><Snowflake />Freeze</button>)}
      </PageHead>
      <div className="grid2e">
        <Panel title="Profile" pad>
          <dl className="dl">
            <dt>Date of birth</dt><dd>{c.dob || '—'} {c.dob && <span className="muted">(age {ageFrom(c.dob)})</span>}</dd>
            <dt>Address</dt><dd>{c.address}, {c.postcode}</dd>
            <dt>Contact</dt><dd>{c.email}<br />{c.phone}</dd>
            <dt>Occupation</dt><dd>{c.occupation || '—'}</dd>
            <dt>Nationality</dt><dd>{c.nationality || '—'}</dd>
            <dt>PEP</dt><dd>{c.pep ? <span><Pill tone="crit">Yes</Pill> <span className="small muted">{c.pepDetail?.match} · {c.pepDetail?.role}</span></span> : 'No'}</dd>
          </dl>
        </Panel>
        <Panel title="Risk assessment" pad>
          <div className="row"><RiskPill level={level} /><span className="muted small">score {c.risk.score}/100{c.risk.override ? ' · manual override' : ' · automatic'}</span></div>
          <ul style={{ margin: '10px 0', paddingLeft: 18 }} className="small">{c.risk.factors?.length ? c.risk.factors.map((f, i) => <li key={i}>{f}</li>) : <li className="muted">No risk factors</li>}</ul>
          {canDecide && <div className="row"><span className="small">Set manually:</span>{['Low', 'Medium', 'High'].map((l) => <button key={l} className={`btn sm ${c.risk.override === l ? 'pri' : ''}`} onClick={() => act((d) => E.setCustomerRisk(d, c.id, c.risk.override === l ? null : l, actor), 'Risk rating updated')}>{l}</button>)}</div>}
        </Panel>
        <Panel title="Identity documents" actions={<button className="btn sm" onClick={() => setAddDoc(true)}>Add document</button>}>
          <div className="list">
            {c.kyc.docs.length ? c.kyc.docs.map((d) => (
              <div className="li" key={d.id}><div className="grow"><b>{d.type}</b><small>Uploaded {fmtDate(d.uploadedAt)}{d.expiry ? ` · expires ${d.expiry}` : ''}{d.reviewedBy ? ` · reviewed by ${d.reviewedBy}` : ''}</small></div>
                {d.status === 'pending' && canDecide ? <div className="row"><button className="btn sm good" onClick={() => act((dd) => E.reviewDocument(dd, c.id, d.id, true, actor), 'Document verified')}>Verify</button><button className="btn sm danger" onClick={() => act((dd) => E.reviewDocument(dd, c.id, d.id, false, actor), 'Document rejected')}>Reject</button></div>
                  : <Pill tone={{ verified: 'good', pending: 'warn', rejected: 'crit' }[d.status]}>{d.status}</Pill>}
              </div>
            )) : <Empty>No documents yet.</Empty>}
          </div>
        </Panel>
        <Panel title="Screening" pad>
          <div className="row"><ScreenPill s={c.screening} /><span className="muted small">checked {fmtDate(c.screening.at)}</span></div>
          {c.screening.match && <p className="small" style={{ marginTop: 8 }}>Closest entry: <b>{c.screening.match.match}</b> · {c.screening.match.list} · {c.screening.match.reason}</p>}
          <p className="muted small" style={{ marginTop: 8 }}>Demo watchlist of fictional names. In production: live sanctions, PEP and adverse-media screening on every transfer.</p>
          {cases.filter((k) => k.kind === 'screening' && k.status !== 'closed').map((k) => <Link key={k.id} className="btn sm pri" style={{ marginTop: 8 }} to={`/portal/compliance/cases/${k.id}`}>Resolve screening case {k.ref}</Link>)}
        </Panel>
      </div>
      <Panel title="Recipients" actions={<button className="btn sm" onClick={() => setAddRec(true)}>Add recipient</button>}>
        {recs.length ? <div className="tbl-wrap"><table><thead><tr><th>Name</th><th>Country</th><th>Method</th><th>Account</th><th>Relationship</th><th>Screening</th></tr></thead>
          <tbody>{recs.map((r) => <tr key={r.id}><td><b>{r.name}</b></td><td>{CURRENCIES[r.cur]?.country} ({r.cur})</td><td>{r.method}</td><td className="mono small">{r.bank} {r.account}</td><td>{r.relationship}</td><td><ScreenPill s={r.screening} /></td></tr>)}</tbody></table></div> : <Empty>No recipients yet.</Empty>}
      </Panel>
      <Panel title={`Transfers (${tx.length})`}><TxTable rows={tx} /></Panel>
      {cases.length > 0 && <Panel title="Compliance cases"><div className="list">{cases.map((k) => <Link key={k.id} className="li" to={`/portal/compliance/cases/${k.id}`}><div className="grow"><b>{k.ref} · {k.title}</b><small>{fmtDate(k.createdAt)}{k.outcome ? ` · ${k.outcome}` : ''}</small></div><CasePill s={k.status} /></Link>)}</div></Panel>}
      {addRec && <NewRecipient c={c} onClose={() => setAddRec(false)} />}
      {addDoc && <Modal title="Add document" onClose={() => setAddDoc(false)}>
        <p className="muted small">In the real app the customer photographs the document in the app. Here, pick the type to simulate an upload.</p>
        <div className="stack-s">{DOC_TYPES.map((d) => <button key={d} className="btn" style={{ justifyContent: 'flex-start' }} onClick={() => { act((dd) => E.addDocument(dd, c.id, d, actor), `${d} added for review`); setAddDoc(false) }}>{d}</button>)}</div>
      </Modal>}
    </>
  )
}

export function NewCustomer({ onClose, onCreated }) {
  const { t, actor } = usePortal()
  const [f, setF] = useState({ type: 'individual', name: '', email: '', phone: '', dob: '', address: '', postcode: '', occupation: OCCUPATIONS[0], nationality: 'British' })
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const ok = () => { const c = act((d) => E.createCustomer(d, t.id, f, actor), (c) => (c.screening.status === 'potential_match' ? 'Customer created — screening match needs review' : 'Customer created')); if (c) { onClose(); onCreated?.(c) } }
  return (
    <Modal title="Add customer" onClose={onClose} footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn pri" onClick={ok}>Create</button></>}>
      <div className="form">
        <Field label="Type" id="nc-t"><select id="nc-t" className="sel" value={f.type} onChange={set('type')}><option value="individual">Individual</option><option value="business">Business</option></select></Field>
        <Field label="Full name" id="nc-n"><input id="nc-n" className="inp" value={f.name} onChange={set('name')} /></Field>
        <Field label="Date of birth" id="nc-d"><input id="nc-d" className="inp" type="date" value={f.dob} onChange={set('dob')} /></Field>
        <Field label="Email" id="nc-e"><input id="nc-e" className="inp" type="email" value={f.email} onChange={set('email')} /></Field>
        <Field label="Phone" id="nc-p"><input id="nc-p" className="inp" value={f.phone} onChange={set('phone')} /></Field>
        <Field label="Address" id="nc-a"><input id="nc-a" className="inp" value={f.address} onChange={set('address')} /></Field>
        <Field label="Postcode" id="nc-pc"><input id="nc-pc" className="inp" value={f.postcode} onChange={set('postcode')} /></Field>
        <Field label="Occupation" id="nc-o"><select id="nc-o" className="sel" value={f.occupation} onChange={set('occupation')}>{OCCUPATIONS.map((o) => <option key={o}>{o}</option>)}</select></Field>
        <Field label="Nationality" id="nc-nat"><input id="nc-nat" className="inp" value={f.nationality} onChange={set('nationality')} /></Field>
      </div>
      <p className="muted small">The name is screened against sanctions and PEP lists as soon as you save. Try “Viktor Orlenko” to see a match.</p>
    </Modal>
  )
}

export function NewRecipient({ c, onClose, actor: actorOverride }) {
  const { db, actor } = usePortal()
  const t = db.tenants.find((x) => x.id === c.tenantId)
  const curs = t.corridors.filter((x) => x.enabled)
  const [f, setF] = useState({ name: '', cur: curs[0]?.cur || '', method: 'Bank', bank: '', account: '', relationship: 'Parent' })
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const ok = () => act((d) => E.addRecipient(d, c.id, f, actorOverride || actor), 'Recipient added') && onClose()
  return (
    <Modal title={`New recipient for ${c.name}`} onClose={onClose} footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn pri" onClick={ok}>Save recipient</button></>}>
      <div className="form">
        <Field label="Full name" id="nr-n"><input id="nr-n" className="inp" value={f.name} onChange={set('name')} /></Field>
        <Field label="Country / currency" id="nr-c"><select id="nr-c" className="sel" value={f.cur} onChange={set('cur')}>{curs.map((x) => <option key={x.cur} value={x.cur}>{CURRENCIES[x.cur].country} ({x.cur})</option>)}</select></Field>
        <Field label="Payout method" id="nr-m"><select id="nr-m" className="sel" value={f.method} onChange={set('method')}><option>Bank</option><option>Cash pickup</option><option>Mobile wallet</option></select></Field>
        <Field label="Bank / wallet provider" id="nr-b"><input id="nr-b" className="inp" value={f.bank} onChange={set('bank')} /></Field>
        <Field label="Account / IBAN / wallet number" id="nr-a"><input id="nr-a" className="inp mono" value={f.account} onChange={set('account')} /></Field>
        <Field label="Relationship" id="nr-r"><select id="nr-r" className="sel" value={f.relationship} onChange={set('relationship')}>{RELATIONSHIPS.map((o) => <option key={o}>{o}</option>)}</select></Field>
      </div>
    </Modal>
  )
}
