import { useState } from 'react'
import { usePortal } from './PortalApp'
import { Panel, PageHead, Modal, Field, Pill, Kpi, Empty } from '../../components/ui'
import { act } from '../../store'
import * as E from '../../lib/engine'
import { PARTNERS, partnerById } from '../../lib/reference'
import { gbp, gbp2, fmtDate, DAY } from '../../lib/util'

export default function Treasury() {
  const { db, t, actor, role } = usePortal()
  const [top, setTop] = useState(null)
  const tx = db.transactions.filter((x) => x.tenantId === t.id)
  const partners = t.partners.map(partnerById).filter(Boolean)
  const weekOut = (pid) => tx.filter((x) => x.partnerId === pid && ['released', 'paid'].includes(x.status) && Date.now() - x.updatedAt < 7 * DAY).reduce((a, x) => a + x.sendAmount, 0)
  const held = tx.filter((x) => ['funds_received', 'on_hold', 'pending_release'].includes(x.status)).reduce((a, x) => a + x.total, 0)
  const waiting = tx.filter((x) => x.status === 'pending_release' && x.note?.startsWith('Waiting'))
  return (
    <>
      <PageHead title="Partners & Treasury" sub="Prefunded balances with payout partners, and client money held." />
      <div className="kpis">
        <Kpi label="Total prefunded" value={gbp(Object.values(t.treasury).reduce((a, b) => a + b, 0))} sub={`across ${partners.length} partners`} />
        <Kpi label="Client money held" value={gbp(held)} sub="received, not yet paid out" tone="info" />
        <Kpi label="Paid out, 7 days" value={gbp(partners.reduce((a, p) => a + weekOut(p.id), 0))} />
        <Kpi label="Waiting for prefunding" value={waiting.length} tone={waiting.length ? 'crit' : 'good'} sub={waiting.length ? gbp(waiting.reduce((a, x) => a + x.sendAmount, 0)) + ' stuck' : 'nothing stuck'} />
      </div>
      <Panel title="Payout partners">
        <div className="tbl-wrap"><table>
          <thead><tr><th>Partner</th><th>Currencies</th><th>Methods</th><th className="r">Balance</th><th className="r">Paid out, 7d</th><th>Runway</th><th></th></tr></thead>
          <tbody>{partners.map((p) => {
            const bal = t.treasury[p.id] || 0, wk = weekOut(p.id), days = wk ? Math.round((bal / (wk / 7))) : null
            return <tr key={p.id}><td><b>{p.name}</b></td><td className="mono">{p.cur.join(', ')}</td><td className="small">{p.methods.join(', ')}</td><td className="r num">{gbp2(bal)}</td><td className="r num">{gbp(wk)}</td>
              <td>{days === null ? <Pill tone="mute">No activity</Pill> : days < 3 ? <Pill tone="crit">~{days} days</Pill> : days < 7 ? <Pill tone="warn">~{days} days</Pill> : <Pill tone="good">~{days} days</Pill>}</td>
              <td className="r">{['Admin', 'MLRO'].includes(role) && <button className="btn sm pri" onClick={() => setTop(p)}>Top up</button>}</td></tr>
          })}</tbody>
        </table></div>
      </Panel>
      <div className="grid2e">
        <Panel title="Safeguarding account" pad>
          <dl className="dl"><dt>Account name</dt><dd>{t.bank.name}</dd><dt>Sort code</dt><dd className="mono">{t.bank.sortCode}</dd><dt>Account number</dt><dd className="mono">{t.bank.account}</dd></dl>
          <p className="muted small" style={{ marginTop: 10 }}>Customer funds stay here until the partner confirms payout. In production the balance and credits come from your bank's API.</p>
        </Panel>
        <Panel title="Top-up history">
          {t.topUps.length ? <div className="list">{t.topUps.slice(0, 8).map((u) => <div className="li" key={u.id}><div className="grow"><b>{gbp2(u.amount)} → {partnerById(u.partnerId)?.name}</b><small>{u.by} · {fmtDate(u.at)}</small></div></div>)}</div> : <Empty>No top-ups recorded yet.</Empty>}
        </Panel>
      </div>
      {top && <TopUp p={top} onClose={() => setTop(null)} />}
    </>
  )
}
function TopUp({ p, onClose }) {
  const { t, actor } = usePortal()
  const [a, setA] = useState('')
  const ok = () => act((d) => E.topUp(d, t.id, p.id, +a, actor), `Prefunded ${gbp(+a)} with ${p.name}`) && onClose()
  return (
    <Modal title={`Top up ${p.name}`} onClose={onClose} footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn pri" onClick={ok}>Record top-up</button></>}>
      <p className="muted small">Records the prefunding transfer you've sent to the partner. Transfers waiting on this partner are released automatically if they qualify.</p>
      <Field label="Amount (£)" id="tu-a"><input id="tu-a" className="inp num" inputMode="decimal" value={a} onChange={(e) => setA(e.target.value)} autoFocus /></Field>
    </Modal>
  )
}
