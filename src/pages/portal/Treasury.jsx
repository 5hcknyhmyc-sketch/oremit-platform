import { useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import { Plus, Download } from 'lucide-react'
import { usePortal } from './PortalApp'
import { Panel, PageHead, Tabs, Modal, Field, Pill, Kpi, Empty } from '../../components/ui'
import { act } from '../../store'
import * as E from '../../lib/engine'
import { partnerById, PAYIN_BANKS } from '../../lib/reference'
import { gbp, gbp2, fmtDate, DAY, toCsv, download } from '../../lib/util'

export default function Treasury() {
  return (
    <>
      <PageHead title="Treasury & ledger" sub="Prefunding with payout partners, pay-in accounts, and the books." />
      <Tabs items={[{ to: '/portal/treasury', label: 'Prefunding', end: true }, { to: '/portal/treasury/accounts', label: 'Pay-in accounts' }, { to: '/portal/treasury/ledger', label: 'Ledger' }, { to: '/portal/treasury/expenses', label: 'Expenses & transfers' }]} />
      <Routes>
        <Route index element={<Prefunding />} />
        <Route path="accounts" element={<Accounts />} />
        <Route path="ledger" element={<Ledger />} />
        <Route path="expenses" element={<Expenses />} />
      </Routes>
    </>
  )
}

function Prefunding() {
  const { db, t, role } = usePortal()
  const [top, setTop] = useState(null)
  const tx = db.transactions.filter((x) => x.tenantId === t.id)
  const partners = t.partners.map((id) => partnerById(db, id)).filter(Boolean)
  const weekOut = (pid) => tx.filter((x) => x.partnerId === pid && ['released', 'paid'].includes(x.status) && Date.now() - x.updatedAt < 7 * DAY).reduce((a, x) => a + x.sendAmount, 0)
  const unpaid = (pid) => tx.filter((x) => x.partnerId === pid && x.status === 'released')
  const waiting = tx.filter((x) => x.status === 'pending_release' && x.note?.startsWith('Waiting'))
  const clientFunds = E.balance(db, t, 'client_funds')
  return (
    <>
      <div className="kpis">
        <Kpi label="Total prefunded" value={gbp(Object.values(t.treasury).reduce((a, b) => a + b, 0))} sub={`across ${partners.length} partner${partners.length === 1 ? '' : 's'}`} />
        <Kpi label="Customer funds held" value={gbp(clientFunds)} sub="received, not yet paid out" tone="info" />
        <Kpi label="Paid out, 7 days" value={gbp(partners.reduce((a, p) => a + weekOut(p.id), 0))} />
        <Kpi label="Waiting for prefunding" value={waiting.length} tone={waiting.length ? 'crit' : 'good'} sub={waiting.length ? gbp(waiting.reduce((a, x) => a + x.sendAmount, 0)) + ' stuck' : 'nothing stuck'} />
      </div>
      <Panel title="Payout partners">
        <div className="tbl-wrap"><table>
          <thead><tr><th>Partner</th><th>Currencies</th><th className="r">Prefund balance</th><th className="r">Paid out, 7d</th><th className="r">Unpaid (sent, awaiting confirmation)</th><th>Runway</th><th></th></tr></thead>
          <tbody>{partners.map((p) => {
            const bal = t.treasury[p.id] || 0, wk = weekOut(p.id), days = wk ? Math.round(bal / (wk / 7)) : null, up = unpaid(p.id)
            return <tr key={p.id}><td><b>{p.name}</b>{!p.included && <span className="tag" style={{ marginLeft: 6 }}>custom</span>}<br /><small className="muted">{p.methods.join(', ')}</small></td><td className="mono">{p.cur.join(', ')}</td><td className="r num">{gbp2(bal)}</td><td className="r num">{gbp(wk)}</td><td className="r num">{up.length ? `${up.length} · ${gbp(up.reduce((a, x) => a + x.sendAmount, 0))}` : '—'}</td>
              <td>{days === null ? <Pill tone="mute">No activity</Pill> : days < 3 ? <Pill tone="crit">~{days} days</Pill> : days < 7 ? <Pill tone="warn">~{days} days</Pill> : <Pill tone="good">~{days} days</Pill>}</td>
              <td className="r">{['Admin', 'MLRO'].includes(role) && <button className="btn sm pri" onClick={() => setTop(p)}>Top up</button>}</td></tr>
          })}</tbody>
        </table></div>
      </Panel>
      <Panel title="Top-up history">
        {t.topUps.length ? <div className="list">{t.topUps.slice(0, 8).map((u) => <div className="li" key={u.id}><div className="grow"><b>{gbp2(u.amount)} → {partnerById(db, u.partnerId)?.name}</b><small>{u.by} · {fmtDate(u.at)}</small></div></div>)}</div> : <Empty>No top-ups recorded yet.</Empty>}
      </Panel>
      {top && <TopUp p={top} onClose={() => setTop(null)} />}
    </>
  )
}
function TopUp({ p, onClose }) {
  const { t, actor } = usePortal()
  const banks = t.accounts.filter((a) => a.type === 'bank')
  const [a, setA] = useState('')
  const [from, setFrom] = useState(banks[0]?.id)
  const ok = () => act((d) => E.topUp(d, t.id, p.id, +a, actor, Date.now(), from), `Prefunded ${gbp(+a)} with ${p.name}`) && onClose()
  return (
    <Modal title={`Top up ${p.name}`} onClose={onClose} footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn pri" onClick={ok}>Record top-up</button></>}>
      <p className="muted small">Records the prefunding you've sent to the partner and posts it to the ledger. Transfers waiting on this partner are released automatically if they qualify.</p>
      <Field label="Amount (£)" id="tu-a"><input id="tu-a" className="inp num" inputMode="decimal" value={a} onChange={(e) => setA(e.target.value)} autoFocus /></Field>
      <Field label="Paid from" id="tu-f"><select id="tu-f" className="sel" value={from} onChange={(e) => setFrom(e.target.value)}>{banks.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>
    </Modal>
  )
}

function Accounts() {
  const { db, t } = usePortal()
  const banks = t.accounts.filter((a) => a.type === 'bank')
  const pays = db.payIns.filter((p) => p.tenantId === t.id)
  return (
    <>
      <Panel title="Pay-in and operating accounts" actions={<span className="muted small">Change which banks are connected in Settings → Integrations</span>}>
        <div className="tbl-wrap"><table><thead><tr><th>Account</th><th>Provider</th><th className="r">Ledger balance</th><th className="r">Credits received, 30d</th><th>Status</th></tr></thead>
          <tbody>{banks.map((b) => { const bid = b.id.replace('bank_', ''); const bank = PAYIN_BANKS.find((x) => x.id === bid); const inn = pays.filter((p) => p.bankId === bid && p.status === 'matched' && Date.now() - p.receivedAt < 30 * DAY).reduce((a, p) => a + p.amount, 0); return <tr key={b.id}><td><b>{b.name}</b></td><td className="muted">{bank?.kind || 'Custom integration'}</td><td className="r num">{gbp2(E.balance(db, t, b.id))}</td><td className="r num">{gbp(inn)}</td><td><Pill tone="good">Connected</Pill></td></tr> })}</tbody>
        </table></div>
      </Panel>
      <Panel title="Safeguarding account details shown to customers" pad>
        <dl className="dl"><dt>Account name</dt><dd>{t.bank.name}</dd><dt>Sort code</dt><dd className="mono">{t.bank.sortCode}</dd><dt>Account number</dt><dd className="mono">{t.bank.account}</dd></dl>
        <p className="muted small" style={{ marginTop: 10 }}>Customer money stays in the safeguarding account until the partner confirms payout. In production, balances and credits come from the bank's API feed.</p>
      </Panel>
    </>
  )
}

function Ledger() {
  const { db, t } = usePortal()
  const [acc, setAcc] = useState('all')
  const [type, setType] = useState('all')
  const js = db.journals.filter((j) => j.tenantId === t.id && (type === 'all' || j.type === type) && (acc === 'all' || j.lines.some((l) => l.account === acc))).slice(0, 300)
  const name = (id) => t.accounts.find((a) => a.id === id)?.name || id
  const groups = ['bank', 'prefund', 'liability', 'income', 'expense']
  const labels = { bank: 'Bank accounts', prefund: 'Partner prefunding', liability: 'Liabilities & equity', income: 'Income', expense: 'Expenses' }
  const exportCsv = () => download(`ledger-${t.slug}.csv`, toCsv(js.flatMap((j) => j.lines.map((l) => ({ journal: j.no, date: new Date(j.at).toISOString(), type: j.type, details: j.details, ref: j.ref, account: name(l.account), debit: l.debit || '', credit: l.credit || '', by: j.by })))))
  return (
    <div className="grid2" style={{ gridTemplateColumns: 'minmax(0,1.7fr) minmax(0,1fr)' }}>
      <div className="stack">
        <div className="filters">
          <select id="lg-acc" className="sel" value={acc} onChange={(e) => setAcc(e.target.value)}><option value="all">All accounts</option>{t.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
          <select id="lg-type" className="sel" value={type} onChange={(e) => setType(e.target.value)}><option value="all">All entries</option><option value="AUTO">Automatic (transfers)</option><option value="EXP">Expenses</option><option value="TRF">Transfers between accounts</option><option value="OPEN">Opening balances</option></select>
          <span className="muted small">{js.length} journals</span><div className="spacer" /><button className="btn sm" onClick={exportCsv}><Download />CSV</button>
        </div>
        <Panel title="Journals">
          <div className="tbl-wrap"><table><thead><tr><th>No.</th><th>Date</th><th>Type</th><th>Account</th><th>Details</th><th className="r">Debit</th><th className="r">Credit</th></tr></thead>
            <tbody>{js.map((j) => j.lines.map((l, i) => <tr key={j.id + i}><td className="mono">{i === 0 ? j.no : ''}</td><td className="nowrap muted">{i === 0 ? fmtDate(j.at, false) : ''}</td><td>{i === 0 ? <span className="tag">{j.type}</span> : ''}</td><td className="small nowrap">{name(l.account)}</td><td className="small">{i === 0 ? <>{j.details}{j.ref && <span className="mono muted"> · {j.ref}</span>}</> : ''}</td><td className="r num nowrap">{l.debit ? gbp2(l.debit) : ''}</td><td className="r num nowrap">{l.credit ? gbp2(l.credit) : ''}</td></tr>))}</tbody>
          </table></div>
        </Panel>
      </div>
      <Panel title="Trial balance" pad>
        {groups.map((g) => { const rows = t.accounts.filter((a) => a.type === g); if (!rows.length) return null; return <div key={g} style={{ marginBottom: 14 }}><div className="small muted" style={{ textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 600, marginBottom: 4 }}>{labels[g]}</div>{rows.map((a) => <div className="meta" key={a.id} style={{ padding: '4px 0', borderBottom: '1px solid var(--line)' }}><span>{a.name}</span><b>{gbp2(E.balance(db, t, a.id))}</b></div>)}</div> })}
        <p className="muted small">Every transfer posts automatically: customer payment → customer funds payable; payout → prefund, fee income and FX income; refund → back to the bank. Manual entries live on the next tab.</p>
      </Panel>
    </div>
  )
}

function Expenses() {
  const { db, t, actor, role } = usePortal()
  const banks = t.accounts.filter((a) => a.type === 'bank'), exps = t.accounts.filter((a) => a.type === 'expense')
  const [f, setF] = useState({ date: new Date().toISOString().slice(0, 10), paidFrom: banks[0]?.id, expenseAccount: exps[0]?.id, details: '', amount: '' })
  const [tr, setTr] = useState({ from: banks[0]?.id, to: banks[1]?.id || banks[0]?.id, amount: '', details: '' })
  const canEdit = ['Admin', 'MLRO'].includes(role)
  const js = db.journals.filter((j) => j.tenantId === t.id && ['EXP', 'TRF'].includes(j.type)).slice(0, 40)
  const name = (id) => t.accounts.find((a) => a.id === id)?.name || id
  return (
    <>
      <div className="grid2e">
        <Panel title="Record an expense / payment" pad>
          <div className="form">
            <Field label="Date" id="ex-d"><input id="ex-d" className="inp" type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
            <Field label="Paid from" id="ex-f"><select id="ex-f" className="sel" value={f.paidFrom} onChange={(e) => setF({ ...f, paidFrom: e.target.value })}>{banks.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>
            <Field label="Expense account" id="ex-a"><select id="ex-a" className="sel" value={f.expenseAccount} onChange={(e) => setF({ ...f, expenseAccount: e.target.value })}>{exps.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>
            <Field label="Amount (£)" id="ex-m"><input id="ex-m" className="inp num" inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></Field>
            <Field label="Details" id="ex-t"><input id="ex-t" className="inp" value={f.details} onChange={(e) => setF({ ...f, details: e.target.value })} placeholder="e.g. Ionos Cloud Ltd" /></Field>
          </div>
          <button className="btn pri" style={{ marginTop: 12 }} disabled={!canEdit} onClick={() => act((d) => E.addExpense(d, t.id, f, actor), 'Expense posted') && setF({ ...f, details: '', amount: '' })}><Plus />Post expense</button>
        </Panel>
        <Panel title="Transfer funds between accounts" pad>
          <div className="form">
            <Field label="From" id="tr-f"><select id="tr-f" className="sel" value={tr.from} onChange={(e) => setTr({ ...tr, from: e.target.value })}>{banks.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>
            <Field label="To" id="tr-t"><select id="tr-t" className="sel" value={tr.to} onChange={(e) => setTr({ ...tr, to: e.target.value })}>{banks.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>
            <Field label="Amount (£)" id="tr-m"><input id="tr-m" className="inp num" inputMode="decimal" value={tr.amount} onChange={(e) => setTr({ ...tr, amount: e.target.value })} /></Field>
            <Field label="Details" id="tr-d"><input id="tr-d" className="inp" value={tr.details} onChange={(e) => setTr({ ...tr, details: e.target.value })} /></Field>
          </div>
          <button className="btn pri" style={{ marginTop: 12 }} disabled={!canEdit} onClick={() => act((d) => E.transferFunds(d, t.id, tr, actor), 'Transfer posted') && setTr({ ...tr, amount: '', details: '' })}><Plus />Post transfer</button>
          <p className="muted small" style={{ marginTop: 10 }}>Prefunding a payout partner is done from the Prefunding tab so the partner balance updates too.</p>
        </Panel>
      </div>
      <Panel title="Manual entries">
        {js.length ? <div className="tbl-wrap"><table><thead><tr><th>No.</th><th>Date</th><th>Type</th><th>Details</th><th>Debit account</th><th>Credit account</th><th className="r">Amount</th><th>By</th></tr></thead>
          <tbody>{js.map((j) => { const dr = j.lines.find((l) => l.debit), cr = j.lines.find((l) => l.credit); return <tr key={j.id}><td className="mono">{j.no}</td><td className="nowrap muted">{fmtDate(j.at, false)}</td><td><span className="tag">{j.type}</span></td><td>{j.details}</td><td className="small">{name(dr.account)}</td><td className="small">{name(cr.account)}</td><td className="r num">{gbp2(dr.debit)}</td><td className="muted small">{j.by}</td></tr> })}</tbody></table></div> : <Empty>No manual entries yet.</Empty>}
      </Panel>
    </>
  )
}
