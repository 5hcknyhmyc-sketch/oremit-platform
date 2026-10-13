import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useStore } from './store'
import { completePayout } from './lib/engine'
import { Toast } from './components/ui'
import Login from './pages/Login'
import AdminApp from './pages/admin/AdminApp'
import PortalApp from './pages/portal/PortalApp'
import CustomerApp from './pages/app/CustomerApp'
import Onboard from './pages/onboard/Onboard'
import { resolveHostTenant } from './lib/tenancy'

// Demo stand-in for payout partner callbacks: transfers sent to a partner are marked paid ~10s later.
function usePartnerSimulator() {
  useEffect(() => {
    const h = setInterval(() => {
      const { db, run } = useStore.getState()
      const due = db.transactions.filter((t) => t.status === 'released' && Date.now() - t.updatedAt > 10000)
      if (due.length) run((d) => due.forEach((t) => completePayout(d, t.id)))
    }, 4000)
    return () => clearInterval(h)
  }, [])
}

export default function App() {
  usePartnerSimulator()
  const db = useStore((s) => s.db)
  useEffect(() => { if (!db.journals || !db.integrationRequests || db.tenants.some((t) => !t.integrations)) { try { localStorage.removeItem('coremit-demo-v1') } catch (e) {} useStore.getState().reset() } }, [db])
  // In production, a request to <slug>.coremit.app or an MSB's own domain opens its customer app directly.
  const hostTenant = resolveHostTenant(db)
  return (
    <>
      <Routes>
        <Route path="/" element={hostTenant ? <Navigate to={`/app/${hostTenant.slug}`} replace /> : <Login />} />
        <Route path="/admin/*" element={<AdminApp />} />
        <Route path="/portal/*" element={<PortalApp />} />
        <Route path="/app/:slug/*" element={<CustomerApp />} />
        <Route path="/onboard/:token" element={<Onboard />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toast />
    </>
  )
}
