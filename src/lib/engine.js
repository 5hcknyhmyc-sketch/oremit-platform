// The platform engine. Every operation takes the database object `db` and mutates it.
// In production each op maps to an API endpoint / database transaction (see docs/ARCHITECTURE.md).
import { CURRENCIES, PARTNERS, partnerFor, partnerById, KYC_PROVIDERS, PAYIN_BANKS, DEFAULT_ROLES, ID_DOC_TYPES, planById, PLATFORM } from './reference'
import { evaluate, decide, topSeverity, defaultRules } from './rules'
import { screenName } from './screening'
import { defaultPolicies } from './policies'
import { defaultEmails } from './emails'
import { uid, shortCode, now, DAY, ageFrom, initials } from './util'

export class OpError extends Error {}
export const fail = (m) => { throw new OpError(m) }

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
    brand: { color: '#1B2559', accent: '#F2A541', logo: null, appName: o.name, tagline: 'Send money home in minutes', font: 'Inter', fontSize: 'M', radius: 14, mode: 'light', nav: 'tabs', ...(o.brand || {}) },
    channels: { portal: true, app: true, ...(o.channels || {}) },
    adminTheme: { sidebar: 'light', accent: null, showLogo: true, ...(o.adminTheme || {}) },
    emailTemplates: o.emailTemplates || defaultEmails(),
    companyNumber: o.companyNumber || '', address: o.address || '', phone: o.phone || '', contactName: o.contactName || '',
    corridors: (o.corridors || []).map((c) => (typeof c === 'string' ? { cur: c, enabled: true, fee: 2.99, feePct: 0, threshold: 0, aboveFee: 0, aboveFeePct: 0, margin: 1.2, min: 10, max: 10000 } : { feePct: 0, threshold: 0, aboveFee: 0, aboveFeePct: 0, ...c })),
    partners: o.partners || [],
    integrations: { kyc: { provider: 'didit', status: 'connected' }, payout: { status: 'connected' }, payin: ['clearbank'], payinStatus: {}, ...(o.integrations || {}) },
    declaration: o.declaration || null,
    compliance: {
      mlro: '', eddThreshold: 5000, sofThreshold: 2000, dailyLimit: 10000, screeningThreshold: 85,
      requireKycBeforeSend: true, idv: 'Document + selfie liveness', screening: 'Real-time sanctions + PEP',
      autoRelease: { enabled: true, maxAmount: 2000 },
      riskWeights: { pep: 40, screeningMatch: 30, confirmedMatch: 80, kycIncomplete: 10, under21: 10, business: 5, highVolume: 15, openCase: 10 },
      ...(o.compliance || {}),
    },
    bank: o.bank || { name: `${o.legalName || o.name} — client account`, sortCode: '04-00-75', account: String(10000000 + Math.floor(Math.random() * 89999999)) },
    products: o.products || ['remittance'],
    roles: o.roles || JSON.parse(JSON.stringify(DEFAULT_ROLES)),
    modules: o.modules || [...planById(o.plan || 'Starter').modules],
    agents: o.agents || [], branches: o.branches || [{ id: 'main', name: 'Head office' }],
    rewards: { enabled: false, pointsPerPound: 1, referralBonus: 10, redeemRate: 100, ...(o.rewards || {}) },
    apiKeys: o.apiKeys || [], webhooks: o.webhooks || [], promos: o.promos || [],
    bureau: { idThreshold: 5000, linkedHours: 24, spreadPct: 3, board: {}, stock: {}, suppliers: ['Wholesale FX Ltd'], reservationHours: 24, shifts: [], orders: [], ...(o.bureau || {}) },
    staff: o.staff || [{ id: uid('stf'), name: 'Owner', email: o.email || '', role: 'Admin' }],
    treasury: o.treasury || Object.fromEntries((o.partners || []).map((p) => [p, 0])),
    topUps: [],
    checks: o.checks || {},
  }
  t.rules = o.rules || defaultRules(t.compliance.eddThreshold, t.compliance.sofThreshold)
  t.policies = o.policies || defaultPolicies(t)
  t.accounts = o.accounts || defaultAccounts(t)
  return t
}

/* ---------------- Ledger (double entry) ---------------- */
// Account types: bank (pay-in/operating accounts), prefund (balance held with a payout partner),
// liability (customer money owed out), income, expense.
export function defaultAccounts(t) {
  const acc = []
  for (const b of t.integrations.payin || []) { const bank = PAYIN_BANKS.find((x) => x.id === b); if (bank) acc.push({ id: `bank_${b}`, name: `${bank.name} (GBP)`, type: 'bank', cur: 'GBP' }) }
  if (!acc.length) acc.push({ id: 'bank_main', name: 'Main bank account (GBP)', type: 'bank', cur: 'GBP' })
  acc.push({ id: 'client_funds', name: 'Customer funds payable', type: 'liability', cur: 'GBP' })
  for (const p of t.partners) acc.push({ id: `prefund_${p}`, name: `Prefund — ${PARTNERS.find((x) => x.id === p)?.name || p}`, type: 'prefund', cur: 'GBP', partnerId: p })
  acc.push({ id: 'inc_fees', name: 'Transfer fee income', type: 'income', cur: 'GBP' }, { id: 'inc_fx', name: 'FX margin income', type: 'income', cur: 'GBP' })
  acc.push({ id: 'exp_it', name: 'IT & software expenses', type: 'expense', cur: 'GBP' }, { id: 'exp_partner', name: 'Partner charges', type: 'expense', cur: 'GBP' }, { id: 'exp_staff', name: 'Staff costs', type: 'expense', cur: 'GBP' }, { id: 'exp_other', name: 'Other operating expenses', type: 'expense', cur: 'GBP' })
  return acc
}
export function ensurePrefundAccount(db, t, partnerId) {
  if (!t.accounts.find((a) => a.id === `prefund_${partnerId}`)) t.accounts.push({ id: `prefund_${partnerId}`, name: `Prefund — ${partnerById(db, partnerId)?.name || partnerId}`, type: 'prefund', cur: 'GBP', partnerId })
}
// Post a balanced journal. lines: [{ account, debit, credit }]
export function post(db, tenantId, { type, details, lines, ref = '', by = 'System', at = now() }) {
  const dr = lines.reduce((a, l) => a + (+l.debit || 0), 0), cr = lines.reduce((a, l) => a + (+l.credit || 0), 0)
  if (Math.abs(dr - cr) > 0.005) fail(`Journal does not balance (debits £${dr.toFixed(2)}, credits £${cr.toFixed(2)}).`)
  db.counters.journal = (db.counters.journal || 1000) + 1
  const j = { id: uid('jnl'), no: db.counters.journal, tenantId, type, details, ref, by, at, lines: lines.map((l) => ({ account: l.account, debit: +(+l.debit || 0).toFixed(2), credit: +(+l.credit || 0).toFixed(2) })) }
  db.journals.unshift(j)
  return j
}
// Balance of an account: bank/prefund/expense increase with debits; liability/income increase with credits.
export function balance(db, t, accountId) {
  const acc = t.accounts.find((a) => a.id === accountId)
  let dr = 0, cr = 0
  for (const j of db.journals) if (j.tenantId === t.id) for (const l of j.lines) if (l.account === accountId) { dr += l.debit; cr += l.credit }
  return +(['liability', 'income'].includes(acc?.type) ? cr - dr : dr - cr).toFixed(2)
}
export function addExpense(db, tenantId, d, actor, at = now()) {
  const t = tenantOf(db, tenantId)
  if (!(+d.amount > 0)) fail('Enter an amount.')
  if (!d.details?.trim()) fail('Enter what the payment was for.')
  return post(db, tenantId, { type: 'EXP', details: d.details.trim(), by: actor, at: d.date ? new Date(d.date).getTime() : at, lines: [{ account: d.expenseAccount, debit: +d.amount }, { account: d.paidFrom, credit: +d.amount }] })
}
export function transferFunds(db, tenantId, d, actor, at = now()) {
  if (!(+d.amount > 0)) fail('Enter an amount.')
  if (d.from === d.to) fail('Choose two different accounts.')
  return post(db, tenantId, { type: 'TRF', details: d.details || 'Transfer between accounts', by: actor, at, lines: [{ account: d.to, debit: +d.amount }, { account: d.from, credit: +d.amount }] })
}

/* ---------------- Integration requests (custom KYC / payout / bank) ---------------- */
export function requestIntegration(db, tenantId, d, actor, at = now()) {
  if (!d.name?.trim()) fail('Enter the provider name.')
  const r = { id: uid('req'), tenantId, kind: d.kind, name: d.name.trim(), notes: d.notes || '', cur: d.cur || [], status: 'requested', quote: null, createdAt: at, by: actor }
  db.integrationRequests.unshift(r)
  audit(db, { tenantId, actor, action: `Requested custom ${d.kind} integration`, target: r.name, at })
  return r
}
export function quoteIntegration(db, reqId, d, actor, at = now()) {
  const r = db.integrationRequests.find((x) => x.id === reqId) || fail('Request not found')
  r.quote = { setup: +d.setup || 0, monthly: +d.monthly || 0, weeks: +d.weeks || 0, note: d.note || '' }
  r.status = 'quoted'
  audit(db, { tenantId: r.tenantId, actor, action: `Quoted custom ${r.kind} integration £${r.quote.setup} setup`, target: r.name, at })
}
export function setIntegrationStatus(db, reqId, status, actor, at = now()) {
  const r = db.integrationRequests.find((x) => x.id === reqId) || fail('Request not found')
  r.status = status
  const t = tenantOf(db, r.tenantId)
  if (status === 'live') {
    if (r.kind === 'payout') {
      const id = `custom_${r.id}`
      db.customPartners.push({ id, name: r.name, cur: r.cur.length ? r.cur : t.corridors.map((c) => c.cur), methods: ['Bank'], included: false, tenantId: t.id, status: 'live' })
      if (!t.partners.includes(id)) t.partners.push(id)
      t.treasury[id] = t.treasury[id] || 0
      ensurePrefundAccount(db, t, id)
      t.checks.payout = true
    }
    if (r.kind === 'kyc') { t.integrations.kyc = { provider: 'custom', name: r.name, status: 'connected' }; t.checks.kyc = true }
    if (r.kind === 'payin') { t.integrations.payin.push('custom'); t.accounts.push({ id: `bank_${r.id}`, name: `${r.name} (GBP)`, type: 'bank', cur: 'GBP' }) }
  }
  audit(db, { tenantId: r.tenantId, actor, action: `Custom ${r.kind} integration ${status.replace('_', ' ')}`, target: r.name, at })
}
export const tenantOf = (db, id) => db.tenants.find((t) => t.id === id) || fail('MSB not found')

export function createInvite(db, actor, label = '', products = ['remittance']) {
  const inv = { token: shortCode(8).toLowerCase(), label, products, createdAt: now(), expiresAt: now() + 7 * DAY, usedBy: null, createdBy: actor }
  db.invites.unshift(inv)
  audit(db, { actor, action: 'Created onboarding link', target: inv.token })
  return inv
}

export function completeOnboarding(db, token, data, seconds) {
  const inv = db.invites.find((i) => i.token === token)
  if (!inv) fail('This onboarding link is not valid.')
  if (inv.usedBy) fail('This onboarding link has already been used.')
  if (inv.expiresAt < now()) fail('This onboarding link has expired. Ask TheFXSoft for a new one.')
  if (db.tenants.some((t) => t.slug === data.slug)) fail(`${data.slug}.${PLATFORM.domain} is already taken.`)
  const products = inv.products || ['remittance']
  const remit = products.includes('remittance'), bdc = products.includes('bureau')
  const plan = data.plan || (remit ? 'Starter' : 'Bureau')
  const t = makeTenant({
    name: data.name, legalName: data.legalName, slug: data.slug, domain: data.domain, frn: data.frn, mlr: data.mlr, email: data.email,
    status: 'review', setupSeconds: seconds, products, plan,
    modules: [...new Set([...planById(plan).modules, ...(bdc ? ['bureau'] : []), ...(remit ? ['transactions', 'payments', 'tracker'] : [])])].filter((m) => remit || !['transactions', 'payments', 'tracker'].includes(m)),
    branches: (data.branches || []).length ? data.branches.map((b, i) => ({ id: i === 0 ? 'main' : uid('br'), name: b.name, address: b.address || '' })) : undefined,
    bureau: bdc ? { idThreshold: +data.bdcThreshold || 5000, linkedHours: 24, spreadPct: +data.spread || 3, board: {}, stock: {}, suppliers: data.supplier ? [data.supplier] : ['Wholesale FX Ltd'], currencies: data.cashCurrencies || [], reservationHours: 24, shifts: [], orders: [] } : undefined,
    brand: { color: data.color, accent: data.accent, logo: data.logo, appName: data.appName || data.name, tagline: data.tagline, font: data.font, fontSize: data.fontSize, radius: +data.radius, mode: data.mode, nav: data.nav },
    channels: data.channels, adminTheme: data.adminTheme, emailTemplates: data.emails, companyNumber: data.companyNumber, address: data.address, phone: data.phone, contactName: data.ownerName, website: data.hasWebsite ? data.website : '',
    corridors: remit ? data.corridors.map((cur) => { const pr = (data.pricing || {})[cur] || {}; return { cur, enabled: true, fee: +pr.fee || 0, feePct: +pr.feePct || 0, threshold: +pr.threshold || 0, aboveFee: +pr.aboveFee || 0, aboveFeePct: +pr.aboveFeePct || 0, margin: +pr.margin || 0, min: 10, max: +data.daily || 10000 } }) : [],
    partners: remit ? data.partners : [],
    integrations: { kyc: { provider: data.kyc, status: data.kyc === 'custom' ? 'requested' : data.kycConnected ? 'connected' : 'pending' }, payout: { status: data.payoutConnected ? 'connected' : data.partners.length ? 'pending' : 'requested' }, payin: data.payin, payinStatus: data.payinConnected || {} },
    declaration: { accepted: !!data.declaration, by: data.ownerName || data.email, at: now() },
    compliance: { mlro: data.mlro, eddThreshold: +data.edd, sofThreshold: +data.sof, dailyLimit: +data.daily, idv: data.idv, screening: data.screening, autoRelease: { enabled: data.releaseMode !== 'manual', maxAmount: data.releaseMode === 'manual' ? 0 : +data.daily || 10000 }, releaseMode: data.releaseMode || 'auto', policyFiles: data.policyFiles || [] },
    staff: [{ id: uid('stf'), name: data.ownerName || 'Owner', email: data.email, role: 'Admin' }, ...(data.mlro ? [{ id: uid('stf'), name: data.mlro, email: '', role: 'MLRO' }] : [])],
    checks: { reg: (remit ? /^\d{6,7}$/.test(data.frn) : true) && !!data.mlr, kyc: data.kyc !== 'custom', payout: !remit || data.partners.some((p) => PARTNERS.some((x) => x.id === p)), prefund: !remit, domain: true },
  })
  if (!data.declaration) fail('Please confirm the declaration before launching.')
  db.tenants.push(t)
  inv.usedBy = t.id
  if (data.kyc === 'custom') requestIntegration(db, t.id, { kind: 'kyc', name: data.kycCustomName || 'Custom KYC provider', notes: 'Requested at onboarding' }, data.email, now())
  if (bdc && +data.openingFloat > 0) { t.bureau.stock[`main:GBP`] = +data.openingFloat; t.accounts.push({ id: 'till_main_GBP', name: `Till ${t.branches[0].name} — GBP`, type: 'till', cur: 'GBP', branchId: 'main' }); post(db, t.id, { type: 'OPEN', details: 'Opening GBP till float', by: data.email, at: now(), lines: [{ account: 'till_main_GBP', debit: +data.openingFloat }, { account: t.accounts.find((a) => a.type === 'bank').id, credit: +data.openingFloat }] }) }
  if (remit && data.payoutCustomName) requestIntegration(db, t.id, { kind: 'payout', name: data.payoutCustomName, notes: 'Requested at onboarding', cur: data.corridors }, data.email, now())
  if (data.hasWebsite === false && data.wantWebsite) requestIntegration(db, t.id, { kind: 'website', name: `Website for ${data.name}`, notes: `Pages: ${data.websiteRequest?.pages || '-'} · domain: ${data.websiteRequest?.domain || 'to decide'} · languages: ${data.websiteRequest?.languages || 'English'} · call: ${data.websiteRequest?.callTime || '-'}${data.websiteRequest?.notes ? ` · ${data.websiteRequest.notes}` : ''}` }, data.email, now())
  if (remit && data.payinCustomName) requestIntegration(db, t.id, { kind: 'payin', name: data.payinCustomName, notes: `Requested at onboarding · ${({ standard: 'standard (about a week)', urgent: 'urgent (extra cost)', critical: 'very urgent (higher extra cost)' })[data.payinUrgency || 'standard']}` }, data.email, now())
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
// Go-live checklist. Commercial and technical only: the MSB is responsible for its own regulatory status.
export const APPROVAL_CHECKS = [
  ['contract', 'Platform agreement signed and plan chosen'], ['reg', 'FCA FRN and HMRC MLR numbers entered (self-declared by the MSB)'],
  ['kyc', 'KYC provider connected'], ['payout', 'Payout partner connected'], ['prefund', 'Initial prefunding received by the payout partner'], ['domain', 'Subdomain or custom domain live'],
]

/* ---------------- Customers & recipients ---------------- */
export function computeRisk(db, c) {
  const t = db.tenants.find((x) => x.id === c.tenantId)
  const factors = []
  const w = { pep: 40, screeningMatch: 30, confirmedMatch: 80, kycIncomplete: 10, under21: 10, business: 5, highVolume: 15, openCase: 10, ...(t?.compliance.riskWeights || {}) }
  let score = 10
  if (c.pep) { score += w.pep; factors.push('Politically exposed person') }
  if (c.screening?.status === 'potential_match') { score += w.screeningMatch; factors.push('Unresolved screening match') }
  if (c.screening?.status === 'confirmed_match') { score += w.confirmedMatch; factors.push('Confirmed sanctions match') }
  if (c.kyc.status !== 'verified') { score += w.kycIncomplete; factors.push('Identity not verified') }
  const age = ageFrom(c.dob)
  if (age !== null && age < 21) { score += w.under21; factors.push('Under 21') }
  if (c.type === 'business') { score += w.business; factors.push('Business customer') }
  const recent = db.transactions.filter((x) => x.customerId === c.id && now() - x.createdAt < 30 * DAY && !['cancelled', 'rejected', 'refunded'].includes(x.status))
  const vol = recent.reduce((a, x) => a + x.sendAmount, 0)
  if (vol > (t?.compliance.eddThreshold || 5000) * 2) { score += w.highVolume; factors.push(`£${Math.round(vol).toLocaleString('en-GB')} sent in 30 days`) }
  const openCases = db.cases.filter((k) => k.customerId === c.id && k.status !== 'closed').length
  if (openCases) { score += w.openCase * openCases; factors.push(`${openCases} open compliance case${openCases > 1 ? 's' : ''}`) }
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
    createdAt: at, status: 'active', pep: !!sc.pep, pepDetail: sc.pep, company: d.company || null, agentId: d.agentId || null, referredBy: d.referredBy || null, points: 0,
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
  const idOk = c.kyc.docs.some((x) => x.status === 'verified' && ID_DOC_TYPES.includes(x.type))
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
// Per-corridor pricing. Below the threshold: fixed fee + % of the amount. At or above it: the "above" fee (default £0 + 0%),
// so an MSB can say "under £100 we charge £3 + 1%; £100 and over we only make the FX margin".
export function corridorFee(cor, amount) {
  const amt = Math.max(0, +amount || 0)
  const thr = +cor.threshold || 0
  const above = thr > 0 && amt >= thr
  const fixed = above ? +cor.aboveFee || 0 : +cor.fee || 0
  const pct = above ? +cor.aboveFeePct || 0 : +cor.feePct || 0
  return { fee: +(fixed + (amt * pct) / 100).toFixed(2), band: above ? 'above' : 'below' }
}
export const describePricing = (cor) => {
  const part = (f, p) => [f ? `£${(+f).toFixed(2)}` : '', p ? `${+p}%` : ''].filter(Boolean).join(' + ') || 'no fee'
  const thr = +cor.threshold || 0
  return thr > 0 ? `under £${thr}: ${part(cor.fee, cor.feePct)} · £${thr}+: ${part(cor.aboveFee, cor.aboveFeePct)} · FX margin ${+cor.margin || 0}%` : `${part(cor.fee, cor.feePct)} · FX margin ${+cor.margin || 0}%`
}
export function quote(db, t, cur, sendAmount) {
  const cor = t.corridors.find((c) => c.cur === cur && c.enabled)
  if (!cor) return null
  const base = CURRENCIES[cur].rate
  const rate = +(base * (1 - cor.margin / 100)).toFixed(4)
  const amt = Math.max(0, +sendAmount || 0)
  const { fee, band } = corridorFee(cor, amt)
  return { cur, rate, fee, feeBand: band, sendAmount: amt, total: +(amt + fee).toFixed(2), receiveAmount: +(amt * rate).toFixed(2), min: cor.min, max: cor.max, partner: partnerFor(db, t, cur) }
}

export function createTransaction(db, d, actor = 'Customer', at = now()) {
  const t = tenantOf(db, d.tenantId)
  if (t.status === 'suspended') fail('This MSB is suspended and cannot send money.')
  const c = db.customers.find((x) => x.id === d.customerId) || fail('Choose a customer.')
  if (c.status === 'frozen') fail('This customer is frozen. Contact compliance.')
  const r = db.recipients.find((x) => x.id === d.recipientId) || fail('Choose a recipient.')
  const q = quote(db, t, r.cur, d.sendAmount)
  if (!q) fail(`${t.name} does not send to ${r.cur}.`)
  if (q.sendAmount < q.min) fail(`The minimum transfer is £${q.min}.`)
  if (q.sendAmount > q.max) fail(`The maximum single transfer is £${q.max.toLocaleString('en-GB')}.`)
  if (t.compliance.requireKycBeforeSend && c.kyc.status === 'not_started' && actor === 'Customer') fail('Verify your identity before sending.')
  const today = db.transactions.filter((x) => x.customerId === c.id && new Date(x.createdAt).toDateString() === new Date(at).toDateString() && !['cancelled', 'rejected', 'refunded'].includes(x.status)).reduce((a, x) => a + x.sendAmount, 0)
  if (today + q.sendAmount > t.compliance.dailyLimit) fail(`This would take today's total over the £${t.compliance.dailyLimit.toLocaleString('en-GB')} daily limit.`)
  if (!q.partner) fail(`No payout partner is switched on for ${r.cur}.`)
  if (c.type === 'business' && c.company?.monthlyLimit) {
    const month = db.transactions.filter((x) => x.customerId === c.id && new Date(x.createdAt).getMonth() === new Date(at).getMonth() && !['cancelled', 'rejected', 'refunded'].includes(x.status)).reduce((a, x) => a + x.sendAmount, 0)
    if (month + q.sendAmount > c.company.monthlyLimit) fail(`This would exceed ${c.name}'s contract limit of £${c.company.monthlyLimit.toLocaleString('en-GB')} this month.`)
  }
  const tx = {
    id: uid('txn'), ref: `${t.short}-${shortCode(6)}`, tenantId: t.id, customerId: c.id, recipientId: r.id,
    sendAmount: q.sendAmount, fee: q.fee, total: q.total, cur: r.cur, rate: q.rate, receiveAmount: q.receiveAmount,
    partnerId: q.partner.id, method: r.method, purpose: d.purpose || '', sof: d.sof || '', channel: d.channel || 'App',
    fraudConfirm: !!d.fraudConfirm, agentId: d.agentId || c.agentId || null, status: 'awaiting_funds', createdAt: at, updatedAt: at,
    history: [{ at, status: 'awaiting_funds', note: `Created via ${d.channel || 'App'}`, actor }], hits: [], caseId: null, payInId: null,
  }
  db.transactions.unshift(tx)
  audit(db, { tenantId: t.id, actor, action: `Created transfer £${q.sendAmount}`, target: tx.ref, at })
  return tx
}

const step = (tx, status, note, actor, at) => { tx.status = status; tx.updatedAt = at; tx.history.push({ at, status, note, actor }) }

/* ---------------- Payments in (safeguarding account credits) ---------------- */
export function recordPayIn(db, tenantId, d, actor = 'Bank feed', at = now()) {
  const t = tenantOf(db, tenantId)
  const p = { id: uid('pay'), tenantId, amount: +(+d.amount).toFixed(2), payer: d.payer || 'Unknown', reference: (d.reference || '').toUpperCase().trim(), method: d.method || 'Faster Payments', bankId: d.bankId || t.integrations.payin[0], receivedAt: at, status: 'unmatched', txnId: null }
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
  const t = tenantOf(db, tx.tenantId)
  const bankAcc = t.accounts.find((a) => a.id === `bank_${p.bankId}`) || t.accounts.find((a) => a.type === 'bank')
  post(db, t.id, { type: 'AUTO', details: `Customer payment ${tx.ref} from ${p.payer}`, ref: tx.ref, by: actor, at, lines: [{ account: bankAcc.id, debit: p.amount }, { account: 'client_funds', credit: p.amount }] })
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
      refundJournal(db, tx, actor, at)
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

function refundJournal(db, tx, actor, at) {
  const t = tenantOf(db, tx.tenantId)
  const p = tx.payInId && db.payIns.find((x) => x.id === tx.payInId)
  const bankAcc = (p && t.accounts.find((a) => a.id === `bank_${p.bankId}`)) || t.accounts.find((a) => a.type === 'bank')
  post(db, t.id, { type: 'AUTO', details: `Refund ${tx.ref}`, ref: tx.ref, by: actor, at, lines: [{ account: 'client_funds', debit: tx.total }, { account: bankAcc.id, credit: tx.total }] })
}

/* ---------------- Release & payout ---------------- */
export function release(db, txnId, actor, at = now(), internal = false) {
  const tx = db.transactions.find((x) => x.id === txnId) || fail('Transfer not found')
  if (tx.status !== 'pending_release') fail('Only transfers that are ready can be released.')
  const t = tenantOf(db, tx.tenantId)
  const bal = t.treasury[tx.partnerId] || 0
  if (bal < tx.sendAmount) {
    tx.note = `Waiting for prefunding: ${partnerById(db, tx.partnerId)?.name} balance £${Math.round(bal)}`
    if (!internal) fail(`Not enough prefunding with ${partnerById(db, tx.partnerId)?.name}. Top up in Treasury first.`)
    return false
  }
  t.treasury[tx.partnerId] = +(bal - tx.sendAmount).toFixed(2)
  tx.note = ''
  ensurePrefundAccount(db, t, tx.partnerId)
  const cor = t.corridors.find((c) => c.cur === tx.cur)
  const fx = +(tx.sendAmount * ((cor?.margin || 0) / 100)).toFixed(2)
  post(db, t.id, { type: 'AUTO', details: `Payout ${tx.ref} via ${partnerById(db, tx.partnerId)?.name}`, ref: tx.ref, by: actor, at, lines: [
    { account: 'client_funds', debit: tx.total }, { account: `prefund_${tx.partnerId}`, credit: +(tx.sendAmount - fx).toFixed(2) }, { account: 'inc_fx', credit: fx }, { account: 'inc_fees', credit: tx.fee },
  ] })
  step(tx, 'released', `Sent to ${partnerById(db, tx.partnerId)?.name}`, actor, at)
  return true
}

export function completePayout(db, txnId, at = now()) {
  const tx = db.transactions.find((x) => x.id === txnId)
  if (!tx || tx.status !== 'released') return
  step(tx, 'paid', `${tx.receiveAmount.toLocaleString('en-GB')} ${tx.cur} paid out (${tx.method})`, partnerById(db, tx.partnerId)?.name || 'Partner', at)
  const t = tenantOf(db, tx.tenantId), c = db.customers.find((x) => x.id === tx.customerId)
  if (t.rewards.enabled && c) c.points = (c.points || 0) + Math.floor(tx.sendAmount * t.rewards.pointsPerPound)
  if (tx.agentId) { const a = t.agents.find((x) => x.id === tx.agentId); if (a) { a.commissionDue = +((a.commissionDue || 0) + tx.fee * (a.commissionPct / 100)).toFixed(2) } }
}

export function cancelTransaction(db, txnId, actor, at = now()) {
  const tx = db.transactions.find((x) => x.id === txnId)
  if (tx.status === 'awaiting_funds') step(tx, 'cancelled', 'Cancelled before payment', actor, at)
  else if (['on_hold', 'pending_release', 'funds_received'].includes(tx.status)) { step(tx, 'cancelled', 'Cancelled', actor, at); step(tx, 'refunded', `£${tx.total.toFixed(2)} returned`, actor, at); refundJournal(db, tx, actor, at) }
  else fail('This transfer can no longer be cancelled.')
  const k = tx.caseId && db.cases.find((x) => x.id === tx.caseId)
  if (k && k.status !== 'closed') closeCase(db, k, 'Transfer cancelled', '', actor, at)
}

export function topUp(db, tenantId, partnerId, amount, actor, at = now(), fromAccount = null) {
  const t = tenantOf(db, tenantId)
  if (!(+amount > 0)) fail('Enter an amount.')
  t.treasury[partnerId] = +((t.treasury[partnerId] || 0) + +amount).toFixed(2)
  t.topUps.unshift({ id: uid('top'), partnerId, amount: +amount, at, by: actor })
  ensurePrefundAccount(db, t, partnerId)
  const from = fromAccount || t.accounts.find((a) => a.type === 'bank')?.id
  post(db, tenantId, { type: 'TRF', details: `Prefunding ${partnerById(db, partnerId)?.name}`, by: actor, at, lines: [{ account: `prefund_${partnerId}`, debit: +amount }, { account: from, credit: +amount }] })
  if (t.status === 'review') t.checks.prefund = true
  audit(db, { tenantId, actor, action: `Prefunded £${(+amount).toLocaleString('en-GB')}`, target: partnerById(db, partnerId)?.name, at })
  // Retry anything waiting for funds at this partner
  for (const tx of db.transactions.filter((x) => x.tenantId === tenantId && x.partnerId === partnerId && x.status === 'pending_release' && x.note?.startsWith('Waiting for prefunding'))) {
    if (t.compliance.autoRelease.enabled && tx.sendAmount <= t.compliance.autoRelease.maxAmount) release(db, tx.id, 'Auto-release', at, true)
  }
}
