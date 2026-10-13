import { useState, useEffect, useMemo } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useStore, act } from '../../store'
import { Panel, Field, Pill } from '../../components/ui'
import { AppPreview } from '../app/CustomerApp'
import * as E from '../../lib/engine'
import { CURRENCIES, PARTNERS, KYC_PROVIDERS, PAYIN_BANKS } from '../../lib/reference'
import { gbp2, num, inkOn } from '../../lib/util'

const STEPS = ['Business', 'Brand', 'Corridors & fees', 'Integrations', 'Compliance', 'Domain & launch']
const PRIMARY = ['#1D5C4D', '#0E5E6F', '#24409E', '#8C3B2E', '#5B2A86', '#1B2559', '#B4472A', '#2D3748']
const ACCENT = ['#F0B44C', '#F2A541', '#53C4B0', '#E8C468', '#EF6F6C', '#9AD1D4']

export default function Onboard() {
  const { token } = useParams()
  const db = useStore((s) => s.db)
  const nav = useNavigate()
  const inv = db.invites.find((i) => i.token === token)
  const [start] = useState(() => Date.now())
  const [now, setNow] = useState(Date.now())
  const [step, setStep] = useState(0)
  const [err, setErr] = useState('')
  const [done, setDone] = useState(null)
  const [d, setD] = useState({
    name: 'Thames Remit', legalName: 'Thames Remit Ltd', frn: '904551', mlr: 'XBML00000412093', email: 'ops@thamesremit.co.uk', ownerName: 'Hassan Ali',
    appName: 'Thames Remit', color: '#1D5C4D', accent: '#F0B44C', logo: null,
    corridors: ['PKR', 'BDT'], fee: '2.49', margin: '1.1', partners: ['daytona'], payoutCustomName: '', kyc: 'didit', kycCustomName: '', payin: ['clearbank'], declaration: false,
    edd: '5000', sof: '2000', daily: '10000', idv: 'Document + selfie liveness', screening: 'Real-time sanctions + PEP', mlro: 'Hassan Ali',
    slug: 'thames', domain: '',
  })
  useEffect(() => { if (done) return; const h = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(h) }, [done])
  const secs = Math.floor(((done?.at || now) - start) / 1000)
  const clock = `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`
  const set = (k) => (e) => setD({ ...d, [k]: e.target.value })
  const preview = useMemo(() => ({ name: d.name || 'Your business', brand: { color: d.color, accent: d.accent, logo: d.logo, appName: d.appName || d.name }, corridors: d.corridors.map((cur) => ({ cur, enabled: true, fee: +d.fee || 0, margin: +d.margin || 0, min: 10, max: 10000 })), partners: d.partners }), [d])

  if (!inv) return <Shell><Panel pad><h2>This link isn't valid</h2><p className="muted">Ask TheFXSoft for a new onboarding link.</p><Link to="/">Home</Link></Panel></Shell>
  if (inv.usedBy && !done) { const t = db.tenants.find((x) => x.id === inv.usedBy); return <Shell><Panel pad><h2>This link has already been used</h2><p className="muted">{t?.name} was set up with it. <Link to="/">Sign in</Link> to continue.</p></Panel></Shell> }

  const validate = () => {
    if (step === 0) { if (!d.name.trim()) return 'Enter your trading name.'; if (!/^\d{6,7}$/.test(d.frn.trim())) return 'FRN must be 6 or 7 digits (from the FCA register).'; if (!/.+@.+\..+/.test(d.email)) return 'Enter a valid admin email.' }
    if (step === 2 && !d.corridors.length) return 'Pick at least one corridor.'
    if (step === 3) { if (!d.partners.length && !d.payoutCustomName.trim()) return 'Choose a payout partner or request a custom one.'; if (d.kyc === 'custom' && !d.kycCustomName.trim()) return 'Name the KYC provider you want integrated.'; if (!d.payin.length) return 'Choose at least one pay-in bank.' }
    if (step === 5) { if (!d.declaration) return 'Please confirm the declaration.'; if (!/^[a-z0-9-]{3,30}$/.test(d.slug)) return 'Use 3–30 lowercase letters, numbers or hyphens.'; if (db.tenants.some((t) => t.slug === d.slug)) return `${d.slug}.coremit.app is taken. Try another.` }
    return ''
  }
  const next = () => { const e = validate(); setErr(e); if (!e) setStep(step + 1) }
  const launch = () => {
    const e = validate(); setErr(e); if (e) return
    const t = act((db2) => E.completeOnboarding(db2, token, d, Math.floor((Date.now() - start) / 1000)))
    if (t) setDone({ at: Date.now(), t })
  }
  const toggleArr = (k, v) => () => { const arr = d[k].includes(v) ? d[k].filter((x) => x !== v) : [...d[k], v]; const nd = { ...d, [k]: arr }; if (k === 'corridors') nd.partners = d.partners.filter((p) => PARTNERS.find((x) => x.id === p).cur.some((c) => arr.includes(c))); setD(nd) }
  const onFile = (e) => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => setD({ ...d, logo: r.result }); r.readAsDataURL(f) }

  if (done) return (
    <Shell>
      <div className="wiz">
        <Panel pad>
          <div className="stack" style={{ alignItems: 'center', textAlign: 'center' }}>
            <Pill tone="good">Submitted</Pill>
            <span className="mono" style={{ fontSize: 44, fontWeight: 600, color: 'var(--good)' }}>{clock}</span>
            <h2>{d.name} is set up</h2>
            <p className="muted" style={{ maxWidth: '52ch' }}>Your admin portal, staff logins and customer app are ready in test mode at <span className="mono">{d.slug}.coremit.app</span>. They go live once TheFXSoft confirms the agreement, integrations and prefunding.</p>
            <div className="list" style={{ width: '100%', textAlign: 'left', border: '1px solid var(--line)', borderRadius: 10 }}>
              <div className="li"><span className="stripe" style={{ background: 'var(--good)' }} /><div className="grow"><b>Portal, admin and app generated</b><small>From the settings you just entered</small></div><Pill tone="good">Done</Pill></div>
              <div className="li"><span className="stripe" style={{ background: 'var(--warn)' }} /><div className="grow"><b>Checks by TheFXSoft</b><small>Companies House, FCA register, HMRC MLR, directors and beneficial owners</small></div><Pill tone="warn">In progress</Pill></div>
              <div className="li"><span className="stripe" style={{ background: 'var(--line)' }} /><div className="grow"><b>Go live</b><small>Customers can sign up and send money</small></div><Pill tone="mute">Next</Pill></div>
            </div>
            <div className="row" style={{ justifyContent: 'center' }}>
              <button className="btn pri" onClick={() => { useStore.getState().login({ kind: 'msb', tenantId: done.t.id, role: 'Admin', name: d.ownerName || 'Owner' }); nav('/portal') }}>Open my admin portal</button>
              <button className="btn" onClick={() => { useStore.getState().login({ kind: 'super' }); nav('/admin/approvals') }}>See it as Super Admin</button>
            </div>
          </div>
        </Panel>
        <div className="sticky"><div className="phone"><AppPreview t={preview} /></div></div>
      </div>
    </Shell>
  )

  const avail = PARTNERS.filter((p) => p.cur.some((c) => d.corridors.includes(c)))
  const toggleBank = (id) => () => setD({ ...d, payin: d.payin.includes(id) ? d.payin.filter((x) => x !== id) : [...d.payin, id] })
  const body = [
    <div className="form">
      <Field label="Trading name" id="w-name"><input id="w-name" className="inp" value={d.name} onChange={set('name')} /></Field>
      <Field label="Legal entity name" id="w-legal"><input id="w-legal" className="inp" value={d.legalName} onChange={set('legalName')} /></Field>
      <Field label="FCA firm reference number (FRN)" id="w-frn" hint="6 or 7 digits, from the FCA register"><input id="w-frn" className="inp mono" inputMode="numeric" value={d.frn} onChange={set('frn')} /></Field>
      <Field label="HMRC MLR registration number" id="w-mlr"><input id="w-mlr" className="inp mono" value={d.mlr} onChange={set('mlr')} /></Field>
      <Field label="Your name" id="w-own"><input id="w-own" className="inp" value={d.ownerName} onChange={set('ownerName')} /></Field>
      <Field label="Admin email" id="w-email" hint="You'll sign in to your admin portal with this"><input id="w-email" className="inp" type="email" value={d.email} onChange={set('email')} /></Field>
    </div>,
    <div className="stack">
      <div className="form"><Field label="App name customers see" id="w-app"><input id="w-app" className="inp" value={d.appName} onChange={set('appName')} /></Field><Field label="Logo" id="w-logo" hint="Square PNG or SVG works best"><input id="w-logo" type="file" accept="image/*" onChange={onFile} /></Field></div>
      <Field label="Primary colour"><div className="swatches">{PRIMARY.map((c) => <button key={c} type="button" className="sw" style={{ background: c }} aria-label={c} aria-pressed={d.color === c} onClick={() => setD({ ...d, color: c })} />)}<input type="color" id="w-color" value={d.color} onChange={set('color')} /></div></Field>
      <Field label="Accent colour"><div className="swatches">{ACCENT.map((c) => <button key={c} type="button" className="sw" style={{ background: c }} aria-label={c} aria-pressed={d.accent === c} onClick={() => setD({ ...d, accent: c })} />)}<input type="color" id="w-accent" value={d.accent} onChange={set('accent')} /></div></Field>
    </div>,
    <div className="stack">
      <Field label="Corridors you send to"><div className="checks">{Object.entries(CURRENCIES).map(([c, v]) => <label key={c} className="check"><input type="checkbox" checked={d.corridors.includes(c)} onChange={toggleArr('corridors', c)} /><span>GBP → {c}<small>{v.country} · partner rate {num(v.rate)}</small></span></label>)}</div></Field>
      <div className="form"><Field label="Transfer fee (£)" id="w-fee" hint="Flat fee per transfer"><input id="w-fee" className="inp num" inputMode="decimal" value={d.fee} onChange={set('fee')} /></Field><Field label="FX margin (%)" id="w-margin" hint="Your margin on the partner rate"><input id="w-margin" className="inp num" inputMode="decimal" value={d.margin} onChange={set('margin')} /></Field></div>
    </div>,
    <div className="stack">
      <div className="banner">Included integrations cost nothing extra. A <b>custom</b> integration is scoped and quoted separately by TheFXSoft (setup fee, monthly fee and build time).</div>
      <Field label="Identity verification (KYC) provider"><div className="checks">{KYC_PROVIDERS.map((k) => <label key={k.id} className="check"><input type="radio" name="kyc" checked={d.kyc === k.id} onChange={() => setD({ ...d, kyc: k.id })} /><span>{k.name} {k.included ? <Pill tone="good">Included</Pill> : <Pill tone="info">Extra cost</Pill>}<small>{k.desc}</small></span></label>)}</div>
        {d.kyc === 'custom' && <input className="inp" style={{ marginTop: 8 }} placeholder="Provider name, e.g. Onfido" value={d.kycCustomName} onChange={set('kycCustomName')} aria-label="Custom KYC provider name" />}</Field>
      <Field label="Payout partner"><div className="checks">{avail.map((p) => <label key={p.id} className="check"><input type="checkbox" checked={d.partners.includes(p.id)} onChange={toggleArr('partners', p.id)} /><span>{p.name} <Pill tone="good">Included</Pill><small>{p.cur.filter((c) => d.corridors.includes(c)).join(', ')} · {p.methods.join(', ')}</small></span></label>)}
        <label className="check"><input type="checkbox" checked={!!d.payoutCustomName} onChange={(e) => setD({ ...d, payoutCustomName: e.target.checked ? d.payoutCustomName || 'My existing partner' : '' })} /><span>Request a custom payout partner <Pill tone="info">Extra cost</Pill><small>Keep a partner you already have a contract with</small></span></label></div>
        {d.payoutCustomName !== '' && <input className="inp" style={{ marginTop: 8 }} placeholder="Partner name" value={d.payoutCustomName} onChange={set('payoutCustomName')} aria-label="Custom payout partner name" />}</Field>
      <Field label="Pay-in banks and card acquirers"><div className="checks">{PAYIN_BANKS.filter((b) => b.id !== 'custom').map((b) => <label key={b.id} className="check"><input type="checkbox" checked={d.payin.includes(b.id)} onChange={toggleBank(b.id)} /><span>{b.name} <Pill tone="good">Included</Pill><small>{b.kind}</small></span></label>)}</div><span className="hint">Need another bank? Request it from Settings → Integrations after launch.</span></Field>
    </div>,
    <div className="form">
      <Field label="Enhanced due diligence above (£)" id="w-edd"><input id="w-edd" className="inp num" value={d.edd} onChange={set('edd')} /></Field>
      <Field label="Ask for source of funds above (£)" id="w-sof"><input id="w-sof" className="inp num" value={d.sof} onChange={set('sof')} /></Field>
      <Field label="Daily limit per customer (£)" id="w-daily"><input id="w-daily" className="inp num" value={d.daily} onChange={set('daily')} /></Field>
      <Field label="MLRO (nominated officer)" id="w-mlro"><input id="w-mlro" className="inp" value={d.mlro} onChange={set('mlro')} /></Field>
      <Field label="Customer ID verification" id="w-idv"><select id="w-idv" className="sel" value={d.idv} onChange={set('idv')}><option>Document + selfie liveness</option><option>Document only</option><option>Electronic ID check (database)</option></select></Field>
      <Field label="Screening" id="w-scr"><select id="w-scr" className="sel" value={d.screening} onChange={set('screening')}><option>Real-time sanctions + PEP</option><option>Real-time sanctions + PEP + adverse media</option></select></Field>
      <div className="banner" style={{ gridColumn: '1 / -1' }}>A starter set of monitoring rules (document bands, structuring, velocity, first-transfer, PEP, sanctions, KYC…) and policy templates are created for you. They are a starting point: your MLRO decides what to keep, change or add.</div>
    </div>,
    <div className="stack">
      <Field label="Your address on CoRemit" id="w-slug" hint="Lowercase letters, numbers and hyphens"><div className="suffix"><input id="w-slug" value={d.slug} onChange={(e) => setD({ ...d, slug: e.target.value.toLowerCase() })} /><span>.coremit.app</span></div></Field>
      <Field label="Custom domain (optional)" id="w-domain" hint="Point a CNAME record to tenants.coremit.app. You can add this later."><input id="w-domain" className="inp" placeholder="send.yourbusiness.co.uk" value={d.domain} onChange={set('domain')} /></Field>
      <div className="list" style={{ border: '1px solid var(--line)', borderRadius: 10 }}>
        <div className="li"><div className="grow"><b>{d.name}</b><small>FRN {d.frn} · MLR {d.mlr} · {d.email}</small></div><button className="btn sm" onClick={() => setStep(0)}>Edit</button></div>
        <div className="li"><div className="grow"><b>Corridors</b><small>{d.corridors.map((c) => 'GBP → ' + c).join(', ') || 'None'} · fee {gbp2(+d.fee || 0)} · margin {d.margin}%</small></div><button className="btn sm" onClick={() => setStep(2)}>Edit</button></div>
        <div className="li"><div className="grow"><b>Integrations</b><small>KYC: {d.kyc === 'custom' ? `${d.kycCustomName} (custom, quoted)` : KYC_PROVIDERS.find((k) => k.id === d.kyc)?.name} · Payout: {[...d.partners.map((p) => PARTNERS.find((x) => x.id === p)?.name), ...(d.payoutCustomName ? [`${d.payoutCustomName} (custom, quoted)`] : [])].join(', ')} · Pay-in: {d.payin.map((b) => PAYIN_BANKS.find((x) => x.id === b)?.name).join(', ')}</small></div><button className="btn sm" onClick={() => setStep(3)}>Edit</button></div>
        <div className="li"><div className="grow"><b>Compliance</b><small>EDD above £{d.edd} · source of funds above £{d.sof} · MLRO {d.mlro}</small></div><button className="btn sm" onClick={() => setStep(4)}>Edit</button></div>
      </div>
      <label className="check"><input type="checkbox" checked={d.declaration} onChange={(e) => setD({ ...d, declaration: e.target.checked })} /><span><b>Declaration.</b> I confirm that {d.legalName || d.name} holds the FCA and HMRC registrations it needs to provide money remittance in the UK, and that it, not TheFXSoft, is responsible for its own regulatory compliance, including how it configures and uses the compliance tools on this platform.</span></label>
    </div>,
  ][step]

  return (
    <Shell>
      <div className="wiz">
        <div className="stack">
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div><span className="muted mono small">onboard.coremit.app/{token}</span><h1 style={{ fontSize: 24, marginTop: 4 }}>Set up your remittance business</h1><p className="muted" style={{ marginTop: 4 }}>Example answers are filled in. Overwrite them with yours.</p></div>
            <div className="timer"><span className="muted" style={{ fontSize: 11.5 }}>Elapsed · target 15:00</span><div className="t">{clock}</div><div className="track"><div className="fill" style={{ width: `${Math.min(100, (secs / 900) * 100)}%` }} /></div></div>
          </div>
          <div className="steps">{STEPS.map((s, i) => <button key={s} type="button" className={i < step ? 'done' : i === step ? 'cur' : ''} onClick={() => i < step && setStep(i)}><span>Step {i + 1}</span>{s}</button>)}</div>
          <Panel title={STEPS[step]} pad>{body}</Panel>
          {err && <span className="err">{err}</span>}
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <button className="btn" disabled={step === 0} onClick={() => { setErr(''); setStep(step - 1) }}>Back</button>
            {step < 5 ? <button className="btn pri" onClick={next}>Continue</button> : <button className="btn pri" onClick={launch}>Launch my platform</button>}
          </div>
        </div>
        <div className="sticky stack" style={{ alignItems: 'center' }}><div className="phone"><AppPreview t={preview} /></div><span className="muted small mono">Live preview · your customers' app</span></div>
      </div>
    </Shell>
  )
}

const Shell = ({ children }) => <div style={{ minHeight: '100vh' }}><header className="pbar"><span className="wordmark">Co<i>R</i>emit<small>by TheFXSoft</small></span><span className="chip-dark">MSB onboarding</span></header>{children}</div>
