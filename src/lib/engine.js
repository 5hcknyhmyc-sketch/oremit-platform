// The platform engine. Every operation takes the database object `db` and mutates it.
// In production each op maps to an API endpoint / database transaction (see docs/ARCHITECTURE.md).
import { CURRENCIES, PARTNERS, partnerFor, DEFAULT_ROLES } from './reference'
import { evaluate, decide, topSeverity, defaultRules } from './rules'
import { screenName } from './screening'
import { defaultPolicies } from './policies'
import { uid, shortCode, now, DAY, ageFrom, initials } from './util'

export class OpError extends Error {}
const fail = (m) => { throw new OpError(m) }

/* ---------------- Audit ---------------- */
export function audit(db, { tenantId = null, actor = 'System', action, target = '', at = now() }) {
  db.audit.unshift({ id: uid('aud'), tenantId, actor, action, target, at })
  if (db.audit.length > 800) db.audit.length = 800
}

/* ---------------- Tenants ---------------- */
export function makeTenant(o) {
  const t = {
    id: o.id || uid('ten'), name: o.name, legalName: o.legalName || o.name, short: o.short || initials(o.name) + 'X',
    status: o.status || 'review', slug: o.slug, domain: o.domain || '', plan: o.plan || 'Starter',
    frn: o.frn || '', mlr: o.mlr || '', email: o.email || '', createdAt: o.createdAt || now(), liveAt: o.liveAt || null,
    setupSeconds: o.setupSeconds ?? null,
    brand: { color: '#1B2559', accent: '#F2A541', logo: null, appName: o.name, ...(o.brand || {}) },
    corridors: (o.corridors || []).map((c) => (typeof c === 'string' ? { cur: c, enabled: true, fee: 2.99, margin: 1.2, min: 10, max: 10000 } : c)),
    partners: o.partners || [],
    compliance: {
      mlro: '', eddThreshold: 5000, sofThreshold: 2000, dailyLimit: 10000, screeningThreshold: 85,
      requireKycBeforeSend: true, idv: 'Document + selfie liveness', screening: 'Real-time sanctions + PEP',
      autoRelease: { enabled: true, maxAmount: 2000 },
      ...(o.compliance || {}),
    },
    bank: o.bank || { name: `${o.legalName || o.name} — client account`, sortCode: '04-00-75', account: String(10000000 + Math.floor(Math.random() * 89999999)) },
    roles: o.roles || JSON.parse(JSON.stringify(DEFAULT_ROLES)),
    staff: o.staff || [{ id: uid('stf'), name: 'Owner', email: o.email || '', role: 'Admin' }],
    treasury: o.treasury || Object.fromEntries((o.partners || []).map((p) => [p, 0])),
    topUps: [],
    checks: o.checks || {},
  }
  t.rules = o.rules || defaultRules(t.compliance.eddThreshold, t.compliance.sofThreshold)
  t.policies = o.policies || defaultPolicies(t)
  return t
}
export const tenantOf = (db, id) => db.tenants.find((t) => t.id === id) || fail('MSB not found')

export function createInvite(db, actor) {
  const inv = { token: shortCode(8).toLowerCase(), createdAt: now(), expiresAt: now() + 7 * DAY, usedBy: null, createdBy: actor }
  db.invites.unshift(inv)
  audit(db, { actor, action: 'Created onboarding link', target: inv.token })
  return inv
}

export function completeOnboarding(db, token, data, seconds) {
  const inv = db.invites.find((i) => i.token === token)
  if (!inv) fail('This onboarding link is not valid.')
  if (inv.usedBy) fail('This onboarding link has already been used.')
  if (inv.expiresAt < now()) fail('This onboarding link has expired. Ask TheFXSoft for a new one.')
  if (db.tenants.some((t) => t.slug === data.slug)) fail(`${data.slug}.coremit.app is already taken.`)
  const t = makeTenant({
    name: data.name, legalName: data.legalName, slug: data.slug, domain: data.domain, frn: data.frn, mlr: data.mlr, email: data.email,
    status: 'review', setupSeconds: seconds,
    brand: { color: data.color, accent: data.accent, logo: data.logo, appName: data.appName || data.name },
    corridors: data.corridors.map((cur) => ({ cur, enabled: true, fee: +data.fee || 0, margin: +data.margin || 0, min: 10, max: +data.daily || 10000 })),
    partners: data.partners,
    compliance: { mlro: data.mlro, eddThreshold: +data.edd, sofThreshold: +data.sof, dailyLimit: +data.daily, idv: data.idv, screening: data.screening, autoRelease: { enabled: true, maxAmount: Math.min(2000, +data.sof || 2000) } },
    staff: [{ id: uid('stf'), name: data.ownerName || 'Owner', email: data.email, role: 'Admin' }, ...(data.mlro ? [{ id: uid('stf'), name: data.mlro, email: '', role: 'MLRO' }] : [])],
    checks: { ch: true, fca: /^\d{6,7}$/.test(data.frn), mlr: /^X[A-Z]ML\d{11}$/i.test(data.mlr) },
  })
  db.tenants.push(t)
  inv.usedBy = t.id
  audit(db, { tenantId: t.id, actor: data.email || data.name, action: `Completed onboarding in ${Math.floor(seconds / 60)}m ${seconds % 60}s`, target: t.name })
  return t
}

export function setTenantStatus(db, tenantId, status, actor) {
  const t = tenantOf(db, tenantId)
  if (status === 'live') {
    const missing = APPROVAL_CHECKS.filter(([k]) => !t.checks[k])
    if (missing.length) fail('Complete every approval check first.')
    t.liveAt = t.liveAt || now()
  }
  t.status = status
  audit(db, { tenantId, actor, action: { live: 'Approved — MSB is live', suspended: 'Suspended MSB' }[status] || `Status → ${status}`, target: t.name })
}
export const APPROVAL_CHECKS = [
  ['ch', 'Companies House record matches'], ['fca', 'FCA register: firm authorised or registered'], ['mlr', 'HMRC MLR registration valid'],
  ['dir', 'Director ID and liveness verified'], ['ubo', 'Beneficial owners declared and screened'], ['bank', 'Safeguarding account confirmed'],
]

/* ---------------- Customers & recipients ---------------- */
export function computeRisk(db, c) {
  const t = db.tenants.find((x) => x.id === c.tenantId)
  const factors = []
  let score = 10
  if (c.pep) { score += 40; factors.push('Politically exposed person') }
  if (c.screening?.status === 'potential_match') { score += 30; factors.push('Unresolved screening match') }
  if (c.screening?.status === 'confirmed_match') { score += 80; factors.push('Confirmed sanctions match') }
  if (c.kyc.status !== 'verified') { score += 10; factors.push('Identity not verified') }
  const age = ageFrom(c.dob)
  if (age !== null && age < 21) { score += 10; factors.push('Under 21') }
  if (c.type === 'business') { score += 5; factors.push('Business customer') }
  const recent = db.transactions.filter((x) => x.customerId === c.id && now() - x.createdAt < 30 * DAY && !['cancelled', 'rejected', 'refunded'].includes(x.status))
  const vol = recent.reduce((a, x) => a + x.sendAmount, 0)
  if (vol > (t?.compliance.eddThreshold || 5000) * 2) { score += 15; factors.push(`£${Math.round(vol).toLocaleString('en-GB')} sent in 30 days`) }
  const openCases = db.cases.filter((k) => k.customerId === c.id && k.status !== 'closed').length
  if (openCases) { score += 10 * openCases; factors.push(`${openCases} open compliance case${openCases > 1 ? 's' : ''}`) }
  const level = score >= 50 ? 'High' : score >= 25 ? 'Medium' : 'Low'
  c.risk = { ...c.risk, score: Math.min(100, score), level, factors }
}

export function createCustomer(db, tenantId, d, actor = 'Customer', at = now()) {
  const t = tenantOf(db, tenantId)
  if (!d.name?.trim()) fail('Enter the customer\'s full name.')
  const sc = screenName(d.name, t.compliance.screeningThreshold)
  const c = {
    id: uid('cus'), tenantId, type: d.type || 'individual', name: d.name.trim(), email: d.email || '', phone: d.phone || '',
    dob: d.dob || '', address: d.address || '', postcode: d.postcode || '', occupation: d.occupation || '', nationality: d.nationality || '',
    createdAt: at, status: 'active', pep: !!sc.pep, pepDetail: sc.pep,
    kyc: { status: 'not_started', docs: [] }, screening: sc, risk: { override: null },
  }
  db.customers.push(c)
  if (sc.status === 'potential_match' || sc.pep) openScreeningCase(db, c, null, sc, at)
  computeRisk(db, c)
  audit(db, { tenantId, actor, action: 'Created customer', target: c.name, at })
  return c
}

export function addDocument(db, customerId, type, actor = 'Customer', at = now()) {
  const c = db.customers.find((x) => x.id === customerId) || fail('Customer not found')
  const doc = { id: uid('doc'), type, status: 'pending', uploadedAt: at, expiry: type.includes('address') || type.includes('funds') ? null : new Date(at + 4 * 365 * DAY).toISOString().slice(0, 10) }
  c.kyc.docs.push(doc)
  if (c.kyc.status === 'not_started' || c.kyc.status === 'rejected') c.kyc.status = 'pending'
  audit(db, { tenantId: c.tenantId, actor, action: `Uploaded ${type}`, target: c.name, at })
  return doc
}

export function reviewDocument(db, customerId, docId, ok, actor, at = now()) {
  const c = db.customers.find((x) => x.id === customerId) || fail('Customer not found')
  const d = c.kyc.docs.find((x) => x.id === docId) || fail('Document not found')
  d.status = ok ? 'verified' : 'rejected'
  d.reviewedBy = actor
  const idOk = c.kyc.docs.some((x) => x.status === 'verified' && ['Passport', 'UK driving licence', 'National ID card'].includes(x.type))
  c.kyc.status = idOk ? 'verified' : c.kyc.docs.some((x) => x.status === 'pending') ? 'pending' : 'rejected'
  if (idOk) c.kyc.verifiedAt = at
  computeRisk(db, c)
  audit(db, { tenantId: c.tenantId, actor, action: `${ok ? 'Verified' : 'Rejected'} ${d.type}`, target: c.name, at })
  // Releasing KYC may unblock held transfers that only failed the KYC rule
  if (idOk) recheckHeld(db, c.id, actor, at)
}

export function setCustomerRisk(db, customerId, level, actor) {
  const c = db.customers.find((x) => x.id === customerId)
  c.risk.override = level || null
  audit(db, { tenantId: c.tenantId, actor, action: level ? `Set risk to ${level} (manual)` : 'Removed manual risk rating', target: c.name })
}
export function setCustomerStatus(db, customerId, status, actor) {
  const c = db.customers.find((x) => x.id === customerId)
  c.status = status
  audit(db, { tenantId: c.tenantId, actor, action: status === 'frozen' ? 'Froze customer' : 'Unfroze customer', target: c.name })
}

export function addRecipient(db, customerId, d, actor = 'Customer', at = now()) {
  const c = db.customers.find((x) => x.id === customerId) || fail('Customer not found')
  const t = tenantOf(db, c.tenantId)
  if (!d.name?.trim()) fail('Enter the recipient\'s name.')
  if (!d.account?.trim()) fail('Enter an account number, IBAN or wallet number.')
  const sc = screenName(d.name, t.compliance.screeningThreshold)
  const r = {
    id: uid('rec'), tenantId: c.tenantId, customerId, name: d.name.trim(), cur: d.cur, method: d.method || 'Bank',
    bank: d.bank || '', account: d.account.trim(), relationship: d.relationship || 'Family', createdAt: at, screening: sc,
  }
  db.recipients.push(r)
  if (sc.status === 'potential_match') openScreeningCase(db, c, r, sc, at)
  return r
}

export function resolveScreening(db, caseId, outcome, note, actor, at = now()) {
  // outcome: 'false_positive' | 'true_match'
  const k = db.cases.find((x) => x.id === caseId) || fail('Case not found')
  const c = db.customers.find((x) => x.id === k.customerId)
  const target = k.recipientId ? db.recipients.find((x) => x.id === k.recipientId) : c
  target.screening = { ...target.screening, status: outcome === 'true_match' ? 'confirmed_match' : 'cleared', resolvedBy: actor, resolvedAt: at }
  if (outcome === 'true_match' && !k.recipientId) c.status = 'frozen'
  closeCase(db, k, outcome === 'true_match' ? 'Confirmed match — customer frozen' : 'False positive — cleared', note, actor, at)
  computeRisk(db, c)
  if (outcome === 'false_positive') recheckHeld(db, c.id, actor, at)
}

/* ---------------- Quotes & transactions ---------------- */
export function quote(t, cur, sendAmount) {
  const cor = t.corridors.find((c) => c.cur === cur && c.enabled)
  if (!cor) return null
  const base = CURRENCIES[cur].rate
  const rate = +(base * (1 - cor.margin / 100)).toFixed(4)
  const amt = Math.max(0, +sendAmount || 0)
  return { cur, rate, fee: cor.fee, sendAmount: amt, total: +(amt + cor.fee).toFixed(2), receiveAmount: +(amt * rate).toFixed(2), min: cor.min, max: cor.max, partner: partnerFor(cur, t.partners) }
}

export function createTransaction(db, d, actor = 'Customer', at = now()) {
  const t = tenantOf(db, d.tenantId)
  if (t.status === 'suspended') fail('This MSB is suspended and cannot send money.')
  const c = db.customers.find((x) => x.id === d.customerId) || fail('Choose a customer.')
  if (c.status === 'frozen') fail('This customer is frozen. Contact compliance.')
  const r = db.recipients.find((x) => x.id === d.recipientId) || fail('Choose a recipient.')
  const q = quote(t, r.cur, d.sendAmount)
  if (!q) fail(`${t.name} does not send to ${r.cur}.`)
  if (q.sendAmount < q.min) fail(`The minimum transfer is £${q.min}.`)
  if (q.sendAmount > q.max) fail(`The maximum single transfer is £${q.max.toLocaleString('en-GB')}.`)
  if (t.compliance.requireKycBeforeSend && c.kyc.status === 'not_started' && actor === 'Customer') fail('Verify your identity before sending.')
  const today = db.transactions.filter((x) => x.customerId === c.id && new Date(x.createdAt).toDateString() === new Date(at).toDateString() && !['cancelled', 'rejected', 'refunded'].includes(x.status)).reduce((a, x) => a + x.sendAmount, 0)
  if (today + q.sendAmount > t.compliance.dailyLimit) fail(`This would take today's total over the £${t.compliance.dailyLimit.toLocaleString('en-GB')} daily limit.`)
  if (!q.partner) fail(`No payout partner is switched on for ${r.cur}.`)
  const tx = {
    id: uid('txn'), ref: `${t.short}-${shortCode(6)}`, tenantId: t.id, customerId: c.id, recipientId: r.id,
    sendAmount: q.sendAmount, fee: q.fee, total: q.total, cur: r.cur, rate: q.rate, receiveAmount: q.receiveAmount,
    partnerId: q.partner.id, method: r.method, purpose: d.purpose || '', sof: d.sof || '', channel: d.channel || 'App',
    fraudConfirm: !!d.fraudConfirm, status: 'awaiting_funds', createdAt: at, updatedAt: at,
    history: [{ at, status: 'awaiting_funds', note: `Created via ${d.channel || 'App'}`, actor }], hits: [], caseId: null, payInId: null,
  }
  db.transactions.unshift(tx)
  audit(db, { tenantId: t.id, actor, action: `Created transfer £${q.sendAmount}`, target: tx.ref, at })
  return tx
}

const step = (tx, status, note, actor, at) => { tx.status = status; tx.updatedAt = at; tx.history.push({ at, status, note, actor }) }

/* ---------------- Payments in (safeguarding account credits) ---------------- */
export function recordPayIn(db, tenantId, d, actor = 'Bank feed', at = now()) {
  const p = { id: uid('pay'), tenantId, amount: +(+d.amount).toFixed(2), payer: d.payer || 'Unknown', reference: (d.reference || '').toUpperCase().trim(), method: d.method || 'Faster Payments', receivedAt: at, status: 'unmatched', txnId: null }
  db.payIns.unshift(p)
  // Auto-match on reference and amount
  const tx = db.transactions.find((x) => x.tenantId === tenantId && x.status === 'awaiting_funds' && p.reference.includes(x.ref))
  if (tx && p.amount >= tx.total - 0.01) matchPayIn(db, p.id, tx.id, 'Auto-match', at)
  else if (tx) p.note = `Underpaid: expected £${tx.total.toFixed(2)}`
  return p
}

export function matchPayIn(db, payInId, txnId, actor, at = now()) {
  const p = db.payIns.find((x) => x.id === payInId) || fail('Payment not found')
  const tx = db.transactions.find((x) => x.id === txnId) || fail('Transfer not found')
  if (p.status === 'matched') fail('This payment is already matched.')
  if (tx.status !== 'awaiting_funds') fail('This transfer is not waiting for funds.')
  if (p.amount < tx.total - 0.01) fail(`Payment £${p.amount.toFixed(2)} is less than the £${tx.total.toFixed(2)} due.`)
  p.status = 'matched'; p.txnId = tx.id; p.matchedBy = actor
  tx.payInId = p.id
  step(tx, 'funds_received', `£${p.amount.toFixed(2)} received from ${p.payer} (${actor})`, actor, at)
  runCompliance(db, tx, at)
}

export function returnPayIn(db, payInId, actor) {
  const p = db.payIns.find((x) => x.id === payInId)
  if (p.status !== 'unmatched') fail('Only unmatched payments can be returned.')
  p.status = 'returned'
  audit(db, { tenantId: p.tenantId, actor, action: `Returned unmatched payment £${p.amount}`, target: p.payer })
}

/* ---------------- Compliance ---------------- */
export function runCompliance(db, tx, at = now()) {
  const t = tenantOf(db, tx.tenantId)
  const hits = evaluate(db, tx)
  tx.hits = hits
  const outcome = decide(hits)
  if (outcome === 'block' || outcome === 'hold') {
    step(tx, 'on_hold', `Held by ${hits.filter((h) => h.action !== 'flag').map((h) => h.name).join(', ')}`, 'Rules engine', at)
    openTxnCase(db, tx, hits, outcome, at)
  } else {
    if (outcome === 'flag') openTxnCase(db, tx, hits, 'flag', at)
    const ar = t.compliance.autoRelease
    if (ar.enabled && tx.sendAmount <= ar.maxAmount) {
      step(tx, 'pending_release', hits.length ? 'Checks passed with alerts (not blocking)' : 'All checks passed', 'Rules engine', at)
      release(db, tx.id, 'Auto-release', at, true)
    } else {
      step(tx, 'pending_release', ar.enabled ? `Checks passed — above auto-release limit of £${ar.maxAmount}` : 'Checks passed — manual release is on', 'Rules engine', at)
    }
  }
  const c = db.customers.find((x) => x.id === tx.customerId)
  computeRisk(db, c)
}

function nextCaseRef(db, t) { db.counters.case = (db.counters.case || 1000) + 1; return `CASE-${db.counters.case}` }

function openTxnCase(db, tx, hits, outcome, at) {
  const t = tenantOf(db, tx.tenantId)
  const k = {
    id: uid('case'), ref: nextCaseRef(db, t), tenantId: tx.tenantId, kind: 'transaction', txnId: tx.id, customerId: tx.customerId, recipientId: tx.recipientId,
    severity: topSeverity(hits), blocking: outcome === 'block', holding: outcome !== 'flag',
    title: hits.map((h) => h.name).join(' · '), hits, status: 'open', outcome: null, assignee: null, notes: [], createdAt: at, closedAt: null,
  }
  db.cases.unshift(k)
  tx.caseId = k.id
  return k
}

function openScreeningCase(db, c, r, sc, at) {
  const isPep = !r && sc.pep && sc.status !== 'potential_match'
  const k = {
    id: uid('case'), ref: nextCaseRef(db), tenantId: c.tenantId, kind: isPep ? 'pep' : 'screening', txnId: null, customerId: c.id, recipientId: r?.id || null,
    severity: 'high', blocking: !isPep, holding: true,
    title: isPep ? `PEP match: ${sc.pep.match} (${sc.pep.role})` : `${r ? 'Recipient' : 'Customer'} screening: ${sc.score}% match to ${sc.match.match}`,
    hits: [{ name: isPep ? 'PEP screening' : 'Sanctions screening', detail: isPep ? `${sc.pep.score}% match, ${sc.pep.role}` : `${sc.match.list} · ${sc.match.reason}`, severity: 'high', action: isPep ? 'hold' : 'block' }],
    status: 'open', outcome: null, assignee: null, notes: [], createdAt: at, closedAt: null,
  }
  db.cases.unshift(k)
  return k
}

export function assignCase(db, caseId, who) {
  const k = db.cases.find((x) => x.id === caseId)
  k.assignee = who
  if (k.status === 'open') k.status = 'in_review'
}
export function addCaseNote(db, caseId, text, actor, at = now()) {
  if (!text?.trim()) fail('Write a note first.')
  const k = db.cases.find((x) => x.id === caseId)
  k.notes.push({ at, by: actor, text: text.trim() })
}
function closeCase(db, k, outcome, note, actor, at) {
  if (note?.trim()) k.notes.push({ at, by: actor, text: note.trim() })
  k.status = 'closed'; k.outcome = outcome; k.closedAt = at; k.closedBy = actor
  audit(db, { tenantId: k.tenantId, actor, action: `Closed ${k.ref}: ${outcome}`, target: k.title, at })
}

export function decideCase(db, caseId, decision, note, actor, role, at = now()) {
  // decision: 'release' | 'reject' | 'clear' (close flag-only case)
  const k = db.cases.find((x) => x.id === caseId) || fail('Case not found')
  if (k.status === 'closed') fail('This case is already closed.')
  if (!note?.trim()) fail('Add a note explaining your decision. It is kept for the audit trail.')
  if (k.blocking && decision === 'release' && !['Admin', 'MLRO'].includes(role)) fail('A blocking rule fired. Only the MLRO or an Admin can release this transfer.')
  const tx = k.txnId ? db.transactions.find((x) => x.id === k.txnId) : null
  if (decision === 'release') {
    if (tx && tx.status === 'on_hold') {
      step(tx, 'pending_release', `Released from hold by ${actor}`, actor, at)
      closeCase(db, k, 'Released after review', note, actor, at)
      release(db, tx.id, actor, at, true)
    } else closeCase(db, k, 'Reviewed — no action', note, actor, at)
  } else if (decision === 'reject') {
    if (tx && ['on_hold', 'pending_release', 'funds_received'].includes(tx.status)) {
      step(tx, 'rejected', `Rejected by ${actor}`, actor, at)
      step(tx, 'refunded', `£${tx.total.toFixed(2)} returned to sender's account`, actor, at)
    }
    closeCase(db, k, 'Rejected and refunded', note, actor, at)
  } else {
    closeCase(db, k, 'Reviewed — no action', note, actor, at)
  }
}

// Re-run rules on held transfers for a customer (after KYC/screening changes). Releases those that now pass.
function recheckHeld(db, customerId, actor, at) {
  for (const tx of db.transactions.filter((x) => x.customerId === customerId && x.status === 'on_hold')) {
    const hits = evaluate(db, tx)
    if (decide(hits) === 'hold' || decide(hits) === 'block') continue
    const k = db.cases.find((x) => x.id === tx.caseId)
    if (k && k.status !== 'closed') closeCase(db, k, 'Cleared automatically — rule no longer applies', 'Re-checked after customer update', actor, at)
    tx.hits = hits
    step(tx, 'pending_release', 'Re-checked: no blocking rules', 'Rules engine', at)
    const t = tenantOf(db, tx.tenantId)
    if (t.compliance.autoRelease.enabled && tx.sendAmount <= t.compliance.autoRelease.maxAmount) release(db, tx.id, 'Auto-release', at, true)
  }
}

/* ---------------- SARs ---------------- */
export function raiseSar(db, d, actor, at = now()) {
  if (!d.grounds?.trim()) fail('Describe your grounds for suspicion.')
  db.counters.sar = (db.counters.sar || 40) + 1
  const s = { id: uid('sar'), ref: `ISAR-${String(db.counters.sar).padStart(4, '0')}`, tenantId: d.tenantId, caseId: d.caseId || null, customerId: d.customerId, txnId: d.txnId || null, type: 'Internal', grounds: d.grounds.trim(), status: 'with_mlro', raisedBy: actor, createdAt: at, decision: null }
  db.sars.unshift(s)
  const k = d.caseId && db.cases.find((x) => x.id === d.caseId)
  if (k && k.status !== 'closed') { k.status = 'escalated'; k.sarId = s.id }
  audit(db, { tenantId: d.tenantId, actor, action: `Raised internal SAR ${s.ref}`, target: '', at })
  return s
}

export function decideSar(db, sarId, d, actor, role, at = now()) {
  if (!['Admin', 'MLRO'].includes(role)) fail('Only the MLRO can decide on a SAR.')
  const s = db.sars.find((x) => x.id === sarId)
  if (!d.reason?.trim()) fail('Record the reason for your decision.')
  if (d.outcome === 'not_filed') {
    s.status = 'not_filed'
  } else {
    if (!d.ncaRef?.trim()) fail('Enter the NCA reference from the SAR Portal.')
    s.status = d.outcome // 'filed' | 'daml_requested'
    s.ncaRef = d.ncaRef.trim()
    if (d.outcome === 'daml_requested') {
      // 7 working-day notice period (approx. 9 calendar days)
      s.moratoriumEnds = at + 9 * DAY
    }
  }
  s.decision = { by: actor, at, reason: d.reason.trim() }
  const k = s.caseId && db.cases.find((x) => x.id === s.caseId)
  if (k && k.status !== 'closed') {
    if (s.status === 'daml_requested') k.notes.push({ at, by: actor, text: `DAML requested (${s.ncaRef}). Do not release until consent or end of notice period.` })
    else closeCase(db, k, s.status === 'filed' ? 'SAR filed with NCA' : 'Internal SAR — no external report', d.reason, actor, at)
  }
  audit(db, { tenantId: s.tenantId, actor, action: `SAR ${s.ref}: ${s.status.replace('_', ' ')}`, target: '', at })
}

/* ---------------- Release & payout ---------------- */
export function release(db, txnId, actor, at = now(), internal = false) {
  const tx = db.transactions.find((x) => x.id === txnId) || fail('Transfer not found')
  if (tx.status !== 'pending_release') fail('Only transfers that are ready can be released.')
  const t = tenantOf(db, tx.tenantId)
  const bal = t.treasury[tx.partnerId] || 0
  if (bal < tx.sendAmount) {
    tx.note = `Waiting for prefunding: ${PARTNERS.find((p) => p.id === tx.partnerId)?.name} balance £${Math.round(bal)}`
    if (!internal) fail(`Not enough prefunding with ${PARTNERS.find((p) => p.id === tx.partnerId)?.name}. Top up in Treasury first.`)
    return false
  }
  t.treasury[tx.partnerId] = +(bal - tx.sendAmount).toFixed(2)
  tx.note = ''
  step(tx, 'released', `Sent to ${PARTNERS.find((p) => p.id === tx.partnerId)?.name}`, actor, at)
  return true
}

export function completePayout(db, txnId, at = now()) {
  const tx = db.transactions.find((x) => x.id === txnId)
  if (!tx || tx.status !== 'released') return
  step(tx, 'paid', `${tx.receiveAmount.toLocaleString('en-GB')} ${tx.cur} paid out (${tx.method})`, PARTNERS.find((p) => p.id === tx.partnerId)?.name || 'Partner', at)
}

export function cancelTransaction(db, txnId, actor, at = now()) {
  const tx = db.transactions.find((x) => x.id === txnId)
  if (tx.status === 'awaiting_funds') step(tx, 'cancelled', 'Cancelled before payment', actor, at)
  else if (['on_hold', 'pending_release', 'funds_received'].includes(tx.status)) { step(tx, 'cancelled', 'Cancelled', actor, at); step(tx, 'refunded', `£${tx.total.toFixed(2)} returned`, actor, at) }
  else fail('This transfer can no longer be cancelled.')
  const k = tx.caseId && db.cases.find((x) => x.id === tx.caseId)
  if (k && k.status !== 'closed') closeCase(db, k, 'Transfer cancelled', '', actor, at)
}

export function topUp(db, tenantId, partnerId, amount, actor, at = now()) {
  const t = tenantOf(db, tenantId)
  if (!(+amount > 0)) fail('Enter an amount.')
  t.treasury[partnerId] = +((t.treasury[partnerId] || 0) + +amount).toFixed(2)
  t.topUps.unshift({ id: uid('top'), partnerId, amount: +amount, at, by: actor })
  audit(db, { tenantId, actor, action: `Prefunded £${(+amount).toLocaleString('en-GB')}`, target: PARTNERS.find((p) => p.id === partnerId)?.name, at })
  // Retry anything waiting for funds at this partner
  for (const tx of db.transactions.filter((x) => x.tenantId === tenantId && x.partnerId === partnerId && x.status === 'pending_release' && x.note?.startsWith('Waiting for prefunding'))) {
    if (t.compliance.autoRelease.enabled && tx.sendAmount <= t.compliance.autoRelease.maxAmount) release(db, tx.id, 'Auto-release', at, true)
  }
}
