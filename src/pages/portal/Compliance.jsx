import { useState } from 'react'
import { Routes, Route, Link, useParams, useNavigate } from 'react-router-dom'
import { Sparkles, Plus, Save, Check } from 'lucide-react'
import { usePortal } from './PortalApp'
import { Panel, PageHead, Tabs, Modal, Field, Empty, Pill, CasePill, SevStripe, Toggle, TxStatus, KycPill, RiskPill, ScreenPill, Markdown } from '../../components/ui'
import { act, useStore } from '../../store'
import * as E from '../../lib/engine'
import { RULE_TYPES, riskLevel } from '../../lib/rules'
import { CURRENCIES, WATCHLIST } from '../../lib/reference'
import { askAi, AiOffline, caseContext, tenantContext, fallbackCaseReview, fallbackRule } from '../../lib/ai'
import { gbp, gbp2, num, fmtDate, ago, uid } from '../../lib/util'

export default function Compliance() {
  const { db, t } = usePortal()
  const open = db.cases.filter((k) => k.tenantId === t.id && k.status !== 'closed').length
  const sars = db.sars.filter((s) => s.tenantId === t.id && s.status === 'with_mlro').length
  return (
    <Routes>
      <Route path="cases/:id" element={<CaseDetail />} />
      <Route path="policies/:key" element={<PolicyEditor />} />
      <Route path="*" element={
        <>
          <PageHead title="Compliance" sub="Cases, monitoring rules, screening, SARs and policies." />
          <Tabs items={[{ to: '/portal/compliance', label: 'Cases', end: true, count: open }, { to: '/portal/compliance/rules', label: 'Monitoring rules' }, { to: '/portal/compliance/release', label: 'Auto-release' }, { to: '/portal/compliance/screening', label: 'Screening' }, { to: '/portal/compliance/sars', label: 'SARs', count: sars }, { to: '/portal/compliance/policies', label: 'Policies' }]} />
          <Routes>
            <Route index element={<Cases />} />
            <Route path="rules" element={<Rules />} />
            <Route path="release" element={<AutoRelease />} />
            <Route path="screening" element={<Screening />} />
            <Route path="sars" element={<Sars />} />
            <Route path="policies" element={<Policies />} />
          </Routes>
        </>
      } />
    </Routes>
  )
}

/* ---------------- Cases ---------------- */
function Cases() {
  const { db, t } = usePortal()
  const [show, setShow] = useState('open')
  const all = db.cases.filter((k) => k.tenantId === t.id)
  const rows = all.filter((k) => (show === 'open' ? k.status !== 'closed' : show === 'closed' ? k.status === 'closed' : true))
  const sevRank = { high: 0, medium: 1, low: 2 }
  rows.sort((a, b) => (a.status === 'closed') - (b.status === 'closed') || sevRank[a.severity] - sevRank[b.severity] || b.createdAt - a.createdAt)
  return (
    <>
      <div className="kpis">
        <div className="kpi crit"><span className="l">Open</span><span className="v">{all.filter((k) => k.status !== 'closed').length}</span><span className="s">{all.filter((k) => k.status !== 'closed' && k.severity === 'high').length} high severity</span></div>
        <div className="kpi"><span className="l">Transfers on hold</span><span className="v">{db.transactions.filter((x) => x.tenantId === t.id && x.status === 'on_hold').length}</span><span className="s">{gbp(db.transactions.filter((x) => x.tenantId === t.id && x.status === 'on_hold').reduce((a, x) => a + x.sendAmount, 0))} held</span></div>
        <div className="kpi"><span className="l">Closed, 30 days</span><span className="v">{all.filter((k) => k.status === 'closed' && Date.now() - k.closedAt < 30 * 864e5).length}</span></div>
        <div className="kpi"><span className="l">Median time to close</span><span className="v">{medianHours(all)}h</span></div>
      </div>
      <div className="filters"><select id="case-f" className="sel" value={show} onChange={(e) => setShow(e.target.value)}><option value="open">Open</option><option value="closed">Closed</option><option value="all">All</option></select><span className="muted small">{rows.length} cases</span></div>
      <Panel>
        <div className="list">
          {rows.length ? rows.map((k) => {
            const c = db.customers.find((x) => x.id === k.customerId), tx = k.txnId && db.transactions.find((x) => x.id === k.txnId)
            return (
              <Link key={k.id} className="li" to={`/portal/compliance/cases/${k.id}`}>
                <SevStripe sev={k.status === 'closed' ? null : k.severity} />
                <div className="grow"><b>{k.ref} · {k.title}</b><small>{c?.name}{tx ? ` · ${gbp2(tx.sendAmount)} to ${tx.cur}` : ''} · {k.status === 'closed' ? `closed ${ago(k.closedAt)} · ${k.outcome}` : `opened ${ago(k.createdAt)}`}{k.assignee ? ` · ${k.assignee}` : ''}</small></div>
                <div className="row">{k.blocking && k.status !== 'closed' && <span className="tag">MLRO sign-off</span>}<CasePill s={k.status} /></div>
              </Link>
            )
          }) : <Empty>No cases here.</Empty>}
        </div>
      </Panel>
    </>
  )
}
const medianHours = (all) => { const d = all.filter((k) => k.closedAt).map((k) => (k.closedAt - k.createdAt) / 36e5).sort((a, b) => a - b); return d.length ? Math.round(d[Math.floor(d.length / 2)]) : 0 }

function CaseDetail() {
  const { db, t, actor, role, canDecide, canSar } = usePortal()
  const { id } = useParams()
  const nav = useNavigate()
  const k = db.cases.find((x) => x.id === id)
  const [note, setNote] = useState('')
  const [ai, setAi] = useState(null)
  const [busy, setBusy] = useState(false)
  const [sar, setSar] = useState(false)
  if (!k) return <Empty>Case not found.</Empty>
  const c = db.customers.find((x) => x.id === k.customerId)
  const tx = k.txnId && db.transactions.find((x) => x.id === k.txnId)
  const rec = db.recipients.find((x) => x.id === (tx?.recipientId || k.recipientId))
  const hist = db.transactions.filter((x) => x.customerId === c.id && x.id !== k.txnId).slice(0, 8)
  const closed = k.status === 'closed'
  const existingSar = k.sarId && db.sars.find((s) => s.id === k.sarId)

  const decide = (decision) => act((d) => E.decideCase(d, k.id, decision, note, actor, role), { release: 'Transfer released', reject: 'Transfer rejected and refunded', clear: 'Case closed' }[decision]) && setNote('')
  const resolveScreen = (outcome) => act((d) => E.resolveScreening(d, k.id, outcome, note, actor), outcome === 'true_match' ? 'Confirmed match — customer frozen' : 'Cleared as false positive') && setNote('')
  const review = async () => {
    setBusy(true)
    const ctx = caseContext(db, k)
    try { setAi({ text: await askAi('case_review', [{ role: 'user', content: 'Review this case.' }], ctx) }) }
    catch (e) { setAi({ text: e instanceof AiOffline ? fallbackCaseReview(ctx) : `Error: ${e.message}`, offline: e instanceof AiOffline }) }
    setBusy(false)
  }

  return (
    <>
      <PageHead crumb={<Link to="/portal/compliance">Compliance › Cases</Link>} title={`${k.ref} · ${k.title}`} sub={`Opened ${fmtDate(k.createdAt)}${k.assignee ? ` · assigned to ${k.assignee}` : ''}`}>
        <CasePill s={k.status} /><Pill tone={{ high: 'crit', medium: 'warn', low: 'info' }[k.severity]}>{k.severity} severity</Pill>
        {!closed && !k.assignee && <button className="btn sm" onClick={() => act((d) => E.assignCase(d, k.id, actor), 'Assigned to you')}>Assign to me</button>}
      </PageHead>
      {k.blocking && !closed && <div className="banner crit">A blocking rule fired. Releasing this transfer needs the MLRO or an Admin.</div>}
      {existingSar && existingSar.status === 'daml_requested' && <div className="banner warn">DAML requested from the NCA ({existingSar.ncaRef}). Don't release until consent is given or the notice period ends on {fmtDate(existingSar.moratoriumEnds, false)}.</div>}
      <div className="grid2">
        <div className="stack">
          <Panel title="What fired" pad>
            <div className="stack-s">{k.hits.map((h, i) => <div key={i} className="row"><Pill tone={h.action === 'flag' ? 'info' : h.action === 'hold' ? 'warn' : 'crit'}>{h.action}</Pill><span><b>{h.name}</b> — {h.detail}</span></div>)}</div>
          </Panel>
          {tx && (
            <Panel title={<h2>Transfer <span className="mono muted">{tx.ref}</span></h2>} actions={<TxStatus s={tx.status} />} pad>
              <dl className="dl">
                <dt>Amount</dt><dd className="num">{gbp2(tx.sendAmount)} → {num(tx.receiveAmount)} {tx.cur} ({CURRENCIES[tx.cur]?.country})</dd>
                <dt>Recipient</dt><dd>{rec?.name} · {rec?.relationship} · {rec?.method} {rec?.bank}<br /><ScreenPill s={rec?.screening} /></dd>
                <dt>Purpose</dt><dd>{tx.purpose || <span className="muted">Not given</span>}</dd>
                <dt>Source of funds</dt><dd>{tx.sof || <span className="muted">Not given</span>}</dd>
                <dt>Channel</dt><dd>{tx.channel} · {fmtDate(tx.createdAt)}</dd>
              </dl>
              <Link className="small" to={`/portal/transactions/${tx.id}`}>Open transfer →</Link>
            </Panel>
          )}
          <Panel title="Recent activity" >
            {hist.length ? <div className="tbl-wrap"><table><thead><tr><th>When</th><th>Recipient</th><th className="r">Amount</th><th>Status</th></tr></thead><tbody>{hist.map((x) => <tr key={x.id}><td className="nowrap">{fmtDate(x.createdAt)}</td><td>{db.recipients.find((r) => r.id === x.recipientId)?.name} · {x.cur}</td><td className="r num">{gbp2(x.sendAmount)}</td><td><TxStatus s={x.status} /></td></tr>)}</tbody></table></div> : <Empty>No other transfers.</Empty>}
          </Panel>
          <Panel title="Notes">
            <div className="list">{k.notes.length ? k.notes.map((n, i) => <div className="li" key={i}><div className="grow"><span style={{ whiteSpace: 'pre-wrap' }}>{n.text}</span><small>{n.by} · {fmtDate(n.at)}</small></div></div>) : <Empty>No notes yet.</Empty>}</div>
            {!closed && <div className="panel-b stack-s" style={{ borderTop: '1px solid var(--line)' }}>
              <textarea id="case-note" className="ta" placeholder="Record what you checked and why you decided. This is your audit trail." value={note} onChange={(e) => setNote(e.target.value)} />
              <div className="row"><button className="btn sm" onClick={() => act((d) => E.addCaseNote(d, k.id, note, actor), 'Note added') && setNote('')}>Add note only</button></div>
            </div>}
          </Panel>
        </div>
        <div className="stack">
          <Panel title="Customer" pad>
            <div className="row"><b><Link to={`/portal/customers/${c.id}`}>{c.name}</Link></b><KycPill s={c.kyc.status} /><RiskPill level={riskLevel(c)} />{c.pep && <span className="tag">PEP</span>}</div>
            <dl className="dl" style={{ marginTop: 10 }}>
              <dt>Occupation</dt><dd>{c.occupation || '—'}</dd><dt>Since</dt><dd>{fmtDate(c.createdAt, false)}</dd><dt>Screening</dt><dd><ScreenPill s={c.screening} /></dd>
              <dt>Risk factors</dt><dd>{c.risk.factors?.join(', ') || 'None'}</dd>
            </dl>
          </Panel>
          <Panel title="AI review" actions={<button className="btn sm" onClick={review} disabled={busy}><Sparkles />{busy ? 'Reviewing…' : ai ? 'Run again' : 'Review this case'}</button>} pad>
            {ai ? <>{ai.offline && <p className="muted small" style={{ marginBottom: 8 }}>AI is off (no API key set), so this is a rule-based summary.</p>}<Markdown text={ai.text} /></> : <p className="muted small">Summarises the case, lists risk indicators and mitigating factors, suggests what to ask the customer and drafts a note. You decide.</p>}
          </Panel>
          {!closed && (
            <Panel title="Decision" pad>
              {!canDecide ? <p className="muted small">Your role can add notes but not decide. A compliance officer, MLRO or admin decides.</p> : (
                <div className="stack-s">
                  {k.kind === 'screening' ? <>
                    <p className="small muted">Compare date of birth, nationality and address with the list entry. A name match alone is not enough.</p>
                    <button className="btn good" onClick={() => resolveScreen('false_positive')}><Check />False positive — clear</button>
                    <button className="btn danger" onClick={() => resolveScreen('true_match')}>Confirmed match — freeze customer</button>
                  </> : <>
                    {tx?.status === 'on_hold' && <button className="btn good" onClick={() => decide('release')} disabled={k.blocking && !['Admin', 'MLRO'].includes(role)}><Check />Release transfer & close</button>}
                    {tx && ['on_hold', 'pending_release'].includes(tx.status) && <button className="btn danger" onClick={() => decide('reject')}>Reject & refund sender</button>}
                    {(!tx || !['on_hold', 'pending_release'].includes(tx.status)) && <button className="btn" onClick={() => decide('clear')}>Close — no action needed</button>}
                  </>}
                  {!existingSar && <button className="btn" onClick={() => setSar(true)}>Raise internal SAR to MLRO</button>}
                  <p className="muted small">Every decision needs a note. Never tell the customer a report is being considered.</p>
                </div>
              )}
            </Panel>
          )}
          {closed && <Panel title="Outcome" pad><b>{k.outcome}</b><p className="muted small">by {k.closedBy} · {fmtDate(k.closedAt)}</p></Panel>}
        </div>
      </div>
      {sar && <SarModal k={k} onClose={() => setSar(false)} />}
    </>
  )
}

function SarModal({ k, onClose }) {
  const { t, actor } = usePortal()
  const [g, setG] = useState('')
  const ok = () => act((d) => E.raiseSar(d, { tenantId: t.id, caseId: k.id, customerId: k.customerId, txnId: k.txnId, grounds: g }, actor), 'Internal SAR sent to the MLRO') && onClose()
  return (
    <Modal title="Raise an internal SAR" onClose={onClose} footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn pri" onClick={ok}>Send to MLRO</button></>}>
      <p className="muted small">Describe your grounds for suspicion in your own words: what you saw, why it doesn't fit the customer's profile, and what the customer said when asked. The MLRO decides whether to report to the NCA.</p>
      <Field label="Grounds for suspicion" id="sar-g"><textarea id="sar-g" className="ta" value={g} onChange={(e) => setG(e.target.value)} /></Field>
      <div className="banner warn">Do not tell the customer. Tipping off is an offence under POCA 2002 s.333A.</div>
    </Modal>
  )
}

/* ---------------- Rules ---------------- */
function Rules() {
  const { db, t, actor, role } = usePortal()
  const [edit, setEdit] = useState(null)
  const [aiText, setAiText] = useState('')
  const [busy, setBusy] = useState(false)
  const canEdit = ['Admin', 'MLRO'].includes(role)
  const stats = (r) => db.cases.filter((k) => k.tenantId === t.id && k.hits.some((h) => h.ruleId === r.id) && Date.now() - k.createdAt < 30 * 864e5).length
  const save = (rule) => act((d) => { const tt = d.tenants.find((x) => x.id === t.id); const i = tt.rules.findIndex((r) => r.id === rule.id); if (i >= 0) tt.rules[i] = rule; else tt.rules.push(rule); E.audit(d, { tenantId: t.id, actor, action: `${i >= 0 ? 'Updated' : 'Added'} rule`, target: rule.name }) }, 'Rule saved') && setEdit(null)
  const toggle = (r) => act((d) => { const x = d.tenants.find((x) => x.id === t.id).rules.find((y) => y.id === r.id); x.enabled = !x.enabled; E.audit(d, { tenantId: t.id, actor, action: `${x.enabled ? 'Enabled' : 'Disabled'} rule`, target: x.name }) })
  const remove = (r) => act((d) => { const tt = d.tenants.find((x) => x.id === t.id); tt.rules = tt.rules.filter((y) => y.id !== r.id); E.audit(d, { tenantId: t.id, actor, action: 'Deleted rule', target: r.name }) }, 'Rule deleted')
  const suggest = async () => {
    if (!aiText.trim()) return
    setBusy(true)
    let rule = null
    try {
      const txt = await askAi('rule', [{ role: 'user', content: aiText }], { msb: tenantContext(db, t).msb })
      const j = JSON.parse(txt.replace(/^```json|```$/g, '').trim())
      rule = { id: uid('rule'), enabled: true, ...j }
    } catch (e) {
      const f = fallbackRule(aiText)
      if (f) rule = { id: uid('rule'), enabled: true, ...f }
      else useStore.getState().notify(e instanceof AiOffline ? 'AI is off and I could not parse that. Try “hold transfers over £3,000 to Nigeria”.' : e.message, 'err')
    }
    if (rule && RULE_TYPES[rule.type]) setEdit(rule)
    setBusy(false)
  }
  return (
    <>
      <div className="grid2">
        <Panel title="Describe a rule in plain English" pad>
          <div className="row"><input id="rule-ai" className="inp" style={{ flex: 1 }} placeholder="e.g. Hold any transfer over £3,000 to Nigeria, or flag 4 transfers in a week" value={aiText} onChange={(e) => setAiText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && suggest()} /><button className="btn pri" onClick={suggest} disabled={busy || !canEdit}><Sparkles />{busy ? '…' : 'Draft rule'}</button></div>
          <p className="muted small" style={{ marginTop: 8 }}>The AI turns your description into a rule you can check and save. Without an API key a simple parser handles amounts, periods and countries.</p>
        </Panel>
        <Panel title="How actions work" pad>
          <div className="stack-s small"><div><Pill tone="info">flag</Pill> Creates a case but the transfer still auto-releases.</div><div><Pill tone="warn">hold</Pill> Stops the transfer until a compliance user releases it.</div><div><Pill tone="crit">block</Pill> Stops the transfer; only the MLRO or an Admin can release.</div></div>
        </Panel>
      </div>
      <Panel title={`Monitoring rules (${t.rules.length})`} actions={canEdit && <button className="btn sm pri" onClick={() => setEdit({ id: uid('rule'), type: 'amount_over', name: '', enabled: true, action: 'hold', severity: 'medium', params: { amount: 3000 } })}><Plus />Add rule</button>}>
        <div className="tbl-wrap"><table>
          <thead><tr><th>On</th><th>Rule</th><th>Condition</th><th>Action</th><th>Severity</th><th className="r">Cases, 30d</th><th></th></tr></thead>
          <tbody>{t.rules.map((r) => (
            <tr key={r.id} style={{ opacity: r.enabled ? 1 : 0.55 }}>
              <td><Toggle on={r.enabled} onChange={() => toggle(r)} label={`Enable ${r.name}`} disabled={!canEdit} /></td>
              <td><b>{r.name}</b><br /><small className="muted">{RULE_TYPES[r.type]?.label}</small></td>
              <td className="small">{RULE_TYPES[r.type]?.describe(r.params)}</td>
              <td><Pill tone={r.action === 'flag' ? 'info' : r.action === 'hold' ? 'warn' : 'crit'}>{r.action}</Pill></td><td>{r.severity}</td><td className="r num">{stats(r)}</td>
              <td><div className="row" style={{ justifyContent: 'flex-end' }}>{canEdit && <><button className="btn sm" onClick={() => setEdit({ ...r, params: { ...r.params } })}>Edit</button><button className="btn sm ghost" onClick={() => remove(r)}>Delete</button></>}</div></td>
            </tr>
          ))}</tbody>
        </table></div>
      </Panel>
      {edit && <RuleModal rule={edit} onSave={save} onClose={() => setEdit(null)} />}
    </>
  )
}

function RuleModal({ rule, onSave, onClose }) {
  const [r, setR] = useState(rule)
  const def = RULE_TYPES[r.type]
  const setP = (k, v, type) => setR({ ...r, params: { ...r.params, [k]: type === 'list' ? v.split(',').map((x) => x.trim().toUpperCase().replace(/^(LOW|MEDIUM|HIGH)$/i, (m) => m[0] + m.slice(1).toLowerCase())).filter(Boolean) : +v } })
  const changeType = (type) => setR({ ...r, type, name: r.name || RULE_TYPES[type].label, params: Object.fromEntries(RULE_TYPES[type].params.map((p) => [p.k, p.type === 'list' ? [] : (r.params[p.k] ?? 1000)])) })
  return (
    <Modal title={rule.name ? 'Edit rule' : 'New rule'} onClose={onClose} footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn pri" onClick={() => r.name.trim() ? onSave(r) : null}><Save />Save rule</button></>}>
      {r.explanation && <div className="banner">{r.explanation}</div>}
      <div className="form">
        <Field label="Name" id="r-n"><input id="r-n" className="inp" value={r.name} onChange={(e) => setR({ ...r, name: e.target.value })} /></Field>
        <Field label="Condition type" id="r-t"><select id="r-t" className="sel" value={r.type} onChange={(e) => changeType(e.target.value)}>{Object.entries(RULE_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></Field>
        {def.params.map((p) => <Field key={p.k} label={p.label} id={`r-${p.k}`}><input id={`r-${p.k}`} className="inp" value={p.type === 'list' ? (r.params[p.k] || []).join(', ') : r.params[p.k] ?? ''} onChange={(e) => setP(p.k, e.target.value, p.type)} /></Field>)}
        <Field label="Action" id="r-a"><select id="r-a" className="sel" value={r.action} onChange={(e) => setR({ ...r, action: e.target.value })}><option value="flag">Flag (alert only)</option><option value="hold">Hold for review</option><option value="block">Block (MLRO release)</option></select></Field>
        <Field label="Severity" id="r-s"><select id="r-s" className="sel" value={r.severity} onChange={(e) => setR({ ...r, severity: e.target.value })}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></Field>
      </div>
      <p className="muted small">Preview: <b>{def.describe(r.params)}</b> → {r.action}</p>
    </Modal>
  )
}

/* ---------------- Auto-release ---------------- */
function AutoRelease() {
  const { t, actor, role } = usePortal()
  const canEdit = ['Admin', 'MLRO'].includes(role)
  const [f, setF] = useState({ ...t.compliance, autoRelease: { ...t.compliance.autoRelease } })
  const save = () => act((d) => { const tt = d.tenants.find((x) => x.id === t.id); tt.compliance = { ...tt.compliance, ...f, eddThreshold: +f.eddThreshold, sofThreshold: +f.sofThreshold, dailyLimit: +f.dailyLimit, screeningThreshold: +f.screeningThreshold, autoRelease: { enabled: f.autoRelease.enabled, maxAmount: +f.autoRelease.maxAmount } }; E.audit(d, { tenantId: t.id, actor, action: 'Updated compliance settings', target: '' }) }, 'Settings saved')
  return (
    <div className="grid2">
      <Panel title="Release policy" actions={canEdit && <button className="btn pri sm" onClick={save}><Save />Save</button>} pad>
        <div className="stack">
          <label className="check"><input type="checkbox" checked={f.autoRelease.enabled} disabled={!canEdit} onChange={(e) => setF({ ...f, autoRelease: { ...f.autoRelease, enabled: e.target.checked } })} /><span>Auto-release transfers that pass every rule<small>When off, a cashier or compliance user releases each transfer by hand.</small></span></label>
          <Field label="Auto-release only up to (£)" id="ar-max" hint="Larger transfers wait in “Ready to release” for a person."><input id="ar-max" className="inp num" value={f.autoRelease.maxAmount} disabled={!canEdit} onChange={(e) => setF({ ...f, autoRelease: { ...f.autoRelease, maxAmount: e.target.value } })} /></Field>
          <div className="form">
            <Field label="Enhanced due diligence above (£)" id="ar-edd"><input id="ar-edd" className="inp num" value={f.eddThreshold} disabled={!canEdit} onChange={(e) => setF({ ...f, eddThreshold: e.target.value })} /></Field>
            <Field label="Source of funds required above (£)" id="ar-sof"><input id="ar-sof" className="inp num" value={f.sofThreshold} disabled={!canEdit} onChange={(e) => setF({ ...f, sofThreshold: e.target.value })} /></Field>
            <Field label="Daily limit per customer (£)" id="ar-day"><input id="ar-day" className="inp num" value={f.dailyLimit} disabled={!canEdit} onChange={(e) => setF({ ...f, dailyLimit: e.target.value })} /></Field>
            <Field label="Screening match threshold (%)" id="ar-scr"><input id="ar-scr" className="inp num" value={f.screeningThreshold} disabled={!canEdit} onChange={(e) => setF({ ...f, screeningThreshold: e.target.value })} /></Field>
          </div>
          <label className="check"><input type="checkbox" checked={f.requireKycBeforeSend} disabled={!canEdit} onChange={(e) => setF({ ...f, requireKycBeforeSend: e.target.checked })} /><span>Customers must start identity verification before creating a transfer</span></label>
          <Field label="MLRO" id="ar-mlro"><input id="ar-mlro" className="inp" value={f.mlro} disabled={!canEdit} onChange={(e) => setF({ ...f, mlro: e.target.value })} /></Field>
        </div>
      </Panel>
      <Panel title="How a transfer moves" pad>
        <ol className="small" style={{ paddingLeft: 18, margin: 0, lineHeight: 1.8 }}>
          <li>Customer creates a transfer → <b>Awaiting funds</b></li>
          <li>Money lands in the safeguarding account and is matched by reference → <b>Funds received</b></li>
          <li>Every enabled rule runs. Any hold/block → <b>On hold</b> with a case. Flags only → case, but continues.</li>
          <li>Passed and under the limit → <b>auto-released</b>. Otherwise → <b>Ready to release</b> for a person.</li>
          <li>Sent to the payout partner → <b>Paid</b> when the partner confirms.</li>
        </ol>
        <p className="muted small" style={{ marginTop: 10 }}>Note the thresholds here also feed the default rules (EDD, source of funds). Edit the rules themselves on the Monitoring rules tab.</p>
      </Panel>
    </div>
  )
}

/* ---------------- Screening ---------------- */
function Screening() {
  const { db, t } = usePortal()
  const custs = db.customers.filter((c) => c.tenantId === t.id), recs = db.recipients.filter((r) => r.tenantId === t.id)
  const hits = [...custs.filter((c) => c.screening.status !== 'clear'), ...recs.filter((r) => r.screening.status !== 'clear')]
  return (
    <>
      <div className="kpis">
        <div className="kpi"><span className="l">Names screened</span><span className="v">{custs.length + recs.length}</span><span className="s">{custs.length} customers · {recs.length} recipients</span></div>
        <div className="kpi crit"><span className="l">Unresolved matches</span><span className="v">{hits.filter((h) => h.screening.status === 'potential_match').length}</span></div>
        <div className="kpi"><span className="l">PEPs</span><span className="v">{custs.filter((c) => c.pep).length}</span></div>
        <div className="kpi"><span className="l">Threshold</span><span className="v">{t.compliance.screeningThreshold}%</span><span className="s">name similarity</span></div>
      </div>
      <Panel title="Matches and outcomes">
        {hits.length ? <div className="tbl-wrap"><table><thead><tr><th>Name</th><th>Type</th><th>Closest list entry</th><th>Score</th><th>Outcome</th></tr></thead><tbody>
          {hits.map((h) => <tr key={h.id}><td><b>{h.name}</b></td><td>{h.customerId ? 'Recipient' : 'Customer'}</td><td>{h.screening.match?.match} <span className="muted small">· {h.screening.match?.list}</span></td><td className="num">{h.screening.score}%</td><td><ScreenPill s={h.screening} /></td></tr>)}
        </tbody></table></div> : <Empty>No matches.</Empty>}
      </Panel>
      <Panel title="Demo watchlist" pad>
        <p className="muted small">These are fictional names used for the demo. In production, screening runs against your provider's live sanctions, PEP and adverse-media data on every customer, recipient and transfer.</p>
        <div className="row" style={{ marginTop: 8 }}>{WATCHLIST.map((w) => <span key={w.name} className="tag">{w.name} · {w.list}</span>)}</div>
      </Panel>
    </>
  )
}

/* ---------------- SARs ---------------- */
function Sars() {
  const { db, t, actor, role, canSar } = usePortal()
  const [open, setOpen] = useState(null)
  const sars = db.sars.filter((s) => s.tenantId === t.id)
  const label = { with_mlro: ['With MLRO', 'warn'], filed: ['SAR filed with NCA', 'good'], daml_requested: ['DAML requested', 'info'], not_filed: ['Not reported', 'mute'] }
  return (
    <>
      <div className="banner">Internal SARs go to the MLRO ({t.compliance.mlro || 'not set'}), who decides whether to report to the NCA through the SAR Online portal. Record the NCA reference here. Never tell the customer.</div>
      <Panel title="Suspicious activity reports">
        {sars.length ? <div className="list">{sars.map((s) => {
          const c = db.customers.find((x) => x.id === s.customerId)
          return <div className="li" key={s.id}><div className="grow"><b>{s.ref} · {c?.name}</b><small>{s.grounds}</small><small>Raised by {s.raisedBy} · {fmtDate(s.createdAt)}{s.decision ? ` · decided by ${s.decision.by}: ${s.decision.reason}` : ''}{s.ncaRef ? ` · NCA ref ${s.ncaRef}` : ''}</small></div>
            <div className="row"><Pill tone={label[s.status][1]}>{label[s.status][0]}</Pill>{s.status === 'with_mlro' && canSar && <button className="btn sm pri" onClick={() => setOpen(s)}>Decide</button>}</div></div>
        })}</div> : <Empty>No SARs raised.</Empty>}
      </Panel>
      {open && <SarDecision s={open} onClose={() => setOpen(null)} />}
    </>
  )
}
function SarDecision({ s, onClose }) {
  const { actor, role } = usePortal()
  const [f, setF] = useState({ outcome: 'filed', ncaRef: '', reason: '' })
  const ok = () => act((d) => E.decideSar(d, s.id, f, actor, role), 'Decision recorded') && onClose()
  return (
    <Modal title={`MLRO decision · ${s.ref}`} onClose={onClose} footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn pri" onClick={ok}>Record decision</button></>}>
      <p className="small"><b>Grounds:</b> {s.grounds}</p>
      <div className="stack-s">
        {[['filed', 'Report to NCA (SAR)', 'Submit on the SAR Online portal, then record the reference.'], ['daml_requested', 'Report and request a defence (DAML)', 'Needed when you want to proceed with a transaction you suspect. 7 working-day notice period.'], ['not_filed', 'Do not report', 'Suspicion not supported after review. Keep the reason.']].map(([v, l, h]) => <label key={v} className="check"><input type="radio" name="o" checked={f.outcome === v} onChange={() => setF({ ...f, outcome: v })} /><span>{l}<small>{h}</small></span></label>)}
      </div>
      {f.outcome !== 'not_filed' && <Field label="NCA reference" id="sar-ref"><input id="sar-ref" className="inp mono" value={f.ncaRef} onChange={(e) => setF({ ...f, ncaRef: e.target.value })} placeholder="e.g. 2026-10-XXXXXXX" /></Field>}
      <Field label="Reason / rationale" id="sar-r"><textarea id="sar-r" className="ta" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} /></Field>
    </Modal>
  )
}

/* ---------------- Policies ---------------- */
function Policies() {
  const { t } = usePortal()
  return (
    <Panel title="Policies and documents" actions={<span className="muted small">Templates — review with your MLRO</span>}>
      <div className="list">{t.policies.map((p) => { const v = p.versions[p.versions.length - 1]; return (
        <Link key={p.key} className="li" to={`/portal/compliance/policies/${p.key}`}><div className="grow"><b>{p.title}</b><small>v{v.v} · {v.by} · {fmtDate(v.at, false)} · {p.audience === 'Customers' ? 'shown to customers in the app' : 'internal'}</small></div>{v.approvedBy ? <Pill tone="good">Approved by {v.approvedBy}</Pill> : <Pill tone="warn">Awaiting MLRO approval</Pill>}</Link>
      ) })}</div>
    </Panel>
  )
}
function PolicyEditor() {
  const { db, t, actor, canSar } = usePortal()
  const { key } = useParams()
  const p = t.policies.find((x) => x.key === key)
  const v = p?.versions[p.versions.length - 1]
  const [text, setText] = useState(v?.body || '')
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [ask, setAsk] = useState('')
  if (!p) return <Empty>Policy not found.</Empty>
  const save = () => act((d) => { const pp = d.tenants.find((x) => x.id === t.id).policies.find((x) => x.key === key); pp.versions.push({ v: v.v + 1, body: text, at: Date.now(), by: actor, approvedBy: null }); E.audit(d, { tenantId: t.id, actor, action: `Saved ${p.title} v${v.v + 1}`, target: '' }) }, 'New version saved') && setEditing(false)
  const approve = () => act((d) => { const pp = d.tenants.find((x) => x.id === t.id).policies.find((x) => x.key === key); pp.versions[pp.versions.length - 1].approvedBy = actor; E.audit(d, { tenantId: t.id, actor, action: `Approved ${p.title} v${v.v}`, target: '' }) }, 'Approved')
  const draft = async () => {
    setBusy(true)
    try {
      const out = await askAi('policy', [{ role: 'user', content: `${ask || 'Improve this policy so it is complete, specific to this MSB and easy for staff to follow.'}\n\nCurrent document:\n${text}` }], tenantContext(db, t))
      setText(out); setEditing(true)
    } catch (e) { useStore.getState().notify(e instanceof AiOffline ? 'AI is off. Add ANTHROPIC_API_KEY in Netlify to draft policies.' : e.message, 'err') }
    setBusy(false)
  }
  return (
    <>
      <PageHead crumb={<Link to="/portal/compliance/policies">Compliance › Policies</Link>} title={p.title} sub={`Version ${v.v} · ${v.by} · ${fmtDate(v.at)}${v.approvedBy ? ` · approved by ${v.approvedBy}` : ''}`}>
        {!editing && <button className="btn" onClick={() => setEditing(true)}>Edit</button>}
        {editing && <><button className="btn" onClick={() => { setText(v.body); setEditing(false) }}>Discard</button><button className="btn pri" onClick={save}><Save />Save as v{v.v + 1}</button></>}
        {!v.approvedBy && canSar && !editing && <button className="btn good" onClick={approve}><Check />Approve as MLRO</button>}
      </PageHead>
      <div className="grid2">
        <Panel pad>{editing ? <textarea id="pol-body" className="ta mono" style={{ minHeight: 520, fontSize: 12.5 }} value={text} onChange={(e) => setText(e.target.value)} /> : <Markdown text={text} />}</Panel>
        <div className="stack">
          <Panel title="Draft with AI" pad>
            <Field label="What should change?" id="pol-ask"><textarea id="pol-ask" className="ta" style={{ minHeight: 80 }} placeholder="e.g. Add a section on agents and cash handling. Make the EDD triggers match our thresholds." value={ask} onChange={(e) => setAsk(e.target.value)} /></Field>
            <button className="btn pri" style={{ marginTop: 10 }} onClick={draft} disabled={busy}><Sparkles />{busy ? 'Drafting…' : 'Draft new version'}</button>
            <p className="muted small" style={{ marginTop: 8 }}>The AI rewrites the document using {t.name}'s corridors, thresholds and MLRO. You review before saving; the MLRO approves.</p>
          </Panel>
          <Panel title="Versions"><div className="list">{[...p.versions].reverse().map((x) => <div className="li" key={x.v}><div className="grow"><b>v{x.v}</b><small>{x.by} · {fmtDate(x.at)}</small></div>{x.approvedBy ? <Pill tone="good">Approved</Pill> : <Pill tone="mute">Draft</Pill>}</div>)}</div></Panel>
        </div>
      </div>
    </>
  )
}
