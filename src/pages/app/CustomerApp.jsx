import { useState } from 'react'
import { Routes, Route, NavLink, Link, Navigate, useParams, useNavigate, useLocation } from 'react-router-dom'
import { Home, Users, List, User, ChevronLeft, Copy, ShieldCheck } from 'lucide-react'
import { useStore, act } from '../../store'
import { brandVars, TxStatus, Field, Pill, Markdown } from '../../components/ui'
import * as E from '../../lib/engine'
import * as M from '../../lib/modules'
import { CURRENCIES, PURPOSES, SOURCES_OF_FUNDS, DOC_TYPES, TX_STATUS, RELATIONSHIPS } from '../../lib/reference'
import { gbp2, num, fmtDate, initials } from '../../lib/util'

/* ---------- Static preview used by Settings → Branding and the onboarding wizard ---------- */
export function AppPreview({ t }) {
  const cur = t.corridors.find((c) => c.enabled)?.cur || 'PKR'
  const cor = t.corridors.find((c) => c.enabled)
  const rate = +(CURRENCIES[cur].rate * (1 - (cor?.margin || 0) / 100)).toFixed(4)
  const q = { rate, fee: cor?.fee || 0, receiveAmount: 500 * rate, cur }
  return (
    <div className="app" style={brandVars(t)}>
      <div className="app-top"><div className="row"><div className="lg">{t.brand.logo ? <img src={t.brand.logo} alt="" /> : initials(t.brand.appName || t.name)}</div><b>{t.brand.appName || t.name}</b></div><div className="hi">Hi Bilal</div><div className="sub">Send money home in minutes</div></div>
      <div className="app-body">
        <div className="app-card">
          <span className="app-sec">You send</span><div className="amt"><input value="500" readOnly aria-label="Amount" /><span className="cur">GBP</span></div>
          <span className="app-sec">They receive</span><div className="amt"><span className="recv">{num(q.receiveAmount)}</span><span className="cur">{cur}</span></div>
          <div className="meta"><span>Rate</span><b>1 GBP = {q.rate} {cur}</b></div><div className="meta"><span>Fee</span><b>{gbp2(q.fee)}</b></div>
          <button className="app-btn" type="button">Send money</button>
        </div>
        <span className="app-sec">Recent</span>
        <div className="app-card" style={{ padding: '4px 16px' }}>{[['Ayesha Khan', 120], ['Rafiq Hossain', 300]].map(([n, v]) => <div className="app-item" key={n}><div className="av">{initials(n)}</div><div className="grow"><b>{n}</b><small>Paid · {cur}</small></div><span className="num">£{v}</span></div>)}</div>
      </div>
      <nav className="app-nav"><a className="active"><Home />Home</a><a><Users />Recipients</a><a><List />Activity</a><a><User />Profile</a></nav>
    </div>
  )
}

/* ---------- Live app ---------- */
export default function CustomerApp() {
  const { slug } = useParams()
  const db = useStore((s) => s.db)
  const sessions = useStore((s) => s.customerSessions)
  const t = db.tenants.find((x) => x.slug === slug)
  if (!t || t.status === 'draft') return <div className="login"><h1>This MSB isn't available</h1><Link to="/">Back</Link></div>
  const c = db.customers.find((x) => x.id === sessions[t.id] && x.tenantId === t.id)
  return (
    <div className="app-page">
      <div className="app" style={brandVars(t)}>
        <Routes>
          <Route path="track" element={<PublicTrack t={t} />} />
          <Route path="*" element={!c ? <Welcome t={t} /> : (
          <Routes>
            <Route index element={<AppHome t={t} c={c} />} />
            <Route path="send" element={<Send t={t} c={c} />} />
            <Route path="recipients" element={<Recipients t={t} c={c} />} />
            <Route path="activity" element={<Activity t={t} c={c} />} />
            <Route path="activity/:id" element={<TxDetail t={t} c={c} />} />
            <Route path="profile" element={<Profile t={t} c={c} />} />
            <Route path="*" element={<Navigate to={`/app/${slug}`} replace />} />
          </Routes>
        )} />
        </Routes>
      </div>
    </div>
  )
}

function Top({ t, title, sub, back, children }) {
  const nav = useNavigate()
  return (
    <div className="app-top">
      <div className="row">{back ? <button className="btn sm" onClick={() => nav(back)} aria-label="Back"><ChevronLeft /></button> : <div className="lg">{t.brand.logo ? <img src={t.brand.logo} alt="" /> : initials(t.brand.appName || t.name)}</div>}<b>{t.brand.appName || t.name}</b><div className="spacer" />{children}</div>
      <div className="hi">{title}</div>{sub && <div className="sub">{sub}</div>}
    </div>
  )
}
function Nav({ t }) {
  const base = `/app/${t.slug}`
  return <nav className="app-nav">{[[base, 'Home', Home, true], [`${base}/recipients`, 'Recipients', Users], [`${base}/activity`, 'Activity', List], [`${base}/profile`, 'Profile', User]].map(([to, l, I, end]) => <NavLink key={to} to={to} end={end} className={({ isActive }) => (isActive ? 'active' : '')}><I />{l}</NavLink>)}</nav>
}

function Welcome({ t }) {
  const db = useStore((s) => s.db)
  const login = useStore((s) => s.customerLogin)
  const [mode, setMode] = useState('in')
  const [f, setF] = useState({ name: '', email: '', phone: '', dob: '', address: '', postcode: '', occupation: 'Nurse' })
  const existing = db.customers.filter((c) => c.tenantId === t.id).slice(0, 6)
  const signup = () => { const c = act((d) => E.createCustomer(d, t.id, f, 'Customer'), 'Welcome!'); if (c) login(t.id, c.id) }
  const fraud = t.policies.find((p) => p.key === 'fraud')
  return (
    <>
      <Top t={t} title={`Welcome to ${t.brand.appName || t.name}`} sub={`Send money to ${t.corridors.filter((c) => c.enabled).map((c) => CURRENCIES[c.cur].country).join(', ')}`} />
      <div className="app-body">
        <div className="app-card">
          <div className="row"><button className={`btn sm ${mode === 'in' ? 'pri' : ''}`} onClick={() => setMode('in')}>Sign in</button><button className={`btn sm ${mode === 'up' ? 'pri' : ''}`} onClick={() => setMode('up')}>Create account</button></div>
          {mode === 'in' ? (
            <><p className="muted small">Demo: pick an existing customer. In production this is email + one-time code.</p>
              <div>{existing.map((c) => <button key={c.id} className="app-item" onClick={() => login(t.id, c.id)}><div className="av">{initials(c.name)}</div><div className="grow"><b>{c.name}</b><small>{c.email} · KYC {c.kyc.status.replace('_', ' ')}</small></div></button>)}</div></>
          ) : (
            <><div className="stack-s">
              <Field label="Full name (as on your ID)" id="su-n"><input id="su-n" className="inp" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
              <Field label="Email" id="su-e"><input id="su-e" className="inp" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
              <Field label="Mobile" id="su-p"><input id="su-p" className="inp" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
              <Field label="Date of birth" id="su-d"><input id="su-d" className="inp" type="date" value={f.dob} onChange={(e) => setF({ ...f, dob: e.target.value })} /></Field>
              <Field label="Address" id="su-a"><input id="su-a" className="inp" value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></Field>
              <Field label="Postcode" id="su-pc"><input id="su-pc" className="inp" value={f.postcode} onChange={(e) => setF({ ...f, postcode: e.target.value })} /></Field>
              <Field label="Occupation" id="su-o"><input id="su-o" className="inp" value={f.occupation} onChange={(e) => setF({ ...f, occupation: e.target.value })} /></Field>
            </div>
              <button className="app-btn" onClick={signup}>Create account</button>
              <p className="muted small">By continuing you agree to our privacy notice. Your name is checked against sanctions lists, as the law requires.</p></>
          )}
        </div>
        <div className="app-card"><div className="row"><ShieldCheck size={18} /><b>Regulated by the FCA</b></div><p className="muted small">{t.legalName}{t.frn ? ` · FRN ${t.frn}` : ''}. Your money is held in a safeguarded account until it is paid out.</p></div>
      </div>
    </>
  )
}

function AppHome({ t, c }) {
  const db = useStore((s) => s.db)
  const nav = useNavigate()
  const curs = t.corridors.filter((x) => x.enabled)
  const [amt, setAmt] = useState('500')
  const [cur, setCur] = useState(curs[0]?.cur)
  const q = E.quote(db, t, cur, amt)
  const tx = db.transactions.filter((x) => x.customerId === c.id).slice(0, 3)
  const kycNeeded = c.kyc.status === 'not_started'
  return (
    <>
      <Top t={t} title={`Hi ${c.name.split(' ')[0]}`} sub={c.status === 'frozen' ? 'Your account is under review. Please contact us.' : 'Send money home in minutes'} />
      <div className="app-body">
        {kycNeeded && <div className="banner warn" style={{ marginTop: 44 }}>Verify your identity before your first transfer. <Link to={`/app/${t.slug}/profile`} style={{ color: 'inherit', fontWeight: 700 }}>Verify now →</Link></div>}
        <div className="app-card" style={{ marginTop: kycNeeded ? 0 : undefined }}>
          <span className="app-sec">You send</span><div className="amt"><input id="amt" inputMode="decimal" value={amt} onChange={(e) => setAmt(e.target.value)} aria-label="Amount to send" /><span className="cur">GBP</span></div>
          <span className="app-sec">They receive</span><div className="amt"><span className="recv">{q ? num(q.receiveAmount) : '—'}</span><select id="cur" value={cur} onChange={(e) => setCur(e.target.value)} aria-label="Currency">{curs.map((x) => <option key={x.cur}>{x.cur}</option>)}</select></div>
          {q && <><div className="meta"><span>Rate</span><b>1 GBP = {q.rate} {cur}</b></div><div className="meta"><span>Fee</span><b>{gbp2(q.fee)}</b></div><div className="meta"><span>Total to pay</span><b>{gbp2(q.total)}</b></div><div className="meta"><span>Arrives</span><b>Usually within minutes</b></div></>}
          <button className="app-btn" disabled={!q || c.status === 'frozen'} onClick={() => nav(`/app/${t.slug}/send`, { state: { amt: +amt, cur } })}>Send money</button>
        </div>
        <span className="app-sec">Recent</span>
        <div className="app-card" style={{ padding: '4px 16px' }}>{tx.length ? tx.map((x) => <Link key={x.id} className="app-item" to={`/app/${t.slug}/activity/${x.id}`}><div className="av">{initials(db.recipients.find((r) => r.id === x.recipientId)?.name)}</div><div className="grow"><b>{db.recipients.find((r) => r.id === x.recipientId)?.name}</b><small>{CUSTOMER_LABEL[x.status]} · {fmtDate(x.createdAt, false)}</small></div><span className="num">{gbp2(x.sendAmount)}</span></Link>) : <p className="muted small" style={{ padding: '12px 0' }}>No transfers yet.</p>}</div>
      </div>
      <Nav t={t} />
    </>
  )
}

function Send({ t, c }) {
  const db = useStore((s) => s.db)
  const nav = useNavigate()
  const state = useLocation().state || {}
  const recs = db.recipients.filter((r) => r.customerId === c.id)
  const [step, setStep] = useState(0)
  const [f, setF] = useState({ amt: state.amt || 500, cur: state.cur || t.corridors[0]?.cur, recipientId: recs[0]?.id || '', purpose: PURPOSES[0], sof: '', f1: false, f2: false, f3: false })
  const rec = recs.find((r) => r.id === f.recipientId)
  const q = rec ? E.quote(db, t, rec.cur, f.amt) : null
  const needSof = f.amt > t.compliance.sofThreshold
  const [tx, setTx] = useState(null)
  const fraud = t.policies.find((p) => p.key === 'fraud')
  const confirm = () => {
    const r = act((d) => E.createTransaction(d, { tenantId: t.id, customerId: c.id, recipientId: f.recipientId, sendAmount: +f.amt, purpose: f.purpose, sof: f.sof, channel: 'App', fraudConfirm: true }, 'Customer'))
    if (r) { setTx(r); setStep(4) }
  }
  const paid = () => act((d) => E.recordPayIn(d, t.id, { amount: tx.total, payer: c.name.toUpperCase(), reference: tx.ref }, 'Bank feed'), 'Payment received') && nav(`/app/${t.slug}/activity/${tx.id}`)
  const copyRef = () => navigator.clipboard?.writeText(tx.ref).catch(() => {})
  const titles = ['Who are you sending to?', 'What is it for?', 'Stay safe', 'Check and confirm', 'Pay for your transfer']
  return (
    <>
      <Top t={t} title={titles[step]} back={step === 0 || step === 4 ? `/app/${t.slug}` : null}>{step > 0 && step < 4 && <button className="btn sm" onClick={() => setStep(step - 1)}>Back</button>}</Top>
      <div className="app-body">
        {step === 0 && <div className="app-card">
          <div className="amt"><input inputMode="decimal" value={f.amt} onChange={(e) => setF({ ...f, amt: e.target.value })} aria-label="Amount" /><span className="cur">GBP</span></div>
          {recs.length ? <div className="stack-s">{recs.map((r) => <label key={r.id} className="choice"><input type="radio" name="r" checked={f.recipientId === r.id} onChange={() => setF({ ...f, recipientId: r.id })} /><span><b>{r.name}</b><br /><small className="muted">{CURRENCIES[r.cur].country} · {r.method} · {r.bank} ••••{String(r.account).slice(-4)}</small></span></label>)}</div> : <p className="muted small">Add a recipient first.</p>}
          <Link className="app-btn alt" style={{ textAlign: 'center' }} to={`/app/${t.slug}/recipients`}>Add a new recipient</Link>
          {q && <div className="meta"><span>They receive</span><b>{num(q.receiveAmount)} {q.cur}</b></div>}
          <button className="app-btn" disabled={!q} onClick={() => setStep(1)}>Continue</button>
        </div>}
        {step === 1 && <div className="app-card">
          <Field label="Purpose of transfer" id="s-p"><select id="s-p" className="sel" value={f.purpose} onChange={(e) => setF({ ...f, purpose: e.target.value })}>{PURPOSES.map((p) => <option key={p}>{p}</option>)}</select></Field>
          <Field label={`Where does the money come from?${needSof ? '' : ' (optional)'}`} id="s-s" hint={needSof ? `Required for transfers over ${gbp2(t.compliance.sofThreshold)}. We may ask for evidence.` : ''}><select id="s-s" className="sel" value={f.sof} onChange={(e) => setF({ ...f, sof: e.target.value })}><option value="">Choose…</option>{SOURCES_OF_FUNDS.map((p) => <option key={p}>{p}</option>)}</select></Field>
          <button className="app-btn" disabled={needSof && !f.sof} onClick={() => setStep(2)}>Continue</button>
        </div>}
        {step === 2 && <div className="app-card">
          <p className="small">Fraudsters pose as relatives, partners met online, banks and the police. Money sent abroad usually can't be recovered. Please confirm:</p>
          <label className="choice"><input type="checkbox" checked={f.f1} onChange={(e) => setF({ ...f, f1: e.target.checked })} /><span>Nobody has asked me to send this money or told me what to say</span></label>
          <label className="choice"><input type="checkbox" checked={f.f2} onChange={(e) => setF({ ...f, f2: e.target.checked })} /><span>I know the recipient personally and this is not an investment or prize</span></label>
          <label className="choice"><input type="checkbox" checked={f.f3} onChange={(e) => setF({ ...f, f3: e.target.checked })} /><span>I'm not being rushed or pressured</span></label>
          <button className="app-btn" disabled={!(f.f1 && f.f2 && f.f3)} onClick={() => setStep(3)}>Continue</button>
          {fraud && <details><summary className="small muted">Read our fraud awareness guide</summary><Markdown text={fraud.versions[fraud.versions.length - 1].body} /></details>}
        </div>}
        {step === 3 && q && <div className="app-card">
          <div className="meta"><span>To</span><b>{rec.name}</b></div><div className="meta"><span>Country</span><b>{CURRENCIES[rec.cur].country}</b></div>
          <div className="meta"><span>You send</span><b>{gbp2(q.sendAmount)}</b></div><div className="meta"><span>Fee</span><b>{gbp2(q.fee)}</b></div><div className="meta"><span>Rate</span><b>1 GBP = {q.rate} {q.cur}</b></div>
          <div className="meta"><span>They receive</span><b style={{ fontSize: 18 }}>{num(q.receiveAmount)} {q.cur}</b></div><div className="meta"><span>Total to pay</span><b style={{ fontSize: 18 }}>{gbp2(q.total)}</b></div>
          <div className="meta"><span>Purpose</span><b>{f.purpose}</b></div>
          <button className="app-btn" onClick={confirm}>Confirm transfer</button>
        </div>}
        {step === 4 && tx && <div className="app-card">
          <Pill tone="warn">Awaiting your payment</Pill>
          <p className="small">Pay <b className="num">{gbp2(tx.total)}</b> by bank transfer to:</p>
          <div className="meta"><span>Account name</span><b>{t.bank.name}</b></div><div className="meta"><span>Sort code</span><b>{t.bank.sortCode}</b></div><div className="meta"><span>Account number</span><b>{t.bank.account}</b></div>
          <div className="meta"><span>Reference</span><b style={{ fontSize: 18 }}>{tx.ref} <button className="btn sm ghost" onClick={copyRef} aria-label="Copy reference"><Copy /></button></b></div>
          <p className="muted small">Use the reference exactly. We match your payment automatically and send the money straight after our checks.</p>
          <button className="app-btn" onClick={paid}>I've sent the payment (demo)</button>
          <Link className="app-btn alt" style={{ textAlign: 'center' }} to={`/app/${t.slug}/activity/${tx.id}`}>Pay later</Link>
        </div>}
      </div>
      {step !== 4 && <Nav t={t} />}
    </>
  )
}

function Recipients({ t, c }) {
  const db = useStore((s) => s.db)
  const recs = db.recipients.filter((r) => r.customerId === c.id)
  const curs = t.corridors.filter((x) => x.enabled)
  const [add, setAdd] = useState(!recs.length)
  const [f, setF] = useState({ name: '', cur: curs[0]?.cur, method: 'Bank', bank: '', account: '', relationship: 'Parent' })
  const save = () => act((d) => E.addRecipient(d, c.id, f, 'Customer'), 'Recipient saved') && setAdd(false)
  return (
    <>
      <Top t={t} title="Recipients" />
      <div className="app-body">
        {add ? <div className="app-card"><h3>New recipient</h3>
          <Field label="Full name" id="r-n"><input id="r-n" className="inp" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field label="Country" id="r-c"><select id="r-c" className="sel" value={f.cur} onChange={(e) => setF({ ...f, cur: e.target.value })}>{curs.map((x) => <option key={x.cur} value={x.cur}>{CURRENCIES[x.cur].country} ({x.cur})</option>)}</select></Field>
          <Field label="How they receive it" id="r-m"><select id="r-m" className="sel" value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })}><option>Bank</option><option>Cash pickup</option><option>Mobile wallet</option></select></Field>
          <Field label="Bank or wallet provider" id="r-b"><input id="r-b" className="inp" value={f.bank} onChange={(e) => setF({ ...f, bank: e.target.value })} /></Field>
          <Field label="Account / IBAN / wallet number" id="r-a"><input id="r-a" className="inp mono" value={f.account} onChange={(e) => setF({ ...f, account: e.target.value })} /></Field>
          <Field label="Relationship" id="r-r"><select id="r-r" className="sel" value={f.relationship} onChange={(e) => setF({ ...f, relationship: e.target.value })}>{RELATIONSHIPS.map((o) => <option key={o}>{o}</option>)}</select></Field>
          <button className="app-btn" onClick={save}>Save recipient</button>{recs.length > 0 && <button className="app-btn alt" onClick={() => setAdd(false)}>Cancel</button>}
        </div> : <div className="app-card" style={{ padding: '4px 16px' }}>{recs.map((r) => <div key={r.id} className="app-item"><div className="av">{initials(r.name)}</div><div className="grow"><b>{r.name}</b><small>{CURRENCIES[r.cur].country} · {r.method} · {r.bank} ••••{String(r.account).slice(-4)}</small></div></div>)}</div>}
        {!add && <button className="app-btn" onClick={() => setAdd(true)}>Add recipient</button>}
      </div>
      <Nav t={t} />
    </>
  )
}

function Activity({ t, c }) {
  const db = useStore((s) => s.db)
  const tx = db.transactions.filter((x) => x.customerId === c.id)
  return (
    <>
      <Top t={t} title="Activity" />
      <div className="app-body"><div className="app-card" style={{ padding: '4px 16px' }}>{tx.length ? tx.map((x) => <Link key={x.id} className="app-item" to={`/app/${t.slug}/activity/${x.id}`}><div className="av">{initials(db.recipients.find((r) => r.id === x.recipientId)?.name)}</div><div className="grow"><b>{db.recipients.find((r) => r.id === x.recipientId)?.name}</b><small>{fmtDate(x.createdAt)} · {x.ref}</small></div><div style={{ textAlign: 'right' }}><div className="num">{gbp2(x.sendAmount)}</div><TxStatus s={customerStatus(x.status)} /></div></Link>) : <p className="muted small" style={{ padding: '12px 0' }}>No transfers yet.</p>}</div></div>
      <Nav t={t} />
    </>
  )
}
// Customers never see internal compliance states — a held transfer shows as "processing".
const customerStatus = (s) => (['on_hold', 'pending_release', 'funds_received'].includes(s) ? 'released' : s)
const CUSTOMER_LABEL = { awaiting_funds: 'Waiting for your payment', funds_received: 'Payment received — processing', on_hold: 'Processing — additional checks', pending_release: 'Processing', released: 'On its way', paid: 'Paid out', rejected: 'Not completed — refunded', refunded: 'Refunded', cancelled: 'Cancelled' }

function TxDetail({ t, c }) {
  const db = useStore((s) => s.db)
  const { id } = useParams()
  const x = db.transactions.find((k) => k.id === id && k.customerId === c.id)
  if (!x) return <Navigate to={`/app/${t.slug}/activity`} replace />
  const r = db.recipients.find((k) => k.id === x.recipientId)
  const paid = () => act((d) => E.recordPayIn(d, t.id, { amount: x.total, payer: c.name.toUpperCase(), reference: x.ref }, 'Bank feed'), 'Payment received')
  const visible = x.history.filter((h) => !['on_hold', 'pending_release'].includes(h.status) || h === x.history[x.history.length - 1])
  return (
    <>
      <Top t={t} title={`${gbp2(x.sendAmount)} to ${r?.name}`} sub={CUSTOMER_LABEL[x.status]} back={`/app/${t.slug}/activity`} />
      <div className="app-body">
        <div className="app-card">
          <div className="meta"><span>Reference</span><b>{x.ref}</b></div><div className="meta"><span>They receive</span><b>{num(x.receiveAmount)} {x.cur}</b></div><div className="meta"><span>Rate</span><b>1 GBP = {x.rate}</b></div><div className="meta"><span>Fee</span><b>{gbp2(x.fee)}</b></div><div className="meta"><span>Total paid</span><b>{gbp2(x.total)}</b></div>
          {x.status === 'awaiting_funds' && <><p className="small">Pay <b>{gbp2(x.total)}</b> to {t.bank.name}, sort code {t.bank.sortCode}, account {t.bank.account}, reference <b>{x.ref}</b>.</p><button className="app-btn" onClick={paid}>I've sent the payment (demo)</button></>}
          {x.status === 'on_hold' && <p className="muted small">We're carrying out some additional checks, which can take up to one working day. We may contact you for more information.</p>}
        </div>
        <div className="app-card"><h3>Progress</h3><div className="timeline">{visible.map((h, i) => <div className="tl" key={i}><span className="dot" style={{ background: `var(--${TX_STATUS[h.status]?.tone || 'line'})` }} /><div><span>{CUSTOMER_LABEL[h.status]}</span><small>{fmtDate(h.at)}</small></div></div>)}</div></div>
      </div>
      <Nav t={t} />
    </>
  )
}

function PublicTrack({ t }) {
  const db = useStore((s) => s.db)
  const [q, setQ] = useState('')
  const [res, setRes] = useState(null)
  const find = () => { const x = db.transactions.find((k) => k.tenantId === t.id && k.ref.toLowerCase() === q.trim().toLowerCase()); setRes(x || false) }
  return (
    <>
      <Top t={t} title="Track a transfer" sub="Enter the reference from your receipt" />
      <div className="app-body">
        <div className="app-card">
          <div className="row"><input className="inp mono" style={{ flex: 1 }} placeholder={`${t.short}-AB12CD`} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && find()} aria-label="Reference" /><button className="btn pri" onClick={find}>Track</button></div>
          {res === false && <p className="muted small">We couldn't find that reference. Check your receipt or contact us.</p>}
          {res && <><div className="meta"><span>Status</span><b>{CUSTOMER_LABEL[res.status]}</b></div><div className="meta"><span>Amount</span><b>{gbp2(res.sendAmount)} → {num(res.receiveAmount)} {res.cur}</b></div><div className="meta"><span>Last update</span><b>{fmtDate(res.updatedAt)}</b></div></>}
        </div>
        <p className="muted small" style={{ textAlign: 'center' }}><Link to={`/app/${t.slug}`}>Sign in</Link> to see full details.</p>
      </div>
    </>
  )
}

function Profile({ t, c }) {
  const logout = useStore((s) => s.customerLogout)
  const [picked, setPicked] = useState(DOC_TYPES[0])
  const upload = () => act((d) => E.addDocument(d, c.id, picked, 'Customer'), 'Document sent for review — usually under 10 minutes')
  const kycMsg = { not_started: 'Upload a photo ID to start sending money.', pending: 'We\'re checking your documents.', verified: 'Your identity is verified.', rejected: 'We couldn\'t accept a document. Please try another.' }[c.kyc.status]
  const privacy = t.policies.find((p) => p.key === 'gdpr'), complaints = t.policies.find((p) => p.key === 'complaints')
  return (
    <>
      <Top t={t} title={c.name} sub={c.email}><button className="btn sm" onClick={() => logout(t.id)}>Sign out</button></Top>
      <div className="app-body">
        <div className="app-card">
          <div className="row"><h3>Identity</h3><Pill tone={{ verified: 'good', pending: 'warn', not_started: 'warn', rejected: 'crit' }[c.kyc.status]}>{c.kyc.status.replace('_', ' ')}</Pill></div>
          <p className="small">{kycMsg}</p>
          {c.kyc.docs.map((d) => <div key={d.id} className="meta"><span>{d.type}</span><b>{d.status}</b></div>)}
          {c.kyc.status !== 'verified' && <><Field label="Document type" id="p-d"><select id="p-d" className="sel" value={picked} onChange={(e) => setPicked(e.target.value)}>{DOC_TYPES.map((d) => <option key={d}>{d}</option>)}</select></Field><button className="app-btn" onClick={upload}>Take a photo (demo upload)</button></>}
        </div>
        {t.modules?.includes('rewards') && t.rewards?.enabled && <div className="app-card"><h3>Rewards</h3><div className="meta"><span>Points</span><b>{(c.points || 0).toLocaleString('en-GB')}</b></div><div className="meta"><span>Credit available</span><b>{gbp2(c.credit || 0)}</b></div><p className="muted small">Earn {t.rewards.pointsPerPound} point{t.rewards.pointsPerPound === 1 ? '' : 's'} per £1 sent. {t.rewards.redeemRate} points = £1 off fees.</p>{(c.points || 0) >= t.rewards.redeemRate && <button className="app-btn alt" onClick={() => act((d) => M.redeemPoints(d, c.id, Math.floor(c.points / t.rewards.redeemRate) * t.rewards.redeemRate, 'Customer'), (v) => `£${v} credit added`)}>Redeem {Math.floor(c.points / t.rewards.redeemRate) * t.rewards.redeemRate} points</button>}</div>}
        <div className="app-card"><h3>Limits</h3><div className="meta"><span>Per day</span><b>{gbp2(t.compliance.dailyLimit)}</b></div><div className="meta"><span>Per transfer</span><b>{gbp2(Math.max(...t.corridors.map((x) => x.max)))}</b></div><p className="muted small">We may ask where the money comes from for larger transfers. This is a legal requirement.</p></div>
        <div className="app-card"><h3>Help</h3>
          {[privacy, complaints].filter(Boolean).map((p) => <details key={p.key}><summary className="small" style={{ cursor: 'pointer' }}>{p.title}</summary><Markdown text={p.versions[p.versions.length - 1].body} /></details>)}
          <p className="muted small">{t.legalName} is {t.frn ? `registered with the FCA (FRN ${t.frn})` : 'an FCA-registered payment institution'}{t.mlr ? ` and supervised by HMRC for anti-money laundering (${t.mlr})` : ''}.</p>
        </div>
      </div>
      <Nav t={t} />
    </>
  )
}
