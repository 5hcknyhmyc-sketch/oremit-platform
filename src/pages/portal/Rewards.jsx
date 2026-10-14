import { useState } from 'react'
import { Save } from 'lucide-react'
import { usePortal } from './PortalApp'
import { Panel, PageHead, Field, Kpi, Toggle, Empty } from '../../components/ui'
import { act } from '../../store'
import * as M from '../../lib/modules'
import { gbp2 } from '../../lib/util'

export default function Rewards() {
  const { db, t, actor, role } = usePortal()
  const [f, setF] = useState({ ...t.rewards })
  const custs = db.customers.filter((c) => c.tenantId === t.id && (c.points || 0) > 0).sort((a, b) => b.points - a.points)
  const totalPts = custs.reduce((s, c) => s + c.points, 0)
  const canEdit = role === 'Admin'
  return (
    <>
      <PageHead title="Rewards" sub="Loyalty points and referral bonuses. Points show in the customer app and can be redeemed as fee credit." />
      <div className="kpis">
        <Kpi label="Programme" value={t.rewards.enabled ? 'On' : 'Off'} tone={t.rewards.enabled ? 'good' : ''} />
        <Kpi label="Points outstanding" value={totalPts.toLocaleString('en-GB')} sub={`liability ${gbp2(totalPts / (t.rewards.redeemRate || 100))}`} />
        <Kpi label="Customers with points" value={custs.length} />
      </div>
      <div className="grid2">
        <Panel title="Rules" actions={canEdit && <button className="btn pri sm" onClick={() => act((d) => M.setRewards(d, t.id, f, actor), 'Rewards saved')}><Save />Save</button>} pad>
          <div className="stack">
            <div className="row"><Toggle on={f.enabled} disabled={!canEdit} onChange={(v) => setF({ ...f, enabled: v })} label="Enable rewards" /><span>Programme enabled</span></div>
            <div className="form">
              <Field label="Points per £1 sent (paid transfers)" id="rw-p"><input id="rw-p" className="inp num" value={f.pointsPerPound} disabled={!canEdit} onChange={(e) => setF({ ...f, pointsPerPound: e.target.value })} /></Field>
              <Field label="Points needed per £1 credit" id="rw-r"><input id="rw-r" className="inp num" value={f.redeemRate} disabled={!canEdit} onChange={(e) => setF({ ...f, redeemRate: e.target.value })} /></Field>
              <Field label="Referral bonus (£ credit)" id="rw-b" hint="Given when a referred friend completes a first transfer"><input id="rw-b" className="inp num" value={f.referralBonus} disabled={!canEdit} onChange={(e) => setF({ ...f, referralBonus: e.target.value })} /></Field>
            </div>
            <p className="muted small">Credit reduces the fee on a customer's next transfers. Points are not cash and carry no regulatory value; keep the terms in your customer policy.</p>
          </div>
        </Panel>
        <Panel title="Top balances">{custs.length ? <div className="tbl-wrap"><table><thead><tr><th>Customer</th><th className="r">Points</th><th className="r">Worth</th><th className="r">Credit</th></tr></thead><tbody>{custs.slice(0, 12).map((c) => <tr key={c.id}><td>{c.name}</td><td className="r num">{c.points.toLocaleString('en-GB')}</td><td className="r num">{gbp2(c.points / (t.rewards.redeemRate || 100))}</td><td className="r num">{gbp2(c.credit || 0)}</td></tr>)}</tbody></table></div> : <Empty>No points earned yet.</Empty>}</Panel>
      </div>
    </>
  )
}
