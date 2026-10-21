import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { usePortal } from './PortalApp'
import { Kpi, Panel, PageHead, SevStripe, Empty } from '../../components/ui'
import { TxTable } from './Transactions'
import { gbp, DAY, ago } from '../../lib/util'
import { partnerById } from '../../lib/reference'
import { riskLevel } from '../../lib/rules'
import * as M from '../../lib/modules'
import * as G from '../../lib/growth'
import { gbp2 } from '../../lib/util'
import { CURRENCIES } from '../../lib/reference'

export default function Dashboard() {
  const { db, t, can } = usePortal()
  const remit = t.products.includes('remittance') && can('transactions')
  const bdc = t.modules.includes('bureau') && can('bureau')
  if (!remit && bdc) return <BureauDashboard />
  const tx = db.transactions.filter((x) => x.tenantId === t.id)
  const today = tx.filter((x) => new Date(x.createdAt).toDateString() === new Date().toDateString() && !['cancelled', 'rejected', 'refunded'].includes(x.status))
  const by = (s) => tx.filter((x) => x.status === s)
  const cases = db.cases.filter((k) => k.tenantId === t.id && k.status !== 'closed')
  const unmatched = db.payIns.filter((p) => p.tenantId === t.id && p.status === 'unmatched')
  const kycPending = db.customers.filter((c) => c.tenantId === t.id && c.kyc.status === 'pending')
  const lowBal = Object.entries(t.treasury).filter(([, b]) => b < 5000)
  const sars = db.sars.filter((s) => s.tenantId === t.id && s.status === 'with_mlro')

  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(Date.now() - (13 - i) * DAY).toDateString()
    return tx.filter((x) => new Date(x.createdAt).toDateString() === d && ['paid', 'released'].includes(x.status)).reduce((a, x) => a + x.sendAmount, 0)
  })
  const mx = Math.max(...days, 1)

  const openTickets = (db.tickets || []).filter((k) => k.tenantId === t.id && k.status === 'open')
  const expiring = G.expiringDocs(db, t.id, 30)
  const dueSched = (db.schedules || []).filter((s) => s.tenantId === t.id && s.status === 'active' && s.nextAt < Date.now() + 3 * DAY)
  const attention = [
    ...openTickets.map((k) => ({ sev: 'low', title: `Customer query: ${k.subject}`, sub: `${db.customers.find((c) => c.id === k.customerId)?.name} · ${k.ref} · waiting ${ago(k.updatedAt)}`, to: '/portal/support', need: 'support' })),
    ...expiring.map((e) => ({ sev: e.days < 0 ? 'medium' : 'low', title: `${e.customer.name}: ${e.doc.type} ${e.days < 0 ? 'expired' : `expires in ${e.days} days`}`, sub: 'Customer has been asked in the app to upload a new one', to: `/portal/customers/${e.customer.id}`, need: 'customers' })),
    ...dueSched.map((s) => ({ sev: 'low', title: `Standing transfer due: ${gbp2(s.sendAmount)} to ${db.recipients.find((r) => r.id === s.recipientId)?.name}`, sub: `${db.customers.find((c) => c.id === s.customerId)?.name} · ${G.FREQ[s.frequency]} · ${new Date(s.nextAt).toLocaleDateString('en-GB')}`, to: `/portal/customers/${s.customerId}`, need: 'customers' })),
    ...cases.map((k) => ({ sev: k.severity, title: `${k.ref} · ${k.title}`, sub: `${db.customers.find((c) => c.id === k.customerId)?.name} · ${k.status === 'escalated' ? 'with MLRO' : 'opened ' + ago(k.createdAt)}`, to: `/portal/compliance/cases/${k.id}`, need: 'compliance' })),
    ...by('pending_release').map((x) => ({ sev: 'medium', title: `${x.ref} ready to release`, sub: x.note || `£${x.sendAmount} · above auto-release limit`, to: `/portal/transactions?status=pending_release`, need: 'transactions' })),
    ...unmatched.map((p) => ({ sev: 'medium', title: `Unmatched payment £${p.amount.toFixed(2)}`, sub: `From ${p.payer} · reference “${p.reference || 'none'}”`, to: '/portal/payments', need: 'payments' })),
    ...kycPending.map((c) => ({ sev: 'low', title: `Documents to review: ${c.name}`, sub: c.kyc.docs.filter((d) => d.status === 'pending').map((d) => d.type).join(', '), to: `/portal/customers/${c.id}`, need: 'customers' })),
    ...sars.map((s) => ({ sev: 'high', title: `${s.ref} waiting for MLRO decision`, sub: s.grounds.slice(0, 90) + '…', to: '/portal/compliance/sars', need: 'compliance' })),
    ...lowBal.map(([p, b]) => ({ sev: 'medium', title: `Low prefunding: ${partnerById(db, p)?.name}`, sub: `${gbp(b)} left`, to: '/portal/treasury', need: 'treasury' })),
    ...(bdc ? db.reservations.filter((r) => r.tenantId === t.id && r.status === 'reserved').map((r) => ({ sev: 'low', title: `Reservation ${r.ref} awaiting collection`, sub: `${r.customerName || 'Walk-in'} · ${r.foreign} ${r.code} · expires ${ago(r.expiresAt).replace('ago', '')}`, to: '/portal/bureau/reservations', need: 'bureau' })) : []),
  ].filter((a) => can(a.need))
  const sevRank = { high: 0, medium: 1, low: 2 }
  attention.sort((a, b) => sevRank[a.sev] - sevRank[b.sev])

  return (
    <>
      <PageHead title="Dashboard" sub={`${t.name} · ${new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}`}>
        {can('transactions') && <Link className="btn pri" to="/portal/transactions?new=1"><Plus />New transfer</Link>}
      </PageHead>
      <div className="kpis">
        <Kpi label="Sent today" value={gbp(today.reduce((a, x) => a + x.sendAmount, 0))} sub={`${today.length} transfers`} to="/portal/transactions" />
        <Kpi label="Needs action" value={attention.length} sub={`${by('on_hold').length} on hold · ${cases.length} open cases`} tone={attention.length ? 'crit' : 'good'} to="/portal/compliance" />
        <Kpi label="Awaiting funds" value={by('awaiting_funds').length} sub={gbp(by('awaiting_funds').reduce((a, x) => a + x.total, 0)) + ' expected'} tone="warn" to="/portal/transactions?status=awaiting_funds" />
        <Kpi label="Customers" value={db.customers.filter((c) => c.tenantId === t.id).length} sub={`${db.customers.filter((c) => c.tenantId === t.id && riskLevel(c) === 'High').length} high risk`} to="/portal/customers" />
      </div>
      <div className="grid2">
        <Panel title="Needs your attention" actions={<span className="muted small">Open items only</span>}>
          <div className="list">
            {attention.length ? attention.slice(0, 9).map((a, i) => (
              <Link key={i} className="li" to={a.to}><SevStripe sev={a.sev} /><div className="grow"><b>{a.title}</b><small>{a.sub}</small></div></Link>
            )) : <Empty>All clear. Nothing needs action.</Empty>}
            {attention.length > 9 && <div className="li"><small>+{attention.length - 9} more</small></div>}
          </div>
        </Panel>
        <Panel title="Paid out, last 14 days" actions={<span className="num muted small">peak {gbp(mx)}</span>} pad>
          <div className="bars">{days.map((v, i) => <div key={i} style={{ height: `${(v / mx) * 100}%` }} title={gbp(v)} />)}</div>
          <div className="bar-axis"><span>{new Date(Date.now() - 13 * DAY).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span><span>Today</span></div>
        </Panel>
      </div>
      {bdc && <BureauStrip />}
      {can('transactions') && <Panel title="Latest transfers" actions={<Link to="/portal/transactions" className="small">View all</Link>}><TxTable rows={tx.slice(0, 6)} /></Panel>}
    </>
  )
}


function useBdc() {
  const { db, t } = usePortal()
  const today = db.deals.filter((d) => d.tenantId === t.id && new Date(d.at).toDateString() === new Date().toDateString())
  const open = db.reservations.filter((r) => r.tenantId === t.id && r.status === 'reserved')
  const orders = t.bureau.orders.filter((o) => o.status === 'ordered')
  const shifts = t.branches.map((b) => ({ b, s: t.bureau.shifts.find((x) => x.branchId === b.id && !x.closedAt) }))
  const curs = t.bureau.currencies || Object.keys(CURRENCIES).filter((c) => CURRENCIES[c].cash)
  const low = curs.filter((c) => t.branches.some((b) => M.stock(t, b.id, c) > 0 && M.stock(t, b.id, c) / CURRENCIES[c].rate < 500))
  return { db, t, today, open, orders, shifts, curs, low }
}
function BureauStrip() {
  const { today, open, orders, low } = useBdc()
  return (
    <Panel title="Bureau de change today" actions={<Link to="/portal/bureau" className="small">Open bureau</Link>}>
      <div className="panel-b kpis">
        <Kpi label="Deals today" value={today.length} sub={gbp(today.reduce((s, d) => s + d.gbp, 0)) + ' turnover'} />
        <Kpi label="Margin today" value={gbp2(today.reduce((s, d) => s + d.margin, 0))} tone="good" />
        <Kpi label="Reservations waiting" value={open.length} tone={open.length ? 'info' : ''} to="/portal/bureau/reservations" />
        <Kpi label="Stock orders out" value={orders.length} to="/portal/bureau/orders" />
        <Kpi label="Low stock" value={low.length ? low.join(', ') : 'none'} tone={low.length ? 'warn' : 'good'} to="/portal/bureau/stock" />
      </div>
    </Panel>
  )
}
function BureauDashboard() {
  const { db, t, today, open, orders, shifts, curs, low } = useBdc()
  const month = db.deals.filter((d) => d.tenantId === t.id && Date.now() - d.at < 30 * DAY)
  const days = Array.from({ length: 14 }, (_, i) => { const d = new Date(Date.now() - (13 - i) * DAY).toDateString(); return db.deals.filter((x) => x.tenantId === t.id && new Date(x.at).toDateString() === d).reduce((s, x) => s + x.gbp, 0) })
  const mx = Math.max(...days, 1)
  const cases = db.cases.filter((k) => k.tenantId === t.id && k.status !== 'closed')
  return (
    <>
      <PageHead title="Dashboard" sub={`${t.name} · ${new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}`}><Link className="btn pri" to="/portal/bureau"><Plus />New deal</Link></PageHead>
      <div className="kpis">
        <Kpi label="Deals today" value={today.length} sub={gbp(today.reduce((s, d) => s + d.gbp, 0)) + ' turnover'} to="/portal/bureau/deals" />
        <Kpi label="Margin today" value={gbp2(today.reduce((s, d) => s + d.margin, 0))} sub={`${gbp2(month.reduce((s, d) => s + d.margin, 0))} last 30 days`} tone="good" />
        <Kpi label="Reservations waiting" value={open.length} tone={open.length ? 'info' : ''} to="/portal/bureau/reservations" />
        <Kpi label="Needs action" value={cases.length + orders.length + low.length} tone={cases.length ? 'crit' : 'good'} sub={`${cases.length} compliance · ${orders.length} orders out · ${low.length} low stock`} />
      </div>
      <div className="grid2">
        <Panel title="Tills" actions={<Link to="/portal/bureau/shifts" className="small">Shifts</Link>}>
          <div className="tbl-wrap"><table><thead><tr><th>Branch</th><th>Shift</th><th className="r">GBP</th>{curs.slice(0, 5).map((c) => <th key={c} className="r">{c}</th>)}</tr></thead><tbody>{shifts.map(({ b, s }) => <tr key={b.id}><td><b>{b.name}</b></td><td>{s ? <span className="pill good">{s.cashier}</span> : <span className="pill mute">Closed</span>}</td><td className="r num">{gbp(M.stock(t, b.id, 'GBP'))}</td>{curs.slice(0, 5).map((c) => <td key={c} className="r num">{M.stock(t, b.id, c).toLocaleString('en-GB', { maximumFractionDigits: 0 })}</td>)}</tr>)}</tbody></table></div>
        </Panel>
        <Panel title="Turnover, last 14 days" actions={<span className="num muted small">peak {gbp(mx)}</span>} pad>
          <div className="bars">{days.map((v, i) => <div key={i} style={{ height: `${(v / mx) * 100}%` }} title={gbp(v)} />)}</div>
          <div className="bar-axis"><span>{new Date(Date.now() - 13 * DAY).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span><span>Today</span></div>
        </Panel>
      </div>
      <div className="grid2e">
        <Panel title="Rate board" actions={<Link to="/portal/bureau/board" className="small">Edit</Link>}><div className="tbl-wrap"><table><thead><tr><th>Currency</th><th className="r">We sell</th><th className="r">We buy</th></tr></thead><tbody>{curs.map((c) => { const r = M.boardRate(t, c); return r && <tr key={c}><td><b>{c}</b> <span className="muted small">{CURRENCIES[c]?.country}</span></td><td className="r num">{r.sell}</td><td className="r num">{r.buy}</td></tr> })}</tbody></table></div></Panel>
        <Panel title="Latest deals" actions={<Link to="/portal/bureau/deals" className="small">View all</Link>}><div className="list">{db.deals.filter((d) => d.tenantId === t.id).slice(0, 6).map((d) => <div className="li" key={d.id}><div className="grow"><b>{d.side === 'sell' ? 'Sold' : 'Bought'} {d.foreign.toLocaleString('en-GB')} {d.code}</b><small>{d.customerName || 'walk-in'} · {d.by} · {ago(d.at)}</small></div><span className="num">{gbp2(d.gbp)}</span></div>)}</div></Panel>
      </div>
    </>
  )
}
