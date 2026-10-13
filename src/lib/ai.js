// Client for the built-in AI assistant. Calls the Netlify function, which holds the Anthropic API key.
// When the key isn't set (or running locally without functions), we fall back to rule-based answers.
import { TX_STATUS, CURRENCIES, partnerById } from './reference'
import { RULE_TYPES, riskLevel } from './rules'
import { gbp, gbp2, fmtDate, ageFrom } from './util'

export class AiOffline extends Error {}

export async function askAi(task, messages, context) {
  let res
  try {
    res = await fetch('/.netlify/functions/ai', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ task, messages, context }) })
  } catch (e) { throw new AiOffline('AI is not reachable.') }
  if (res.status === 503 || res.status === 404) throw new AiOffline('AI is switched off. Add ANTHROPIC_API_KEY in Netlify to turn it on.')
  const j = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(j.error || 'The AI service returned an error.')
  return j.text
}

/* ---------- Context builders (keep them small: no more than the AI needs) ---------- */
export function tenantContext(db, t) {
  const tx = db.transactions.filter((x) => x.tenantId === t.id)
  const open = db.cases.filter((k) => k.tenantId === t.id && k.status !== 'closed')
  return {
    msb: { name: t.name, corridors: t.corridors.filter((c) => c.enabled).map((c) => c.cur), mlro: t.compliance.mlro, thresholds: { edd: t.compliance.eddThreshold, sourceOfFunds: t.compliance.sofThreshold, dailyLimit: t.compliance.dailyLimit }, autoRelease: t.compliance.autoRelease },
    counts: Object.fromEntries(Object.keys(TX_STATUS).map((s) => [s, tx.filter((x) => x.status === s).length])),
    volume30d: Math.round(tx.filter((x) => Date.now() - x.createdAt < 30 * 864e5 && x.status === 'paid').reduce((a, x) => a + x.sendAmount, 0)),
    openCases: open.slice(0, 15).map((k) => ({ ref: k.ref, title: k.title, severity: k.severity, status: k.status, customer: db.customers.find((c) => c.id === k.customerId)?.name, ageHours: Math.round((Date.now() - k.createdAt) / 36e5) })),
    highRiskCustomers: db.customers.filter((c) => c.tenantId === t.id && riskLevel(c) === 'High').map((c) => ({ name: c.name, factors: c.risk.factors })),
    rules: t.rules.map((r) => ({ name: r.name, type: r.type, action: r.action, enabled: r.enabled, params: r.params })),
  }
}

export function caseContext(db, k) {
  const c = db.customers.find((x) => x.id === k.customerId)
  const tx = k.txnId && db.transactions.find((x) => x.id === k.txnId)
  const rec = db.recipients.find((x) => x.id === (tx?.recipientId || k.recipientId))
  const hist = db.transactions.filter((x) => x.customerId === c.id).slice(0, 20)
  return {
    case: { ref: k.ref, title: k.title, severity: k.severity, blocking: k.blocking, hits: k.hits, notes: k.notes },
    customer: { name: c.name, age: ageFrom(c.dob), occupation: c.occupation, since: fmtDate(c.createdAt, false), kyc: c.kyc.status, risk: riskLevel(c), riskFactors: c.risk.factors, pep: c.pep, screening: c.screening },
    transfer: tx && { ref: tx.ref, amount: tx.sendAmount, currency: tx.cur, purpose: tx.purpose, sourceOfFunds: tx.sof, channel: tx.channel },
    recipient: rec && { name: rec.name, country: CURRENCIES[rec.cur]?.country, relationship: rec.relationship, screening: rec.screening },
    history: hist.map((x) => ({ date: fmtDate(x.createdAt), amount: x.sendAmount, cur: x.cur, status: x.status, recipient: db.recipients.find((r) => r.id === x.recipientId)?.name })),
  }
}

/* ---------- Offline fallbacks ---------- */
export function fallbackCaseReview(ctx) {
  const { case: k, customer: c, transfer: tx, recipient: r, history } = ctx
  const total = history.filter((h) => !['cancelled', 'rejected', 'refunded'].includes(h.status)).reduce((a, h) => a + h.amount, 0)
  const recips = new Set(history.map((h) => h.recipient)).size
  const lines = [
    `Automatic summary (AI is off — this is generated from the case data).`,
    ``,
    `**What fired:** ${k.hits.map((h) => `${h.name} (${h.detail})`).join('; ')}.`,
    `**Customer:** ${c.name}, ${c.age ?? '?'} y/o ${c.occupation || ''}, customer since ${c.since}. KYC ${c.kyc}, ${c.risk} risk${c.pep ? ', PEP' : ''}.`,
    tx ? `**Transfer:** ${gbp2(tx.amount)} to ${r?.name} in ${r?.country} (${r?.relationship}). Purpose: ${tx.purpose || 'not given'}. Source of funds: ${tx.sourceOfFunds || 'not given'}.` : '',
    `**History:** ${history.length} transfers totalling ${gbp(total)} to ${recips} recipient${recips === 1 ? '' : 's'}.`,
    ``,
    `**Suggested next steps:**`,
    ...(tx && !tx.sourceOfFunds ? ['- Ask the customer for source of funds evidence (payslips or bank statements).'] : []),
    ...(k.hits.some((h) => /structur/i.test(h.name)) ? ['- Compare amounts against the threshold; ask why the payments were split.'] : []),
    ...(k.hits.some((h) => /sanction|screen/i.test(h.name)) ? ['- Compare date of birth and nationality with the list entry before deciding. Do not release on name alone.'] : []),
    ...(c.pep ? ['- PEP: confirm source of wealth and get MLRO approval for the relationship.'] : []),
    '- Record your rationale in a note before releasing or rejecting.',
    '- If you suspect money laundering, raise an internal SAR. Do not tell the customer (tipping off).',
  ]
  return lines.filter((l) => l !== null).join('\n')
}

export function fallbackChat(question, ctx) {
  const q = question.toLowerCase()
  if (/queue|case|alert|today|summar/.test(q)) {
    if (!ctx.openCases.length) return 'There are no open compliance cases.'
    return `There are ${ctx.openCases.length} open cases:\n` + ctx.openCases.map((k) => `- ${k.ref} · ${k.title} · ${k.customer} · ${k.severity} · ${k.ageHours}h old`).join('\n') + `\n\nTransfers on hold: ${ctx.counts.on_hold}. Ready to release: ${ctx.counts.pending_release}. Awaiting funds: ${ctx.counts.awaiting_funds}.`
  }
  if (/edd|high.?risk|risk/.test(q)) {
    if (!ctx.highRiskCustomers.length) return 'No customers are currently rated high risk.'
    return 'Customers rated high risk (EDD needed):\n' + ctx.highRiskCustomers.map((c) => `- ${c.name}: ${c.factors.join(', ')}`).join('\n')
  }
  if (/rule/.test(q)) return 'Active rules:\n' + ctx.rules.filter((r) => r.enabled).map((r) => `- ${r.name} → ${r.action}`).join('\n')
  return 'AI is switched off, so I can only answer a few built-in questions: today\'s queue, high-risk customers, and active rules. Add ANTHROPIC_API_KEY in Netlify to turn on the full assistant.'
}

// Very small natural-language → rule parser used when AI is off
export function fallbackRule(text) {
  const t = text.toLowerCase()
  const n = (re) => { const m = t.match(re); return m ? +m[1].replace(/,/g, '') : null }
  const amount = n(/£\s?([\d,]+)/) || n(/([\d,]{3,})\s?(?:pounds|gbp)/)
  const days = n(/(\d+)\s?days?/) || (/week/.test(t) ? 7 : /month/.test(t) ? 30 : null)
  const count = n(/(\d+)\s?(?:transfers|transactions|payments|times)/)
  const action = /block|stop/.test(t) ? 'block' : /flag|alert|notify/.test(t) ? 'flag' : 'hold'
  const cur = Object.keys(CURRENCIES).filter((c) => t.includes(c.toLowerCase()) || t.includes(CURRENCIES[c].country.toLowerCase()))
  let type, params
  if (count && days) { type = 'velocity_count'; params = { count, days } }
  else if (amount && days) { type = 'cumulative_over'; params = { amount, days } }
  else if (/first/.test(t) && amount) { type = 'first_txn_over'; params = { amount } }
  else if (cur.length) { type = 'corridor'; params = { currencies: cur } }
  else if (amount) { type = 'amount_over'; params = { amount } }
  else return null
  return { type, name: RULE_TYPES[type].describe(params), action, severity: action === 'block' ? 'high' : action === 'hold' ? 'medium' : 'low', params }
}
