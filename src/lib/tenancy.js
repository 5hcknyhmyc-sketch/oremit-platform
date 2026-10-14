// Tenant resolution by hostname.
//   northgate.coremit.app          → tenant with slug "northgate"
//   send.northgateremit.co.uk      → tenant whose custom domain matches
// Set VITE_PLATFORM_DOMAIN (e.g. "coremit.app") in Netlify to turn this on. Netlify preview URLs are ignored.
const PLATFORM = import.meta.env.VITE_PLATFORM_DOMAIN || 'thefxsoft.app'

export function resolveHostTenant(db, host = typeof location !== 'undefined' ? location.hostname : '') {
  if (!host || host === 'localhost' || host.endsWith('.netlify.app')) return null
  const live = db.tenants.filter((t) => t.status === 'live')
  const byDomain = live.find((t) => t.domain && t.domain.toLowerCase() === host.toLowerCase())
  if (byDomain) return byDomain
  if (host.endsWith('.' + PLATFORM)) {
    const sub = host.slice(0, -(PLATFORM.length + 1))
    if (['admin', 'www', 'onboard', 'portal'].includes(sub)) return null
    return live.find((t) => t.slug === sub) || null
  }
  return null
}
