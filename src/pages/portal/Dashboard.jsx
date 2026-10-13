import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { usePortal } from './PortalApp'
import { Kpi, Panel, PageHead, SevStripe, Empty } from '../../components/ui'
import { TxTable } from './Transactions'
import { gbp, DAY, ago } from '../../lib/util'
import { partnerById } from '../../lib/reference'
import { riskLevel } from '../../lib/rules'

export default function Dashboard() {
  const { db, t, can } = usePortal()
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

  const attention = [
    ...cases.map((k) => ({ sev: k.severity, title: `${k.ref} · ${k.title}`, sub: `${db.customers.find((c) => c.id === k.customerId)?.name} · ${k.status === 'escalated' ? 'with MLRO' : 'opened ' + ago(k.createdAt)}`, to: `/portal/compliance/cases/${k.id}`, need: 'compliance' })),
    ...by('pending_release').map((x) => ({ sev: 'medium', title: `${x.ref} ready to release`, sub: x.note || `£${x.sendAmount} · above auto-release limit`, to: `/portal/transactions?status=pending_release`, need: 'transactions' })),
    ...unmatched.map((p) => ({ sev: 'medium', title: `Unmatched payment £${p.amount.toFixed(2)}`, sub: `From ${p.payer} · reference “${p.reference || 'none'}”`, to: '/portal/payments', need: 'payments' })),
    ...kycPending.map((c) => ({ sev: 'low', title: `Documents to review: ${c.name}`, sub: c.kyc.docs.filter((d) => d.status === 'pending').map((d) => d.type).join(', '), to: `/portal/customers/${c.id}`, need: 'customers' })),
    ...sars.map((s) => ({ sev: 'high', title: `${s.ref} waiting for MLRO decision`, sub: s.grounds.slice(0, 90) + '…', to: '/portal/compliance/sars', need: 'compliance' })),
    ...lowBal.map(([p, b]) => ({ sev: 'medium', title: `Low prefunding: ${partnerById(db, p)?.name}`, sub: `${gbp(b)} left`, to: '/portal/treasury', need: 'treasury' })),
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
      {can('transactions') && <Panel title="Latest transfers" actions={<Link to="/portal/transactions" className="small">View all</Link>}><TxTable rows={tx.slice(0, 6)} /></Panel>}
    </>
  )
}
