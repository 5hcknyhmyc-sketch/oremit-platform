import { useState, useMemo } from 'react'
import { Routes, Route, useNavigate, useParams, useSearchParams, Link } from 'react-router-dom'
import { Plus, Download } from 'lucide-react'
import { usePortal } from './PortalApp'
import { Panel, PageHead, TxStatus, Drawer, Modal, Field, Empty, Pill } from '../../components/ui'
import { act } from '../../store'
import * as E from '../../lib/engine'
import { TX_STATUS, PURPOSES, SOURCES_OF_FUNDS, CURRENCIES, partnerById } from '../../lib/reference'
import { gbp2, num, fmtDate, toCsv, download } from '../../lib/util'

export function TxTable({ rows, onPick }) {
  const { db } = usePortal()
  const nav = useNavigate()
  if (!rows.length) return <Empty>No transfers match.</Empty>
  return (
    <div className="tbl-wrap">
      <table>
        <thead><tr><th>Reference</th><th>Sender</th><th>Recipient</th><th>Corridor</th><th className="r">Sent</th><th className="r">Received</th><th>Status</th><th>When</th></tr></thead>
        <tbody>
          {rows.map((x) => {
            const c = db.customers.find((k) => k.id === x.customerId), r = db.recipients.find((k) => k.id === x.recipientId)
            return (
              <tr key={x.id} className="click" onClick={() => (onPick ? onPick(x) : nav(`/portal/transactions/${x.id}`))}>
                <td className="mono">{x.ref}</td><td>{c?.name}</td><td>{r?.name}</td><td className="mono">GBP → {x.cur}</td>
                <td className="r num">{gbp2(x.sendAmount)}</td><td className="r num">{num(x.receiveAmount)} {x.cur}</td><td><TxStatus s={x.status} /></td><td className="muted nowrap">{fmtDate(x.createdAt)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default function Transactions() {
  return (
    <Routes>
      <Route index element={<List />} />
      <Route path=":id" element={<List />} />
    </Routes>
  )
}

function List() {
  const { db, t, can } = usePortal()
  const { id } = useParams()
  const [sp, setSp] = useSearchParams()
  const nav = useNavigate()
  const status = sp.get('status') || 'all'
  const [q, setQ] = useState('')
  const all = db.transactions.filter((x) => x.tenantId === t.id)
  const rows = useMemo(() => all.filter((x) => (status === 'all' || (status === 'live' ? !['paid', 'cancelled', 'rejected', 'refunded'].includes(x.status) : x.status === status)) && (!q || [x.ref, db.customers.find((c) => c.id === x.customerId)?.name, db.recipients.find((c) => c.id === x.recipientId)?.name].join(' ').toLowerCase().includes(q.toLowerCase()))), [all, status, q])
  const counts = Object.fromEntries(Object.keys(TX_STATUS).map((s) => [s, all.filter((x) => x.status === s).length]))

  const exportCsv = () => download(`transfers-${t.slug}.csv`, toCsv(rows.map((x) => ({ reference: x.ref, created: new Date(x.createdAt).toISOString(), sender: db.customers.find((c) => c.id === x.customerId)?.name, recipient: db.recipients.find((c) => c.id === x.recipientId)?.name, currency: x.cur, send_gbp: x.sendAmount, fee_gbp: x.fee, rate: x.rate, receive: x.receiveAmount, status: TX_STATUS[x.status].label, purpose: x.purpose, source_of_funds: x.sof, channel: x.channel }))))

  return (
    <>
      <PageHead title="Transactions" sub="Every transfer, from creation to payout.">
        <button className="btn" onClick={exportCsv}><Download />Export CSV</button>
        <button className="btn pri" onClick={() => setSp({ ...Object.fromEntries(sp), new: '1' })}><Plus />New transfer</button>
      </PageHead>
      <div className="filters">
        <input id="tx-q" className="inp" placeholder="Search reference, sender or recipient" value={q} onChange={(e) => setQ(e.target.value)} />
        <select id="tx-status" className="sel" value={status} onChange={(e) => setSp(e.target.value === 'all' ? {} : { status: e.target.value })}>
          <option value="all">All statuses</option><option value="live">In progress</option>
          {Object.entries(TX_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label} ({counts[k]})</option>)}
        </select>
        <span className="muted small">{rows.length} of {all.length}</span>
      </div>
      <Panel><TxTable rows={rows} /></Panel>
      {id && <TxDrawer id={id} onClose={() => nav('/portal/transactions' + (status !== 'all' ? `?status=${status}` : ''))} />}
      {sp.get('new') && <NewTransfer onClose={() => { const o = Object.fromEntries(sp); delete o.new; setSp(o) }} />}
    </>
  )
}

export function TxDrawer({ id, onClose }) {
  const { db, t, actor, can, canDecide, role } = usePortal()
  const x = db.transactions.find((k) => k.id === id)
  if (!x) return null
  const c = db.customers.find((k) => k.id === x.customerId), r = db.recipients.find((k) => k.id === x.recipientId)
  const k = x.caseId && db.cases.find((z) => z.id === x.caseId)
  const p = partnerById(x.partnerId)
  const canRelease = canDecide && x.status === 'pending_release'
  const canCancel = ['awaiting_funds', 'on_hold', 'pending_release', 'funds_received'].includes(x.status) && (canDecide || x.status === 'awaiting_funds')
  return (
    <Drawer title={x.ref} onClose={onClose} footer={
      <>
        {canCancel && <button className="btn danger" onClick={() => act((d) => E.cancelTransaction(d, x.id, actor), 'Transfer cancelled')}>Cancel transfer</button>}
        {x.status === 'awaiting_funds' && can('payments') && <button className="btn" onClick={() => act((d) => E.recordPayIn(d, t.id, { amount: x.total, payer: c.name.toUpperCase(), reference: x.ref }, actor), 'Payment recorded and matched')}>Record payment (demo)</button>}
        {canRelease && <button className="btn pri" onClick={() => act((d) => E.release(d, x.id, actor), 'Released to partner')}>Release to partner</button>}
        {x.status === 'on_hold' && k && <Link className="btn pri" to={`/portal/compliance/cases/${k.id}`}>Review case {k.ref}</Link>}
      </>
    }>
      <div className="row"><TxStatus s={x.status} /><span className="tag">{x.channel}</span>{x.note && <span className="pill warn">{x.note}</span>}</div>
      <dl className="dl">
        <dt>Sender</dt><dd><Link to={`/portal/customers/${c.id}`}>{c.name}</Link></dd>
        <dt>Recipient</dt><dd>{r.name} · {r.method}, {r.bank} {r.account}<br /><span className="muted small">{CURRENCIES[r.cur]?.country} · {r.relationship}</span></dd>
        <dt>Amount</dt><dd className="num">{gbp2(x.sendAmount)} + {gbp2(x.fee)} fee = <b>{gbp2(x.total)}</b></dd>
        <dt>Rate</dt><dd className="num">1 GBP = {x.rate} {x.cur}</dd>
        <dt>They receive</dt><dd className="num"><b>{num(x.receiveAmount)} {x.cur}</b></dd>
        <dt>Partner</dt><dd>{p?.name}</dd>
        <dt>Purpose</dt><dd>{x.purpose || <span className="muted">Not given</span>}</dd>
        <dt>Source of funds</dt><dd>{x.sof || <span className="muted">Not given</span>}</dd>
        {x.payInId && <><dt>Paid by</dt><dd>{(() => { const pi = db.payIns.find((z) => z.id === x.payInId); return pi ? `${pi.payer} · ${pi.method} · ${fmtDate(pi.receivedAt)}` : '' })()}</dd></>}
      </dl>
      {x.hits.length > 0 && (
        <div className="stack-s">
          <b className="small">Rules that fired</b>
          {x.hits.map((h, i) => <div key={i} className="row"><Pill tone={h.action === 'flag' ? 'info' : h.action === 'hold' ? 'warn' : 'crit'}>{h.action}</Pill><span className="small"><b>{h.name}</b> — {h.detail}</span></div>)}
          {k && <Link className="small" to={`/portal/compliance/cases/${k.id}`}>Open case {k.ref} →</Link>}
        </div>
      )}
      <div>
        <b className="small">Timeline</b>
        <div className="timeline" style={{ marginTop: 8 }}>
          {x.history.map((h, i) => <div className="tl" key={i}><span className="dot" style={{ background: `var(--${TX_STATUS[h.status]?.tone || 'line'})` }} /><div><span>{TX_STATUS[h.status]?.label}</span> <span className="muted">· {h.note}</span><small>{fmtDate(h.at)} · {h.actor}</small></div></div>)}
        </div>
      </div>
    </Drawer>
  )
}

function NewTransfer({ onClose }) {
  const { db, t, actor } = usePortal()
  const nav = useNavigate()
  const custs = db.customers.filter((c) => c.tenantId === t.id && c.status === 'active')
  const [f, setF] = useState({ customerId: '', recipientId: '', sendAmount: '', purpose: PURPOSES[0], sof: '', pay: true })
  const recs = db.recipients.filter((r) => r.customerId === f.customerId)
  const rec = recs.find((r) => r.id === f.recipientId)
  const q = rec ? E.quote(t, rec.cur, f.sendAmount) : null
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const submit = () => {
    const tx = act((d) => {
      const tx = E.createTransaction(d, { tenantId: t.id, customerId: f.customerId, recipientId: f.recipientId, sendAmount: +f.sendAmount, purpose: f.purpose, sof: f.sof, channel: 'Branch', fraudConfirm: true }, actor)
      if (f.pay) E.recordPayIn(d, t.id, { amount: tx.total, payer: custs.find((c) => c.id === f.customerId).name.toUpperCase(), reference: tx.ref, method: 'Cash at branch' }, actor)
      return tx
    }, (tx) => `Transfer ${tx.ref} created`)
    if (tx) { onClose(); nav(`/portal/transactions/${tx.id}`) }
  }
  return (
    <Modal title="New transfer (branch)" onClose={onClose} footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn pri" onClick={submit} disabled={!q}>Create transfer</button></>}>
      <Field label="Customer" id="nt-c"><select id="nt-c" className="sel" value={f.customerId} onChange={(e) => setF({ ...f, customerId: e.target.value, recipientId: '' })}><option value="">Choose…</option>{custs.map((c) => <option key={c.id} value={c.id}>{c.name} · KYC {c.kyc.status.replace('_', ' ')}</option>)}</select></Field>
      <Field label="Recipient" id="nt-r"><select id="nt-r" className="sel" value={f.recipientId} onChange={set('recipientId')} disabled={!f.customerId}><option value="">Choose…</option>{recs.map((r) => <option key={r.id} value={r.id}>{r.name} · {r.cur} · {r.method}</option>)}</select></Field>
      <div className="form">
        <Field label="Amount to send (£)" id="nt-a"><input id="nt-a" className="inp num" inputMode="decimal" value={f.sendAmount} onChange={set('sendAmount')} /></Field>
        <Field label="Purpose" id="nt-p"><select id="nt-p" className="sel" value={f.purpose} onChange={set('purpose')}>{PURPOSES.map((p) => <option key={p}>{p}</option>)}</select></Field>
        <Field label="Source of funds" id="nt-s" hint={`Required above £${t.compliance.sofThreshold.toLocaleString('en-GB')}`}><select id="nt-s" className="sel" value={f.sof} onChange={set('sof')}><option value="">Not given</option>{SOURCES_OF_FUNDS.map((p) => <option key={p}>{p}</option>)}</select></Field>
      </div>
      {q && <div className="banner">They receive <b className="num">{num(q.receiveAmount)} {q.cur}</b> · rate {q.rate} · fee {gbp2(q.fee)} · customer pays <b className="num">{gbp2(q.total)}</b> · via {q.partner?.name || 'no partner enabled'}</div>}
      <label className="check"><input type="checkbox" checked={f.pay} onChange={(e) => setF({ ...f, pay: e.target.checked })} /><span>Customer paid cash at the counter<small>Records the payment now so compliance checks run immediately</small></span></label>
    </Modal>
  )
}
