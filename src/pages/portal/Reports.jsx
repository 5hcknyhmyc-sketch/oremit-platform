import { Download } from 'lucide-react'
import { usePortal } from './PortalApp'
import { Panel, PageHead, Kpi } from '../../components/ui'
import { TX_STATUS, CURRENCIES } from '../../lib/reference'
import { gbp, DAY, toCsv, download } from '../../lib/util'

export default function Reports() {
  const { db, t } = usePortal()
  const tx = db.transactions.filter((x) => x.tenantId === t.id && Date.now() - x.createdAt < 30 * DAY)
  const paid = tx.filter((x) => x.status === 'paid')
  const vol = paid.reduce((a, x) => a + x.sendAmount, 0)
  const fees = paid.reduce((a, x) => a + x.fee, 0)
  const fx = paid.reduce((a, x) => a + x.sendAmount * ((t.corridors.find((c) => c.cur === x.cur)?.margin || 0) / 100), 0)
  const byCur = t.corridors.map((c) => ({ cur: c.cur, n: paid.filter((x) => x.cur === c.cur).length, v: paid.filter((x) => x.cur === c.cur).reduce((a, x) => a + x.sendAmount, 0) })).sort((a, b) => b.v - a.v)
  const mx = Math.max(...byCur.map((b) => b.v), 1)
  const cases = db.cases.filter((k) => k.tenantId === t.id && Date.now() - k.createdAt < 30 * DAY)
  const byRule = {}
  cases.forEach((k) => k.hits.forEach((h) => { byRule[h.name] = (byRule[h.name] || 0) + 1 }))
  const rules = Object.entries(byRule).sort((a, b) => b[1] - a[1])
  const held = tx.filter((x) => x.history.some((h) => h.status === 'on_hold'))
  const avgHold = held.length ? held.reduce((a, x) => { const on = x.history.find((h) => h.status === 'on_hold'), off = x.history.find((h) => h.at > on.at && h.status !== 'on_hold'); return a + ((off ? off.at : Date.now()) - on.at) }, 0) / held.length / 36e5 : 0
  const exportMlr = () => download(`mlro-report-${t.slug}.csv`, toCsv([
    { metric: 'Transfers (30d)', value: tx.length }, { metric: 'Paid volume GBP', value: Math.round(vol) }, { metric: 'Cases opened', value: cases.length }, { metric: 'Cases closed', value: cases.filter((k) => k.status === 'closed').length },
    { metric: 'Transfers rejected', value: tx.filter((x) => x.status === 'refunded').length }, { metric: 'Internal SARs', value: db.sars.filter((s) => s.tenantId === t.id && Date.now() - s.createdAt < 30 * DAY).length },
    { metric: 'SARs filed with NCA', value: db.sars.filter((s) => s.tenantId === t.id && ['filed', 'daml_requested'].includes(s.status)).length }, { metric: 'KYC incomplete customers', value: db.customers.filter((c) => c.tenantId === t.id && c.kyc.status !== 'verified').length },
    ...rules.map(([r, n]) => ({ metric: `Rule: ${r}`, value: n })),
  ]))
  return (
    <>
      <PageHead title="Reports" sub="Last 30 days."><button className="btn" onClick={exportMlr}><Download />MLRO report (CSV)</button></PageHead>
      <div className="kpis">
        <Kpi label="Paid volume" value={gbp(vol)} sub={`${paid.length} transfers`} />
        <Kpi label="Fee income" value={gbp(fees)} />
        <Kpi label="FX margin income" value={gbp(fx)} sub="estimated" />
        <Kpi label="Avg. ticket" value={gbp(paid.length ? vol / paid.length : 0)} />
        <Kpi label="Avg. time on hold" value={`${avgHold.toFixed(1)}h`} sub={`${held.length} transfers held`} />
      </div>
      <div className="grid2e">
        <Panel title="Volume by corridor" pad>{byCur.map((b) => <div className="hbar" key={b.cur}><span>GBP → {b.cur} <span className="muted small">{CURRENCIES[b.cur]?.country}</span></span><div className="track"><div className="fill" style={{ width: `${(b.v / mx) * 100}%` }} /></div><span className="num" style={{ textAlign: 'right' }}>{gbp(b.v)} <span className="muted small">· {b.n}</span></span></div>)}</Panel>
        <Panel title="Transfers by status" pad>{Object.entries(TX_STATUS).map(([k, v]) => { const n = tx.filter((x) => x.status === k).length; return n ? <div className="hbar" key={k}><span>{v.label}</span><div className="track"><div className="fill" style={{ width: `${(n / tx.length) * 100}%`, background: `var(--${v.tone === 'mute' ? 'muted' : v.tone})` }} /></div><span className="num" style={{ textAlign: 'right' }}>{n}</span></div> : null })}</Panel>
        <Panel title="Cases by rule" pad>{rules.length ? rules.map(([r, n]) => <div className="hbar" key={r}><span className="small">{r}</span><div className="track"><div className="fill" style={{ width: `${(n / rules[0][1]) * 100}%` }} /></div><span className="num" style={{ textAlign: 'right' }}>{n}</span></div>) : <p className="muted">No cases in the period.</p>}</Panel>
        <Panel title="Compliance summary" pad>
          <dl className="dl">
            <dt>Cases opened</dt><dd>{cases.length}</dd><dt>Closed</dt><dd>{cases.filter((k) => k.status === 'closed').length}</dd>
            <dt>Released after review</dt><dd>{cases.filter((k) => k.outcome?.startsWith('Released')).length}</dd><dt>Rejected & refunded</dt><dd>{cases.filter((k) => k.outcome?.startsWith('Rejected')).length}</dd>
            <dt>Internal SARs</dt><dd>{db.sars.filter((s) => s.tenantId === t.id).length}</dd><dt>Reported to NCA</dt><dd>{db.sars.filter((s) => s.tenantId === t.id && ['filed', 'daml_requested'].includes(s.status)).length}</dd>
          </dl>
        </Panel>
      </div>
    </>
  )
}
