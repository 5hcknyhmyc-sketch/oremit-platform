import { useState } from 'react'
import { Routes, Route, Link, useParams } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { usePortal } from './PortalApp'
import { Panel, PageHead, Tabs, Modal, Field, Pill, Kpi, Empty } from '../../components/ui'
import { TxTable } from './Transactions'
import { act } from '../../store'
import * as E from '../../lib/engine'
import * as M from '../../lib/modules'
import { gbp, gbp2, fmtDate, DAY } from '../../lib/util'

export default function Agents() {
  return (
    <Routes>
      <Route path=":id" element={<AgentDetail />} />
      <Route path="*" element={<>
        <PageHead title="Agents & branches" sub="Your agent network: floats, commission and the transfers each agent books." />
        <Tabs items={[{ to: '/portal/agents', label: 'Agents', end: true }, { to: '/portal/agents/branches', label: 'Branches' }]} />
        <Routes><Route index element={<List />} /><Route path="branches" element={<Branches />} /></Routes>
      </>} />
    </Routes>
  )
}

function List() {
  const { db, t, actor, role } = usePortal()
  const [edit, setEdit] = useState(null)
  const tx = db.transactions.filter((x) => x.tenantId === t.id && x.agentId)
  const vol = (a) => tx.filter((x) => x.agentId === a.id && x.status === 'paid' && Date.now() - x.createdAt < 30 * DAY).reduce((s, x) => s + x.sendAmount, 0)
  const floatBal = (a) => E.balance(db, t, `agent_${a.id}`)
  const save = () => act((d) => M.saveAgent(d, t.id, edit, actor), 'Agent saved') && setEdit(null)
  return (
    <>
      <div className="kpis">
        <Kpi label="Active agents" value={t.agents.filter((a) => a.status === 'active').length} />
        <Kpi label="Agent volume, 30d" value={gbp(t.agents.reduce((s, a) => s + vol(a), 0))} />
        <Kpi label="Float outstanding" value={gbp(t.agents.reduce((s, a) => s + floatBal(a), 0))} tone="info" />
        <Kpi label="Commission due" value={gbp2(t.agents.reduce((s, a) => s + (a.commissionDue || 0), 0))} tone="warn" />
      </div>
      <Panel title="Agents" actions={role === 'Admin' && <button className="btn sm pri" onClick={() => setEdit({ name: '', branchId: t.branches[0]?.id, commissionPct: 25, floatLimit: 2000, contact: '' })}><Plus />Add agent</button>}>
        {t.agents.length ? <div className="tbl-wrap"><table><thead><tr><th>Agent</th><th>Branch</th><th className="r">Commission</th><th className="r">Float held</th><th className="r">Float limit</th><th className="r">Volume, 30d</th><th className="r">Commission due</th><th>Status</th></tr></thead>
          <tbody>{t.agents.map((a) => <tr key={a.id} className="click" onClick={() => window.location.hash = ''}><td><Link to={`/portal/agents/${a.id}`}><b>{a.name}</b></Link><br /><small className="muted">{a.contact}</small></td><td>{t.branches.find((b) => b.id === a.branchId)?.name}</td><td className="r num">{a.commissionPct}%</td><td className="r num">{gbp2(floatBal(a))}</td><td className="r num">{gbp(a.floatLimit)}</td><td className="r num">{gbp(vol(a))}</td><td className="r num">{gbp2(a.commissionDue || 0)}</td><td><Pill tone={a.status === 'active' ? 'good' : 'mute'}>{a.status}</Pill></td></tr>)}</tbody></table></div> : <Empty>No agents yet. Agents get a login with the “Agent” role and a float account in your ledger.</Empty>}
      </Panel>
      {edit && <Modal title={edit.id ? 'Edit agent' : 'New agent'} onClose={() => setEdit(null)} footer={<><button className="btn" onClick={() => setEdit(null)}>Cancel</button><button className="btn pri" onClick={save}>Save</button></>}>
        <div className="form">
          <Field label="Name / business" id="ag-n"><input id="ag-n" className="inp" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
          <Field label="Branch" id="ag-b"><select id="ag-b" className="sel" value={edit.branchId} onChange={(e) => setEdit({ ...edit, branchId: e.target.value })}>{t.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>
          <Field label="Commission (% of fee)" id="ag-c"><input id="ag-c" className="inp num" value={edit.commissionPct} onChange={(e) => setEdit({ ...edit, commissionPct: e.target.value })} /></Field>
          <Field label="Float limit (£)" id="ag-f"><input id="ag-f" className="inp num" value={edit.floatLimit} onChange={(e) => setEdit({ ...edit, floatLimit: e.target.value })} /></Field>
          <Field label="Contact email" id="ag-e"><input id="ag-e" className="inp" value={edit.contact} onChange={(e) => setEdit({ ...edit, contact: e.target.value })} /></Field>
          {edit.id && <Field label="Status" id="ag-s"><select id="ag-s" className="sel" value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value })}><option value="active">Active</option><option value="suspended">Suspended</option></select></Field>}
        </div>
      </Modal>}
    </>
  )
}

function AgentDetail() {
  const { db, t, actor, role } = usePortal()
  const { id } = useParams()
  const a = t.agents.find((x) => x.id === id)
  const [flo, setFlo] = useState(null)
  const [amt, setAmt] = useState('')
  const [edit, setEdit] = useState(null)
  if (!a) return <Empty>Agent not found.</Empty>
  const tx = db.transactions.filter((x) => x.agentId === a.id)
  const bal = E.balance(db, t, `agent_${a.id}`)
  const js = db.journals.filter((j) => j.tenantId === t.id && j.lines.some((l) => l.account === `agent_${a.id}`)).slice(0, 12)
  return (
    <>
      <PageHead crumb={<Link to="/portal/agents">Agents</Link>} title={a.name} sub={`${t.branches.find((b) => b.id === a.branchId)?.name} · ${a.commissionPct}% of fees · since ${fmtDate(a.createdAt, false)}`}>
        {['Admin', 'MLRO'].includes(role) && <><button className="btn" onClick={() => setFlo('issue')}>Issue float</button><button className="btn" onClick={() => setFlo('collect')}>Collect cash</button><button className="btn pri" disabled={!(a.commissionDue > 0)} onClick={() => act((d) => M.payCommission(d, t.id, a.id, actor), 'Commission paid')}>Pay commission {gbp2(a.commissionDue || 0)}</button></>}
        {role === 'Admin' && <button className="btn" onClick={() => setEdit({ ...a })}>Edit</button>}
      </PageHead>
      <div className="kpis">
        <Kpi label="Float held" value={gbp2(bal)} sub={`limit ${gbp(a.floatLimit)}`} tone={bal > a.floatLimit ? 'warn' : 'info'} />
        <Kpi label="Transfers booked" value={tx.length} sub={gbp(tx.filter((x) => x.status === 'paid').reduce((s, x) => s + x.sendAmount, 0)) + ' paid'} />
        <Kpi label="Commission due" value={gbp2(a.commissionDue || 0)} sub={`${gbp2(a.commissionPaid || 0)} paid to date`} />
      </div>
      <div className="grid2">
        <Panel title="Transfers booked by this agent"><TxTable rows={tx} /></Panel>
        <Panel title="Float ledger">{js.length ? <div className="list">{js.map((j) => { const l = j.lines.find((x) => x.account === `agent_${a.id}`); return <div className="li" key={j.id}><div className="grow"><b>{j.details}</b><small>{fmtDate(j.at)} · {j.by}</small></div><span className="num">{l.debit ? '+' + gbp2(l.debit) : '−' + gbp2(l.credit)}</span></div> })}</div> : <Empty>No float movements.</Empty>}</Panel>
      </div>
      {flo && <Modal title={flo === 'issue' ? `Issue float to ${a.name}` : `Record cash collected from ${a.name}`} onClose={() => setFlo(null)} footer={<><button className="btn" onClick={() => setFlo(null)}>Cancel</button><button className="btn pri" onClick={() => act((d) => M.agentFloat(d, t.id, a.id, +amt, flo, actor), 'Posted') && setFlo(null)}>Post</button></>}>
        <Field label="Amount (£)" id="fl-a"><input id="fl-a" className="inp num" value={amt} onChange={(e) => setAmt(e.target.value)} autoFocus /></Field>
        <p className="muted small">{flo === 'issue' ? 'Moves money from your main bank account to the agent\'s float account in the ledger.' : 'Cash the agent has taken from customers and paid into your bank.'}</p>
      </Modal>}
      {edit && <Modal title="Edit agent" onClose={() => setEdit(null)} footer={<><button className="btn" onClick={() => setEdit(null)}>Cancel</button><button className="btn pri" onClick={() => act((d) => M.saveAgent(d, t.id, edit, actor), 'Saved') && setEdit(null)}>Save</button></>}>
        <div className="form"><Field label="Name" id="e-n"><input id="e-n" className="inp" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field><Field label="Commission (%)" id="e-c"><input id="e-c" className="inp num" value={edit.commissionPct} onChange={(e) => setEdit({ ...edit, commissionPct: e.target.value })} /></Field><Field label="Float limit (£)" id="e-f"><input id="e-f" className="inp num" value={edit.floatLimit} onChange={(e) => setEdit({ ...edit, floatLimit: e.target.value })} /></Field><Field label="Status" id="e-s"><select id="e-s" className="sel" value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value })}><option value="active">Active</option><option value="suspended">Suspended</option></select></Field></div>
      </Modal>}
    </>
  )
}

function Branches() {
  const { t, actor, role } = usePortal()
  const [edit, setEdit] = useState(null)
  return (
    <>
      <Panel title="Branches" actions={role === 'Admin' && <button className="btn sm pri" onClick={() => setEdit({ name: '', address: '' })}><Plus />Add branch</button>}>
        <div className="tbl-wrap"><table><thead><tr><th>Branch</th><th>Address</th><th className="r">Agents</th><th></th></tr></thead><tbody>{t.branches.map((b) => <tr key={b.id}><td><b>{b.name}</b></td><td className="muted">{b.address || '—'}</td><td className="r num">{t.agents.filter((a) => a.branchId === b.id).length}</td><td className="r">{role === 'Admin' && <button className="btn sm" onClick={() => setEdit({ ...b })}>Edit</button>}</td></tr>)}</tbody></table></div>
      </Panel>
      {edit && <Modal title={edit.id ? 'Edit branch' : 'New branch'} onClose={() => setEdit(null)} footer={<><button className="btn" onClick={() => setEdit(null)}>Cancel</button><button className="btn pri" onClick={() => act((d) => M.saveBranch(d, t.id, edit, actor), 'Branch saved') && setEdit(null)}>Save</button></>}>
        <div className="form"><Field label="Name" id="br-n"><input id="br-n" className="inp" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field><Field label="Address" id="br-a"><input id="br-a" className="inp" value={edit.address} onChange={(e) => setEdit({ ...edit, address: e.target.value })} /></Field></div>
      </Modal>}
    </>
  )
}
