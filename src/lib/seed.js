// Builds a realistic demo database by running the real engine operations with past timestamps.
import * as E from './engine'
import { withSeed, pick, between, DAY, now, uid } from './util'
import { PURPOSES, SOURCES_OF_FUNDS, OCCUPATIONS } from './reference'

const FIRST = ['Bilal', 'Chiamaka', 'Priya', 'Rafiq', 'Maria', 'Kwame', 'Ayesha', 'Tunde', 'Sanjay', 'Grace', 'Imran', 'Fatima', 'Usman', 'Ngozi', 'Arjun', 'Shirin', 'Kofi', 'Rosa', 'Hamza', 'Joy', 'Tariq', 'Mehwish', 'Emeka', 'Divya']
const LAST = ['Ahmed', 'Okafor', 'Nair', 'Hossain', 'Santos', 'Mensah', 'Khan', 'Bakare', 'Patel', 'Wanjiru', 'Qureshi', 'Begum', 'Malik', 'Eze', 'Sharma', 'Rahman', 'Asante', 'Reyes', 'Butt', 'Adeyemi', 'Mirza', 'Chaudhry', 'Obi', 'Iyer']
const RFIRST = ['Shazia', 'Ali', 'Kemi', 'Ravi', 'Nasreen', 'Juan', 'Ama', 'Bilqis', 'Lakshmi', 'Wanjiku', 'Zainab', 'Ruhul', 'Chidi', 'Anita']
const POSTCODES = ['E6 2LT', 'IG11 7QJ', 'RM9 4XS', 'E7 9HQ', 'B11 1RE', 'M13 0PR', 'LU1 3HZ', 'BD8 7QP', 'E12 5AD', 'SE15 4ST']
const BANKS = { PKR: ['HBL', 'Meezan Bank', 'UBL'], INR: ['SBI', 'HDFC Bank', 'ICICI Bank'], BDT: ['Sonali Bank', 'BRAC Bank', 'Dutch-Bangla Bank'], NGN: ['GTBank', 'Access Bank', 'Zenith Bank'], GHS: ['GCB Bank', 'Ecobank Ghana'], KES: ['M-Pesa', 'Equity Bank'], PHP: ['BDO', 'GCash'], EUR: ['Deutsche Bank', 'BNP Paribas'] }

function dob(minAge, maxAge) {
  const d = new Date(now() - between(minAge, maxAge) * 365.25 * DAY)
  return d.toISOString().slice(0, 10)
}

function seedTenant(db, t, nCustomers, nTx, specials) {
  const actorCo = t.staff.find((s) => s.role === 'Compliance officer')?.name || 'Compliance'
  const start = now() - 32 * DAY
  const customers = []
  const curs = t.corridors.map((c) => c.cur)
  const sharedAccount = 'SHARED' + Math.floor(between(100000, 999999))
  const mk = (name, extra = {}) => {
    const at = start + between(0, 6) * DAY
    const c = E.createCustomer(db, t.id, { name, email: name.toLowerCase().replace(/[^a-z]+/g, '.') + '@example.com', phone: '07' + Math.floor(between(100000000, 999999999)), dob: dob(23, 62), address: `${Math.floor(between(2, 180))} ${pick(['Ripple Rd', 'Longbridge Rd', 'High St North', 'Green St', 'Romford Rd', 'Upney Ln'])}`, postcode: pick(POSTCODES), occupation: pick(OCCUPATIONS), ...extra }, 'Customer', at)
    customers.push(c)
    const kycOk = extra._kyc !== false
    E.addDocument(db, c.id, pick(['Passport', 'UK driving licence']), 'Customer', at + 600000)
    if (kycOk) E.reviewDocument(db, c.id, c.kyc.docs[0].id, true, 'Auto-verification', at + 900000)
    const nRec = extra._recipients || 1 + Math.floor(between(0, 2))
    for (let i = 0; i < nRec; i++) {
      const cur = extra._cur || pick(curs)
      E.addRecipient(db, c.id, { name: `${pick(RFIRST)} ${name.split(' ').pop()}`, cur, method: 'Bank', bank: pick(BANKS[cur] || ['Bank']), account: extra._shared ? sharedAccount : String(Math.floor(between(1e9, 9e9))), relationship: pick(['Parent', 'Sibling', 'Spouse', 'Child', 'Cousin']) }, 'Customer', at + 1200000)
    }
    return c
  }

  const used = new Set()
  for (let i = 0; i < nCustomers; i++) {
    let n
    do { n = `${pick(FIRST)} ${pick(LAST)}` } while (used.has(n))
    used.add(n)
    mk(n)
  }
  const sp = {}
  if (specials) {
    sp.pep = mk('Farah Siddiqui', { _cur: curs[0] })
    sp.sanction = mk('Viktor Orlenkov', { _cur: curs[0] })
    sp.young = mk('Zayn Ashraf', { dob: dob(18.5, 19.5), _cur: curs[0] })
    sp.struct = mk('Kamran Yousaf', { _cur: curs[0] })
    sp.noKyc = mk('Lola Adebayo', { _kyc: false, _cur: curs[curs.length - 1] })
    sp.shared1 = mk('Nadeem Akhtar', { _shared: true, _cur: curs[0], _recipients: 1 })
    sp.shared2 = mk('Saima Iqbal', { _shared: true, _cur: curs[0], _recipients: 1 })
    sp.shared3 = mk('Waqas Javed', { _shared: true, _cur: curs[0], _recipients: 1 })
  }

  const send = (c, amount, at, opts = {}) => {
    const rec = db.recipients.find((r) => r.customerId === c.id)
    if (!rec) return null
    try {
      const tx = E.createTransaction(db, { tenantId: t.id, customerId: c.id, recipientId: rec.id, sendAmount: amount, purpose: pick(PURPOSES), sof: amount > 1500 || random01() > 0.5 ? pick(SOURCES_OF_FUNDS) : opts.noSof ? '' : '', channel: pick(['App', 'App', 'App', 'Branch']), fraudConfirm: true }, 'Seed', at)
      if (opts.unpaid) return tx
      E.recordPayIn(db, t.id, { amount: tx.total, payer: c.name.toUpperCase(), reference: tx.ref }, 'Bank feed', Math.min(at + between(3, 40) * 60000, now() - 60000))
      if (tx.status === 'released' && now() - at > 2 * 3600000) E.completePayout(db, tx.id, at + between(1, 3) * 3600000)
      return tx
    } catch (e) { return null }
  }
  const random01 = () => between(0, 1)

  // Ordinary traffic
  const regular = customers.filter((c) => !Object.values(sp).includes(c))
  for (let i = 0; i < nTx; i++) {
    const at = start + 7 * DAY + between(0, 25) * DAY - between(0, 2) * 3600000
    const c = pick(regular)
    const amt = Math.round(pick([between(50, 400), between(50, 400), between(200, 900), between(400, 1500), between(1500, 3200)]) / 5) * 5
    send(c, amt, Math.min(at, now() - 600000))
  }
  // A few awaiting funds (recent)
  for (let i = 0; i < 3; i++) send(pick(regular), Math.round(between(80, 600) / 5) * 5, now() - between(5, 90) * 60000, { unpaid: true })

  // Close out older cases and release older transfers, as staff would have
  for (const k of db.cases.filter((x) => x.tenantId === t.id && x.status !== 'closed' && now() - x.createdAt > 3 * DAY && x.kind === 'transaction')) {
    try { E.decideCase(db, k.id, 'release', 'Source of funds evidence reviewed (payslips). Activity consistent with profile.', actorCo, 'Admin', k.createdAt + 5 * 3600000) } catch (e) { /* ignore */ }
  }
  for (const tx of db.transactions.filter((x) => x.tenantId === t.id && x.status === 'pending_release' && now() - x.updatedAt > DAY)) {
    try { E.release(db, tx.id, t.staff.find((s) => s.role === 'Admin').name, tx.updatedAt + 2 * 3600000) } catch (e) { /* ignore */ }
  }
  for (const tx of db.transactions.filter((x) => x.tenantId === t.id && x.status === 'released' && now() - x.updatedAt > 2 * 3600000)) E.completePayout(db, tx.id, tx.updatedAt + 3600000)

  if (specials) {
    send(sp.pep, 1200, now() - 2 * DAY)
    send(sp.young, 1800, now() - 1.5 * DAY)
    send(sp.struct, 940, now() - 2.6 * DAY); send(sp.struct, 960, now() - 1.8 * DAY); send(sp.struct, 955, now() - 3 * 3600000)
    send(sp.shared1, 300, now() - 9 * DAY); send(sp.shared2, 350, now() - 6 * DAY); send(sp.shared3, 400, now() - 5 * 3600000)
    send(regular[0], 6200, now() - 4 * 3600000)
    send(regular[1], 2600, now() - 2 * 3600000)
    send(regular[2], 2350, now() - 50 * 60000)
    send(regular[4], 180, now() - 25 * 60000)
    // Unmatched incoming payments
    E.recordPayIn(db, t.id, { amount: 250, payer: 'M A RAHMAN', reference: 'FOR MUM' }, 'Bank feed', now() - 3 * 3600000)
    E.recordPayIn(db, t.id, { amount: 1000, payer: 'J OKONKWO', reference: '' }, 'Bank feed', now() - 26 * 3600000)
    // A historic SAR
    const sarCust = regular[3]
    db.counters.sar = 41
    const s = E.raiseSar(db, { tenantId: t.id, customerId: sarCust.id, grounds: 'Customer made 6 transfers to 4 unrelated recipients in Lagos within 10 days; could not explain relationship to recipients.' }, actorCo, now() - 12 * DAY)
    E.decideSar(db, s.id, { outcome: 'not_filed', reason: 'Customer provided invoices showing payments to suppliers for his import business. Suspicion not supported.' }, t.compliance.mlro, 'MLRO', now() - 11 * DAY)
    E.raiseSar(db, { tenantId: t.id, customerId: sp.struct.id, grounds: 'Three transfers just under £1,000 in three days to the same recipient. Customer declined to give source of funds when asked by phone.' }, actorCo, now() - 2 * 3600000)
  }
}

export function buildSeed() {
  return withSeed('coremit-demo-v1', () => {
    const db = { version: 2, tenants: [], customers: [], recipients: [], transactions: [], payIns: [], cases: [], sars: [], audit: [], invites: [], counters: {}, journals: [], customPartners: [], integrationRequests: [] }
    const lagos = { id: 'custom_lagos', name: 'Lagos Settle (custom)', cur: ['NGN', 'GHS'], methods: ['Bank', 'Mobile wallet'], included: false, tenantId: 'sahara', status: 'live' }
    db.customPartners.push(lagos)
    const ng = E.makeTenant({
      id: 'northgate', name: 'Northgate Remit', legalName: 'Northgate Remit Ltd', short: 'NGR', slug: 'northgate', domain: 'send.northgateremit.co.uk', status: 'live',
      frn: '900123', mlr: 'XBML00000123456', email: 'owner@northgateremit.co.uk', plan: 'Growth', createdAt: now() - 60 * DAY, liveAt: now() - 58 * DAY, setupSeconds: 588,
      brand: { color: '#0E5E6F', accent: '#F2A541', appName: 'Northgate' },
      corridors: [
        { cur: 'PKR', enabled: true, fee: 2.99, margin: 1.2, min: 10, max: 10000 },
        { cur: 'INR', enabled: true, fee: 2.99, margin: 1.0, min: 10, max: 10000 },
        { cur: 'BDT', enabled: true, fee: 1.99, margin: 1.3, min: 10, max: 10000 },
        { cur: 'NGN', enabled: true, fee: 3.49, margin: 1.5, min: 10, max: 8000 },
      ],
      partners: ['daytona'],
      integrations: { kyc: { provider: 'didit', status: 'connected' }, payin: ['clearbank', 'revolut'] },
      declaration: { accepted: true, by: 'owner@northgateremit.co.uk', at: now() - 60 * DAY },
      compliance: { mlro: 'Amina Yusuf', autoRelease: { enabled: true, maxAmount: 2000 } },
      staff: [
        { id: uid('stf'), name: 'Owner', email: 'owner@northgateremit.co.uk', role: 'Admin' },
        { id: uid('stf'), name: 'Amina Yusuf', email: 'amina@northgateremit.co.uk', role: 'MLRO' },
        { id: uid('stf'), name: 'Daniel Reid', email: 'daniel@northgateremit.co.uk', role: 'Compliance officer' },
        { id: uid('stf'), name: 'Sana Mirza', email: 'sana@northgateremit.co.uk', role: 'Cashier' },
        { id: uid('stf'), name: 'Ilford Agent 03', email: 'agent03@northgateremit.co.uk', role: 'Agent' },
      ],
      treasury: { daytona: 3000000 },
      checks: { contract: true, reg: true, kyc: true, payout: true, prefund: true, domain: true },
    })
    const sh = E.makeTenant({
      id: 'sahara', name: 'Sahara Exchange', legalName: 'Sahara Exchange UK Ltd', short: 'SHX', slug: 'sahara', domain: 'app.saharaexchange.com', status: 'live',
      frn: '901877', mlr: 'XBML00000231907', email: 'ops@saharaexchange.com', plan: 'Starter', createdAt: now() - 41 * DAY, liveAt: now() - 40 * DAY, setupSeconds: 725,
      brand: { color: '#8C3B2E', accent: '#E8C468', appName: 'Sahara' },
      corridors: [
        { cur: 'NGN', enabled: true, fee: 1.99, margin: 1.4, min: 10, max: 8000 },
        { cur: 'GHS', enabled: true, fee: 1.99, margin: 1.6, min: 10, max: 8000 },
        { cur: 'KES', enabled: true, fee: 2.49, margin: 1.5, min: 10, max: 8000 },
      ],
      partners: ['daytona', 'custom_lagos'], integrations: { kyc: { provider: 'shufti', status: 'connected' }, payin: ['embank'] }, declaration: { accepted: true, by: 'ops@saharaexchange.com', at: now() - 41 * DAY }, compliance: { mlro: 'Kofi Asante' },
      staff: [{ id: uid('stf'), name: 'Owner', email: 'ops@saharaexchange.com', role: 'Admin' }, { id: uid('stf'), name: 'Kofi Asante', email: '', role: 'MLRO' }, { id: uid('stf'), name: 'Efua Boateng', email: '', role: 'Compliance officer' }],
      treasury: { daytona: 1500000, custom_lagos: 1500000 }, checks: { contract: true, reg: true, kyc: true, payout: true, prefund: true, domain: true },
    })
    const ks = E.makeTenant({
      id: 'kestrel', name: 'Kestrel Pay', legalName: 'Kestrel Pay Ltd', short: 'KSP', slug: 'kestrel', status: 'review', frn: '903412', mlr: 'XBML00000318822', email: 'hello@kestrelpay.co.uk',
      createdAt: now() - 3 * 3600000, setupSeconds: 700, brand: { color: '#24409E', accent: '#53C4B0', appName: 'Kestrel Pay' },
      corridors: ['PHP', 'INR'], partners: ['daytona'], integrations: { kyc: { provider: 'custom', status: 'requested' }, payin: ['clearbank'] }, declaration: { accepted: true, by: 'hello@kestrelpay.co.uk', at: now() - 3 * 3600000 }, compliance: { mlro: 'Lea Bautista' }, treasury: { daytona: 0 },
      checks: { reg: true, payout: true, domain: true },
    })
    sh.accounts.find((a) => a.id === 'prefund_custom_lagos').name = 'Prefund — Lagos Settle (custom)'
    for (const t of [ng, sh, ks]) t.accounts.push({ id: 'eq_open', name: 'Opening balance equity', type: 'liability', cur: 'GBP' })
    db.tenants.push(ng, sh, ks)
    seedTenant(db, ng, 22, 120, true)
    seedTenant(db, sh, 10, 45, false)
    // Opening balances + a few manual ledger entries so the books look real
    const open = (t, lines, details, at) => E.post(db, t.id, { type: 'OPEN', details, by: 'Opening balance', at, lines })
    open(ng, [{ account: 'bank_clearbank', debit: 120000 }, { account: 'bank_revolut', debit: 18000 }, { account: 'prefund_daytona', debit: 90000 }, { account: 'eq_open', credit: 228000 }], 'Opening balances', now() - 33 * DAY)
    open(sh, [{ account: 'bank_embank', debit: 60000 }, { account: 'prefund_daytona', debit: 40000 }, { account: 'prefund_custom_lagos', debit: 12000 }, { account: 'eq_open', credit: 112000 }], 'Opening balances', now() - 33 * DAY)
    E.addExpense(db, ng.id, { amount: 5000, details: 'To Cloud tech ltd', expenseAccount: 'exp_it', paidFrom: 'bank_revolut', date: now() - 10 * DAY }, 'Owner', now() - 8 * DAY)
    E.addExpense(db, ng.id, { amount: 72.72, details: 'LinkedIn *080344264', expenseAccount: 'exp_it', paidFrom: 'bank_revolut', date: now() - 11 * DAY }, 'Owner', now() - 8 * DAY)
    E.addExpense(db, ng.id, { amount: 151.18, details: 'Ionos Cloud Ltd', expenseAccount: 'exp_it', paidFrom: 'bank_revolut', date: now() - 12 * DAY }, 'Owner', now() - 8 * DAY)
    E.transferFunds(db, ng.id, { from: 'bank_clearbank', to: 'bank_revolut', amount: 10000, details: 'Move operating float' }, 'Owner', now() - 9 * DAY)
    E.topUp(db, ng.id, 'daytona', 40000, 'Owner', now() - 6 * DAY, 'bank_clearbank')
    // Prefund balances come from the ledger
    for (const t of [ng, sh]) for (const pid of t.partners) t.treasury[pid] = E.balance(db, t, `prefund_${pid}`)
    db.integrationRequests.unshift({ id: 'req_kestrel_kyc', tenantId: 'kestrel', kind: 'kyc', name: 'Onfido', notes: 'We already have a contract with Onfido and want to keep it.', cur: [], status: 'requested', quote: null, createdAt: now() - 3 * 3600000, by: 'hello@kestrelpay.co.uk' })
    db.integrationRequests.unshift({ id: 'req_sahara_payin', tenantId: 'sahara', kind: 'payin', name: 'Tide Business', notes: 'Second operating account.', cur: [], status: 'quoted', quote: { setup: 2500, monthly: 150, weeks: 3, note: 'API available; 3 weeks.' }, createdAt: now() - 9 * DAY, by: 'ops@saharaexchange.com' })
    db.invites.push({ token: 'bmx7q2ka', label: 'Barking Money Express', createdAt: now() - 2 * DAY, expiresAt: now() + 5 * DAY, usedBy: null, createdBy: 'Zaland Shah' })
    E.audit(db, { tenantId: 'kestrel', actor: 'hello@kestrelpay.co.uk', action: 'Completed onboarding in 11m 40s', target: 'Kestrel Pay', at: now() - 3 * 3600000 })
    db.audit.sort((a, b) => b.at - a.at)
    db.transactions.sort((a, b) => b.createdAt - a.createdAt)
    db.payIns.sort((a, b) => b.receivedAt - a.receivedAt)
    db.cases.sort((a, b) => b.createdAt - a.createdAt)
    return db
  })
}
