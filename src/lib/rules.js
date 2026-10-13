// Transaction monitoring rules engine.
// Each rule = { id, type, name, enabled, action: 'flag'|'hold'|'block', severity: 'low'|'medium'|'high', params }
// flag  → creates an alert but the transfer can still auto-release
// hold  → transfer stops until a compliance user releases it
// block → transfer stops; release needs MLRO / Admin sign-off
import { DAY, ageFrom, uid } from './util'

export const RULE_TYPES = {
  amount_over: { label: 'Single transfer above amount', params: [{ k: 'amount', label: 'Amount (£)', type: 'number' }], describe: (p) => `Transfer over £${p.amount}` },
  first_txn_over: { label: 'First transfer above amount', params: [{ k: 'amount', label: 'Amount (£)', type: 'number' }], describe: (p) => `Customer's first transfer over £${p.amount}` },
  velocity_count: { label: 'Too many transfers in a period', params: [{ k: 'count', label: 'Transfers', type: 'number' }, { k: 'days', label: 'Days', type: 'number' }], describe: (p) => `${p.count}+ transfers in ${p.days} days` },
  cumulative_over: { label: 'Total sent in a period above amount', params: [{ k: 'amount', label: 'Amount (£)', type: 'number' }, { k: 'days', label: 'Days', type: 'number' }], describe: (p) => `More than £${p.amount} in ${p.days} days` },
  structuring: { label: 'Possible structuring (several just below a threshold)', params: [{ k: 'threshold', label: 'Threshold (£)', type: 'number' }, { k: 'count', label: 'Transfers', type: 'number' }, { k: 'days', label: 'Days', type: 'number' }], describe: (p) => `${p.count}+ transfers within 15% below £${p.threshold} in ${p.days} days` },
  many_senders: { label: 'Recipient receiving from many senders', params: [{ k: 'count', label: 'Different senders', type: 'number' }, { k: 'days', label: 'Days', type: 'number' }], describe: (p) => `Recipient paid by ${p.count}+ different senders in ${p.days} days` },
  corridor: { label: 'High-risk destination', params: [{ k: 'currencies', label: 'Currencies (comma separated)', type: 'list' }], describe: (p) => `Sending to ${(p.currencies || []).join(', ') || '—'}` },
  customer_risk: { label: 'Customer risk rating', params: [{ k: 'levels', label: 'Risk levels (comma separated)', type: 'list' }], describe: (p) => `Customer rated ${(p.levels || []).join(' / ')}` },
  kyc_incomplete: { label: 'KYC not verified', params: [], describe: () => 'Customer identity not verified' },
  pep: { label: 'Politically exposed person', params: [], describe: () => 'Customer is a PEP' },
  sanctions: { label: 'Sanctions screening match', params: [], describe: () => 'Sender or recipient has an unresolved screening match' },
  sof_missing: { label: 'Source of funds missing above amount', params: [{ k: 'amount', label: 'Amount (£)', type: 'number' }], describe: (p) => `No source of funds given for transfer over £${p.amount}` },
  young_sender: { label: 'Young sender, large amount', params: [{ k: 'age', label: 'Under age', type: 'number' }, { k: 'amount', label: 'Amount (£)', type: 'number' }], describe: (p) => `Sender under ${p.age} sending over £${p.amount}` },
}

const r = (type, name, action, severity, params = {}) => ({ id: uid('rule'), type, name, enabled: true, action, severity, params })
export function defaultRules(edd = 5000, sof = 2000) {
  return [
    r('sanctions', 'Unresolved sanctions match', 'block', 'high'),
    r('pep', 'PEP — enhanced due diligence', 'hold', 'high'),
    r('kyc_incomplete', 'Identity not verified', 'hold', 'medium'),
    r('amount_over', 'Large transfer — EDD', 'hold', 'medium', { amount: edd }),
    r('first_txn_over', 'Large first transfer', 'hold', 'medium', { amount: 2000 }),
    r('sof_missing', 'Source of funds required', 'hold', 'medium', { amount: sof }),
    r('cumulative_over', '30-day total over limit', 'hold', 'medium', { amount: 15000, days: 30 }),
    r('velocity_count', 'High frequency', 'flag', 'low', { count: 5, days: 7 }),
    r('structuring', 'Possible structuring', 'hold', 'high', { threshold: 1000, count: 3, days: 3 }),
    r('many_senders', 'Recipient used by many senders', 'flag', 'medium', { count: 3, days: 30 }),
    r('customer_risk', 'High-risk customer', 'flag', 'medium', { levels: ['High'] }),
    r('young_sender', 'Young sender, large amount', 'flag', 'low', { age: 21, amount: 1500 }),
  ]
}

export function evaluate(db, tx) {
  const tenant = db.tenants.find((t) => t.id === tx.tenantId)
  const cust = db.customers.find((c) => c.id === tx.customerId)
  const rec = db.recipients.find((x) => x.id === tx.recipientId)
  const live = (t) => !['cancelled', 'rejected', 'refunded'].includes(t.status) && t.id !== tx.id && t.createdAt <= tx.createdAt
  const history = db.transactions.filter((t) => t.customerId === tx.customerId && live(t))
  const within = (days) => history.filter((t) => tx.createdAt - t.createdAt <= days * DAY)
  const amt = tx.sendAmount
  const hits = []
  for (const rule of tenant.rules) {
    if (!rule.enabled) continue
    const p = rule.params || {}
    let detail = null
    switch (rule.type) {
      case 'amount_over': if (amt > p.amount) detail = `£${amt} is above £${p.amount}`; break
      case 'first_txn_over': if (!history.length && amt > p.amount) detail = `First transfer of £${amt}`; break
      case 'velocity_count': { const n = within(p.days).length + 1; if (n >= p.count) detail = `${n} transfers in ${p.days} days`; break }
      case 'cumulative_over': { const s = within(p.days).reduce((a, t) => a + t.sendAmount, 0) + amt; if (s > p.amount) detail = `£${Math.round(s)} sent in ${p.days} days`; break }
      case 'structuring': {
        const near = (t) => t.sendAmount >= p.threshold * 0.85 && t.sendAmount < p.threshold
        const n = within(p.days).filter(near).length + (near(tx) ? 1 : 0)
        if (near(tx) && n >= p.count) detail = `${n} transfers just below £${p.threshold} in ${p.days} days`
        break
      }
      case 'many_senders': {
        if (!rec) break
        const senders = new Set(db.transactions.filter((t) => t.tenantId === tx.tenantId && live(t) && tx.createdAt - t.createdAt <= p.days * DAY && db.recipients.find((x) => x.id === t.recipientId)?.account === rec.account).map((t) => t.customerId))
        senders.add(tx.customerId)
        if (senders.size >= p.count) detail = `${senders.size} different senders paid this account`
        break
      }
      case 'corridor': if ((p.currencies || []).includes(tx.cur)) detail = `Destination ${tx.cur}`; break
      case 'customer_risk': if ((p.levels || []).includes(riskLevel(cust))) detail = `Customer risk: ${riskLevel(cust)}`; break
      case 'kyc_incomplete': if (cust.kyc.status !== 'verified') detail = `KYC status: ${cust.kyc.status.replace('_', ' ')}`; break
      case 'pep': if (cust.pep) detail = 'Customer is a politically exposed person'; break
      case 'sanctions': {
        const bad = (s) => s && s.status === 'potential_match'
        const conf = (s) => s && s.status === 'confirmed_match'
        if (conf(cust.screening) || conf(rec?.screening)) detail = 'Confirmed sanctions match'
        else if (bad(cust.screening)) detail = `Sender ${cust.screening.score}% match to ${cust.screening.match.match}`
        else if (bad(rec?.screening)) detail = `Recipient ${rec.screening.score}% match to ${rec.screening.match.match}`
        break
      }
      case 'sof_missing': if (amt > p.amount && !tx.sof) detail = `No source of funds for £${amt}`; break
      case 'young_sender': { const a = ageFrom(cust.dob); if (a !== null && a < p.age && amt > p.amount) detail = `Sender aged ${a}, £${amt}`; break }
    }
    if (detail) hits.push({ ruleId: rule.id, name: rule.name, action: rule.action, severity: rule.severity, detail })
  }
  return hits
}

export function decide(hits) {
  if (hits.some((h) => h.action === 'block')) return 'block'
  if (hits.some((h) => h.action === 'hold')) return 'hold'
  if (hits.length) return 'flag'
  return 'clear'
}
export const topSeverity = (hits) => (hits.some((h) => h.severity === 'high') ? 'high' : hits.some((h) => h.severity === 'medium') ? 'medium' : 'low')

export function riskLevel(c) {
  if (!c) return 'Low'
  return c.risk?.override || c.risk?.level || 'Low'
}
