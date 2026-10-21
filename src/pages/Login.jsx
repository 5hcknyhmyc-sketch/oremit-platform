import { useNavigate, Link } from 'react-router-dom'
import { ShieldCheck, Building2, Smartphone, Rocket, Clock, Palette, Plug } from 'lucide-react'
import { useStore } from '../store'
import { Wordmark, Logo, MadeBy } from '../components/ui'
import { PLATFORM } from '../lib/reference'

export default function Login() {
  const nav = useNavigate()
  const db = useStore((s) => s.db)
  const login = useStore((s) => s.login)
  const live = db.tenants.filter((t) => t.status !== 'review')
  const asStaff = (t, member) => { login({ kind: 'msb', tenantId: t.id, role: member.role, name: member.name }); nav('/portal') }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header className="pbar"><Wordmark /><span className="chip-dark">Demo environment</span><div className="spacer" /><Link to="/get-started" className="btn pri sm"><Rocket />Get started</Link></header>
      <main className="login" style={{ flex: 1 }}>
        <section className="hero">
          <div className="stack-s">
            <span className="pill good">For UK money service businesses</span>
            <h1>Your own remittance app and portal, live in under 15 minutes.</h1>
            <p className="muted" style={{ maxWidth: '58ch', fontSize: 15 }}>Answer a few questions, design your brand, connect your KYC, payout and payment providers, and launch. One platform, every MSB under its own name. {PLATFORM.owner} provides the software; you keep your licences and your provider agreements.</p>
            <div className="row" style={{ marginTop: 6 }}><Link to="/get-started" className="btn pri" style={{ padding: '12px 22px', fontSize: 15 }}><Rocket />Set up my business</Link><Link to="/get-started/bureau" className="btn" style={{ padding: '12px 18px' }}>Bureau de change</Link></div>
          </div>
          <div className="hero-points">
            {[[Clock, 'Under 15 minutes', 'Admin portal, web portal and installable app the moment you finish.'], [Palette, 'Fully yours', 'Logo, colours, font, text size, emails — designed once, applied to web and app together.'], [Plug, 'Providers built in', 'Didit, Shufti Pro, Daytona (Hello Paisa), Fena. Log in to your own accounts and go.'], [ShieldCheck, 'Compliance included', 'Monitoring rules, cases, screening, SARs and AI-assisted release — your MLRO stays in charge.']].map(([I, t, s]) => <div className="point" key={t}><I /><div><b>{t}</b><small>{s}</small></div></div>)}
          </div>
        </section>

        <section className="stack-s">
          <h2 style={{ fontSize: 16 }}>Explore the demo as…</h2>
          <div className="personas">
            <button className="persona" onClick={() => { login({ kind: 'super' }); nav('/admin') }}>
              <div className="row"><ShieldCheck size={20} /><b>Super Admin</b></div>
              <small>{PLATFORM.owner}. All MSBs, go-live approvals, integration requests, billing, platform settings.</small>
            </button>
            <button className="persona" onClick={() => nav('/get-started')}>
              <div className="row"><Rocket size={20} /><b>A new MSB (public link)</b></div>
              <small>The self-service link: choose remittance or bureau, design, connect providers, launch.</small>
            </button>
          </div>
        </section>

        {live.map((t) => (
          <section className="stack-s" key={t.id}>
            <div className="row"><Logo t={t} size="sm" /><h2 style={{ fontSize: 16 }}>{t.name}</h2>{t.products.map((p) => <span key={p} className="tag">{p === 'bureau' ? 'Bureau de change' : 'Remittance'}</span>)}<span className="muted small mono">{t.slug}.{PLATFORM.domain}</span></div>
            <div className="personas">
              {t.staff.map((s) => (
                <button key={s.id} className="persona" onClick={() => asStaff(t, s)}>
                  <div className="row"><Building2 size={20} /><b>{s.name}</b></div>
                  <small>{s.role} · MSB {s.role === 'Admin' ? 'owner portal' : 'staff portal'}</small>
                </button>
              ))}
              {(t.channels?.portal !== false || t.channels?.app !== false) && <button className="persona" onClick={() => nav(`/app/${t.slug}`)}>
                <div className="row"><Smartphone size={20} /><b>Customer app</b></div>
                <small>{t.products.includes('remittance') ? 'Sign up or sign in as a sender' : 'Order currency for collection'}, in {t.name}'s brand.</small>
              </button>}
            </div>
          </section>
        ))}
      </main>
      <MadeBy style={{ textAlign: 'center', padding: 16 }} />
    </div>
  )
}
