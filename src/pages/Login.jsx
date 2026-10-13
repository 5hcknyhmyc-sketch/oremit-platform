import { useNavigate } from 'react-router-dom'
import { ShieldCheck, Building2, Smartphone, Link2 } from 'lucide-react'
import { useStore, act } from '../store'
import { createInvite } from '../lib/engine'
import { Logo } from '../components/ui'

export default function Login() {
  const nav = useNavigate()
  const db = useStore((s) => s.db)
  const login = useStore((s) => s.login)
  const live = db.tenants.filter((t) => t.status !== 'review')

  const asStaff = (t, member) => { login({ kind: 'msb', tenantId: t.id, role: member.role, name: member.name }); nav('/portal') }
  const tryOnboarding = () => { const inv = act((d) => createInvite(d, 'Demo')); if (inv) nav(`/onboard/${inv.token}`) }

  return (
    <div style={{ minHeight: '100vh' }}>
      <header className="pbar"><span className="wordmark">Co<i>R</i>emit<small>by TheFXSoft</small></span><span className="chip-dark">Demo environment</span></header>
      <main className="login">
        <div className="stack-s">
          <h1>Sign in to the demo</h1>
          <p className="muted" style={{ maxWidth: '62ch' }}>Pick who you want to be. Everything you do is saved in this browser, so you can try a full transfer: customer sends, money arrives, rules run, compliance reviews, partner pays out. Use “Reset demo” in the top bar to start again.</p>
        </div>

        <section className="stack-s">
          <h2 style={{ fontSize: 16 }}>Platform owner</h2>
          <div className="personas">
            <button className="persona" onClick={() => { login({ kind: 'super' }); nav('/admin') }}>
              <div className="row"><ShieldCheck size={20} /><b>Super Admin</b></div>
              <small>TheFXSoft. All MSBs, go-live approvals, integration requests, billing.</small>
            </button>
            <button className="persona" onClick={tryOnboarding}>
              <div className="row"><Link2 size={20} /><b>Onboarding link</b></div>
              <small>See what a new MSB fills in to launch in under 15 minutes.</small>
            </button>
          </div>
        </section>

        {live.map((t) => (
          <section className="stack-s" key={t.id}>
            <div className="row"><Logo t={t} size="sm" /><h2 style={{ fontSize: 16 }}>{t.name}</h2><span className="muted small mono">{t.slug}.coremit.app</span></div>
            <div className="personas">
              {t.staff.filter((s) => s.role !== 'Agent').map((s) => (
                <button key={s.id} className="persona" onClick={() => asStaff(t, s)}>
                  <div className="row"><Building2 size={20} /><b>{s.name}</b></div>
                  <small>{s.role} · MSB {s.role === 'Admin' ? 'owner portal' : 'staff portal'}</small>
                </button>
              ))}
              <button className="persona" onClick={() => nav(`/app/${t.slug}`)}>
                <div className="row"><Smartphone size={20} /><b>Customer app</b></div>
                <small>Sign up or sign in as a sender, in {t.name}'s brand.</small>
              </button>
            </div>
          </section>
        ))}
      </main>
    </div>
  )
}
