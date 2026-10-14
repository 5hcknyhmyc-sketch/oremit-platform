// Operations for the configurable platform and the optional modules (agents, corporate, rewards, developer, bureau de change).
import { audit, post, balance, tenantOf, fail, computeRisk } from './engine'
import { screenName } from './screening'
import { CURRENCIES, MODULES, planById } from './reference'
import { uid, now, shortCode } from './util'

/* ---------------- Platform settings (Super Admin) ---------------- */
export function updatePlatform(db, patch, actor) {
  Object.assign(db.platform, patch)
  audit(db, { actor, action: 'Updated platform settings', target: Object.keys(patch).join(', ') })
}
export function setCurrency(db, code, d, actor) {
  code = code.toUpperCase().trim()
  if (!/^[A-Z]{3}$/.test(code)) fail('Currency code must be 3 letters, e.g. PKR.')
  const prev = db.platform.currencies[code]
  const rate = +d.rate
  if (!(rate > 0)) fail('Enter a rate above 0.')
  db.platform.currencies[code] = { ...(prev || {}), country: d.country || prev?.country || code, rate, enabled: d.enabled ?? prev?.enabled ?? true, cash: d.cash ?? prev?.cash ?? false }
  if (!prev || prev.rate !== rate) db.platform.rateHistory.unshift({ id: uid('rt'), code, rate, prev: prev?.rate ?? null, source: d.source || 'Manual', by: actor, at: now() })
  if (db.platform.rateHistory.length > 2000) db.platform.rateHistory.length = 2000
  audit(db, { actor, action: prev ? `Updated ${code} rate to ${rate}` : `Added currency ${code}`, target: '' })
}
export function removeCurrency(db, code, actor) {
  if (db.tenants.some((t) => t.corridors.some((c) => c.cur === code))) fail(`${code} is used by an MSB corridor. Disable it instead.`)
  delete db.platform.currencies[code]
  audit(db, { actor, action: `Removed currency ${code}`, target: '' })
}
export function upsertCatalog(db, list, item, actor) {
  // list: 'partners' | 'kycProviders' | 'payinBanks' | 'plans' | 'modules'
  if (!item.name?.trim()) fail('Enter a name.')
  const arr = db.platform[list]
  const id = item.id || item.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const i = arr.findIndex((x) => x.id === id)
  const next = { ...(i >= 0 ? arr[i] : {}), ...item, id }
  if (i >= 0) arr[i] = next; else arr.push(next)
  audit(db, { actor, action: `${i >= 0 ? 'Updated' : 'Added'} ${list.replace(/s$/, '')} ${next.name}`, target: '' })
  return next
}
export function removeCatalog(db, list, id, actor) {
  const used = { partners: (t) => t.partners.includes(id), kycProviders: (t) => t.integrations.kyc.provider === id, payinBanks: (t) => t.integrations.payin.includes(id), plans: (t) => t.plan === id, modules: () => true }[list]
  if (list === 'modules') fail('Modules are built into the software. Hide them from a plan instead.')
  if (db.tenants.some(used)) fail('An MSB is using this. Remove it from the MSB first.')
  db.platform[list] = db.platform[list].filter((x) => x.id !== id)
  audit(db, { actor, action: `Removed ${list.replace(/s$/, '')} ${id}`, target: '' })
}
export function setList(db, key, values, actor) {
  db.platform.lists[key] = values.map((v) => v.trim()).filter(Boolean)
  audit(db, { actor, action: `Updated list: ${key}`, target: '' })
}
export function setTenantModules(db, tenantId, modules, actor) {
  const t = tenantOf(db, tenantId)
  const core = MODULES.filter((m) => m.core).map((m) => m.id)
  t.modules = [...new Set([...core, ...modules])]
  audit(db, { tenantId, actor, action: 'Changed enabled modules', target: t.modules.filter((m) => !core.includes(m)).join(', ') || 'core only' })
}
export function setTenantPlan(db, tenantId, planId, actor) {
  const t = tenantOf(db, tenantId)
  t.plan = planId
  t.modules = [...planById(planId).modules]
  audit(db, { tenantId, actor, action: `Changed plan to ${planId}`, target: '' })
}

/* ---------------- Roles ---------------- */
export function saveRole(db, tenantId, name, modules, actor, rename = null) {
  const t = tenantOf(db, tenantId)
  name = name.trim()
  if (!name) fail('Enter a role name.')
  if (name === 'Admin' && rename) fail('The Admin role cannot be renamed.')
  if (rename && rename !== name) { if (t.roles[name]) fail('A role with that name already exists.'); t.roles[name] = t.roles[rename]; delete t.roles[rename]; t.staff.forEach((s) => { if (s.role === rename) s.role = name }) }
  t.roles[name] = name === 'Admin' ? ['*'] : [...modules]
  audit(db, { tenantId, actor, action: `${rename ? 'Updated' : 'Created'} role ${name}`, target: '' })
}
export function deleteRole(db, tenantId, name, actor) {
  const t = tenantOf(db, tenantId)
  if (name === 'Admin') fail('The Admin role cannot be deleted.')
  if (t.staff.some((s) => s.role === name)) fail('Reassign staff with this role first.')
  delete t.roles[name]
  audit(db, { tenantId, actor, action: `Deleted role ${name}`, target: '' })
}
export const roleModules = (t, role) => (t.roles[role]?.includes('*') ? t.modules : (t.roles[role] || []).filter((m) => t.modules.includes(m)))

/* ---------------- Agents & branches ---------------- */
export function saveBranch(db, tenantId, d, actor) {
  const t = tenantOf(db, tenantId)
  if (!d.name?.trim()) fail('Enter a branch name.')
  const b = d.id ? t.branches.find((x) => x.id === d.id) : null
  if (b) Object.assign(b, { name: d.name.trim(), address: d.address || '' })
  else t.branches.push({ id: uid('br'), name: d.name.trim(), address: d.address || '' })
  audit(db, { tenantId, actor, action: `${b ? 'Updated' : 'Added'} branch ${d.name}`, target: '' })
}
export function saveAgent(db, tenantId, d, actor) {
  const t = tenantOf(db, tenantId)
  if (!d.name?.trim()) fail('Enter the agent name.')
  const a = d.id ? t.agents.find((x) => x.id === d.id) : null
  const data = { name: d.name.trim(), branchId: d.branchId || t.branches[0]?.id, commissionPct: +d.commissionPct || 0, floatLimit: +d.floatLimit || 0, contact: d.contact || '', status: d.status || 'active' }
  if (a) Object.assign(a, data)
  else {
    const id = uid('agt')
    t.agents.push({ id, ...data, commissionDue: 0, createdAt: now() })
    t.accounts.push({ id: `agent_${id}`, name: `Agent float — ${data.name}`, type: 'bank', cur: 'GBP', agentId: id })
    if (!t.roles.Agent) t.roles.Agent = ['transactions', 'customers', 'tracker']
    t.staff.push({ id: uid('stf'), name: data.name, email: data.contact, role: 'Agent', agentId: id })
  }
  audit(db, { tenantId, actor, action: `${a ? 'Updated' : 'Added'} agent ${data.name}`, target: '' })
}
export function agentFloat(db, tenantId, agentId, amount, direction, actor, at = now()) {
  // direction 'issue' = MSB gives float to agent (Dr agent float, Cr bank); 'collect' = agent remits cash collected to MSB bank
  const t = tenantOf(db, tenantId)
  const a = t.agents.find((x) => x.id === agentId) || fail('Agent not found')
  if (!(+amount > 0)) fail('Enter an amount.')
  const bank = t.accounts.find((x) => x.type === 'bank' && !x.agentId)?.id
  const lines = direction === 'issue' ? [{ account: `agent_${agentId}`, debit: +amount }, { account: bank, credit: +amount }] : [{ account: bank, debit: +amount }, { account: `agent_${agentId}`, credit: +amount }]
  post(db, tenantId, { type: 'AGT', details: `${direction === 'issue' ? 'Float issued to' : 'Cash collected from'} ${a.name}`, by: actor, at, lines })
  audit(db, { tenantId, actor, action: `${direction === 'issue' ? 'Issued float' : 'Collected cash'} £${(+amount).toLocaleString('en-GB')}`, target: a.name, at })
}
export function payCommission(db, tenantId, agentId, actor, at = now()) {
  const t = tenantOf(db, tenantId)
  const a = t.agents.find((x) => x.id === agentId) || fail('Agent not found')
  if (!(a.commissionDue > 0)) fail('No commission due.')
  const bank = t.accounts.find((x) => x.type === 'bank' && !x.agentId)?.id
  if (!t.accounts.find((x) => x.id === 'exp_commission')) t.accounts.push({ id: 'exp_commission', name: 'Agent commission', type: 'expense', cur: 'GBP' })
  post(db, tenantId, { type: 'AGT', details: `Commission paid to ${a.name}`, by: actor, at, lines: [{ account: 'exp_commission', debit: a.commissionDue }, { account: bank, credit: a.commissionDue }] })
  a.commissionPaid = +((a.commissionPaid || 0) + a.commissionDue).toFixed(2)
  a.commissionDue = 0
  audit(db, { tenantId, actor, action: 'Paid agent commission', target: a.name, at })
}

/* ---------------- Corporate clients ---------------- */
export function setCompany(db, customerId, d, actor) {
  const c = db.customers.find((x) => x.id === customerId) || fail('Customer not found')
  c.type = 'business'
  c.company = { ...(c.company || {}), regNo: d.regNo || '', contact: d.contact || '', monthlyLimit: +d.monthlyLimit || 0, sector: d.sector || '', ubos: d.ubos || '' }
  computeRisk(db, c)
  audit(db, { tenantId: c.tenantId, actor, action: 'Updated corporate profile', target: c.name })
}

/* ---------------- Rewards ---------------- */
export function setRewards(db, tenantId, d, actor) {
  const t = tenantOf(db, tenantId)
  t.rewards = { enabled: !!d.enabled, pointsPerPound: +d.pointsPerPound || 0, referralBonus: +d.referralBonus || 0, redeemRate: +d.redeemRate || 100 }
  audit(db, { tenantId, actor, action: 'Updated rewards settings', target: '' })
}
export function redeemPoints(db, customerId, points, actor) {
  const c = db.customers.find((x) => x.id === customerId) || fail('Customer not found')
  const t = tenantOf(db, c.tenantId)
  if (!(points > 0) || points > (c.points || 0)) fail('Not enough points.')
  c.points -= points
  const value = +(points / t.rewards.redeemRate).toFixed(2)
  c.credit = +((c.credit || 0) + value).toFixed(2)
  audit(db, { tenantId: t.id, actor, action: `Redeemed ${points} points for £${value} credit`, target: c.name })
  return value
}

/* ---------------- Developer: API keys & webhooks ---------------- */
export function createApiKey(db, tenantId, label, actor) {
  const t = tenantOf(db, tenantId)
  if (!label?.trim()) fail('Give the key a label.')
  const key = `crm_${t.slug}_${shortCode(24).toLowerCase()}`
  t.apiKeys.push({ id: uid('key'), label: label.trim(), prefix: key.slice(0, 16) + '…', createdAt: now(), by: actor, lastUsed: null, revoked: false })
  audit(db, { tenantId, actor, action: 'Created API key', target: label })
  return key // shown once
}
export function revokeApiKey(db, tenantId, id, actor) {
  const t = tenantOf(db, tenantId)
  const k = t.apiKeys.find((x) => x.id === id) || fail('Key not found')
  k.revoked = true
  audit(db, { tenantId, actor, action: 'Revoked API key', target: k.label })
}
export const WEBHOOK_EVENTS = ['transfer.created', 'transfer.funds_received', 'transfer.on_hold', 'transfer.released', 'transfer.paid', 'transfer.refunded', 'customer.created', 'customer.kyc_verified', 'case.opened', 'case.closed']
export function saveWebhook(db, tenantId, d, actor) {
  const t = tenantOf(db, tenantId)
  if (!/^https:\/\/.+/.test(d.url || '')) fail('Webhook URL must start with https://')
  if (!d.events?.length) fail('Choose at least one event.')
  const w = d.id ? t.webhooks.find((x) => x.id === d.id) : null
  if (w) Object.assign(w, { url: d.url, events: d.events, active: d.active ?? true })
  else t.webhooks.push({ id: uid('wh'), url: d.url, events: d.events, active: true, secret: 'whsec_' + shortCode(20).toLowerCase(), createdAt: now(), deliveries: [] })
  audit(db, { tenantId, actor, action: `${w ? 'Updated' : 'Added'} webhook`, target: d.url })
}
export function deleteWebhook(db, tenantId, id, actor) {
  const t = tenantOf(db, tenantId)
  t.webhooks = t.webhooks.filter((x) => x.id !== id)
  audit(db, { tenantId, actor, action: 'Deleted webhook', target: '' })
}

/* ---------------- Bureau de change ---------------- */
// Rate board per currency: { buy, sell } in foreign units per GBP. buy = we buy foreign from customer (we pay fewer GBP → higher number);
// sell = we sell foreign to customer (customer gets fewer units → lower number).
export function boardRate(t, code) {
  const mid = CURRENCIES[code]?.rate
  if (!mid) return null
  const b = t.bureau.board[code]
  const s = (t.bureau.spreadPct || 3) / 100
  return { code, mid, buy: b?.buy ?? +(mid * (1 + s)).toFixed(4), sell: b?.sell ?? +(mid * (1 - s)).toFixed(4), custom: !!b }
}
export function setBoard(db, tenantId, code, d, actor) {
  const t = tenantOf(db, tenantId)
  if (d === null) delete t.bureau.board[code]
  else {
    if (!(+d.buy > 0 && +d.sell > 0)) fail('Enter buy and sell rates above 0.')
    if (+d.sell > +d.buy) fail('Sell rate (units you give per £) should not be higher than your buy rate.')
    t.bureau.board[code] = { buy: +d.buy, sell: +d.sell }
  }
  audit(db, { tenantId, actor, action: `${d ? 'Set' : 'Reset'} rate board ${code}`, target: '' })
}
export function setBureauSettings(db, tenantId, d, actor) {
  const t = tenantOf(db, tenantId)
  t.bureau.idThreshold = +d.idThreshold || 0; t.bureau.linkedHours = +d.linkedHours || 24; t.bureau.spreadPct = +d.spreadPct || 0
  t.bureau.currencies = d.currencies || t.bureau.currencies
  audit(db, { tenantId, actor, action: 'Updated bureau settings', target: '' })
}
const ensureTill = (t, branchId, code) => {
  const id = `till_${branchId}_${code}`
  if (!t.accounts.find((a) => a.id === id)) t.accounts.push({ id, name: `Till ${t.branches.find((b) => b.id === branchId)?.name || branchId} — ${code}`, type: 'till', cur: code, branchId })
  if (!t.accounts.find((a) => a.id === 'inc_bureau')) t.accounts.push({ id: 'inc_bureau', name: 'Bureau de change income', type: 'income', cur: 'GBP' })
  return id
}
export const stock = (t, branchId, code) => t.bureau.stock[`${branchId}:${code}`] || 0
const addStock = (t, branchId, code, qty) => { const k = `${branchId}:${code}`; t.bureau.stock[k] = +((t.bureau.stock[k] || 0) + qty).toFixed(2) }

export function stockMovement(db, tenantId, d, actor, at = now()) {
  // kind: 'buy_wholesale' (bought foreign notes from a wholesaler, paid GBP), 'sell_wholesale' (sold surplus back), 'gbp_in' / 'gbp_out' (GBP float to/from bank), 'adjust'
  const t = tenantOf(db, tenantId)
  const qty = +d.qty
  if (!(qty > 0) && d.kind !== 'adjust') fail('Enter a quantity.')
  const bank = t.accounts.find((x) => x.type === 'bank' && !x.agentId)?.id
  const gbpTill = ensureTill(t, d.branchId, 'GBP')
  if (d.kind === 'gbp_in') { addStock(t, d.branchId, 'GBP', qty); post(db, tenantId, { type: 'BDC', details: 'GBP float to till', by: actor, at, lines: [{ account: gbpTill, debit: qty }, { account: bank, credit: qty }] }) }
  else if (d.kind === 'gbp_out') { if (stock(t, d.branchId, 'GBP') < qty) fail('Not enough GBP in the till.'); addStock(t, d.branchId, 'GBP', -qty); post(db, tenantId, { type: 'BDC', details: 'GBP banked from till', by: actor, at, lines: [{ account: bank, debit: qty }, { account: gbpTill, credit: qty }] }) }
  else if (d.kind === 'buy_wholesale') {
    const cost = +d.gbpCost; if (!(cost > 0)) fail('Enter the GBP cost.')
    const till = ensureTill(t, d.branchId, d.code); addStock(t, d.branchId, d.code, qty)
    post(db, tenantId, { type: 'BDC', details: `Bought ${qty.toLocaleString('en-GB')} ${d.code} from ${d.supplier || 'wholesaler'}`, by: actor, at, lines: [{ account: till, debit: cost }, { account: bank, credit: cost }] })
  } else if (d.kind === 'sell_wholesale') {
    if (stock(t, d.branchId, d.code) < qty) fail(`Not enough ${d.code} in stock.`)
    const proceeds = +d.gbpCost; if (!(proceeds > 0)) fail('Enter the GBP received.')
    const till = ensureTill(t, d.branchId, d.code); const book = qty / CURRENCIES[d.code].rate
    addStock(t, d.branchId, d.code, -qty)
    post(db, tenantId, { type: 'BDC', details: `Sold ${qty.toLocaleString('en-GB')} ${d.code} to ${d.supplier || 'wholesaler'}`, by: actor, at, lines: [{ account: bank, debit: proceeds }, { account: till, credit: +book.toFixed(2) }, { account: 'inc_bureau', credit: +(proceeds - book).toFixed(2) }] })
  } else if (d.kind === 'adjust') {
    const counted = +d.qty, diff = +(counted - stock(t, d.branchId, d.code)).toFixed(2)
    if (!diff) return
    const till = ensureTill(t, d.branchId, d.code); const gbp = d.code === 'GBP' ? Math.abs(diff) : Math.abs(diff) / CURRENCIES[d.code].rate
    addStock(t, d.branchId, d.code, diff)
    post(db, tenantId, { type: 'BDC', details: `Till count ${d.code}: ${diff > 0 ? 'over' : 'short'} by ${Math.abs(diff)} (${d.note || 'reconciliation'})`, by: actor, at, lines: diff > 0 ? [{ account: till, debit: +gbp.toFixed(2) }, { account: 'inc_bureau', credit: +gbp.toFixed(2) }] : [{ account: 'inc_bureau', debit: +gbp.toFixed(2) }, { account: till, credit: +gbp.toFixed(2) }] })
  }
  audit(db, { tenantId, actor, action: `Bureau stock: ${d.kind.replace('_', ' ')} ${d.code || 'GBP'}`, target: '', at })
}

export function bdcQuote(t, side, code, amount, by = 'foreign') {
  const r = boardRate(t, code); if (!r) return null
  const rate = side === 'sell' ? r.sell : r.buy // sell = customer buys foreign from us
  const foreign = by === 'foreign' ? +amount : +(amount * rate).toFixed(2)
  const gbp = by === 'foreign' ? +(amount / rate).toFixed(2) : +amount
  return { side, code, rate, foreign, gbp, mid: r.mid }
}
export function createDeal(db, tenantId, d, actor, at = now()) {
  const t = tenantOf(db, tenantId)
  const q = bdcQuote(t, d.side, d.code, d.amount, d.by)
  if (!q || !(q.gbp > 0)) fail('Enter an amount.')
  const branchId = d.branchId || t.branches[0].id
  // Linked transactions: same customer within linkedHours count toward the ID threshold
  const linked = d.customerName ? db.deals.filter((x) => x.tenantId === tenantId && x.customerName?.toLowerCase() === d.customerName.toLowerCase() && at - x.at < t.bureau.linkedHours * 3600000).reduce((a, x) => a + x.gbp, 0) : 0
  const needsId = q.gbp + linked >= t.bureau.idThreshold
  if (needsId && !(d.customerName?.trim() && d.idType && d.idNumber?.trim())) fail(`Deals of £${t.bureau.idThreshold.toLocaleString('en-GB')} or more (including linked deals in ${t.bureau.linkedHours}h) need the customer's name and ID.`)
  if (q.side === 'sell' && stock(t, branchId, q.code) < q.foreign) fail(`Only ${stock(t, branchId, q.code).toLocaleString('en-GB')} ${q.code} in stock.`)
  if (q.side === 'buy' && stock(t, branchId, 'GBP') < q.gbp) fail(`Only £${stock(t, branchId, 'GBP').toLocaleString('en-GB')} in the GBP till.`)
  if (!t.bureau.shifts?.length || t.bureau.shifts.some((s) => s.branchId === branchId && !s.closedAt) || d.noShiftCheck) { /* ok: no shift tracking yet, or a shift is open */ } else fail('Open a till shift for this branch before dealing (Bureau → Shifts).')
  let screening = null
  if (d.customerName?.trim()) screening = screenName(d.customerName, t.compliance.screeningThreshold)
  if (screening?.status === 'potential_match') fail(`Name matches a watchlist entry (${screening.score}%). Refer to compliance before completing.`)
  const till = ensureTill(t, branchId, q.code), gbpTill = ensureTill(t, branchId, 'GBP')
  const book = +(q.foreign / q.mid).toFixed(2), margin = +(q.side === 'sell' ? q.gbp - book : book - q.gbp).toFixed(2)
  if (q.side === 'sell') { addStock(t, branchId, q.code, -q.foreign); addStock(t, branchId, 'GBP', q.gbp) } else { addStock(t, branchId, q.code, q.foreign); addStock(t, branchId, 'GBP', -q.gbp) }
  const deal = { id: uid('bdc'), ref: `BDC-${shortCode(6)}`, tenantId, branchId, side: q.side, code: q.code, foreign: q.foreign, gbp: q.gbp, rate: q.rate, mid: q.mid, margin, customerName: d.customerName?.trim() || '', idType: d.idType || '', idNumber: d.idNumber || '', needsId, screening, by: actor, at }
  db.deals.unshift(deal)
  post(db, tenantId, { type: 'BDC', details: `${q.side === 'sell' ? 'Sold' : 'Bought'} ${q.foreign.toLocaleString('en-GB')} ${q.code} ${q.side === 'sell' ? 'to' : 'from'} ${deal.customerName || 'walk-in'} @ ${q.rate}`, ref: deal.ref, by: actor, at,
    lines: q.side === 'sell'
      ? [{ account: gbpTill, debit: q.gbp }, { account: till, credit: book }, margin >= 0 ? { account: 'inc_bureau', credit: margin } : { account: 'inc_bureau', debit: -margin }]
      : [{ account: till, debit: book }, { account: gbpTill, credit: q.gbp }, margin >= 0 ? { account: 'inc_bureau', credit: margin } : { account: 'inc_bureau', debit: -margin }] })
  audit(db, { tenantId, actor, action: `Bureau deal ${deal.ref}: ${q.side} ${q.foreign} ${q.code} for £${q.gbp}`, target: deal.customerName, at })
  return deal
}

/* ---------------- Products (Super Admin switches a product on/off for an MSB) ---------------- */
export function setTenantProducts(db, tenantId, products, actor) {
  const t = tenantOf(db, tenantId)
  if (!products.length) fail('An MSB needs at least one product.')
  t.products = products
  const remitMods = ['transactions', 'payments', 'tracker']
  let mods = t.modules.filter((m) => products.includes('remittance') || !remitMods.includes(m))
  if (products.includes('remittance')) mods = [...new Set([...mods, ...remitMods])]
  if (products.includes('bureau')) mods = [...new Set([...mods, 'bureau'])]; else mods = mods.filter((m) => m !== 'bureau')
  t.modules = mods
  if (products.includes('bureau') && !t.bureau.currencies?.length) t.bureau.currencies = Object.keys(CURRENCIES).filter((c) => CURRENCIES[c].cash).slice(0, 5)
  audit(db, { tenantId, actor, action: `Products set to ${products.join(' + ')}`, target: '' })
}

/* ---------------- Bureau: cashier shifts ---------------- */
export function openShift(db, tenantId, d, actor, at = now()) {
  const t = tenantOf(db, tenantId)
  if (t.bureau.shifts.some((s) => s.branchId === d.branchId && !s.closedAt)) fail('A shift is already open at this branch. Close it first.')
  const counts = d.counts || {}
  for (const [code, qty] of Object.entries(counts)) if (qty !== '' && qty !== null) stockMovement(db, tenantId, { kind: 'adjust', branchId: d.branchId, code, qty: +qty, note: 'Opening count' }, actor, at)
  const s = { id: uid('shf'), branchId: d.branchId, cashier: actor, openedAt: at, closedAt: null, opening: { ...counts }, closing: null, dealsAtOpen: db.deals.filter((x) => x.tenantId === tenantId && x.branchId === d.branchId).length }
  t.bureau.shifts.unshift(s)
  audit(db, { tenantId, actor, action: 'Opened till shift', target: t.branches.find((b) => b.id === d.branchId)?.name, at })
  return s
}
export function closeShift(db, tenantId, shiftId, counts, actor, at = now()) {
  const t = tenantOf(db, tenantId)
  const s = t.bureau.shifts.find((x) => x.id === shiftId) || fail('Shift not found')
  if (s.closedAt) fail('Shift already closed.')
  const variance = {}
  for (const [code, qty] of Object.entries(counts || {})) {
    if (qty === '' || qty === null) continue
    variance[code] = +(+qty - stock(t, s.branchId, code)).toFixed(2)
    stockMovement(db, tenantId, { kind: 'adjust', branchId: s.branchId, code, qty: +qty, note: `Closing count by ${actor}` }, actor, at)
  }
  s.closedAt = at; s.closing = { ...counts }; s.variance = variance; s.closedBy = actor
  s.deals = db.deals.filter((x) => x.tenantId === tenantId && x.branchId === s.branchId && x.at >= s.openedAt && x.at <= at).length
  audit(db, { tenantId, actor, action: 'Closed till shift', target: Object.entries(variance).filter(([, v]) => v).map(([c, v]) => `${c} ${v > 0 ? '+' : ''}${v}`).join(', ') || 'no variance', at })
}

/* ---------------- Bureau: wholesaler stock orders ---------------- */
export function createStockOrder(db, tenantId, d, actor, at = now()) {
  const t = tenantOf(db, tenantId)
  if (!(+d.qty > 0)) fail('Enter a quantity.')
  if (!(+d.gbpCost > 0)) fail('Enter the agreed GBP cost.')
  const o = { id: uid('ord'), ref: `PO-${shortCode(5)}`, branchId: d.branchId, code: d.code, qty: +d.qty, gbpCost: +d.gbpCost, supplier: d.supplier || t.bureau.suppliers[0], status: 'ordered', createdAt: at, by: actor, expected: d.expected || '' }
  t.bureau.orders.unshift(o)
  audit(db, { tenantId, actor, action: `Ordered ${o.qty} ${o.code} from ${o.supplier}`, target: o.ref, at })
  return o
}
export function receiveStockOrder(db, tenantId, orderId, actor, at = now()) {
  const t = tenantOf(db, tenantId)
  const o = t.bureau.orders.find((x) => x.id === orderId) || fail('Order not found')
  if (o.status !== 'ordered') fail('This order is not outstanding.')
  stockMovement(db, tenantId, { kind: 'buy_wholesale', branchId: o.branchId, code: o.code, qty: o.qty, gbpCost: o.gbpCost, supplier: o.supplier }, actor, at)
  o.status = 'received'; o.receivedAt = at
}
export function cancelStockOrder(db, tenantId, orderId, actor) {
  const t = tenantOf(db, tenantId)
  const o = t.bureau.orders.find((x) => x.id === orderId) || fail('Order not found')
  if (o.status !== 'ordered') fail('Only outstanding orders can be cancelled.')
  o.status = 'cancelled'
  audit(db, { tenantId, actor, action: 'Cancelled stock order', target: o.ref })
}

/* ---------------- Bureau: online reservations (click & collect) ---------------- */
export function createReservation(db, tenantId, d, actor = 'Customer', at = now()) {
  const t = tenantOf(db, tenantId)
  const c = d.customerId ? db.customers.find((x) => x.id === d.customerId) : null
  if (c && c.status === 'frozen') fail('This account is under review. Please contact us.')
  const q = bdcQuote(t, d.side || 'sell', d.code, d.amount, d.by || 'foreign')
  if (!q || !(q.gbp > 0)) fail('Enter an amount.')
  const branchId = d.branchId || t.branches[0].id
  if (q.side === 'sell' && stock(t, branchId, q.code) < q.foreign) fail(`We don't have ${q.foreign.toLocaleString('en-GB')} ${q.code} available at that branch right now. Try a smaller amount or another branch.`)
  if (q.gbp >= t.bureau.idThreshold && !c) fail('Please sign in so we can verify your identity for an order this size.')
  const r = { id: uid('rsv'), ref: `RSV-${shortCode(6)}`, tenantId, branchId, customerId: c?.id || null, customerName: c?.name || d.customerName || '', side: q.side, code: q.code, foreign: q.foreign, gbp: q.gbp, rate: q.rate, status: 'reserved', createdAt: at, expiresAt: at + (t.bureau.reservationHours || 24) * 3600000, dealId: null }
  db.reservations.unshift(r)
  audit(db, { tenantId, actor, action: `Reserved ${q.foreign} ${q.code} for collection`, target: r.ref, at })
  return r
}
export function fulfilReservation(db, tenantId, rsvId, d, actor, at = now()) {
  const r = db.reservations.find((x) => x.id === rsvId) || fail('Reservation not found')
  if (r.status !== 'reserved') fail('This reservation is not open.')
  if (at > r.expiresAt) { r.status = 'expired'; fail('This reservation has expired. Create a new deal at today\'s rate.') }
  const t = tenantOf(db, tenantId)
  const c = r.customerId && db.customers.find((x) => x.id === r.customerId)
  const idDoc = c?.kyc.docs.find((x) => x.status === 'verified')
  // Honour the reserved rate: temporarily place it on the board for this deal
  const prev = t.bureau.board[r.code]
  const b = boardRate(t, r.code)
  t.bureau.board[r.code] = { buy: r.side === 'buy' ? r.rate : b.buy, sell: r.side === 'sell' ? r.rate : b.sell }
  let deal
  try { deal = createDeal(db, tenantId, { side: r.side, code: r.code, amount: r.foreign, by: 'foreign', branchId: r.branchId, customerName: r.customerName, idType: d.idType || idDoc?.type || '', idNumber: d.idNumber || (idDoc ? 'verified in app' : '') }, actor, at) }
  finally { if (prev) t.bureau.board[r.code] = prev; else delete t.bureau.board[r.code] }
  r.status = 'collected'; r.dealId = deal.id; r.collectedAt = at
  return deal
}
export function cancelReservation(db, rsvId, actor) {
  const r = db.reservations.find((x) => x.id === rsvId) || fail('Reservation not found')
  if (r.status !== 'reserved') fail('This reservation is not open.')
  r.status = 'cancelled'
  audit(db, { tenantId: r.tenantId, actor, action: 'Cancelled reservation', target: r.ref })
}
export function expireReservations(db) {
  for (const r of db.reservations) if (r.status === 'reserved' && Date.now() > r.expiresAt) r.status = 'expired'
}
export function setSuppliers(db, tenantId, list, actor) {
  const t = tenantOf(db, tenantId)
  t.bureau.suppliers = list.map((x) => x.trim()).filter(Boolean)
  audit(db, { tenantId, actor, action: 'Updated wholesalers', target: '' })
}
