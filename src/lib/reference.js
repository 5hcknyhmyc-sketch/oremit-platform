// Platform-wide reference data. Rates and partner names are demo placeholders.

export const CURRENCIES = {
  PKR: { country: 'Pakistan', rate: 372.4 },
  INR: { country: 'India', rate: 111.85 },
  NGN: { country: 'Nigeria', rate: 2045.1 },
  BDT: { country: 'Bangladesh', rate: 156.2 },
  PHP: { country: 'Philippines', rate: 76.9 },
  KES: { country: 'Kenya', rate: 165.3 },
  GHS: { country: 'Ghana', rate: 19.8 },
  EUR: { country: 'Eurozone (SEPA)', rate: 1.17 },
}

// Payout partners integrated at platform level. Daytona is included; anything else is a custom integration quoted separately.
export const PARTNERS = [
  { id: 'daytona', name: 'Daytona Capital Management', cur: ['PKR', 'INR', 'NGN', 'BDT', 'PHP', 'KES', 'GHS', 'EUR'], methods: ['Bank', 'Cash pickup', 'Mobile wallet'], included: true, desc: 'Pre-integrated. Bank, cash pickup and wallet payouts across all platform corridors.' },
]
export const partnersOf = (db) => [...PARTNERS, ...(db.customPartners || [])]
export const partnerById = (db, id) => partnersOf(db).find((p) => p.id === id)
export const partnerFor = (db, t, cur) => partnersOf(db).find((p) => p.cur.includes(cur) && t.partners.includes(p.id) && (p.status || 'live') === 'live')

// KYC / identity providers already integrated. MSB picks one at sign-up.
export const KYC_PROVIDERS = [
  { id: 'didit', name: 'Didit', included: true, desc: 'ID document + liveness, AML screening, proof of address. Included in your plan.' },
  { id: 'shufti', name: 'Shufti Pro', included: true, desc: 'ID document + face match, AML screening, address verification. Included in your plan.' },
  { id: 'custom', name: 'Custom KYC integration', included: false, desc: 'Bring your own provider. Scoped and quoted separately by TheFXSoft.' },
]
// Pay-in / banking rails already integrated.
export const PAYIN_BANKS = [
  { id: 'clearbank', name: 'ClearBank', kind: 'Bank account (Faster Payments, CHAPS)', included: true },
  { id: 'revolut', name: 'Revolut Business', kind: 'Bank account', included: true },
  { id: 'embank', name: 'EM Bank', kind: 'Safeguarding + corporate accounts', included: true },
  { id: 'securetrading', name: 'Secure Trading', kind: 'Card payments', included: true },
  { id: 'transact365', name: 'Bombora Transact365', kind: 'Card payments', included: true },
  { id: 'custom', name: 'Custom bank integration', kind: 'Quoted separately', included: false },
]

export const MODULES = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'transactions', label: 'Transactions' },
  { id: 'payments', label: 'Payments in' },
  { id: 'customers', label: 'Customers' },
  { id: 'compliance', label: 'Compliance' },
  { id: 'treasury', label: 'Treasury' },
  { id: 'reports', label: 'Reports' },
  { id: 'settings', label: 'Settings' },
]

export const DEFAULT_ROLES = {
  Admin: ['dashboard', 'transactions', 'payments', 'customers', 'compliance', 'treasury', 'reports', 'settings'],
  MLRO: ['dashboard', 'transactions', 'payments', 'customers', 'compliance', 'reports'],
  'Compliance officer': ['dashboard', 'transactions', 'customers', 'compliance'],
  Cashier: ['dashboard', 'transactions', 'payments', 'customers'],
  Agent: ['transactions', 'customers'],
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

export const PURPOSES = ['Family support', 'Education fees', 'Medical expenses', 'Savings', 'Property purchase', 'Business payment', 'Gift']
export const SOURCES_OF_FUNDS = ['Salary', 'Savings', 'Business income', 'Pension', 'Sale of property', 'Loan', 'Gift / inheritance']
export const DOC_TYPES = ['Passport', 'UK driving licence', 'National ID card', 'Proof of address', 'Source of funds evidence']
export const OCCUPATIONS = ['Nurse', 'Software engineer', 'Taxi driver', 'Shop owner', 'Student', 'Care worker', 'Accountant', 'Construction worker', 'Retired', 'Restaurant manager']

// Fictional watchlist used for demo screening only. Replace with a real sanctions/PEP data provider.
export const WATCHLIST = [
  { name: 'Viktor Orlenko', list: 'UK sanctions list (demo)', reason: 'Asset freeze' },
  { name: 'Hassan Al-Moudari', list: 'UN consolidated list (demo)', reason: 'Terrorist financing' },
  { name: 'Darius Kemal Ferro', list: 'OFAC SDN (demo)', reason: 'Narcotics' },
  { name: 'Liang Wexu', list: 'UK sanctions list (demo)', reason: 'Cyber' },
  { name: 'Amadou Bello Sise', list: 'EU sanctions list (demo)', reason: 'Asset freeze' },
  { name: 'Ruslan Petrakov', list: 'UK sanctions list (demo)', reason: 'Asset freeze' },
]
export const PEP_LIST = [
  { name: 'Senator Okon Effiong', role: 'Senator (demo)' },
  { name: 'Farah Siddiqui', role: 'Provincial minister (demo)' },
]
