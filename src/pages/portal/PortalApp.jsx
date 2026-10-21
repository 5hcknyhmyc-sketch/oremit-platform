import { createContext, useContext } from 'react'
import { Routes, Route, NavLink, Navigate, useNavigate } from 'react-router-dom'
import { LayoutDashboard, ArrowLeftRight, Landmark, Users, ShieldCheck, Wallet, BarChart3, Settings as Cog, Store, Building, Coins, Gift, Search, Code2, LifeBuoy } from 'lucide-react'
import { useStore } from '../../store'
import { Logo, brandVars, MadeBy } from '../../components/ui'
import { inkOn } from '../../lib/util'
import TopBar from '../../components/TopBar'
import AiPanel from '../../components/AiPanel'
import { MODULES, DECISION_ROLES, SAR_ROLES, PLATFORM } from '../../lib/reference'
import { roleModules } from '../../lib/modules'
import Dashboard from './Dashboard'
import Transactions from './Transactions'
import Payments from './Payments'
import Customers, { CustomerDetail } from './Customers'
import Compliance from './Compliance'
import Treasury from './Treasury'
import Reports from './Reports'
import Settings from './Settings'
import Agents from './Agents'
import Corporate from './Corporate'
import Bureau from './Bureau'
import Rewards from './Rewards'
import Developer from './Developer'
import TrackerPage from './TrackerPage'
import Support from './Support'

const ICONS = { dashboard: LayoutDashboard, transactions: ArrowLeftRight, payments: Landmark, customers: Users, compliance: ShieldCheck, treasury: Wallet, reports: BarChart3, settings: Cog, agents: Store, corporate: Building, bureau: Coins, rewards: Gift, tracker: Search, developer: Code2, support: LifeBuoy }
const PATHS = Object.fromEntries(['dashboard', 'transactions', 'payments', 'customers', 'compliance', 'treasury', 'reports', 'settings', 'agents', 'corporate', 'bureau', 'rewards', 'tracker', 'developer', 'support'].map((m) => [m, m === 'dashboard' ? '/portal' : `/portal/${m}`]))

const Ctx = createContext(null)
export const usePortal = () => useContext(Ctx)

export default function PortalApp() {
  const session = useStore((s) => s.session)
  const db = useStore((s) => s.db)
  const login = useStore((s) => s.login)
  const nav = useNavigate()
  if (!session || session.kind !== 'msb') return <Navigate to="/" replace />
  const t = db.tenants.find((x) => x.id === session.tenantId)
  if (!t) return <Navigate to="/" replace />
  const allowed = roleModules(t, session.role)
  const ctx = {
    db, t, session, role: session.role, actor: session.name, agentId: t.staff.find((s) => s.name === session.name)?.agentId || null,
    can: (m) => allowed.includes(m),
    canDecide: DECISION_ROLES.includes(session.role),
    canSar: SAR_ROLES.includes(session.role),
  }
  const openCases = db.cases.filter((k) => k.tenantId === t.id && k.status !== 'closed').length
  const unmatched = db.payIns.filter((p) => p.tenantId === t.id && p.status === 'unmatched').length
  const openTickets = (db.tickets || []).filter((k) => k.tenantId === t.id && k.status === 'open').length
  const counts = { compliance: openCases, payments: unmatched, support: openTickets }
  const first = MODULES.find((m) => allowed.includes(m.id))
  const guard = (m, el) => (allowed.includes(m) ? el : <NoAccess />)

  const at = t.adminTheme || {}
  const accent = at.accent || t.brand.color
  const sideVars = at.sidebar === 'dark' ? { '--side-bg': '#0F1613', '--side-ink': '#E8EFEA', '--side-muted': '#9DB3A8', '--side-line': '#263730', '--side-hover': '#1C2823', '--side-active': 'rgba(255,255,255,.14)', '--side-active-ink': '#fff' }
    : at.sidebar === 'brand' ? { '--side-bg': t.brand.color, '--side-ink': inkOn(t.brand.color), '--side-muted': inkOn(t.brand.color), '--side-line': 'rgba(255,255,255,.18)', '--side-hover': 'rgba(255,255,255,.12)', '--side-active': 'rgba(255,255,255,.22)', '--side-active-ink': inkOn(t.brand.color) }
    : {}
  return (
    <Ctx.Provider value={ctx}>
      <div style={{ ...brandVars(t), '--brand': accent, '--brand-ink': inkOn(accent), ...sideVars, fontFamily: 'var(--b-font)' }}>
        <TopBar label={session.impersonating ? 'Super Admin view' : `${t.name} · ${session.role}`} />
        {session.impersonating && (
          <div className="imp-banner">You're viewing {t.name}'s portal as the platform owner. Actions are recorded under your name.
            <button className="btn sm" onClick={() => { login({ kind: 'super' }); nav('/admin/msbs') }}>Back to Super Admin</button>
          </div>
        )}
        {t.status === 'review' && <div className="imp-banner">This MSB is awaiting approval by TheFXSoft. You can set everything up; real transfers start at go-live.</div>}
        {t.status === 'suspended' && <div className="imp-banner">This MSB is suspended by the platform owner. Customers cannot send money.</div>}
        <div className="shell">
          <aside className="side">
            <div className="tenant-id">{at.showLogo !== false && <Logo t={t} />}<div><b>{t.name}</b><span>{t.domain || `${t.slug}.${PLATFORM.domain}`}</span></div></div>
            <nav className="nav">
              {MODULES.filter((m) => allowed.includes(m.id)).map((m) => {
                const I = ICONS[m.id]
                return <NavLink key={m.id} to={PATHS[m.id]} end={m.id === 'dashboard'} className={({ isActive }) => (isActive ? 'active' : '')}><I />{m.label}{counts[m.id] ? <span className="count">{counts[m.id]}</span> : null}</NavLink>
              })}
            </nav>
            <div className="side-foot"><span>Signed in as <b>{session.name}</b></span><span>{session.role}</span><MadeBy /></div>
          </aside>
          <main className="main">
            <Routes>
              <Route index element={allowed.includes('dashboard') ? <Dashboard /> : <Navigate to={PATHS[first?.id] || '/'} replace />} />
              <Route path="transactions/*" element={guard('transactions', <Transactions />)} />
              <Route path="payments" element={guard('payments', <Payments />)} />
              <Route path="customers" element={guard('customers', <Customers />)} />
              <Route path="customers/:id" element={guard('customers', <CustomerDetail />)} />
              <Route path="compliance/*" element={guard('compliance', <Compliance />)} />
              <Route path="treasury/*" element={guard('treasury', <Treasury />)} />
              <Route path="reports" element={guard('reports', <Reports />)} />
              <Route path="support" element={guard('support', <Support />)} />
              <Route path="settings/*" element={guard('settings', <Settings />)} />
              <Route path="agents/*" element={guard('agents', <Agents />)} />
              <Route path="corporate/*" element={guard('corporate', <Corporate />)} />
              <Route path="bureau/*" element={guard('bureau', <Bureau />)} />
              <Route path="rewards" element={guard('rewards', <Rewards />)} />
              <Route path="tracker" element={guard('tracker', <TrackerPage />)} />
              <Route path="developer/*" element={guard('developer', <Developer />)} />
              <Route path="*" element={<Navigate to="/portal" replace />} />
            </Routes>
          </main>
        </div>
        {(allowed.includes('compliance') || session.role === 'Admin') && <AiPanel tenant={t} />}
      </div>
    </Ctx.Provider>
  )
}

const NoAccess = () => <div className="panel"><div className="empty">This section is not enabled for you. An admin can switch modules on under Settings → Modules and set role access under Staff & roles.</div></div>
