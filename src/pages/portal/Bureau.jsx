import { useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import { Save, Plus, ArrowDownLeft, ArrowUpRight } from 'lucide-react'
import { usePortal } from './PortalApp'
import { Panel, PageHead, Tabs, Modal, Field, Pill, Kpi, Empty } from '../../components/ui'
import { act } from '../../store'
import * as E from '../../lib/engine'
import * as M from '../../lib/modules'
import { CURRENCIES, ID_DOC_TYPES } from '../../lib/reference'
import { gbp, gbp2, num, fmtDate, DAY } from '../../lib/util'

export default function Bureau() {
  const { t } = usePortal()
  const curs = t.bureau.currencies || Object.keys(CURRENCIES).filter((c) => CURRENCIES[c].cash)
  return (
    <>
      <PageHead title="Bureau de change" sub="Over-the-counter cash exchange: rate board, tills, stock and deals. Same compliance engine and ledger as remittance." />
      <Tabs items={[{ to: '/portal/bureau', label: 'New deal', end: true }, { to: '/portal/bureau/board', label: 'Rate board' }, { to: '/portal/bureau/stock', label: 'Tills & stock' }, { to: '/portal/bureau/deals', label: 'Deals' }, { to: '/portal/bureau/settings', label: 'Settings' }]} />
      <Routes>
        <Route index element={<NewDeal curs={curs} />} />
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
          <button className="btn pri" disabled={!q || !(q.gbp > 0)} onClick={submit}>Complete deal</button>
          {done && <p className="small muted">Last deal: <b className="mono">{done.ref}</b> · {done.side === 'sell' ? 'sold' : 'bought'} {num(done.foreign)} {done.code} for {gbp2(done.gbp)} · margin {gbp2(done.margin)}</p>}
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
  const deals = db.deals.filter((d) => d.tenantId === t.id && (!q || `${d.ref} ${d.customerName}`.toLowerCase().includes(q.toLowerCase())))
  const month = deals.filter((d) => Date.now() - d.at < 30 * DAY)
  return (
    <>
      <div className="kpis"><Kpi label="Deals, 30d" value={month.length} /><Kpi label="Turnover, 30d" value={gbp(month.reduce((s, d) => s + d.gbp, 0))} /><Kpi label="Margin, 30d" value={gbp2(month.reduce((s, d) => s + d.margin, 0))} tone="good" /><Kpi label="ID recorded" value={month.filter((d) => d.needsId).length} sub="deals over threshold" /></div>
      <div className="filters"><input id="dl-q" className="inp" placeholder="Search reference or customer" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <Panel>{deals.length ? <div className="tbl-wrap"><table><thead><tr><th>Ref</th><th>When</th><th>Side</th><th className="r">Foreign</th><th className="r">GBP</th><th className="r">Rate</th><th className="r">Margin</th><th>Customer</th><th>Branch</th><th>By</th></tr></thead>
        <tbody>{deals.map((d) => <tr key={d.id}><td className="mono">{d.ref}</td><td className="nowrap muted">{fmtDate(d.at)}</td><td><Pill tone={d.side === 'sell' ? 'info' : 'warn'}>{d.side === 'sell' ? 'We sold' : 'We bought'}</Pill></td><td className="r num">{num(d.foreign)} {d.code}</td><td className="r num">{gbp2(d.gbp)}</td><td className="r num">{d.rate}</td><td className="r num">{gbp2(d.margin)}</td><td>{d.customerName || <span className="muted">walk-in</span>}{d.needsId && <span className="tag" style={{ marginLeft: 6 }}>{d.idType}</span>}</td><td>{t.branches.find((b) => b.id === d.branchId)?.name}</td><td className="muted">{d.by}</td></tr>)}</tbody></table></div> : <Empty>No deals yet.</Empty>}</Panel>
    </>
  )
}

function Settings() {
  const { t, actor, role } = usePortal()
  const [f, setF] = useState({ idThreshold: t.bureau.idThreshold, linkedHours: t.bureau.linkedHours, spreadPct: t.bureau.spreadPct, currencies: t.bureau.currencies || Object.keys(CURRENCIES).filter((c) => CURRENCIES[c].cash) })
  const canEdit = ['Admin', 'MLRO'].includes(role)
  const cash = Object.keys(CURRENCIES).filter((c) => CURRENCIES[c].cash)
  return (
    <div className="grid2">
      <Panel title="Bureau settings" actions={canEdit && <button className="btn pri sm" onClick={() => act((d) => M.setBureauSettings(d, t.id, f, actor), 'Saved')}><Save />Save</button>} pad>
        <div className="stack">
          <div className="form">
            <Field label="Record customer ID from (£)" id="bs-t" hint="Your internal threshold for identification. Linked deals in the window below count together."><input id="bs-t" className="inp num" value={f.idThreshold} disabled={!canEdit} onChange={(e) => setF({ ...f, idThreshold: e.target.value })} /></Field>
            <Field label="Linked-deal window (hours)" id="bs-h"><input id="bs-h" className="inp num" value={f.linkedHours} disabled={!canEdit} onChange={(e) => setF({ ...f, linkedHours: e.target.value })} /></Field>
            <Field label="Default spread either side of mid (%)" id="bs-s"><input id="bs-s" className="inp num" value={f.spreadPct} disabled={!canEdit} onChange={(e) => setF({ ...f, spreadPct: e.target.value })} /></Field>
          </div>
          <Field label="Currencies you hold in cash"><div className="checks">{cash.map((c) => <label key={c} className="check"><input type="checkbox" disabled={!canEdit} checked={f.currencies.includes(c)} onChange={(e) => setF({ ...f, currencies: e.target.checked ? [...f.currencies, c] : f.currencies.filter((x) => x !== c) })} /><span>{c}<small>{CURRENCIES[c].country}</small></span></label>)}</div><span className="hint">Cash availability per currency is set by TheFXSoft in Platform settings.</span></Field>
        </div>
      </Panel>
      <Panel title="How it works" pad>
        <ul className="small" style={{ paddingLeft: 18, margin: 0, lineHeight: 1.8 }}>
          <li>Rates: platform mid rate ± your spread, or a custom buy/sell per currency on the Rate board.</li>
          <li>Stock: buy notes from a wholesaler into a branch till; every deal moves cash between the GBP till and the currency till.</li>
          <li>Compliance: deals at or above your threshold (including linked deals) require name and ID; names are screened against the same watchlists as remittance customers.</li>
          <li>Ledger: every deal posts automatically (till accounts, bureau income). End-of-day count posts any over/short.</li>
          <li>Your MLRO sets the threshold and keeps records; TheFXSoft provides the tools.</li>
        </ul>
      </Panel>
    </div>
  )
}
