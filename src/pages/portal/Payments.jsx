import { useState } from 'react'
import { Plus } from 'lucide-react'
import { usePortal } from './PortalApp'
import { Panel, PageHead, Modal, Field, Empty, Pill, Kpi } from '../../components/ui'
import { act } from '../../store'
import * as E from '../../lib/engine'
import { gbp, gbp2, fmtDate } from '../../lib/util'

export default function Payments() {
  const { db, t, actor } = usePortal()
  const pays = db.payIns.filter((p) => p.tenantId === t.id)
  const unmatched = pays.filter((p) => p.status === 'unmatched')
  const awaiting = db.transactions.filter((x) => x.tenantId === t.id && x.status === 'awaiting_funds')
  const [match, setMatch] = useState(null)
  const [rec, setRec] = useState(false)
  const todayIn = pays.filter((p) => new Date(p.receivedAt).toDateString() === new Date().toDateString()).reduce((a, p) => a + p.amount, 0)
  return (
    <>
      <PageHead title="Payments in" sub={`Credits to the safeguarding account ${t.bank.sortCode} ${t.bank.account}. Matched to transfers by reference and amount.`}>
        <button className="btn pri" onClick={() => setRec(true)}><Plus />Record a bank credit (demo)</button>
      </PageHead>
      <div className="kpis">
        <Kpi label="Received today" value={gbp(todayIn)} />
        <Kpi label="Unmatched" value={unmatched.length} sub={gbp(unmatched.reduce((a, p) => a + p.amount, 0)) + ' to allocate'} tone={unmatched.length ? 'warn' : 'good'} />
        <Kpi label="Awaiting funds" value={awaiting.length} sub={gbp(awaiting.reduce((a, x) => a + x.total, 0)) + ' expected'} />
      </div>
      {unmatched.length > 0 && (
        <Panel title="Unmatched payments" actions={<span className="muted small">Match to a transfer, or return to the payer</span>}>
          <div className="tbl-wrap"><table>
            <thead><tr><th>Received</th><th>Payer</th><th>Reference</th><th className="r">Amount</th><th>Note</th><th></th></tr></thead>
            <tbody>{unmatched.map((p) => (
              <tr key={p.id}><td className="nowrap">{fmtDate(p.receivedAt)}</td><td>{p.payer}</td><td className="mono">{p.reference || <span className="muted">none</span>}</td><td className="r num">{gbp2(p.amount)}</td><td className="muted small">{p.note || 'No transfer with this reference'}</td>
                <td><div className="row" style={{ justifyContent: 'flex-end' }}><button className="btn sm pri" onClick={() => setMatch(p)}>Match</button><button className="btn sm" onClick={() => act((d) => E.returnPayIn(d, p.id, actor), 'Marked as returned')}>Return</button></div></td></tr>
            ))}</tbody>
          </table></div>
        </Panel>
      )}
      <Panel title="All payments in">
        {pays.length ? <div className="tbl-wrap"><table>
          <thead><tr><th>Received</th><th>Payer</th><th>Method</th><th>Reference</th><th className="r">Amount</th><th>Status</th><th>Transfer</th></tr></thead>
          <tbody>{pays.slice(0, 60).map((p) => (
            <tr key={p.id}><td className="nowrap">{fmtDate(p.receivedAt)}</td><td>{p.payer}</td><td>{p.method}</td><td className="mono">{p.reference || '—'}</td><td className="r num">{gbp2(p.amount)}</td>
              <td><Pill tone={{ matched: 'good', unmatched: 'warn', returned: 'mute' }[p.status]}>{p.status}</Pill></td><td className="mono">{p.txnId ? db.transactions.find((x) => x.id === p.txnId)?.ref : '—'}</td></tr>
          ))}</tbody>
        </table></div> : <Empty>No payments yet.</Empty>}
      </Panel>
      {match && <MatchModal p={match} awaiting={awaiting} onClose={() => setMatch(null)} />}
      {rec && <RecordModal onClose={() => setRec(false)} />}
    </>
  )
}

function MatchModal({ p, awaiting, onClose }) {
  const { db, actor } = usePortal()
  const [id, setId] = useState('')
  const ok = () => act((d) => E.matchPayIn(d, p.id, id, actor), 'Payment matched — compliance checks running') && onClose()
  return (
    <Modal title={`Match ${gbp2(p.amount)} from ${p.payer}`} onClose={onClose} footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn pri" disabled={!id} onClick={ok}>Match payment</button></>}>
      {awaiting.length ? <div className="stack-s">{awaiting.map((x) => (
        <label key={x.id} className="check"><input type="radio" name="m" checked={id === x.id} onChange={() => setId(x.id)} /><span><b className="mono">{x.ref}</b> · {db.customers.find((c) => c.id === x.customerId)?.name} · due {gbp2(x.total)}<small>{x.amount < p.amount ? '' : ''}Created {fmtDate(x.createdAt)}{p.amount < x.total - 0.01 ? ' · underpaid' : ''}</small></span></label>
      ))}</div> : <Empty>No transfers are waiting for funds.</Empty>}
    </Modal>
  )
}

function RecordModal({ onClose }) {
  const { t, actor } = usePortal()
  const [f, setF] = useState({ amount: '', payer: '', reference: '', method: 'Faster Payments' })
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const ok = () => act((d) => E.recordPayIn(d, t.id, f, actor), (p) => (p.status === 'matched' ? 'Payment matched to a transfer' : 'Payment recorded as unmatched')) && onClose()
  return (
    <Modal title="Record a bank credit" onClose={onClose} footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn pri" onClick={ok}>Record</button></>}>
      <p className="muted small">In production this comes from your bank's feed automatically. Use it here to simulate a customer paying.</p>
      <div className="form">
        <Field label="Amount (£)" id="rp-a"><input id="rp-a" className="inp num" inputMode="decimal" value={f.amount} onChange={set('amount')} /></Field>
        <Field label="Payer name" id="rp-p"><input id="rp-p" className="inp" value={f.payer} onChange={set('payer')} /></Field>
        <Field label="Payment reference" id="rp-r" hint="The transfer reference, e.g. NGR-AB12CD"><input id="rp-r" className="inp mono" value={f.reference} onChange={set('reference')} /></Field>
        <Field label="Method" id="rp-m"><select id="rp-m" className="sel" value={f.method} onChange={set('method')}><option>Faster Payments</option><option>CHAPS</option><option>Cash at branch</option><option>Card</option></select></Field>
      </div>
    </Modal>
  )
}
