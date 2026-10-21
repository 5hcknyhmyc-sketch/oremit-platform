import { useState, useEffect, useMemo } from 'react'
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom'
import { Send, Coins, Layers, Check, Lock, ShieldCheck, Smartphone, Monitor, LayoutDashboard, Mail, Upload, Globe, Sparkles } from 'lucide-react'
import { useStore, act } from '../../store'
import { Panel, Field, Pill, Wordmark, Modal, MadeBy, brandVars } from '../../components/ui'
import { AppPreview } from '../app/CustomerApp'
import OnboardBureau from './OnboardBureau'
import * as E from '../../lib/engine'
import { CURRENCIES, PARTNERS, KYC_PROVIDERS, PAYIN_BANKS, PLATFORM } from '../../lib/reference'
import { defaultEmails, renderEmail, EMAIL_VARS } from '../../lib/emails'
import { gbp2, num, inkOn, initials } from '../../lib/util'
import PricingTable, { DEFAULT_PRICING, PricingHint } from '../../components/PricingTable'
import { fetchBrand } from '../../lib/brand'

const STEPS = ['Business', 'What you need', 'Design', 'Identity checks', 'Payouts', 'Payments in', 'Compliance', 'Emails', 'Admin portal', 'Launch']
const PRIMARY = ['#1E7A5A', '#0F766E', '#1D5C4D', '#1E40AF', '#5B21B6', '#B45309', '#BE123C', '#1F2937']
const ACCENT = ['#F0B44C', '#53C4B0', '#F2A541', '#E8C468', '#EF6F6C', '#9AD1D4', '#86EFAC', '#FDE68A']
const FONTS = ['Inter', 'Manrope', 'DM Sans', 'Poppins', 'Nunito', 'Roboto', 'Plus Jakarta Sans', 'Lato']
const TARGET = 15 * 60

/* ---------- Entry: /get-started ---------- */
export default function Onboard() {
  const { token } = useParams()
  const db = useStore((s) => s.db)
  if (!token) return <Chooser />
  const inv = db.invites.find((i) => i.token === token)
  if (inv && !(inv.products || ['remittance']).includes('remittance')) return <OnboardBureau />
  return <RemitWizard inv={inv} token={token} />
}

function Chooser() {
  const nav = useNavigate()
  const loc = useLocation()
  const bureauLink = loc.pathname.endsWith('/bureau')
  const [pick, setPick] = useState(bureauLink ? 'bureau' : 'remittance')
  const go = () => {
    const products = pick === 'both' ? ['remittance', 'bureau'] : [pick]
    const inv = act((d) => E.createInvite(d, 'Self-service', pick === 'both' ? 'Remittance + bureau' : pick === 'bureau' ? 'Bureau de change' : 'Remittance', products))
    if (inv) nav(`/onboard/${inv.token}`)
  }
  const opts = [
    { id: 'remittance', icon: Send, title: 'Home remittance software', desc: 'Your customers send money abroad through your own branded app and web portal. Compliance, payouts and ledgers built in.' },
    { id: 'bureau', icon: Coins, title: 'Bureau de change software', desc: 'Over-the-counter cash FX: rate board, tills, stock, deals and online currency orders.' },
    { id: 'both', icon: Layers, title: 'Both', desc: 'One admin portal that runs remittance and your cash bureau, sharing customers, compliance and ledgers.' },
  ]
  return (
    <Shell>
      <div className="chooser">
        <div className="stack-s" style={{ textAlign: 'center', alignItems: 'center' }}>
          <Pill tone="good">Self-service · live in under 15 minutes</Pill>
          <h1 style={{ fontSize: 30 }}>What would you like to set up?</h1>
          <p className="muted" style={{ maxWidth: '58ch' }}>Pick a product, answer a few questions, design your portal and app, connect your providers and launch. No developers, no waiting.</p>
        </div>
        <div className="choices3">{opts.map((o) => { const I = o.icon; return <button key={o.id} className={`choice-card ${pick === o.id ? 'on' : ''}`} onClick={() => setPick(o.id)}><div className="ic"><I /></div><b>{o.title}</b><small>{o.desc}</small>{pick === o.id && <span className="tick"><Check /></span>}</button> })}</div>
        <div className="row" style={{ justifyContent: 'center' }}><button className="btn pri" style={{ padding: '12px 28px', fontSize: 15 }} onClick={go}>Continue</button></div>
        <p className="muted small" style={{ textAlign: 'center' }}>{PLATFORM.owner} provides the software only. You keep your own FCA / HMRC registrations and your own agreements with KYC, payout and payment providers.</p>
      </div>
    </Shell>
  )
}

/* ---------- Remittance wizard ---------- */
function RemitWizard({ inv, token }) {
  const db = useStore((s) => s.db)
  const nav = useNavigate()
  const products = inv?.products || ['remittance']
  const bdc = products.includes('bureau')
  const [start] = useState(() => Date.now())
  const [now, setNow] = useState(Date.now())
  const [step, setStep] = useState(0)
  const [err, setErr] = useState('')
  const [done, setDone] = useState(null)
  const [connect, setConnect] = useState(null)
  const [fetching, setFetching] = useState(false)
  const [prevTab, setPrevTab] = useState('app')
  const [emailSel, setEmailSel] = useState('pay_instructions')
  const [d, setD] = useState({
    name: 'Thames Remit', legalName: 'Thames Remit Ltd', companyNumber: '12345678', address: '14 Station Road, Barking IG11 8DN', frn: '904551', mlr: 'XBML00000412093', ownerName: 'Hassan Ali', phone: '020 3000 0000', email: 'ops@thamesremit.co.uk',
    hasWebsite: null, website: '', brandFetched: null, wantWebsite: null, websiteRequest: { pages: 'Home, About, Rates, Contact', domain: '', languages: 'English', notes: '', callTime: 'Morning' },
    channels: { portal: true, app: true },
    appName: 'Thames Remit', tagline: 'Send money home in minutes', color: '#1E7A5A', accent: '#F0B44C', font: 'Inter', fontSize: 'M', radius: 14, mode: 'light', nav: 'tabs', logo: null,
    corridors: ['PKR', 'BDT', 'INR'], pricing: { PKR: { ...DEFAULT_PRICING }, BDT: { ...DEFAULT_PRICING }, INR: { ...DEFAULT_PRICING, feePct: 2.5, fee: 0, threshold: 0 } },
    kyc: 'didit', kycCustomName: '', kycConnected: false,
    partners: ['daytona'], payoutConnected: false, payoutCustomName: '',
    payin: ['fena'], payinConnected: {}, payinCustomName: '', payinUrgency: 'standard',
    releaseMode: 'auto', edd: '5000', sof: '2000', daily: '10000', mlro: 'Hassan Ali', policyFiles: [],
    emails: defaultEmails(),
    adminTheme: { sidebar: 'light', accent: '', showLogo: true },
    slug: 'thames', domain: '', declaration: false,
    cashCurrencies: ['EUR', 'USD'], spread: '3',
  })
  useEffect(() => { if (done) return; const h = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(h) }, [done])
  const secs = Math.floor(((done?.at || now) - start) / 1000)
  const clock = `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`
  const set = (k) => (e) => setD({ ...d, [k]: e.target.value })
  const preview = useMemo(() => ({ name: d.name || 'Your business', products, channels: d.channels, brand: { color: d.color, accent: d.accent, logo: d.logo, appName: d.appName || d.name, tagline: d.tagline, font: d.font, fontSize: d.fontSize, radius: d.radius, mode: d.mode, nav: d.nav }, adminTheme: d.adminTheme, corridors: d.corridors.map((cur) => ({ cur, enabled: true, ...DEFAULT_PRICING, ...(d.pricing[cur] || {}), min: 10, max: 10000 })), partners: d.partners, bureau: { spreadPct: +d.spread || 3, board: {}, currencies: d.cashCurrencies } }), [d, products])

  if (!inv) return <Shell><Panel pad><h2>This link isn't valid</h2><p className="muted">Start again from <Link to="/get-started">get started</Link>.</p></Panel></Shell>
  if (inv.usedBy && !done) { const t = db.tenants.find((x) => x.id === inv.usedBy); return <Shell><Panel pad><h2>This link has already been used</h2><p className="muted">{t?.name} was set up with it. <Link to="/">Sign in</Link> to continue.</p></Panel></Shell> }

  const validate = () => {
    if (step === 0) { if (!d.name.trim()) return 'Enter your trading name.'; if (!d.legalName.trim()) return 'Enter your registered company name.'; if (!/^\d{6,7}$/.test(d.frn.trim())) return 'FRN must be 6 or 7 digits (from the FCA register).'; if (!d.mlr.trim()) return 'Enter your HMRC MLR registration number.'; if (!/.+@.+\..+/.test(d.email)) return 'Enter a valid email.'; if (d.hasWebsite === true && !d.website.trim()) return 'Enter your website address (or say you don\'t have one).' }
    if (step === 2 && !d.appName.trim()) return 'Give your app a name.'
    if (step === 3 && d.kyc === 'custom' && !d.kycCustomName.trim()) return 'Tell us which KYC provider you use.'
    if (step === 4) { if (!d.corridors.length) return 'Pick at least one country you send to.'; if (!d.partners.length && !d.payoutCustomName.trim()) return 'Choose the built-in payout partner or name your own.' }
    if (step === 5 && !d.payin.length && !d.payinCustomName.trim()) return 'Choose a payment processor or request one.'
    if (step === 6 && !d.mlro.trim()) return 'Name your MLRO (nominated officer).'
    if (step === 9) { if (!d.declaration) return 'Please confirm the declaration.'; if (!/^[a-z0-9-]{3,30}$/.test(d.slug)) return 'Use 3–30 lowercase letters, numbers or hyphens.'; if (db.tenants.some((t) => t.slug === d.slug)) return `${d.slug}.${PLATFORM.domain} is taken. Try another.` }
    return ''
  }
  const next = () => { const e = validate(); setErr(e); if (!e) { setStep(step + 1); if (step + 1 === 8) setPrevTab('admin'); else if (step + 1 === 2) setPrevTab('app') } }
  const launch = () => {
    const e = validate(); setErr(e); if (e) return
    const payload = { ...d, nav: d.nav, payoutConnected: d.payoutConnected, payinConnected: d.payinConnected, adminTheme: { ...d.adminTheme, accent: d.adminTheme.accent || null }, bdcThreshold: '5000', supplier: 'Wholesale FX Ltd', openingFloat: '0', branches: [{ name: 'Head office', address: d.address }] }
    const t = act((db2) => E.completeOnboarding(db2, token, payload, Math.floor((Date.now() - start) / 1000)))
    if (t) setDone({ at: Date.now(), t })
  }
  const toggleArr = (k, v) => () => { const arr = d[k].includes(v) ? d[k].filter((x) => x !== v) : [...d[k], v]; const nd = { ...d, [k]: arr }; if (k === 'corridors' && !d.pricing[v]) nd.pricing = { ...d.pricing, [v]: { ...DEFAULT_PRICING } }; setD(nd) }
  const onFile = (e) => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => setD({ ...d, logo: r.result }); r.readAsDataURL(f) }
  const grabBrand = async () => {
    setFetching(true); setErr('')
    try {
      const b = await fetchBrand(d.website)
      setD((x) => ({ ...x, brandFetched: b, logo: b.logo || x.logo, color: b.color || x.color, appName: x.appName === 'Thames Remit' && b.name && b.source === 'site' ? b.name : x.appName, name: x.name === 'Thames Remit' && b.name && b.source === 'site' ? b.name : x.name }))
    } catch (e) { setErr(e.message) }
    setFetching(false)
  }
  const onPolicy = (e) => { const fs = [...e.target.files].map((f) => f.name); setD({ ...d, policyFiles: [...new Set([...d.policyFiles, ...fs])] }) }
  const emailTpl = d.emails.find((x) => x.id === emailSel)
  const setEmail = (k, v) => setD({ ...d, emails: d.emails.map((x) => (x.id === emailSel ? { ...x, [k]: v } : x)) })

  if (done) return (
    <Shell>
      <div className="wiz">
        <Panel pad>
          <div className="stack" style={{ alignItems: 'center', textAlign: 'center' }}>
            <Pill tone="good">Launched</Pill>
            <span className="mono" style={{ fontSize: 44, fontWeight: 600, color: 'var(--good)' }}>{clock}</span>
            <h2>{d.name} is live in test mode</h2>
            <p className="muted" style={{ maxWidth: '54ch' }}>Your admin portal{d.channels.portal ? ', customer web portal' : ''}{d.channels.app ? ' and customer app' : ''} are ready at <span className="mono">{d.slug}.{PLATFORM.domain}</span>. Real transfers start once {PLATFORM.owner} confirms your agreement and your provider accounts are prefunded.</p>
            <div className="list" style={{ width: '100%', textAlign: 'left', border: '1px solid var(--line)', borderRadius: 10 }}>
              <div className="li"><span className="stripe" style={{ background: 'var(--good)' }} /><div className="grow"><b>Admin portal, web portal and app generated</b><small>From the design and settings you just chose</small></div><Pill tone="good">Done</Pill></div>
              <div className="li"><span className="stripe" style={{ background: d.kycConnected && d.payoutConnected ? 'var(--good)' : 'var(--warn)' }} /><div className="grow"><b>Provider accounts</b><small>KYC {d.kyc === 'custom' ? `${d.kycCustomName} (requested)` : d.kycConnected ? 'connected' : 'not connected yet'} · payouts {d.payoutConnected ? 'connected' : d.partners.length ? 'not connected yet' : 'requested'} · payments in {Object.values(d.payinConnected).some(Boolean) ? 'connected' : 'not connected yet'}</small></div><Pill tone={d.kycConnected && d.payoutConnected ? 'good' : 'warn'}>{d.kycConnected && d.payoutConnected ? 'Done' : 'Finish in Settings'}</Pill></div>
              <div className="li"><span className="stripe" style={{ background: 'var(--warn)' }} /><div className="grow"><b>Checks by {PLATFORM.owner}</b><small>Agreement, Companies House, directors and beneficial owners</small></div><Pill tone="warn">In progress</Pill></div>
              {d.channels.app && <div className="li"><span className="stripe" style={{ background: 'var(--info)' }} /><div className="grow"><b>App store listing</b><small>Your iOS and Android builds are generated now. Apple and Google review takes a few days; the installable web app works immediately.</small></div><Pill tone="info">Building</Pill></div>}
            </div>
            <div className="row" style={{ justifyContent: 'center' }}>
              <button className="btn pri" onClick={() => { useStore.getState().login({ kind: 'msb', tenantId: done.t.id, role: 'Admin', name: d.ownerName || 'Owner' }); nav('/portal') }}>Open my admin portal</button>
              {(d.channels.portal || d.channels.app) && <Link className="btn" to={`/app/${d.slug}`}>Open my customer app</Link>}
              <button className="btn" onClick={() => { useStore.getState().login({ kind: 'super' }); nav('/admin/approvals') }}>See it as Super Admin</button>
            </div>
          </div>
        </Panel>
        <PreviewPane t={preview} tab={prevTab} setTab={setPrevTab} />
      </div>
    </Shell>
  )

  const avail = PARTNERS.filter((p) => p.cur.some((c) => d.corridors.includes(c)))
  const kycName = KYC_PROVIDERS.find((k) => k.id === d.kyc)?.name
  const Disclaimer = ({ what }) => <div className="banner warn"><ShieldCheck /><span><b>Your account, your agreement.</b> {what} is a built-in integration, but you still need your own account, your own logins and your own commercial agreement and pricing with them. {PLATFORM.owner} provides the IT service only and is not a party to that agreement.</span></div>
  const Connected = ({ ok, onClick, name }) => ok ? <Pill tone="good">Connected</Pill> : <button type="button" className="btn pri sm" onClick={onClick}><Lock />Log in to {name}</button>

  const body = [
    /* 0 Business */
    <div className="stack">
      <p className="muted">Example answers are filled in. Overwrite them with yours.</p>
      <div className="form">
        <Field label="Registered company name" id="w-legal"><input id="w-legal" className="inp" value={d.legalName} onChange={set('legalName')} /></Field>
        <Field label="Trading name" id="w-name" hint="The name customers know you by"><input id="w-name" className="inp" value={d.name} onChange={set('name')} /></Field>
        <Field label="Companies House number" id="w-ch"><input id="w-ch" className="inp mono" value={d.companyNumber} onChange={set('companyNumber')} /></Field>
        <Field label="Registered address" id="w-addr"><input id="w-addr" className="inp" value={d.address} onChange={set('address')} /></Field>
        <Field label="FCA firm reference number (FRN)" id="w-frn" hint="6 or 7 digits · stored as you enter it, we do not verify it"><input id="w-frn" className="inp mono" inputMode="numeric" value={d.frn} onChange={set('frn')} /></Field>
        <Field label="HMRC MLR registration number" id="w-mlr"><input id="w-mlr" className="inp mono" value={d.mlr} onChange={set('mlr')} /></Field>
        <Field label="Your name" id="w-own"><input id="w-own" className="inp" value={d.ownerName} onChange={set('ownerName')} /></Field>
        <Field label="Phone" id="w-phone"><input id="w-phone" className="inp" value={d.phone} onChange={set('phone')} /></Field>
        <Field label="Admin email" id="w-email" hint="You'll sign in to your admin portal with this"><input id="w-email" className="inp" type="email" value={d.email} onChange={set('email')} /></Field>
      </div>
      <Field label="Do you have a website?"><div className="seg" role="radiogroup">{[[true, 'Yes'], [false, 'No']].map(([v, l]) => <button key={l} type="button" role="radio" aria-checked={d.hasWebsite === v} onClick={() => setD({ ...d, hasWebsite: v })}>{l}</button>)}</div></Field>
      {d.hasWebsite === true && <div className="stack-s">
        <div className="promo-row"><input className="inp" placeholder="www.yourbusiness.co.uk" value={d.website} onChange={set('website')} aria-label="Website address" onKeyDown={(e) => e.key === 'Enter' && grabBrand()} /><button type="button" className="btn pri" onClick={grabBrand} disabled={fetching || !d.website.trim()}><Sparkles />{fetching ? 'Looking…' : 'Use my branding'}</button></div>
        {d.brandFetched ? <div className="banner good" style={{ alignItems: 'center' }}>{d.logo && <img src={d.logo} alt="" style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'contain', background: '#fff' }} />}<span>We found <b>{d.brandFetched.name}</b>{d.brandFetched.color ? <> and your colour <span style={{ display: 'inline-block', width: 14, height: 14, borderRadius: 4, background: d.brandFetched.color, verticalAlign: 'middle', marginLeft: 4 }} /> {d.brandFetched.color}</> : ''}. Applied to your app and web portal — change anything in the Design step.</span></div>
          : <span className="hint">We'll fetch your logo and colours from the site and apply them to your app and web portal. You can still change them.</span>}
      </div>}
      {d.hasWebsite === false && <div className="stack-s">
        <Field label="Would you like us to build you a website?"><div className="seg" role="radiogroup">{[[true, 'Yes, please'], [false, 'No thanks']].map(([v, l]) => <button key={l} type="button" role="radio" aria-checked={d.wantWebsite === v} onClick={() => setD({ ...d, wantWebsite: v })}>{l}</button>)}</div></Field>
        {d.wantWebsite === true && <div className="banner" style={{ display: 'block' }}><div className="row" style={{ marginBottom: 8 }}><Globe /><b>Quick website brief — we'll call you back</b></div>
          <div className="form">
            <Field label="Pages you want" id="ws-p"><input id="ws-p" className="inp" value={d.websiteRequest.pages} onChange={(e) => setD({ ...d, websiteRequest: { ...d.websiteRequest, pages: e.target.value } })} /></Field>
            <Field label="Preferred domain" id="ws-d"><input id="ws-d" className="inp" placeholder="yourbusiness.co.uk" value={d.websiteRequest.domain} onChange={(e) => setD({ ...d, websiteRequest: { ...d.websiteRequest, domain: e.target.value } })} /></Field>
            <Field label="Languages" id="ws-l"><input id="ws-l" className="inp" value={d.websiteRequest.languages} onChange={(e) => setD({ ...d, websiteRequest: { ...d.websiteRequest, languages: e.target.value } })} /></Field>
            <Field label="Best time to call" id="ws-c"><select id="ws-c" className="sel" value={d.websiteRequest.callTime} onChange={(e) => setD({ ...d, websiteRequest: { ...d.websiteRequest, callTime: e.target.value } })}><option>Morning</option><option>Afternoon</option><option>Evening</option></select></Field>
          </div>
          <Field label="Anything else" id="ws-n"><textarea id="ws-n" className="ta" rows={2} value={d.websiteRequest.notes} onChange={(e) => setD({ ...d, websiteRequest: { ...d.websiteRequest, notes: e.target.value } })} /></Field>
          <span className="hint">Websites are built by {PLATFORM.owner} as a separate service and quoted after the call. Your app and customer web portal launch today regardless.</span></div>}
      </div>}
    </div>,
    /* 1 Channels */
    <div className="stack">
      <p className="muted">Every package includes the admin portal for you and your staff. Choose how your customers reach you. You can change this later.</p>
      <div className="choices3">
        {[{ id: 'both', icon: Layers, t: 'Web portal + mobile app', s: 'Customers send from your website and from your iOS / Android app. Same features, same brand.', c: { portal: true, app: true } },
          { id: 'app', icon: Smartphone, t: 'Mobile app only', s: 'iOS and Android app for customers. No public web portal.', c: { portal: false, app: true } },
          { id: 'admin', icon: LayoutDashboard, t: 'Admin portal only', s: 'Run everything from the back office: walk-in and phone customers, no customer channel.', c: { portal: false, app: false } }].map((o) => { const I = o.icon; const on = d.channels.portal === o.c.portal && d.channels.app === o.c.app; return <button key={o.id} type="button" className={`choice-card ${on ? 'on' : ''}`} onClick={() => setD({ ...d, channels: o.c })}><div className="ic"><I /></div><b>{o.t}</b><small>{o.s}</small>{on && <span className="tick"><Check /></span>}</button> })}
      </div>
      <div className="banner"><Monitor /><span>The web portal and the app are <b>one product</b>: anything you design or change for one is applied to the other automatically.</span></div>

    </div>,
    /* 2 Design */
    <div className="stack">
      <div className="form">
        <Field label="App / portal name" id="w-app"><input id="w-app" className="inp" value={d.appName} onChange={set('appName')} /></Field>
        <Field label="Tagline" id="w-tag"><input id="w-tag" className="inp" value={d.tagline} onChange={set('tagline')} /></Field>
        <Field label="Logo" id="w-logo" hint="Square PNG or SVG, at least 256px"><div className="row"><input id="w-logo" type="file" accept="image/*" onChange={onFile} />{d.logo && <button type="button" className="btn sm" onClick={() => setD({ ...d, logo: null })}>Remove</button>}</div></Field>
      </div>
      <div className="form">
        <Field label="Primary colour"><div className="swatches">{PRIMARY.map((c) => <button key={c} type="button" className="sw" style={{ background: c }} aria-label={c} aria-pressed={d.color === c} onClick={() => setD({ ...d, color: c })} />)}<input type="color" id="w-color" value={d.color} onChange={set('color')} aria-label="Custom primary colour" /></div></Field>
        <Field label="Accent colour"><div className="swatches">{ACCENT.map((c) => <button key={c} type="button" className="sw" style={{ background: c }} aria-label={c} aria-pressed={d.accent === c} onClick={() => setD({ ...d, accent: c })} />)}<input type="color" id="w-accent" value={d.accent} onChange={set('accent')} aria-label="Custom accent colour" /></div></Field>
      </div>
      <div className="form">
        <Field label="Font" id="w-font"><select id="w-font" className="sel" value={d.font} onChange={set('font')} style={{ fontFamily: `"${d.font}", sans-serif` }}>{FONTS.map((f) => <option key={f} value={f} style={{ fontFamily: `"${f}", sans-serif` }}>{f}</option>)}</select></Field>
        <Field label="Text size" id="w-fs"><div className="seg" role="radiogroup">{[['S', 'Small'], ['M', 'Medium'], ['L', 'Large']].map(([v, l]) => <button key={v} type="button" role="radio" aria-checked={d.fontSize === v} onClick={() => setD({ ...d, fontSize: v })}>{l}</button>)}</div></Field>
        <Field label={`Corner roundness · ${d.radius}px`} id="w-rad"><input id="w-rad" type="range" min="0" max="28" value={d.radius} onChange={(e) => setD({ ...d, radius: +e.target.value })} /></Field>
        <Field label="Appearance" id="w-mode"><div className="seg" role="radiogroup">{[['light', 'Light'], ['dark', 'Dark'], ['system', 'Match device']].map(([v, l]) => <button key={v} type="button" role="radio" aria-checked={d.mode === v} onClick={() => setD({ ...d, mode: v })}>{l}</button>)}</div></Field>
        <Field label="Navigation" id="w-nav"><div className="seg" role="radiogroup">{[['tabs', 'Bottom tabs'], ['sidebar', 'Side menu']].map(([v, l]) => <button key={v} type="button" role="radio" aria-checked={d.nav === v} onClick={() => setD({ ...d, nav: v })}>{l}</button>)}</div></Field>
      </div>
      <div className="banner good"><Check /><span>Everything you choose here is applied to <b>both</b> the web portal and the mobile app. Use the preview tabs on the right to switch between them.</span></div>
    </div>,
    /* 3 KYC */
    <div className="stack">
      <Disclaimer what="Your identity-check provider" />
      <Field label="Identity verification (KYC) provider"><div className="checks">{KYC_PROVIDERS.map((k) => <label key={k.id} className="check"><input type="radio" name="kyc" checked={d.kyc === k.id} onChange={() => setD({ ...d, kyc: k.id, kycConnected: false })} /><span>{k.name} {k.included ? <Pill tone="good">Built in</Pill> : <Pill tone="info">Extra cost</Pill>}<small>{k.desc}</small></span></label>)}</div></Field>
      {d.kyc === 'custom' ? <div className="stack-s"><input className="inp" placeholder="Provider name, e.g. Onfido, Sumsub, Veriff" value={d.kycCustomName} onChange={set('kycCustomName')} aria-label="Your KYC provider" /><div className="banner"><Mail /><span>A new KYC integration is <b>an extra cost</b>. We will get in touch with timings and a quote. You can launch now and switch to it when it is ready.</span></div></div>
        : <div className="connect-row"><div className="connect-logo" style={{ background: d.kyc === 'didit' ? '#111' : '#1F4FD8' }}>{kycName?.[0]}</div><div className="grow"><b>Connect your {kycName} account</b><small>Log in with your own {kycName} credentials and authorise the platform. Verification results flow into your compliance queue automatically.</small></div><Connected ok={d.kycConnected} name={kycName} onClick={() => setConnect({ name: kycName, color: d.kyc === 'didit' ? '#111' : '#1F4FD8', scope: ['Create verification sessions', 'Read verification results', 'Receive webhooks'], on: () => setD((x) => ({ ...x, kycConnected: true })) })} /></div>}
    </div>,
    /* 4 Payouts */
    <div className="stack">
      <Field label="Countries you send money to"><div className="checks">{Object.entries(CURRENCIES).map(([c, v]) => <label key={c} className="check"><input type="checkbox" checked={d.corridors.includes(c)} onChange={toggleArr('corridors', c)} /><span>{v.country}<small>GBP → {c} · partner rate {num(v.rate)}</small></span></label>)}</div></Field>
      <Field label="Pricing per corridor"><PricingTable rows={d.corridors.map((cur) => ({ cur, ...DEFAULT_PRICING, ...(d.pricing[cur] || {}) }))} onChange={(rows) => setD({ ...d, pricing: { ...d.pricing, ...Object.fromEntries(rows.map((r) => [r.cur, { margin: r.margin, threshold: r.threshold, fee: r.fee, feePct: r.feePct, aboveFee: r.aboveFee, aboveFeePct: r.aboveFeePct }])) } })} /><PricingHint /></Field>
      <Disclaimer what="Your payout partner" />
      <Field label="Payout partner"><div className="stack-s">
        {avail.map((p) => <div key={p.id} className={`connect-row ${d.partners.includes(p.id) ? 'on' : ''}`}><input type="checkbox" checked={d.partners.includes(p.id)} onChange={() => setD({ ...d, partners: d.partners.includes(p.id) ? [] : [p.id], payoutConnected: false })} aria-label={p.name} /><div className="connect-logo" style={{ background: '#0B3B5C' }}>D</div><div className="grow"><b>{p.name} <Pill tone="good">Built in</Pill></b><small>{p.desc} Covers {p.cur.filter((c) => d.corridors.includes(c)).join(', ')} · {p.methods.join(', ')}.</small></div>{d.partners.includes(p.id) && <Connected ok={d.payoutConnected} name="Daytona" onClick={() => setConnect({ name: 'Daytona Capital Management', color: '#0B3B5C', scope: ['Get live rates and quotes', 'Create payouts', 'Read payout status', 'Read prefund balance'], on: () => setD((x) => ({ ...x, payoutConnected: true })) })} />}</div>)}
        <label className="check"><input type="checkbox" checked={!!d.payoutCustomName} onChange={(e) => setD({ ...d, payoutCustomName: e.target.checked ? d.payoutCustomName || 'My existing partner' : '' })} /><span>Another payout partner <Pill tone="info">Extra cost</Pill><small>Keep a partner you already have a contract with. We will get in touch with timings and a quote.</small></span></label>
        {d.payoutCustomName !== '' && <input className="inp" placeholder="Partner name" value={d.payoutCustomName} onChange={set('payoutCustomName')} aria-label="Custom payout partner name" />}
      </div></Field>
    </div>,
    /* 5 Pay-in */
    <div className="stack">
      <p className="muted">How your customers pay you before you send. Built-in processors connect in a minute; anything else is a request.</p>
      <Disclaimer what="Your payment processor" />
      <div className="stack-s">
        {PAYIN_BANKS.filter((b) => b.id !== 'custom').map((b) => <div key={b.id} className={`connect-row ${d.payin.includes(b.id) ? 'on' : ''}`}><input type="checkbox" checked={d.payin.includes(b.id)} onChange={() => setD({ ...d, payin: d.payin.includes(b.id) ? d.payin.filter((x) => x !== b.id) : [...d.payin, b.id] })} aria-label={b.name} /><div className="connect-logo" style={{ background: b.id === 'fena' ? '#5B2DE0' : '#334155' }}>{b.name[0]}</div><div className="grow"><b>{b.name} <Pill tone="good">Built in</Pill></b><small>{b.kind}</small></div>{d.payin.includes(b.id) && <Connected ok={!!d.payinConnected[b.id]} name={b.name} onClick={() => setConnect({ name: b.name, color: b.id === 'fena' ? '#5B2DE0' : '#334155', scope: ['Create payment requests', 'Receive payment notifications', 'Read settlement reports'], on: () => setD((x) => ({ ...x, payinConnected: { ...x.payinConnected, [b.id]: true } })) })} />}</div>)}
        <div className="connect-row" style={{ alignItems: 'flex-start' }}><input type="checkbox" checked={!!d.payinCustomName} onChange={(e) => setD({ ...d, payinCustomName: e.target.checked ? d.payinCustomName || 'My processor' : '' })} aria-label="Request another processor" /><div className="connect-logo" style={{ background: 'var(--surface-2)', color: 'var(--muted)' }}>+</div><div className="grow"><b>Request another processor <Pill tone="info">Extra cost</Pill></b><small>A new integration normally takes <b>about a week</b>. Urgent requests cost more; very urgent requests cost more again.</small>
          {d.payinCustomName !== '' && <div className="stack-s" style={{ marginTop: 10 }}><input className="inp" placeholder="Processor or bank name" value={d.payinCustomName} onChange={set('payinCustomName')} aria-label="Processor name" /><div className="seg" role="radiogroup">{[['standard', 'Standard · ~1 week'], ['urgent', 'Urgent · extra cost'], ['critical', 'Very urgent · higher cost']].map(([v, l]) => <button key={v} type="button" role="radio" aria-checked={d.payinUrgency === v} onClick={() => setD({ ...d, payinUrgency: v })}>{l}</button>)}</div></div>}</div></div>
      </div>
    </div>,
    /* 6 Compliance */
    <div className="stack">
      <p className="muted">How transfers get released to the payout partner once a customer has paid. Your MLRO decides; the platform applies it.</p>
      <div className="choices3" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))' }}>
        <button type="button" className={`choice-card ${d.releaseMode === 'auto' ? 'on' : ''}`} onClick={() => setD({ ...d, releaseMode: 'auto' })}><div className="ic"><ShieldCheck /></div><b>Automatic with AI review</b><small>Upload your AML and transaction-monitoring policies. The built-in AI reads every transfer in the queue against your policy and thresholds; clean transfers inside a customer's limits are released automatically. Anything flagged waits for a person.</small>{d.releaseMode === 'auto' && <span className="tick"><Check /></span>}</button>
        <button type="button" className={`choice-card ${d.releaseMode === 'manual' ? 'on' : ''}`} onClick={() => setD({ ...d, releaseMode: 'manual' })}><div className="ic"><Lock /></div><b>Manual release</b><small>Your compliance officer reviews and releases every transfer by hand. The AI still runs the checks and writes the summary, but never releases.</small>{d.releaseMode === 'manual' && <span className="tick"><Check /></span>}</button>
      </div>
      {d.releaseMode === 'auto' && <Field label="Your policies (PDF or Word)" id="w-pol" hint="AML / CTF policy, transaction monitoring policy, risk assessment. Not got them yet? Starter templates are created for you and your MLRO can edit them in the portal."><div className="row"><input id="w-pol" type="file" multiple accept=".pdf,.doc,.docx" onChange={onPolicy} /><Upload size={16} /></div>{d.policyFiles.length > 0 && <div className="row" style={{ marginTop: 6 }}>{d.policyFiles.map((f) => <span key={f} className="tag">{f}</span>)}</div>}</Field>}
      <div className="form">
        <Field label="Daily limit per customer (£)" id="w-daily" hint={d.releaseMode === 'auto' ? 'Transfers up to this, with no flags, are auto-released' : ''}><input id="w-daily" className="inp num" value={d.daily} onChange={set('daily')} /></Field>
        <Field label="Ask for source of funds above (£)" id="w-sof"><input id="w-sof" className="inp num" value={d.sof} onChange={set('sof')} /></Field>
        <Field label="Enhanced due diligence above (£)" id="w-edd"><input id="w-edd" className="inp num" value={d.edd} onChange={set('edd')} /></Field>
        <Field label="MLRO (nominated officer)" id="w-mlro"><input id="w-mlro" className="inp" value={d.mlro} onChange={set('mlro')} /></Field>
      </div>
      <div className="banner">A starter set of monitoring rules (document bands, structuring, velocity, first transfer, PEP, sanctions, KYC…) is created for you. They are a starting point: your MLRO decides what to keep, change or add.</div>
    </div>,
    /* 7 Emails */
    <div className="stack">
      <p className="muted">These go to your customers at each step. Edit the wording now or later in Settings → Emails. Variables in {'{{ }}'} are filled in automatically.</p>
      <div className="emails">
        <div className="email-list">{d.emails.map((e) => <button key={e.id} type="button" className={e.id === emailSel ? 'on' : ''} onClick={() => setEmailSel(e.id)}><Mail /><span>{e.event}</span></button>)}</div>
        <div className="stack-s">
          <Field label="Subject" id="w-subj"><input id="w-subj" className="inp" value={emailTpl.subject} onChange={(e) => setEmail('subject', e.target.value)} /></Field>
          <Field label="Message" id="w-body"><textarea id="w-body" className="ta" rows={8} value={emailTpl.body} onChange={(e) => setEmail('body', e.target.value)} /></Field>
          <div className="row">{EMAIL_VARS.map((v) => <button key={v} type="button" className="tag" style={{ cursor: 'pointer' }} onClick={() => setEmail('body', emailTpl.body + ' ' + v)}>{v}</button>)}</div>
        </div>
      </div>
    </div>,
    /* 8 Admin portal */
    <div className="stack">
      <p className="muted">Your back office. Your staff see your name, logo and colours here too.</p>
      <div className="form">
        <Field label="Sidebar style"><div className="seg" role="radiogroup">{[['light', 'Light'], ['brand', 'Brand colour'], ['dark', 'Dark']].map(([v, l]) => <button key={v} type="button" role="radio" aria-checked={d.adminTheme.sidebar === v} onClick={() => setD({ ...d, adminTheme: { ...d.adminTheme, sidebar: v } })}>{l}</button>)}</div></Field>
        <Field label="Admin accent colour" hint="Buttons, active menu, charts. Defaults to your primary colour."><div className="swatches">{['', ...PRIMARY].map((c) => <button key={c || 'auto'} type="button" className="sw" style={{ background: c || d.color, outline: c ? 'none' : '2px dashed var(--muted)' }} aria-label={c || 'Same as primary'} aria-pressed={(d.adminTheme.accent || '') === c} onClick={() => setD({ ...d, adminTheme: { ...d.adminTheme, accent: c } })} />)}</div></Field>
        <Field label="Show logo in sidebar"><label className="check"><input type="checkbox" checked={d.adminTheme.showLogo} onChange={(e) => setD({ ...d, adminTheme: { ...d.adminTheme, showLogo: e.target.checked } })} /><span>Use my logo next to the business name</span></label></Field>
      </div>
      <div className="banner good"><Check /><span>Fonts and corner roundness follow your customer design, so the whole platform feels like one brand.</span></div>
    </div>,
    /* 9 Launch */
    <div className="stack">
      <div className="form">
        <Field label="Your address on the platform" id="w-slug" hint="Live immediately with SSL"><div className="suffix"><input id="w-slug" value={d.slug} onChange={(e) => setD({ ...d, slug: e.target.value.toLowerCase() })} /><span>.{PLATFORM.domain}</span></div></Field>
        <Field label="Your own domain (optional)" id="w-domain" hint={`Add a CNAME to tenants.${PLATFORM.domain}. You can do this later.`}><input id="w-domain" className="inp" placeholder="send.yourbusiness.co.uk" value={d.domain} onChange={set('domain')} /></Field>
      </div>
      <div className="list" style={{ border: '1px solid var(--line)', borderRadius: 10 }}>
        {[['Business', `${d.legalName} · FRN ${d.frn} · MLR ${d.mlr}${d.hasWebsite ? ` · ${d.website}` : d.wantWebsite ? ' · website requested from TheFXSoft' : ''}`, 0], ['Channels', d.channels.portal ? 'Admin + web portal + app' : d.channels.app ? 'Admin + app' : 'Admin only', 1], ['Design', `${d.font} · ${d.color} / ${d.accent} · ${d.mode}`, 2],
          ['Identity checks', d.kyc === 'custom' ? `${d.kycCustomName} (requested, extra cost)` : `${kycName} · ${d.kycConnected ? 'connected' : 'not connected yet'}`, 3],
          ['Payouts', `${d.corridors.map((c) => CURRENCIES[c].country).join(', ')} · ${d.partners.length ? `Daytona · ${d.payoutConnected ? 'connected' : 'not connected yet'}` : ''}${d.payoutCustomName ? ` · ${d.payoutCustomName} (requested)` : ''} · ${d.corridors.map((c) => `${c}: ${E.describePricing({ ...DEFAULT_PRICING, ...(d.pricing[c] || {}) })}`).join(' · ')}`, 4],
          ['Payments in', `${d.payin.map((b) => PAYIN_BANKS.find((x) => x.id === b)?.name).join(', ')}${d.payinCustomName ? ` · ${d.payinCustomName} (requested, ${d.payinUrgency})` : ''}`, 5],
          ['Compliance', `${d.releaseMode === 'auto' ? 'Automatic with AI review' : 'Manual release'} · daily £${d.daily} · SoF £${d.sof} · EDD £${d.edd} · MLRO ${d.mlro}`, 6],
          ['Emails', `${d.emails.length} templates`, 7], ['Admin portal', `${d.adminTheme.sidebar} sidebar`, 8]].map(([k, v, i]) => <div className="li" key={k}><div className="grow"><b>{k}</b><small>{v}</small></div><button type="button" className="btn sm" onClick={() => setStep(i)}>Edit</button></div>)}
      </div>
      <label className="check"><input type="checkbox" checked={d.declaration} onChange={(e) => setD({ ...d, declaration: e.target.checked })} /><span><b>Declaration.</b> I confirm that {d.legalName || d.name} holds the FCA and HMRC registrations it needs to provide money remittance services in the UK; that it, not {PLATFORM.owner}, is responsible for its own regulatory compliance, including how it configures and uses the compliance tools on this platform; and that its agreements with its KYC, payout and payment providers are its own.</span></label>
    </div>,
  ][step]

  return (
    <Shell>
      <div className="wiz">
        <div className="stack">
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div><span className="muted mono small">{PLATFORM.domain}/get-started · {bdc ? 'remittance + bureau' : 'remittance'}</span><h1 style={{ fontSize: 24, marginTop: 4 }}>Set up {d.name || 'your business'}</h1></div>
            <div className="timer"><span className="muted" style={{ fontSize: 11.5 }}>Elapsed · target 15:00</span><div className="t">{clock}</div><div className="track"><div className="fill" style={{ width: `${Math.min(100, (secs / TARGET) * 100)}%` }} /></div></div>
          </div>
          <div className="steps">{STEPS.map((s, i) => <button key={s} type="button" className={i < step ? 'done' : i === step ? 'cur' : ''} onClick={() => i < step && setStep(i)}><span>{i + 1}</span>{s}</button>)}</div>
          <Panel title={STEPS[step]} pad>{body}</Panel>
          {err && <span className="err">{err}</span>}
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <button className="btn" disabled={step === 0} onClick={() => { setErr(''); setStep(step - 1) }}>Back</button>
            {step < STEPS.length - 1 ? <button className="btn pri" onClick={next}>Continue</button> : <button className="btn pri" onClick={launch}>Launch my platform</button>}
          </div>
        </div>
        <PreviewPane t={preview} tab={prevTab} setTab={setPrevTab} emailTpl={step === 7 ? emailTpl : null} />
      </div>
      {connect && <ConnectModal p={connect} onClose={() => setConnect(null)} />}
    </Shell>
  )
}

/* ---------- Previews ---------- */
function PreviewPane({ t, tab, setTab, emailTpl }) {
  const tabs = [['app', 'App', Smartphone], ['web', 'Web portal', Monitor], ['admin', 'Admin', LayoutDashboard]]
  if (emailTpl) return <div className="sticky stack" style={{ alignItems: 'center' }}><EmailPreview t={t} tpl={emailTpl} /><span className="muted small mono">Live preview · customer email</span></div>
  return (
    <div className="sticky stack" style={{ alignItems: 'center' }}>
      <div className="seg" role="tablist">{tabs.map(([id, l, I]) => <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}><I size={14} />{l}</button>)}</div>
      {tab === 'app' && <div className="phone"><AppPreview t={t} /></div>}
      {tab === 'web' && <WebPreview t={t} />}
      {tab === 'admin' && <AdminPreview t={t} />}
      <span className="muted small mono">Live preview · {tab === 'app' ? "your customers' app" : tab === 'web' ? 'your customer web portal' : 'your admin portal'}</span>
    </div>
  )
}

export function WebPreview({ t }) {
  const cur = t.corridors.find((c) => c.enabled)?.cur || 'PKR'
  const cor = t.corridors.find((c) => c.enabled)
  const rate = +(CURRENCIES[cur].rate * (1 - (cor?.margin || 0) / 100)).toFixed(4)
  const dark = t.brand.mode === 'dark'
  return (
    <div className="browser" style={brandVars(t)}>
      <div className="browser-bar"><span /><span /><span /><div className="url">{t.slug || 'yourbusiness'}.{PLATFORM.domain}</div></div>
      <div className={`web ${dark ? 'dark' : ''}`}>
        <div className="web-nav"><div className="row"><div className="lg">{t.brand.logo ? <img src={t.brand.logo} alt="" /> : initials(t.brand.appName || t.name)}</div><b>{t.brand.appName || t.name}</b></div><div className="links"><span>Send</span><span>Rates</span><span>Help</span><span className="web-btn">Sign in</span></div></div>
        <div className="web-hero"><div><h3>{t.brand.tagline || 'Send money home in minutes'}</h3><p>Great rates to {t.corridors.filter((c) => c.enabled).slice(0, 3).map((c) => CURRENCIES[c.cur].country).join(', ')}.</p></div>
          <div className="web-card"><span className="app-sec">You send</span><div className="amt"><input value="500" readOnly aria-label="Amount" /><span className="cur">GBP</span></div><span className="app-sec">They receive</span><div className="amt"><span className="recv">{num(500 * rate)}</span><span className="cur">{cur}</span></div><div className="meta"><span>Rate</span><b>{rate}</b></div><button className="app-btn" type="button">Send money</button></div></div>
        <div className="web-foot">Made by TheFXSoft Limited</div>
      </div>
    </div>
  )
}

export function AdminPreview({ t }) {
  const a = t.adminTheme || {}
  const accent = a.accent || t.brand.color
  const side = a.sidebar === 'dark' ? { background: '#0F1613', color: '#E8EFEA' } : a.sidebar === 'brand' ? { background: t.brand.color, color: inkOn(t.brand.color) } : { background: '#fff', color: '#131A2C', borderRight: '1px solid var(--line)' }
  const activeBg = a.sidebar === 'light' ? accent : 'rgba(255,255,255,.18)'
  const activeInk = a.sidebar === 'light' ? inkOn(accent) : side.color
  return (
    <div className="browser" style={brandVars(t)}>
      <div className="browser-bar"><span /><span /><span /><div className="url">admin.{t.slug || 'yourbusiness'}.{PLATFORM.domain}</div></div>
      <div className="admin-mini">
        <div className="am-side" style={side}><div className="row" style={{ gap: 6, padding: '0 2px 8px' }}>{a.showLogo !== false && <div className="lg" style={{ background: accent, color: inkOn(accent) }}>{t.brand.logo ? <img src={t.brand.logo} alt="" /> : initials(t.name)}</div>}<b style={{ fontSize: 11 }}>{t.name}</b></div>{['Dashboard', 'Transactions', 'Payments in', 'Customers', 'Compliance', 'Treasury', 'Reports', 'Settings'].map((m, i) => <div key={m} className="am-nav" style={i === 0 ? { background: activeBg, color: activeInk } : {}}>{m}</div>)}<div className="am-foot">Made by TheFXSoft Limited</div></div>
        <div className="am-main"><b style={{ fontSize: 12 }}>Dashboard</b><div className="am-kpis">{[['Sent today', '£18,420'], ['Transfers', '47'], ['On hold', '3'], ['Prefund', '£90,000']].map(([l, v]) => <div key={l}><small>{l}</small><b>{v}</b></div>)}</div><div className="am-bars">{[40, 55, 35, 70, 60, 85, 65].map((h, i) => <div key={i} style={{ height: `${h}%`, background: accent }} />)}</div><div className="am-rows">{['Ayesha Khan · £500 · Released', 'Rafiq Hossain · £300 · On hold', 'Bilal Ahmed · £1,200 · Paid'].map((r) => <div key={r}>{r}</div>)}</div></div>
      </div>
    </div>
  )
}

function EmailPreview({ t, tpl }) {
  const r = renderEmail(tpl, { brand: t.brand.appName || t.name })
  return (
    <div className="email-prev" style={brandVars(t)}>
      <div className="ep-head"><div className="lg">{t.brand.logo ? <img src={t.brand.logo} alt="" /> : initials(t.brand.appName || t.name)}</div><b>{t.brand.appName || t.name}</b></div>
      <div className="ep-body"><b>{r.subject}</b><p>{r.body}</p><button type="button" className="app-btn" style={{ width: 'auto', padding: '9px 16px', fontSize: 13 }}>Open the app</button></div>
      <div className="ep-foot">{t.brand.appName || t.name} · Made by TheFXSoft Limited</div>
    </div>
  )
}

/* ---------- Fake provider OAuth window ---------- */
function ConnectModal({ p, onClose }) {
  const [stage, setStage] = useState('login')
  const [f, setF] = useState({ email: '', password: '' })
  useEffect(() => { if (stage === 'wait') { const h = setTimeout(() => { p.on(); setStage('ok') }, 1200); return () => clearTimeout(h) } }, [stage])
  return (
    <Modal title={`Connect ${p.name}`} onClose={onClose} footer={stage === 'ok' ? <button className="btn pri" onClick={onClose}>Done</button> : stage === 'consent' ? <><button className="btn" onClick={onClose}>Cancel</button><button className="btn pri" onClick={() => setStage('wait')}>Allow</button></> : <><button className="btn" onClick={onClose}>Cancel</button><button className="btn pri" disabled={!/.+@.+/.test(f.email) || f.password.length < 4} onClick={() => setStage('consent')}>Log in</button></>}>
      <div className="oauth"><div className="connect-logo" style={{ background: p.color }}>{p.name[0]}</div><div><b>{p.name}</b><small className="muted" style={{ display: 'block' }}>Secure sign-in · opens on {p.name}'s own site in production</small></div></div>
      {stage === 'login' && <div className="stack-s"><Field label={`${p.name} account email`} id="oa-email"><input id="oa-email" className="inp" type="email" autoComplete="off" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field><Field label="Password" id="oa-pw"><input id="oa-pw" className="inp" type="password" autoComplete="off" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field><span className="hint">Demo: any email and password work. Your real credentials are never seen by {PLATFORM.owner}.</span></div>}
      {stage === 'consent' && <div className="stack-s"><b>{PLATFORM.name} platform would like to:</b><ul style={{ margin: 0, paddingLeft: 20 }}>{p.scope.map((s) => <li key={s}>{s}</li>)}</ul><span className="hint">Billing for these services stays on your {p.name} account under your own agreement with them.</span></div>}
      {stage === 'wait' && <div className="empty">Authorising…</div>}
      {stage === 'ok' && <div className="banner good"><Check /><span><b>{p.name} connected.</b> Your account is linked to your platform. You can disconnect it any time in Settings → Integrations.</span></div>}
    </Modal>
  )
}

const Shell = ({ children }) => <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}><header className="pbar"><Wordmark /><span className="chip-dark">Get started</span><div className="spacer" /><Link to="/" className="btn sm">Sign in</Link></header><div style={{ flex: 1 }}>{children}</div><MadeBy style={{ textAlign: 'center', padding: 16 }} /></div>
