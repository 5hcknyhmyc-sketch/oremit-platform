import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Search } from 'lucide-react'
import { usePortal } from './PortalApp'
import { Panel, PageHead, TxStatus, Empty } from '../../components/ui'
import { TX_STATUS, PLATFORM } from '../../lib/reference'
import { gbp2, num, fmtDate } from '../../lib/util'

export default function TrackerPage() {
  const { db, t } = usePortal()
  const [q, setQ] = useState('')
  const [res, setRes] = useState(null)
  const find = () => { const x = db.transactions.find((k) => k.tenantId === t.id && k.ref.toLowerCase() === q.trim().toLowerCase()); setRes(x || false) }
  const url = `https://${t.domain || `${t.slug}.${PLATFORM.domain}`}/track`
  return (
    <>
      <PageHead title="Tracker" sub="Look up a transfer by reference. Customers can do the same on your public tracking page without signing in." />
      <div className="grid2">
        <Panel pad>
          <div className="row"><input id="trk" className="inp" style={{ flex: 1 }} placeholder="Reference, e.g. NGR-AB12CD" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && find()} /><button className="btn pri" onClick={find}><Search />Track</button></div>
          {res === false && <Empty>No transfer with that reference.</Empty>}
          {res && <div className="stack-s" style={{ marginTop: 14 }}>
            <div className="row"><b className="mono">{res.ref}</b><TxStatus s={res.status} /></div>
            <dl className="dl"><dt>Amount</dt><dd className="num">{gbp2(res.sendAmount)} → {num(res.receiveAmount)} {res.cur}</dd><dt>Created</dt><dd>{fmtDate(res.createdAt)}</dd><dt>Last update</dt><dd>{fmtDate(res.updatedAt)} · {TX_STATUS[res.status].label}</dd></dl>
            <Link className="small" to={`/portal/transactions/${res.id}`}>Open full details →</Link>
          </div>}
        </Panel>
        <Panel title="Public tracking page" pad>
          <p className="small">Customers can enter their reference on your branded page. It shows only the customer-facing status, never internal compliance states.</p>
          <div className="linkbox" style={{ marginTop: 10 }}><code>{url}</code><Link className="btn sm" to={`/app/${t.slug}/track`}>Open demo page</Link></div>
        </Panel>
      </div>
    </>
  )
}
