// Platform reference data.
// The DEFAULTS below seed `db.platform`, which the Super Admin edits at runtime (Platform settings).
// The exported live objects (CURRENCIES, PARTNERS, …) mirror db.platform and are refreshed by syncFromPlatform()
// every time the store changes, so the rest of the app can keep importing them.

export const DEFAULT_PLATFORM = {
  name: 'TheFXSoft', owner: 'TheFXSoft Ltd', domain: 'thefxsoft.app', supportEmail: 'support@thefxsoft.com',
  products: [
    { id: 'remittance', label: 'Money remittance', desc: 'Send money abroad: customer app, payouts, compliance, treasury', modules: ['transactions', 'payments', 'tracker'] },
    { id: 'bureau', label: 'Bureau de change', desc: 'Over-the-counter cash FX: rate board, tills, stock, deals, online reservations', modules: ['bureau'] },
  ],
  baseCurrency: 'GBP',
  currencies: {
    PKR: { country: 'Pakistan', rate: 372.4, enabled: true, cash: true },
    INR: { country: 'India', rate: 111.85, enabled: true, cash: true },
    NGN: { country: 'Nigeria', rate: 2045.1, enabled: true, cash: false },
    BDT: { country: 'Bangladesh', rate: 156.2, enabled: true, cash: true },
    PHP: { country: 'Philippines', rate: 76.9, enabled: true, cash: false },
    KES: { country: 'Kenya', rate: 165.3, enabled: true, cash: false },
    GHS: { country: 'Ghana', rate: 19.8, enabled: true, cash: false },
    EUR: { country: 'Eurozone (SEPA)', rate: 1.17, enabled: true, cash: true },
    USD: { country: 'United States', rate: 1.315, enabled: true, cash: true },
    AED: { country: 'United Arab Emirates', rate: 4.83, enabled: true, cash: true },
    TRY: { country: 'Türkiye', rate: 45.2, enabled: true, cash: true },
  },
  rateSource: 'Manual (Super Admin)',
  partners: [
    { id: 'daytona', name: 'Daytona Capital Management', cur: ['PKR', 'INR', 'NGN', 'BDT', 'PHP', 'KES', 'GHS', 'EUR', 'USD', 'AED', 'TRY'], methods: ['Bank', 'Cash pickup', 'Mobile wallet'], included: true, desc: 'Pre-integrated. Bank, cash pickup and wallet payouts across all platform corridors.', status: 'live' },
  ],
  kycProviders: [
    { id: 'didit', name: 'Didit', included: true, desc: 'ID document + liveness, AML screening, proof of address. Included in your plan.' },
    { id: 'shufti', name: 'Shufti Pro', included: true, desc: 'ID document + face match, AML screening, address verification. Included in your plan.' },
    { id: 'custom', name: 'Custom KYC integration', included: false, desc: 'Bring your own provider. Scoped and quoted separately by TheFXSoft.' },
  ],
  payinBanks: [
    { id: 'clearbank', name: 'ClearBank', kind: 'Bank account (Faster Payments, CHAPS)', included: true },
    { id: 'revolut', name: 'Revolut Business', kind: 'Bank account', included: true },
    { id: 'embank', name: 'EM Bank', kind: 'Safeguarding + corporate accounts', included: true },
    { id: 'securetrading', name: 'Secure Trading', kind: 'Card payments', included: true },
    { id: 'transact365', name: 'Bombora Transact365', kind: 'Card payments', included: true },
    { id: 'custom', name: 'Custom bank integration', kind: 'Quoted separately', included: false },
  ],
  plans: [
    { id: 'Bureau', name: 'Bureau', monthly: 149, perTx: 0, modules: ['dashboard', 'customers', 'compliance', 'treasury', 'reports', 'settings', 'bureau', 'developer'] },
    { id: 'Starter', name: 'Starter', monthly: 199, perTx: 0.4, modules: ['dashboard', 'transactions', 'payments', 'customers', 'compliance', 'treasury', 'reports', 'settings', 'tracker'] },
    { id: 'Growth', name: 'Growth', monthly: 499, perTx: 0.25, modules: ['dashboard', 'transactions', 'payments', 'customers', 'compliance', 'treasury', 'reports', 'settings', 'tracker', 'agents', 'corporate', 'rewards', 'bureau', 'developer'] },
    { id: 'Enterprise', name: 'Enterprise', monthly: 1200, perTx: 0.15, modules: ['dashboard', 'transactions', 'payments', 'customers', 'compliance', 'treasury', 'reports', 'settings', 'tracker', 'agents', 'corporate', 'rewards', 'bureau', 'developer'] },
  ],
  modules: [
    { id: 'dashboard', label: 'Dashboard', core: true },
    { id: 'transactions', label: 'Transactions', core: true },
    { id: 'payments', label: 'Payments in', core: true },
    { id: 'customers', label: 'Customers', core: true },
    { id: 'compliance', label: 'Compliance', core: true },
    { id: 'treasury', label: 'Treasury', core: true },
    { id: 'reports', label: 'Reports', core: true },
    { id: 'agents', label: 'Agents', core: false, desc: 'Branch and agent network with floats and commission' },
    { id: 'corporate', label: 'Corporate clients', core: false, desc: 'Business senders with contract limits and bulk payments' },
    { id: 'bureau', label: 'Bureau de change', core: false, desc: 'Over-the-counter cash FX: rate board, tills, stock, deals' },
    { id: 'rewards', label: 'Rewards', core: false, desc: 'Referral and loyalty points for customers' },
    { id: 'tracker', label: 'Tracker', core: false, desc: 'Public transfer tracking page' },
    { id: 'developer', label: 'Developer', core: false, desc: 'API keys and webhooks' },
    { id: 'settings', label: 'Settings', core: true },
  ],
  lists: {
    purposes: ['Family support', 'Education fees', 'Medical expenses', 'Savings', 'Property purchase', 'Business payment', 'Gift'],
    sourcesOfFunds: ['Salary', 'Savings', 'Business income', 'Pension', 'Sale of property', 'Loan', 'Gift / inheritance'],
    docTypes: ['Passport', 'UK driving licence', 'National ID card', 'Proof of address', 'Source of funds evidence'],
    idDocTypes: ['Passport', 'UK driving licence', 'National ID card'],
    occupations: ['Nurse', 'Software engineer', 'Taxi driver', 'Shop owner', 'Student', 'Care worker', 'Accountant', 'Construction worker', 'Retired', 'Restaurant manager'],
    relationships: ['Parent', 'Spouse', 'Sibling', 'Child', 'Cousin', 'Friend', 'Supplier', 'Other'],
    payoutMethods: ['Bank', 'Cash pickup', 'Mobile wallet'],
    channels: ['App', 'Web', 'Branch', 'Agent'],
  },
  // Fictional watchlist used for demo screening only. Replace with a real sanctions/PEP data provider.
  watchlist: [
    { name: 'Viktor Orlenko', list: 'UK sanctions list (demo)', reason: 'Asset freeze' },
    { name: 'Hassan Al-Moudari', list: 'UN consolidated list (demo)', reason: 'Terrorist financing' },
    { name: 'Darius Kemal Ferro', list: 'OFAC SDN (demo)', reason: 'Narcotics' },
    { name: 'Liang Wexu', list: 'UK sanctions list (demo)', reason: 'Cyber' },
    { name: 'Amadou Bello Sise', list: 'EU sanctions list (demo)', reason: 'Asset freeze' },
    { name: 'Ruslan Petrakov', list: 'UK sanctions list (demo)', reason: 'Asset freeze' },
  ],
  pepList: [
    { name: 'Senator Okon Effiong', role: 'Senator (demo)' },
    { name: 'Farah Siddiqui', role: 'Provincial minister (demo)' },
  ],
}

/* ---- Live mirrors (kept in sync with db.platform) ---- */
export const CURRENCIES = {}
export const PARTNERS = []
export const KYC_PROVIDERS = []
export const PAYIN_BANKS = []
export const MODULES = []
export const PLANS = []
export const PURPOSES = []
export const SOURCES_OF_FUNDS = []
export const DOC_TYPES = []
export const ID_DOC_TYPES = []
export const OCCUPATIONS = []
export const RELATIONSHIPS = []
export const WATCHLIST = []
export const PEP_LIST = []
export const PLATFORM = { name: 'TheFXSoft', owner: 'TheFXSoft Ltd', domain: 'thefxsoft.app' }
export const PRODUCTS = []

const fillArr = (target, src) => { target.length = 0; for (const x of src || []) target.push(x) }
const fillObj = (target, src) => { for (const k of Object.keys(target)) delete target[k]; Object.assign(target, src || {}) }
export function syncFromPlatform(p) {
  if (!p) return
  fillObj(CURRENCIES, Object.fromEntries(Object.entries(p.currencies || {}).filter(([, v]) => v.enabled !== false)))
  fillArr(PRODUCTS, p.products); fillArr(PARTNERS, p.partners); fillArr(KYC_PROVIDERS, p.kycProviders); fillArr(PAYIN_BANKS, p.payinBanks); fillArr(MODULES, p.modules); fillArr(PLANS, p.plans)
  fillArr(PURPOSES, p.lists?.purposes); fillArr(SOURCES_OF_FUNDS, p.lists?.sourcesOfFunds); fillArr(DOC_TYPES, p.lists?.docTypes); fillArr(ID_DOC_TYPES, p.lists?.idDocTypes)
  fillArr(OCCUPATIONS, p.lists?.occupations); fillArr(RELATIONSHIPS, p.lists?.relationships); fillArr(WATCHLIST, p.watchlist); fillArr(PEP_LIST, p.pepList)
  Object.assign(PLATFORM, { name: p.name, owner: p.owner, domain: p.domain, supportEmail: p.supportEmail })
}
syncFromPlatform(DEFAULT_PLATFORM)

export const partnersOf = (db) => [...PARTNERS, ...(db.customPartners || [])]
export const partnerById = (db, id) => partnersOf(db).find((p) => p.id === id)
export const partnerFor = (db, t, cur) => partnersOf(db).find((p) => p.cur.includes(cur) && t.partners.includes(p.id) && (p.status || 'live') === 'live')
export const planById = (id) => PLANS.find((p) => p.id === id) || PLANS[0]
export const moduleLabel = (id) => MODULES.find((m) => m.id === id)?.label || id

export const DEFAULT_ROLES = {
  Admin: ['*'],
  MLRO: ['dashboard', 'transactions', 'payments', 'customers', 'compliance', 'reports', 'corporate', 'agents', 'bureau'],
  'Compliance officer': ['dashboard', 'transactions', 'customers', 'compliance', 'corporate'],
  Cashier: ['dashboard', 'transactions', 'payments', 'customers', 'bureau', 'tracker'],
  'Bureau cashier': ['dashboard', 'bureau', 'customers'],
  Agent: ['transactions', 'customers', 'tracker'],
}
// Roles allowed to make final compliance decisions (release held transfers, decide SARs)
export const DECISION_ROLES = ['Admin', 'MLRO', 'Compliance officer']
export const SAR_ROLES = ['Admin', 'MLRO']

export const TX_STATUS = {
  awaiting_funds: { label: 'Awaiting funds', tone: 'warn' },
  funds_received: { label: 'Funds received', tone: 'info' },
  on_hold: { label: 'On hold', tone: 'crit' },
  pending_release: { label: 'Ready to release', tone: 'info' },
  released: { label: 'Sent to partner', tone: 'info' },
  paid: { label: 'Paid', tone: 'good' },
  rejected: { label: 'Rejected', tone: 'crit' },
  refunded: { label: 'Refunded', tone: 'mute' },
  cancelled: { label: 'Cancelled', tone: 'mute' },
}
