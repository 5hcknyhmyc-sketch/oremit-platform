import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Send, CheckCircle2 } from 'lucide-react'
import { usePortal } from './PortalApp'
import { Panel, PageHead, Pill, Empty, Kpi } from '../../components/ui'
import { act } from '../../store'
import * as G from '../../lib/growth'
import { fmtDate, gbp2, ago } from '../../lib/util'

const TONE = { open: 'warn', answered: 'good', closed: 'mute' }
const LABEL = { open: 'Waiting for reply', answered: 'Replied', closed: 'Closed' }

export default function Support() {
  const { db, t, actor } = usePortal()
  const all = (db.tickets || []).filter((k) => k.tenantId === t.id)
  const [filter, setFilter] = useState('open')
  const [sel, setSel] = useState(all[0]?.id || null)
  const [reply, setReply] = useState('')
  const rows = all.filter((k) => (filter === 'all' ? true : filter === 'open' ? k.status !== 'closed' : k.status === filter))
  const tk = all.find((k) => k.id === sel)
  const cust = tk && db.customers.find((c) => c.id === tk.customerId)
  const tx = tk?.txId && db.transactions.find((x) => x.id === tk.txId)
  const waiting = all.filter((k) => k.status === 'open')
  const oldest = waiting.length ? Math.min(...waiting.map((k) => k.updatedAt)) : null
  const send = () => act((d) => G.replyTicket(d, tk.id, reply, actor, true), 'Reply sent — the customer gets a notification') && setReply('')
  return (
    <>
      <PageHead title="Support" sub="Queries your customers raise from the app. Replies go back to them as notifications and email." />
      <div className="kpis">
        <Kpi label="Waiting for reply" value={waiting.length} tone={waiting.length ? 'warn' : 'good'} sub={oldest ? `Oldest ${ago(oldest)}` : 'All answered'} />
        <Kpi label="Replied, awaiting customer" value={all.filter((k) => k.status === 'answered').length} />
        <Kpi label="Closed this month" value={all.filter((k) => k.status === 'closed' && Date.now() - k.updatedAt < 30 * 86400000).length} />
      </div>
      <div className="grid2">
        <Panel title="Queries" actions={<select className="sel" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter"><option value="open">Open</option><option value="answered">Replied</option><option value="closed">Closed</option><option value="all">All</option></select>}>
          {rows.length ? <div className="list">{rows.map((k) => { const c = db.customers.find((x) => x.id === k.customerId); return <button key={k.id} className="li" style={{ background: k.id === sel ? 'var(--surface-2)' : 'none', border: 0, borderBottom: '1px solid var(--line)', textAlign: 'left', cursor: 'pointer', width: '100%' }} onClick={() => setSel(k.id)}><div className="grow"><b>{k.subject}</b><small>{k.ref} · {c?.name} · {ago(k.updatedAt)}</small></div><Pill tone={TONE[k.status]}>{LABEL[k.status]}</Pill></button> })}</div> : <Empty>No queries here.</Empty>}
        </Panel>
        {tk ? <Panel title={<div><h2>{tk.ref} · {tk.subject}</h2><span className="muted small"><Link to={`/portal/customers/${cust?.id}`}>{cust?.name}</Link> · opened {fmtDate(tk.createdAt)}{tx && <> · about <Link to={`/portal/transactions/${tx.id}`}>{tx.ref}</Link> ({gbp2(tx.sendAmount)})</>}</span></div>} actions={tk.status !== 'closed' && <button className="btn sm" onClick={() => act((d) => G.closeTicket(d, tk.id, actor), 'Closed')}><CheckCircle2 />Close</button>} pad>
          <div className="stack-s">
            <div className="ai-msgs" style={{ padding: 0, maxHeight: 420 }}>{tk.messages.map((m, i) => <div key={i} className={`ai-msg ${m.staff ? 'user' : 'bot'}`} style={{ alignSelf: m.staff ? 'flex-end' : 'flex-start' }}><small style={{ display: 'block', opacity: 0.8 }}>{m.by} · {fmtDate(m.at)}</small>{m.text}</div>)}</div>
            {tk.status !== 'closed' && <div className="promo-row"><textarea className="ta" rows={2} style={{ minHeight: 0 }} placeholder="Reply to the customer…" value={reply} onChange={(e) => setReply(e.target.value)} aria-label="Reply" /><button className="btn pri" onClick={send} disabled={!reply.trim()}><Send />Send</button></div>}
          </div>
        </Panel> : <Panel><Empty>Pick a query to read and reply.</Empty></Panel>}
      </div>
    </>
  )
}
