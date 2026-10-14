import { useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import { Save, Plus, ArrowDownLeft, ArrowUpRight, Printer, Check } from 'lucide-react'
import { usePortal } from './PortalApp'
import { Panel, PageHead, Tabs, Modal, Field, Pill, Kpi, Empty, Toggle } from '../../components/ui'
import { act } from '../../store'
import * as E from '../../lib/engine'
import * as M from '../../lib/modules'
import { CURRENCIES, ID_DOC_TYPES } from '../../lib/reference'
import { gbp, gbp2, num, fmtDate, DAY } from '../../lib/util'

export default function Bureau() {
  const { db, t } = usePortal()
  const curs = t.bureau.currencies || Object.keys(CURRENCIES).filter((c) => CURRENCIES[c].cash)
  return (
    <>
      <PageHead title="Bureau de change" sub="Over-the-counter cash exchange: rate board, tills, stock and deals. Same compliance engine and ledger as remittance." />
      <Tabs items={[{ to: '/portal/bureau', label: 'New deal', end: true }, { to: '/portal/bureau/reservations', label: 'Reservations', count: db.reservations.filter((r) => r.tenantId === t.id && r.status === 'reserved').length }, { to: '/portal/bureau/shifts', label: 'Shifts' }, { to: '/portal/bureau/board', label: 'Rate board' }, { to: '/portal/bureau/stock', label: 'Tills & stock' }, { to: '/portal/bureau/orders', label: 'Stock orders', count: t.bureau.orders.filter((o) => o.status === 'ordered').length }, { to: '/portal/bureau/deals', label: 'Deals' }, { to: '/portal/bureau/reports', label: 'Reports' }, { to: '/portal/bureau/settings', label: 'Settings' }]} />
      <Routes>
        <Route index element={<NewDeal curs={curs} />} />
        <Route path="reservations" element={<Reservations />} />
        <Route path="shifts" element={<Shifts curs={curs} />} />
        <Route path="orders" element={<Orders curs={curs} />} />
        <Route path="reports" element={<Reports curs={curs} />} />
        <Route path="board" element={<Board curs={curs} />} />
        <Route path="stock" element={<Stock curs={curs} />} />
        <Route path="deals" element={<Deals />} />
        <Route path="settings" element={<Settings />} />
      </Routes>
    </>
  )
}

function NewDeal({ curs }) {
  const { db, t, actor } = usePortal()
  const [f, setF] = useState({ side: 'sell', code: curs[0], amount: '500', by: 'foreign', branchId: t.branches[0]?.id, customerName: '', idType: ID_DOC_TYPES[0], idNumber: '' })
  const q = M.bdcQuote(t, f.side, f.code, +f.amount || 0, f.by)
  const linked = f.customerName ? db.deals.filter((x) => x.tenantId === t.id && x.customerName?.toLowerCase() === f.customerName.toLowerCase() && Date.now() - x.at < t.bureau.linkedHours * 36e5).reduce((a, x) => a + x.gbp, 0) : 0
  const needsId = q && q.gbp + linked >= t.bureau.idThreshold
  const [done, setDone] = useState(null)
  const [receipt, setReceipt] = useState(null)
  const openShift = t.bureau.shifts.find((s) => s.branchId === f.branchId && !s.closedAt)
  const submit = () => { const d = act((dd) => M.createDeal(dd, t.id, f, actor), (d) => `Deal ${d.ref} completed`); if (d) { setDone(d); setF({ ...f, amount: '', customerName: '', idNumber: '' }) } }
  const today = db.deals.filter((x) => x.tenantId === t.id && new Date(x.at).toDateString() === new Date().toDateString())
  return (
    <div className="grid2">
      <Panel title="Deal" pad>
        <div className="stack">
          <div className="row">{[['sell', 'Customer buys currency (we sell)', ArrowUpRight], ['buy', 'Customer sells currency (we buy)', ArrowDownLeft]].map(([k, l, I]) => <button key={k} className={`btn ${f.side === k ? 'pri' : ''}`} onClick={() => setF({ ...f, side: k })}><I />{l}</button>)}</div>
          <div className="form">
            <Field label="Currency" id="bd-c"><select id="bd-c" className="sel" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })}>{curs.map((c) => <option key={c} value={c}>{c} · {CURRENCIES[c]?.country}</option>)}</select></Field>
            <Field label="Branch" id="bd-b"><select id="bd-b" className="sel" value={f.branchId} onChange={(e) => setF({ ...f, branchId: e.target.value })}>{t.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>
            <Field label={`Amount in ${f.by === 'foreign' ? f.code : 'GBP'}`} id="bd-a"><div className="row"><input id="bd-a" className="inp num" style={{ flex: 1 }} inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /><button className="btn sm" onClick={() => setF({ ...f, by: f.by === 'foreign' ? 'gbp' : 'foreign' })}>Switch to {f.by === 'foreign' ? 'GBP' : f.code}</button></div></Field>
          </div>
          {q && <div className="banner">{f.side === 'sell' ? <>Customer pays <b className="num">{gbp2(q.gbp)}</b> and receives <b className="num">{num(q.foreign)} {q.code}</b></> : <>Customer gives <b className="num">{num(q.foreign)} {q.code}</b> and receives <b className="num">{gbp2(q.gbp)}</b></>} · rate {q.rate} · in stock: {num(M.stock(t, f.branchId, q.code))} {q.code}, till {gbp(M.stock(t, f.branchId, 'GBP'))}</div>}
          <div className="form">
            <Field label={`Customer name${needsId ? ' (required)' : ' (optional)'}`} id="bd-n"><input id="bd-n" className="inp" value={f.customerName} onChange={(e) => setF({ ...f, customerName: e.target.value })} /></Field>
            <Field label="ID type" id="bd-it"><select id="bd-it" className="sel" value={f.idType} onChange={(e) => setF({ ...f, idType: e.target.value })}>{ID_DOC_TYPES.map((d) => <option key={d}>{d}</option>)}</select></Field>
            <Field label={`ID number${needsId ? ' (required)' : ''}`} id="bd-in"><input id="bd-in" className="inp mono" value={f.idNumber} onChange={(e) => setF({ ...f, idNumber: e.target.value })} /></Field>
          </div>
          {needsId && <div className="banner warn">This deal{linked ? ` plus £${num(linked)} of linked deals in the last ${t.bureau.linkedHours}h` : ''} reaches your £{t.bureau.idThreshold.toLocaleString('en-GB')} identification threshold. Record the customer's name and ID, and keep a copy.</div>}
          {!openShift && t.bureau.shifts.length > 0 && <div className="banner warn">No till shift is open at this branch. Open one under Shifts before dealing.</div>}
          <button className="btn pri" disabled={!q || !(q.gbp > 0)} onClick={submit}>Complete deal</button>
          {done && <div className="row"><p className="small muted">Last deal: <b className="mono">{done.ref}</b> · {done.side === 'sell' ? 'sold' : 'bought'} {num(done.foreign)} {done.code} for {gbp2(done.gbp)} · margin {gbp2(done.margin)}</p><button className="btn sm" onClick={() => setReceipt(done)}><Printer />Receipt</button></div>}
          {receipt && <Receipt deal={receipt} onClose={() => setReceipt(null)} />}
        </div>
      </Panel>
      <div className="stack">
        <Panel title="Today" pad>
          <div className="kpis"><Kpi label="Deals" value={today.length} /><Kpi label="Turnover" value={gbp(today.reduce((s, d) => s + d.gbp, 0))} /><Kpi label="Margin" value={gbp2(today.reduce((s, d) => s + d.margin, 0))} tone="good" /></div>
        </Panel>
        <Panel title="Board (customer-facing)"><div className="tbl-wrap"><table><thead><tr><th>Currency</th><th className="r">We sell at</th><th className="r">We buy at</th></tr></thead><tbody>{curs.map((c) => { const r = M.boardRate(t, c); return r && <tr key={c}><td><b>{c}</b> <span className="muted small">{CURRENCIES[c]?.country}</span></td><td className="r num">{r.sell}</td><td className="r num">{r.buy}</td></tr> })}</tbody></table></div></Panel>
      </div>
    </div>
  )
}

function Board({ curs }) {
  const { t, actor, role } = usePortal()
  const [edit, setEdit] = useState({})
  const canEdit = ['Admin', 'MLRO'].includes(role)
  const save = (c) => act((d) => M.setBoard(d, t.id, c, edit[c], actor), `${c} board rate saved`) && setEdit({ ...edit, [c]: undefined })
  return (
    <Panel title="Rate board" actions={<span className="muted small">Mid rates come from Platform settings ({t.bureau.spreadPct}% default spread). Override per currency here.</span>}>
      <div className="tbl-wrap"><table><thead><tr><th>Currency</th><th className="r">Mid (platform)</th><th className="r">We sell at</th><th className="r">We buy at</th><th className="r">Spread</th><th></th></tr></thead>
        <tbody>{curs.map((c) => { const r = M.boardRate(t, c); if (!r) return null; const e = edit[c]; return <tr key={c}><td><b>{c}</b> <span className="muted small">{CURRENCIES[c]?.country}</span>{r.custom && <span className="tag" style={{ marginLeft: 6 }}>custom</span>}</td><td className="r num">{r.mid}</td>
          <td className="r">{e ? <input className="inp num" style={{ width: 110, textAlign: 'right' }} value={e.sell} onChange={(ev) => setEdit({ ...edit, [c]: { ...e, sell: ev.target.value } })} aria-label={`${c} sell`} /> : <span className="num">{r.sell}</span>}</td>
          <td className="r">{e ? <input className="inp num" style={{ width: 110, textAlign: 'right' }} value={e.buy} onChange={(ev) => setEdit({ ...edit, [c]: { ...e, buy: ev.target.value } })} aria-label={`${c} buy`} /> : <span className="num">{r.buy}</span>}</td>
          <td className="r num">{(((r.buy - r.sell) / r.mid) * 100).toFixed(2)}%</td>
          <td className="r">{canEdit && (e ? <div className="row" style={{ justifyContent: 'flex-end' }}><button className="btn sm pri" onClick={() => save(c)}><Save />Save</button><button className="btn sm" onClick={() => setEdit({ ...edit, [c]: undefined })}>Cancel</button></div> : <div className="row" style={{ justifyContent: 'flex-end' }}><button className="btn sm" onClick={() => setEdit({ ...edit, [c]: { buy: r.buy, sell: r.sell } })}>Edit</button>{r.custom && <button className="btn sm ghost" onClick={() => act((d) => M.setBoard(d, t.id, c, null, actor), 'Reset to default spread')}>Reset</button>}</div>)}</td></tr> })}</tbody>
      </table></div>
    </Panel>
  )
}

function Stock({ curs }) {
  const { db, t, actor, role } = usePortal()
  const [mv, setMv] = useState(null)
  const [branch, setBranch] = useState(t.branches[0]?.id)
  const canEdit = ['Admin', 'MLRO', 'Cashier'].includes(role)
  const rows = ['GBP', ...curs]
  const bookValue = (c) => (c === 'GBP' ? M.stock(t, branch, c) : M.stock(t, branch, c) / CURRENCIES[c].rate)
  const movements = db.journals.filter((j) => j.tenantId === t.id && j.type === 'BDC' && !j.ref).slice(0, 15)
  return (
    <>
      <div className="filters"><select id="st-b" className="sel" value={branch} onChange={(e) => setBranch(e.target.value)}>{t.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
        {canEdit && <><button className="btn sm" onClick={() => setMv({ kind: 'gbp_in', branchId: branch, code: 'GBP', qty: '', gbpCost: '', supplier: '' })}><Plus />GBP float to till</button><button className="btn sm" onClick={() => setMv({ kind: 'buy_wholesale', branchId: branch, code: curs[0], qty: '', gbpCost: '', supplier: '' })}><Plus />Buy stock from wholesaler</button><button className="btn sm" onClick={() => setMv({ kind: 'sell_wholesale', branchId: branch, code: curs[0], qty: '', gbpCost: '', supplier: '' })}>Sell surplus</button><button className="btn sm" onClick={() => setMv({ kind: 'adjust', branchId: branch, code: 'GBP', qty: '', note: 'End of day count' })}>End-of-day count</button></>}
      </div>
      <Panel title={`Tills & stock — ${t.branches.find((b) => b.id === branch)?.name}`}>
        <div className="tbl-wrap"><table><thead><tr><th>Currency</th><th className="r">In till</th><th className="r">Book value (GBP)</th><th className="r">Ledger balance</th><th>Check</th></tr></thead>
          <tbody>{rows.map((c) => { const qty = M.stock(t, branch, c), led = E.balance(db, t, `till_${branch}_${c}`), bv = bookValue(c); const diff = Math.abs(led - bv); return <tr key={c}><td><b>{c}</b></td><td className="r num">{num(qty)}</td><td className="r num">{gbp2(bv)}</td><td className="r num">{gbp2(led)}</td><td>{diff < 1 ? <Pill tone="good">Reconciled</Pill> : <Pill tone="warn">Revalue {gbp2(led - bv)}</Pill>}</td></tr> })}</tbody>
        </table></div>
        <div className="panel-b muted small">Book value uses the platform mid rate; the ledger carries stock at cost. The difference is unrealised FX on your stock.</div>
      </Panel>
      <Panel title="Stock movements">{movements.length ? <div className="list">{movements.map((j) => <div className="li" key={j.id}><div className="grow"><b>{j.details}</b><small>{fmtDate(j.at)} · {j.by}</small></div><span className="num">{gbp2(j.lines[0].debit || j.lines[0].credit)}</span></div>)}</div> : <Empty>No movements yet.</Empty>}</Panel>
      {mv && <Modal title={{ gbp_in: 'GBP float to till', gbp_out: 'Bank GBP from till', buy_wholesale: 'Buy stock from wholesaler', sell_wholesale: 'Sell surplus stock', adjust: 'End-of-day count' }[mv.kind]} onClose={() => setMv(null)} footer={<><button className="btn" onClick={() => setMv(null)}>Cancel</button><button className="btn pri" onClick={() => act((d) => M.stockMovement(d, t.id, mv, actor), 'Posted') && setMv(null)}>Post</button></>}>
        <div className="form">
          {mv.kind !== 'gbp_in' && mv.kind !== 'gbp_out' && <Field label="Currency" id="mv-c"><select id="mv-c" className="sel" value={mv.code} onChange={(e) => setMv({ ...mv, code: e.target.value })}>{(mv.kind === 'adjust' ? rows : curs).map((c) => <option key={c}>{c}</option>)}</select></Field>}
          <Field label={mv.kind === 'adjust' ? `Counted amount (${mv.code})` : `Quantity (${mv.code})`} id="mv-q"><input id="mv-q" className="inp num" value={mv.qty} onChange={(e) => setMv({ ...mv, qty: e.target.value })} /></Field>
          {['buy_wholesale', 'sell_wholesale'].includes(mv.kind) && <><Field label={mv.kind === 'buy_wholesale' ? 'GBP paid' : 'GBP received'} id="mv-g"><input id="mv-g" className="inp num" value={mv.gbpCost} onChange={(e) => setMv({ ...mv, gbpCost: e.target.value })} /></Field><Field label="Wholesaler" id="mv-s"><input id="mv-s" className="inp" value={mv.supplier} onChange={(e) => setMv({ ...mv, supplier: e.target.value })} /></Field></>}
          {mv.kind === 'adjust' && <Field label="Note" id="mv-n"><input id="mv-n" className="inp" value={mv.note} onChange={(e) => setMv({ ...mv, note: e.target.value })} /></Field>}
        </div>
        {mv.kind === 'adjust' && <p className="muted small">System shows {num(M.stock(t, mv.branchId, mv.code))} {mv.code}. Any difference is posted as an over/short to bureau income.</p>}
      </Modal>}
    </>
  )
}

function Deals() {
  const { db, t } = usePortal()
  const [q, setQ] = useState('')
  const [rc, setRc] = useState(null)
  const deals = db.deals.filter((d) => d.tenantId === t.id && (!q || `${d.ref} ${d.customerName}`.toLowerCase().includes(q.toLowerCase())))
  const month = deals.filter((d) => Date.now() - d.at < 30 * DAY)
  return (
    <>
      <div className="kpis"><Kpi label="Deals, 30d" value={month.length} /><Kpi label="Turnover, 30d" value={gbp(month.reduce((s, d) => s + d.gbp, 0))} /><Kpi label="Margin, 30d" value={gbp2(month.reduce((s, d) => s + d.margin, 0))} tone="good" /><Kpi label="ID recorded" value={month.filter((d) => d.needsId).length} sub="deals over threshold" /></div>
      <div className="filters"><input id="dl-q" className="inp" placeholder="Search reference or customer" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      {rc && <Receipt deal={rc} onClose={() => setRc(null)} />}
      <Panel>{deals.length ? <div className="tbl-wrap"><table><thead><tr><th>Ref</th><th>When</th><th>Side</th><th className="r">Foreign</th><th className="r">GBP</th><th className="r">Rate</th><th className="r">Margin</th><th>Customer</th><th>Branch</th><th>By</th><th></th></tr></thead>
        <tbody>{deals.map((d) => <tr key={d.id}><td className="mono">{d.ref}</td><td className="nowrap muted">{fmtDate(d.at)}</td><td><Pill tone={d.side === 'sell' ? 'info' : 'warn'}>{d.side === 'sell' ? 'We sold' : 'We bought'}</Pill></td><td className="r num">{num(d.foreign)} {d.code}</td><td className="r num">{gbp2(d.gbp)}</td><td className="r num">{d.rate}</td><td className="r num">{gbp2(d.margin)}</td><td>{d.customerName || <span className="muted">walk-in</span>}{d.needsId && <span className="tag" style={{ marginLeft: 6 }}>{d.idType}</span>}</td><td>{t.branches.find((b) => b.id === d.branchId)?.name}</td><td className="muted">{d.by}</td><td className="r"><button className="btn sm ghost" onClick={() => setRc(d)} aria-label="Receipt"><Printer /></button></td></tr>)}</tbody></table></div> : <Empty>No deals yet.</Empty>}</Panel>
    </>
  )
}

function Settings() {
  const { t, actor, role } = usePortal()
  const [f, setF] = useState({ idThreshold: t.bureau.idThreshold, linkedHours: t.bureau.linkedHours, spreadPct: t.bureau.spreadPct, currencies: t.bureau.currencies || Object.keys(CURRENCIES).filter((c) => CURRENCIES[c].cash) })
  const [sup, setSup] = useState((t.bureau.suppliers || []).join('\n'))
  const [rh, setRh] = useState(t.bureau.reservationHours || 24)
  const canEdit = ['Admin', 'MLRO'].includes(role)
  const cash = Object.keys(CURRENCIES).filter((c) => CURRENCIES[c].cash)
  return (
    <div className="grid2">
      <Panel title="Bureau settings" actions={canEdit && <button className="btn pri sm" onClick={() => act((d) => { M.setBureauSettings(d, t.id, f, actor); const tt = d.tenants.find((x) => x.id === t.id); tt.bureau.reservationHours = +rh || 24; M.setSuppliers(d, t.id, sup.split('\n'), actor) }, 'Saved')}><Save />Save</button>} pad>
        <div className="stack">
          <div className="form">
            <Field label="Record customer ID from (£)" id="bs-t" hint="Your internal threshold for identification. Linked deals in the window below count together."><input id="bs-t" className="inp num" value={f.idThreshold} disabled={!canEdit} onChange={(e) => setF({ ...f, idThreshold: e.target.value })} /></Field>
            <Field label="Linked-deal window (hours)" id="bs-h"><input id="bs-h" className="inp num" value={f.linkedHours} disabled={!canEdit} onChange={(e) => setF({ ...f, linkedHours: e.target.value })} /></Field>
            <Field label="Default spread either side of mid (%)" id="bs-s"><input id="bs-s" className="inp num" value={f.spreadPct} disabled={!canEdit} onChange={(e) => setF({ ...f, spreadPct: e.target.value })} /></Field>
          </div>
          <div className="form"><Field label="Online reservations held for (hours)" id="bs-r" hint="Customers reserve at today's rate and collect at a branch"><input id="bs-r" className="inp num" value={rh} disabled={!canEdit} onChange={(e) => setRh(e.target.value)} /></Field></div>
          <Field label="Currencies you hold in cash"><div className="checks">{cash.map((c) => <label key={c} className="check"><input type="checkbox" disabled={!canEdit} checked={f.currencies.includes(c)} onChange={(e) => setF({ ...f, currencies: e.target.checked ? [...f.currencies, c] : f.currencies.filter((x) => x !== c) })} /><span>{c}<small>{CURRENCIES[c].country}</small></span></label>)}</div><span className="hint">Cash availability per currency is set by TheFXSoft in Platform settings.</span></Field>
        </div>
      </Panel>
      <div className="stack"><Panel title="Wholesalers" pad><textarea id="bs-sup" className="ta" value={sup} disabled={!canEdit} onChange={(e) => setSup(e.target.value)} /><span className="hint">One per line. Used when ordering stock.</span></Panel>
      <Panel title="How it works" pad>
        <ul className="small" style={{ paddingLeft: 18, margin: 0, lineHeight: 1.8 }}>
          <li>Rates: platform mid rate ± your spread, or a custom buy/sell per currency on the Rate board.</li>
          <li>Stock: buy notes from a wholesaler into a branch till; every deal moves cash between the GBP till and the currency till.</li>
          <li>Compliance: deals at or above your threshold (including linked deals) require name and ID; names are screened against the same watchlists as remittance customers.</li>
          <li>Ledger: every deal posts automatically (till accounts, bureau income). End-of-day count posts any over/short.</li>
          <li>Your MLRO sets the threshold and keeps records; the platform provides the tools.</li>
        </ul>
      </Panel></div>
    </div>
  )
}


function Receipt({ deal, onClose }) {
  const { t } = usePortal()
  const b = t.branches.find((x) => x.id === deal.branchId)
  return (
    <Modal title="Receipt" onClose={onClose} footer={<button className="btn" onClick={onClose}>Close</button>}>
      <div className="mono small" style={{ background: 'var(--surface-2)', padding: 16, borderRadius: 8, lineHeight: 1.7 }}>
        <b>{t.name}</b><br />{b?.name}{b?.address ? `, ${b.address}` : ''}<br />{t.mlr ? `HMRC MLR ${t.mlr}` : ''}<br />
        ────────────────────────<br />
        {deal.ref} · {fmtDate(deal.at)}<br />
        {deal.side === 'sell' ? 'SOLD TO CUSTOMER' : 'BOUGHT FROM CUSTOMER'}<br />
        {num(deal.foreign)} {deal.code} @ {deal.rate}<br />
        {deal.side === 'sell' ? 'Customer paid' : 'Customer received'}: {gbp2(deal.gbp)}<br />
        {deal.customerName ? `Customer: ${deal.customerName}` : ''}{deal.needsId ? ` (${deal.idType} on file)` : ''}<br />
        Served by {deal.by}<br />
        ────────────────────────<br />
        No commission. Rate includes our margin. Keep this receipt.
      </div>
    </Modal>
  )
}

function Reservations() {
  const { db, t, actor } = usePortal()
  const rows = db.reservations.filter((r) => r.tenantId === t.id)
  const [fulfil, setFulfil] = useState(null)
  const [idf, setIdf] = useState({ idType: ID_DOC_TYPES[0], idNumber: '' })
  const pill = { reserved: 'info', collected: 'good', expired: 'mute', cancelled: 'mute' }
  return (
    <>
      <div className="banner">Customers reserve currency online at today's rate and collect at a branch. The rate is honoured until the reservation expires.</div>
      <Panel title="Reservations">{rows.length ? <div className="tbl-wrap"><table><thead><tr><th>Ref</th><th>Customer</th><th>Branch</th><th>Order</th><th className="r">Rate</th><th className="r">To pay</th><th>Expires</th><th>Status</th><th></th></tr></thead>
        <tbody>{rows.map((r) => <tr key={r.id}><td className="mono">{r.ref}</td><td>{r.customerName || 'Walk-in'}</td><td>{t.branches.find((b) => b.id === r.branchId)?.name}</td><td>{r.side === 'sell' ? 'Buy' : 'Sell'} {num(r.foreign)} {r.code}</td><td className="r num">{r.rate}</td><td className="r num">{gbp2(r.gbp)}</td><td className="muted nowrap">{fmtDate(r.expiresAt)}</td><td><Pill tone={pill[r.status]}>{r.status}</Pill></td>
          <td className="r">{r.status === 'reserved' && <div className="row" style={{ justifyContent: 'flex-end' }}><button className="btn sm pri" onClick={() => setFulfil(r)}><Check />Collected</button><button className="btn sm ghost" onClick={() => act((d) => M.cancelReservation(d, r.id, actor), 'Cancelled')}>Cancel</button></div>}</td></tr>)}</tbody></table></div> : <Empty>No reservations yet.</Empty>}</Panel>
      {fulfil && <Modal title={`Collect ${fulfil.ref}`} onClose={() => setFulfil(null)} footer={<><button className="btn" onClick={() => setFulfil(null)}>Cancel</button><button className="btn pri" onClick={() => act((d) => M.fulfilReservation(d, t.id, fulfil.id, idf, actor), (deal) => `Deal ${deal.ref} completed at reserved rate`) && setFulfil(null)}>Complete deal</button></>}>
        <p className="small">{fulfil.customerName || 'Customer'} {fulfil.side === 'sell' ? 'pays' : 'receives'} <b className="num">{gbp2(fulfil.gbp)}</b> for <b className="num">{num(fulfil.foreign)} {fulfil.code}</b> at {fulfil.rate}.</p>
        {fulfil.gbp >= t.bureau.idThreshold && <div className="form"><Field label="ID type" id="rf-t"><select id="rf-t" className="sel" value={idf.idType} onChange={(e) => setIdf({ ...idf, idType: e.target.value })}>{ID_DOC_TYPES.map((d) => <option key={d}>{d}</option>)}</select></Field><Field label="ID number" id="rf-n"><input id="rf-n" className="inp mono" value={idf.idNumber} onChange={(e) => setIdf({ ...idf, idNumber: e.target.value })} /></Field></div>}
      </Modal>}
    </>
  )
}

function Shifts({ curs }) {
  const { db, t, actor } = usePortal()
  const [branch, setBranch] = useState(t.branches[0]?.id)
  const open = t.bureau.shifts.find((s) => s.branchId === branch && !s.closedAt)
  const [counts, setCounts] = useState({})
  const [mode, setMode] = useState(null) // 'open' | 'close'
  const rows = ['GBP', ...curs]
  const submit = () => {
    if (mode === 'open') act((d) => M.openShift(d, t.id, { branchId: branch, counts }, actor), 'Shift opened')
    else act((d) => M.closeShift(d, t.id, open.id, counts, actor), 'Shift closed')
    setMode(null); setCounts({})
  }
  const dealsInShift = open ? db.deals.filter((x) => x.tenantId === t.id && x.branchId === branch && x.at >= open.openedAt) : []
  return (
    <>
      <div className="filters"><select id="sh-b" className="sel" value={branch} onChange={(e) => setBranch(e.target.value)}>{t.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
        {open ? <><Pill tone="good">Shift open · {open.cashier} since {fmtDate(open.openedAt)}</Pill><button className="btn sm pri" onClick={() => setMode('close')}>Close shift (count till)</button></> : <button className="btn sm pri" onClick={() => setMode('open')}>Open shift</button>}</div>
      {open && <div className="kpis"><Kpi label="Deals this shift" value={dealsInShift.length} /><Kpi label="Turnover" value={gbp(dealsInShift.reduce((s, d) => s + d.gbp, 0))} /><Kpi label="Margin" value={gbp2(dealsInShift.reduce((s, d) => s + d.margin, 0))} tone="good" /><Kpi label="GBP in till" value={gbp2(M.stock(t, branch, 'GBP'))} /></div>}
      <Panel title="Shift history">{t.bureau.shifts.filter((s) => s.branchId === branch).length ? <div className="tbl-wrap"><table><thead><tr><th>Opened</th><th>Cashier</th><th>Closed</th><th className="r">Deals</th><th>Variance</th></tr></thead>
        <tbody>{t.bureau.shifts.filter((s) => s.branchId === branch).map((s) => <tr key={s.id}><td className="nowrap">{fmtDate(s.openedAt)}</td><td>{s.cashier}</td><td className="nowrap">{s.closedAt ? `${fmtDate(s.closedAt)} · ${s.closedBy}` : <Pill tone="good">Open</Pill>}</td><td className="r num">{s.deals ?? dealsInShift.length}</td><td>{s.variance ? (Object.entries(s.variance).filter(([, v]) => v).map(([c, v]) => <Pill key={c} tone={Math.abs(v) < 1 ? 'good' : 'warn'}>{c} {v > 0 ? '+' : ''}{v}</Pill>).length ? Object.entries(s.variance).filter(([, v]) => v).map(([c, v]) => <Pill key={c} tone="warn">{c} {v > 0 ? '+' : ''}{v}</Pill>) : <Pill tone="good">Balanced</Pill>) : '—'}</td></tr>)}</tbody></table></div> : <Empty>No shifts yet at this branch.</Empty>}</Panel>
      {mode && <Modal title={mode === 'open' ? 'Open shift: count the till' : 'Close shift: count the till'} onClose={() => setMode(null)} footer={<><button className="btn" onClick={() => setMode(null)}>Cancel</button><button className="btn pri" onClick={submit}>{mode === 'open' ? 'Open shift' : 'Close shift'}</button></>}>
        <p className="muted small">Enter what is physically in the till. Leave blank to accept the system figure. Any difference is posted as an over/short.</p>
        <div className="tbl-wrap"><table><thead><tr><th>Currency</th><th className="r">System</th><th className="r">Counted</th></tr></thead><tbody>{rows.map((c) => <tr key={c}><td><b>{c}</b></td><td className="r num">{num(M.stock(t, branch, c))}</td><td className="r"><input className="inp num" style={{ width: 130, textAlign: 'right' }} value={counts[c] ?? ''} onChange={(e) => setCounts({ ...counts, [c]: e.target.value })} aria-label={`${c} counted`} /></td></tr>)}</tbody></table></div>
      </Modal>}
    </>
  )
}

function Orders({ curs }) {
  const { t, actor, role } = usePortal()
  const [f, setF] = useState(null)
  const canEdit = ['Admin', 'MLRO', 'Cashier', 'Bureau cashier'].includes(role)
  return (
    <>
      <Panel title="Stock orders from wholesalers" actions={canEdit && <button className="btn sm pri" onClick={() => setF({ branchId: t.branches[0]?.id, code: curs[0], qty: '', gbpCost: '', supplier: t.bureau.suppliers[0] || '', expected: '' })}><Plus />New order</button>}>
        {t.bureau.orders.length ? <div className="tbl-wrap"><table><thead><tr><th>Ref</th><th>Ordered</th><th>Supplier</th><th>Branch</th><th className="r">Quantity</th><th className="r">GBP cost</th><th className="r">Implied rate</th><th>Expected</th><th>Status</th><th></th></tr></thead>
          <tbody>{t.bureau.orders.map((o) => <tr key={o.id}><td className="mono">{o.ref}</td><td className="nowrap muted">{fmtDate(o.createdAt, false)}</td><td>{o.supplier}</td><td>{t.branches.find((b) => b.id === o.branchId)?.name}</td><td className="r num">{num(o.qty)} {o.code}</td><td className="r num">{gbp2(o.gbpCost)}</td><td className="r num">{(o.qty / o.gbpCost).toFixed(4)}</td><td>{o.expected || '—'}</td><td><Pill tone={{ ordered: 'warn', received: 'good', cancelled: 'mute' }[o.status]}>{o.status}</Pill></td>
            <td className="r">{o.status === 'ordered' && canEdit && <div className="row" style={{ justifyContent: 'flex-end' }}><button className="btn sm pri" onClick={() => act((d) => M.receiveStockOrder(d, t.id, o.id, actor), 'Stock received into till')}>Received</button><button className="btn sm ghost" onClick={() => act((d) => M.cancelStockOrder(d, t.id, o.id, actor), 'Cancelled')}>Cancel</button></div>}</td></tr>)}</tbody></table></div> : <Empty>No orders yet.</Empty>}
      </Panel>
      {f && <Modal title="Order stock" onClose={() => setF(null)} footer={<><button className="btn" onClick={() => setF(null)}>Cancel</button><button className="btn pri" onClick={() => act((d) => M.createStockOrder(d, t.id, f, actor), 'Order recorded') && setF(null)}>Record order</button></>}>
        <div className="form">
          <Field label="Supplier" id="po-s"><select id="po-s" className="sel" value={f.supplier} onChange={(e) => setF({ ...f, supplier: e.target.value })}>{t.bureau.suppliers.map((x) => <option key={x}>{x}</option>)}</select></Field>
          <Field label="Branch" id="po-b"><select id="po-b" className="sel" value={f.branchId} onChange={(e) => setF({ ...f, branchId: e.target.value })}>{t.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>
          <Field label="Currency" id="po-c"><select id="po-c" className="sel" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })}>{curs.map((c) => <option key={c}>{c}</option>)}</select></Field>
          <Field label="Quantity" id="po-q"><input id="po-q" className="inp num" value={f.qty} onChange={(e) => setF({ ...f, qty: e.target.value })} /></Field>
          <Field label="Agreed GBP cost" id="po-g" hint={f.qty && f.gbpCost ? `rate ${(f.qty / f.gbpCost).toFixed(4)} vs mid ${CURRENCIES[f.code]?.rate}` : ''}><input id="po-g" className="inp num" value={f.gbpCost} onChange={(e) => setF({ ...f, gbpCost: e.target.value })} /></Field>
          <Field label="Expected delivery" id="po-e"><input id="po-e" className="inp" value={f.expected} onChange={(e) => setF({ ...f, expected: e.target.value })} placeholder="e.g. Thursday am" /></Field>
        </div>
      </Modal>}
    </>
  )
}

function Reports({ curs }) {
  const { db, t } = usePortal()
  const deals = db.deals.filter((d) => d.tenantId === t.id && Date.now() - d.at < 30 * DAY)
  const byCur = curs.map((c) => { const ds = deals.filter((d) => d.code === c); return { c, n: ds.length, sold: ds.filter((d) => d.side === 'sell').reduce((s, d) => s + d.foreign, 0), bought: ds.filter((d) => d.side === 'buy').reduce((s, d) => s + d.foreign, 0), gbp: ds.reduce((s, d) => s + d.gbp, 0), margin: ds.reduce((s, d) => s + d.margin, 0) } }).sort((a, b) => b.gbp - a.gbp)
  const byCashier = Object.entries(deals.reduce((m, d) => { m[d.by] = m[d.by] || { n: 0, gbp: 0, margin: 0 }; m[d.by].n++; m[d.by].gbp += d.gbp; m[d.by].margin += d.margin; return m }, {}))
  const stockVal = (t.bureau.currencies || curs).reduce((s, c) => s + M.stock(t, t.branches[0]?.id, c) / CURRENCIES[c].rate, 0) + t.branches.slice(1).reduce((s, b) => s + (t.bureau.currencies || curs).reduce((x, c) => x + M.stock(t, b.id, c) / CURRENCIES[c].rate, 0), 0)
  const mx = Math.max(...byCur.map((x) => x.gbp), 1)
  const big = deals.filter((d) => d.needsId)
  return (
    <>
      <div className="kpis"><Kpi label="Deals, 30d" value={deals.length} /><Kpi label="Turnover, 30d" value={gbp(deals.reduce((s, d) => s + d.gbp, 0))} /><Kpi label="Margin, 30d" value={gbp2(deals.reduce((s, d) => s + d.margin, 0))} tone="good" sub={deals.length ? `${((deals.reduce((s, d) => s + d.margin, 0) / deals.reduce((s, d) => s + d.gbp, 0)) * 100).toFixed(2)}% of turnover` : ''} /><Kpi label="Foreign stock value" value={gbp(stockVal)} sub="at mid rate" /><Kpi label="ID-recorded deals" value={big.length} sub="over threshold" /></div>
      <div className="grid2e">
        <Panel title="By currency (30 days)"><div className="tbl-wrap"><table><thead><tr><th>Currency</th><th className="r">Deals</th><th className="r">Sold</th><th className="r">Bought</th><th className="r">Turnover</th><th className="r">Margin</th></tr></thead><tbody>{byCur.map((x) => <tr key={x.c}><td><b>{x.c}</b><div className="track" style={{ height: 4, marginTop: 4 }}><div className="fill" style={{ width: `${(x.gbp / mx) * 100}%`, height: '100%' }} /></div></td><td className="r num">{x.n}</td><td className="r num">{num(x.sold)}</td><td className="r num">{num(x.bought)}</td><td className="r num">{gbp(x.gbp)}</td><td className="r num">{gbp2(x.margin)}</td></tr>)}</tbody></table></div></Panel>
        <Panel title="By cashier (30 days)"><div className="tbl-wrap"><table><thead><tr><th>Cashier</th><th className="r">Deals</th><th className="r">Turnover</th><th className="r">Margin</th></tr></thead><tbody>{byCashier.map(([n, x]) => <tr key={n}><td><b>{n}</b></td><td className="r num">{x.n}</td><td className="r num">{gbp(x.gbp)}</td><td className="r num">{gbp2(x.margin)}</td></tr>)}</tbody></table></div></Panel>
      </div>
      <Panel title="Deals with ID recorded (MLR register)" actions={<span className="muted small">Keep for 5 years</span>}>{big.length ? <div className="tbl-wrap"><table><thead><tr><th>Ref</th><th>When</th><th>Customer</th><th>ID</th><th>Deal</th><th className="r">GBP</th></tr></thead><tbody>{big.map((d) => <tr key={d.id}><td className="mono">{d.ref}</td><td className="nowrap muted">{fmtDate(d.at)}</td><td>{d.customerName}</td><td>{d.idType} {d.idNumber}</td><td>{d.side} {num(d.foreign)} {d.code}</td><td className="r num">{gbp2(d.gbp)}</td></tr>)}</tbody></table></div> : <Empty>None in the period.</Empty>}</Panel>
    </>
  )
}
