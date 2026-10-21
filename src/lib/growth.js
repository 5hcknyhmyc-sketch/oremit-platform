// Growth & service features: promo codes, rate alerts, recipient name check, scheduled transfers,
// support tickets, document expiry. All tenant-scoped; the Super Admin sees none of it directly.
import { CURRENCIES } from './reference'
import { audit, quote, createTransaction } from './engine'
import { uid, now, DAY } from './util'

const fail = (m) => { throw new Error(m) }
const tenantOf = (db, id) => db.tenants.find((t) => t.id === id) || fail('MSB not found')
export const ensure = (db) => { db.rateAlerts ||= []; db.schedules ||= []; db.tickets ||= []; db.notifications ||= [] }

/* ---------- Promo codes ---------- */
// type: 'free_fee' | 'pct_off' (value = % off the fee) | 'fixed_off' (value = £ off the fee) | 'bonus_rate' (value = extra % on the rate)
export function addPromo(db, tenantId, d, actor, at = now()) {
  const t = tenantOf(db, tenantId); t.promos ||= []
  const code = (d.code || '').trim().toUpperCase()
  if (!/^[A-Z0-9]{3,16}$/.test(code)) fail('Code must be 3–16 letters or numbers.')
  if (t.promos.some((p) => p.code === code)) fail(`${code} already exists.`)
  const p = { id: uid('pro'), code, type: d.type || 'free_fee', value: +d.value || 0, firstOnly: !!d.firstOnly, minAmount: +d.minAmount || 0, maxUses: +d.maxUses || 0, uses: 0, expiresAt: d.expiresAt ? new Date(d.expiresAt).getTime() : null, active: true, createdAt: at }
  t.promos.unshift(p)
  audit(db, { tenantId, actor, action: 'Created promo code', target: code, at })
  return p
}
export function setPromoActive(db, tenantId, id, active, actor) {
  const t = tenantOf(db, tenantId); const p = (t.promos || []).find((x) => x.id === id) || fail('Promo not found')
  p.active = active; audit(db, { tenantId, actor, action: `${active ? 'Enabled' : 'Paused'} promo code`, target: p.code })
}
export function findPromo(db, t, code, customerId, sendAmount, at = now()) {
  const c = (code || '').trim().toUpperCase(); if (!c) return null
  const p = (t.promos || []).find((x) => x.code === c)
  if (!p || !p.active) fail('That code is not valid.')
  if (p.expiresAt && p.expiresAt < at) fail('That code has expired.')
  if (p.maxUses && p.uses >= p.maxUses) fail('That code has been fully used.')
  if (p.minAmount && sendAmount < p.minAmount) fail(`That code needs a transfer of £${p.minAmount} or more.`)
  if (p.firstOnly && db.transactions.some((x) => x.customerId === customerId && !['cancelled', 'rejected', 'refunded'].includes(x.status))) fail('That code is for your first transfer only.')
  return p
}
export const describePromo = (p) => ({ free_fee: 'No fee', pct_off: `${p.value}% off the fee`, fixed_off: `£${p.value} off the fee`, bonus_rate: `+${p.value}% better rate` })[p.type] + (p.firstOnly ? ' · first transfer' : '') + (p.minAmount ? ` · from £${p.minAmount}` : '')

// Quote with a promo applied. Throws if the code is invalid so the app can show why.
export function quoteWithPromo(db, t, cur, sendAmount, code, customerId) {
  const q = quote(db, t, cur, sendAmount); if (!q) return null
  const p = findPromo(db, t, code, customerId, q.sendAmount)
  if (!p) return q
  let fee = q.fee, rate = q.rate
  if (p.type === 'free_fee') fee = 0
  if (p.type === 'pct_off') fee = +(fee * (1 - p.value / 100)).toFixed(2)
  if (p.type === 'fixed_off') fee = Math.max(0, +(fee - p.value).toFixed(2))
  if (p.type === 'bonus_rate') rate = +(rate * (1 + p.value / 100)).toFixed(4)
  return { ...q, fee, rate, total: +(q.sendAmount + fee).toFixed(2), receiveAmount: +(q.sendAmount * rate).toFixed(2), promo: { code: p.code, id: p.id, saved: +(q.fee - fee).toFixed(2), desc: describePromo(p) } }
}
export function createTransactionWithPromo(db, d, actor = 'Customer', at = now()) {
  const t = tenantOf(db, d.tenantId)
  const r = db.recipients.find((x) => x.id === d.recipientId) || fail('Choose a recipient.')
  const q = quoteWithPromo(db, t, r.cur, d.sendAmount, d.promo, d.customerId)
  const tx = createTransaction(db, d, actor, at)
  if (q?.promo) {
    tx.fee = q.fee; tx.rate = q.rate; tx.total = q.total; tx.receiveAmount = q.receiveAmount; tx.promo = q.promo
    const p = t.promos.find((x) => x.id === q.promo.id); if (p) p.uses += 1
    tx.history[0].note += ` · promo ${q.promo.code}`
  }
  if (d.scheduleId) tx.scheduleId = d.scheduleId
  return tx
}

/* ---------- Rate alerts ---------- */
export function addRateAlert(db, tenantId, customerId, cur, target, at = now()) {
  ensure(db)
  if (!(+target > 0)) fail('Enter the rate you want to be told about.')
  const a = { id: uid('ra'), tenantId, customerId, cur, target: +target, createdAt: at, triggeredAt: null }
  db.rateAlerts.unshift(a); return a
}
export function removeRateAlert(db, id) { ensure(db); db.rateAlerts = db.rateAlerts.filter((a) => a.id !== id) }
export function customerRate(t, cur) { const cor = t.corridors.find((c) => c.cur === cur && c.enabled); return cor ? +(CURRENCIES[cur].rate * (1 - cor.margin / 100)).toFixed(4) : null }
export function checkRateAlerts(db, at = now()) {
  ensure(db); let n = 0
  db.rateAlerts.filter((a) => !a.triggeredAt).forEach((a) => {
    const t = db.tenants.find((x) => x.id === a.tenantId); const r = t && customerRate(t, a.cur)
    if (r && r >= a.target) { a.triggeredAt = at; notify(db, a.tenantId, a.customerId, `Rate alert: 1 GBP = ${r} ${a.cur}`, `The ${a.cur} rate reached your target of ${a.target}. Send now to lock it in.`, at); n++ }
  })
  return n
}
export function notify(db, tenantId, customerId, title, body, at = now()) { ensure(db); db.notifications.unshift({ id: uid('ntf'), tenantId, customerId, title, body, at, read: false }) }

/* ---------- Recipient name check (Confirmation of Payee-style) ---------- */
// Demo stand-in for the partner's account-name lookup. In production the PayoutProvider.validateBeneficiary() call answers this.
const DEMO_HOLDERS = ['AYESHA KHAN', 'RAFIQ HOSSAIN', 'RAVI PATEL', 'BILAL AHMED', 'AMINA YUSUF']
export function checkRecipientName(db, recipientId, at = now()) {
  const r = db.recipients.find((x) => x.id === recipientId) || fail('Recipient not found')
  const digits = String(r.account).replace(/\D/g, '')
  const last = +digits.slice(-1)
  const nm = r.name.trim().toUpperCase()
  let status, accountName
  if (r.method !== 'Bank' && r.method !== 'Mobile wallet') { status = 'not_supported'; accountName = null }
  else if (last % 3 === 0) { status = 'match'; accountName = nm }
  else if (last % 3 === 1) { const parts = nm.split(' '); accountName = parts.length > 1 ? `${parts[0][0]} ${parts.slice(1).join(' ')}` : nm; status = 'close' }
  else { status = 'no_match'; accountName = DEMO_HOLDERS[last % DEMO_HOLDERS.length] === nm ? 'M AKHTAR' : DEMO_HOLDERS[last % DEMO_HOLDERS.length] }
  r.nameCheck = { status, accountName, at }
  return r.nameCheck
}
export const NAME_CHECK = { match: { tone: 'good', label: 'Name matches account' }, close: { tone: 'warn', label: 'Close match — check spelling' }, no_match: { tone: 'crit', label: 'Name does not match account' }, not_supported: { tone: 'mute', label: 'Name check not available' } }

/* ---------- Scheduled & recurring transfers ---------- */
export const FREQ = { once: 'One time', weekly: 'Every week', fortnightly: 'Every 2 weeks', monthly: 'Every month' }
export function createSchedule(db, d, actor = 'Customer', at = now()) {
  ensure(db)
  const r = db.recipients.find((x) => x.id === d.recipientId) || fail('Choose a recipient.')
  const t = tenantOf(db, d.tenantId)
  if (!quote(db, t, r.cur, d.sendAmount)) fail('That corridor is not available.')
  const first = d.firstAt ? new Date(d.firstAt).getTime() : at + DAY
  if (first < at - 60000) fail('Pick a date in the future.')
  const s = { id: uid('sch'), tenantId: d.tenantId, customerId: d.customerId, recipientId: r.id, sendAmount: +d.sendAmount, purpose: d.purpose || 'Family support', sof: d.sof || '', frequency: d.frequency || 'monthly', nextAt: first, lastRunAt: null, runs: 0, status: 'active', createdAt: at, promo: d.promo || '' }
  db.schedules.unshift(s)
  audit(db, { tenantId: d.tenantId, actor, action: `Scheduled ${FREQ[s.frequency].toLowerCase()} transfer £${s.sendAmount}`, target: r.name, at })
  return s
}
export function cancelSchedule(db, id, actor = 'Customer') { ensure(db); const s = db.schedules.find((x) => x.id === id) || fail('Not found'); s.status = 'cancelled'; audit(db, { tenantId: s.tenantId, actor, action: 'Cancelled scheduled transfer', target: s.id }) }
const advance = (ts, f) => f === 'weekly' ? ts + 7 * DAY : f === 'fortnightly' ? ts + 14 * DAY : f === 'monthly' ? (() => { const d = new Date(ts); d.setMonth(d.getMonth() + 1); return d.getTime() })() : null
// Creates the transfer for every schedule that is due. The customer still pays each one (open banking mandate later).
export function runSchedules(db, at = now(), force = null) {
  ensure(db); const made = []
  db.schedules.filter((s) => s.status === 'active' && (s.nextAt <= at || s.id === force)).forEach((s) => {
    try {
      const tx = createTransactionWithPromo(db, { tenantId: s.tenantId, customerId: s.customerId, recipientId: s.recipientId, sendAmount: s.sendAmount, purpose: s.purpose, sof: s.sof, channel: 'Scheduled', fraudConfirm: true, promo: s.promo, scheduleId: s.id }, 'Scheduler', at)
      s.runs += 1; s.lastRunAt = at; s.lastTxId = tx.id
      notify(db, s.tenantId, s.customerId, 'Scheduled transfer ready to pay', `Your ${FREQ[s.frequency].toLowerCase()} transfer of £${s.sendAmount} is created (${tx.ref}). Pay by bank transfer to send it.`, at)
      made.push(tx)
    } catch (e) { s.lastError = e.message; notify(db, s.tenantId, s.customerId, 'Scheduled transfer needs attention', e.message, at) }
    const nx = advance(s.nextAt, s.frequency)
    if (nx) s.nextAt = Math.max(nx, at + 60000); else s.status = 'done'
  })
  return made
}

/* ---------- Support tickets ---------- */
export function openTicket(db, d, actor = 'Customer', at = now()) {
  ensure(db)
  if (!d.subject?.trim()) fail('Tell us what it is about.')
  const tk = { id: uid('tkt'), ref: `HELP-${String(db.tickets.length + 1).padStart(4, '0')}`, tenantId: d.tenantId, customerId: d.customerId, txId: d.txId || null, subject: d.subject.trim(), status: 'open', assignee: null, createdAt: at, updatedAt: at, messages: [{ by: actor, staff: actor !== 'Customer', text: d.text || d.subject, at }] }
  db.tickets.unshift(tk)
  audit(db, { tenantId: d.tenantId, actor, action: 'Opened support ticket', target: tk.ref, at })
  return tk
}
export function replyTicket(db, id, text, actor, staff, at = now()) {
  ensure(db); const tk = db.tickets.find((x) => x.id === id) || fail('Ticket not found')
  if (!text?.trim()) fail('Write a message.')
  tk.messages.push({ by: actor, staff, text: text.trim(), at }); tk.updatedAt = at
  if (staff) { tk.status = 'answered'; notify(db, tk.tenantId, tk.customerId, `Reply on ${tk.ref}`, text.trim().slice(0, 120), at) } else tk.status = 'open'
  return tk
}
export function closeTicket(db, id, actor, at = now()) { ensure(db); const tk = db.tickets.find((x) => x.id === id) || fail('Ticket not found'); tk.status = 'closed'; tk.updatedAt = at; audit(db, { tenantId: tk.tenantId, actor, action: 'Closed ticket', target: tk.ref, at }) }

/* ---------- Document expiry ---------- */
export function expiringDocs(db, tenantId, withinDays = 60, at = now()) {
  const out = []
  db.customers.filter((c) => c.tenantId === tenantId).forEach((c) => c.kyc.docs.forEach((d) => {
    if (!d.expiry) return
    const days = Math.floor((new Date(d.expiry).getTime() - at) / DAY)
    if (days <= withinDays) out.push({ customer: c, doc: d, days })
  }))
  return out.sort((a, b) => a.days - b.days)
}
export function customerExpiry(c, at = now()) { return (c.kyc?.docs || []).filter((d) => d.expiry).map((d) => ({ doc: d, days: Math.floor((new Date(d.expiry).getTime() - at) / DAY) })).sort((a, b) => a.days - b.days)[0] || null }
