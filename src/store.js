// App state: the demo database (persisted in the browser) plus who is signed in.
// Swap `run` for API calls when moving to Supabase — every op in lib/engine.js maps to one endpoint.
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { buildSeed } from './lib/seed'
import { OpError } from './lib/engine'

export const useStore = create(
  persist(
    (set, get) => ({
      db: buildSeed(),
      session: null, // { kind:'super' } | { kind:'msb', tenantId, role, name, impersonating }
      customerSessions: {}, // tenantId -> customerId
      toast: null,
      run(fn) {
        const db = structuredClone(get().db)
        const result = fn(db)
        set({ db })
        return result
      },
      login(session) { set({ session }) },
      logout() { set({ session: null }) },
      customerLogin(tenantId, customerId) { set({ customerSessions: { ...get().customerSessions, [tenantId]: customerId } }) },
      customerLogout(tenantId) { const c = { ...get().customerSessions }; delete c[tenantId]; set({ customerSessions: c }) },
      reset() { set({ db: buildSeed(), customerSessions: {} }) },
      notify(msg, tone = 'ok') { set({ toast: { msg, tone, id: Date.now() } }) },
    }),
    {
      name: 'coremit-demo-v1',
      partialize: (s) => ({ db: s.db, session: s.session, customerSessions: s.customerSessions }),
    },
  ),
)

// Run an engine op; show its error as a toast instead of crashing.
export function act(fn, success) {
  const s = useStore.getState()
  try {
    const r = s.run(fn)
    if (success) s.notify(typeof success === 'function' ? success(r) : success)
    return r ?? true
  } catch (e) {
    s.notify(e instanceof OpError ? e.message : `Something went wrong: ${e.message}`, 'err')
    if (!(e instanceof OpError)) console.error(e)
    return null
  }
}

export const useDb = () => useStore((s) => s.db)
export const useSession = () => useStore((s) => s.session)
export function actorName() {
  const s = useStore.getState().session
  if (!s) return 'Unknown'
  if (s.kind === 'super') return 'Zaland Shah (TheFXSoft)'
  return s.name
}
