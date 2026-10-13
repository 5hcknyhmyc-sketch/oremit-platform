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

export const PARTNERS = [
  { id: 'p1', name: 'Indus Payout Network', cur: ['PKR'], methods: ['Bank', 'Cash pickup', 'Mobile wallet'] },
  { id: 'p2', name: 'Bharat Rails', cur: ['INR'], methods: ['Bank', 'UPI'] },
  { id: 'p3', name: 'Lagos Settle', cur: ['NGN', 'GHS'], methods: ['Bank', 'Mobile wallet'] },
  { id: 'p4', name: 'Dhaka Direct', cur: ['BDT'], methods: ['Bank', 'Mobile wallet', 'Cash pickup'] },
  { id: 'p5', name: 'Pacific Payouts', cur: ['PHP'], methods: ['Bank', 'Cash pickup'] },
  { id: 'p6', name: 'EastPay Mobile', cur: ['KES'], methods: ['Mobile money'] },
  { id: 'p7', name: 'SEPA Gateway', cur: ['EUR'], methods: ['Bank'] },
]
export const partnerById = (id) => PARTNERS.find((p) => p.id === id)
export const partnerFor = (cur, enabled) => PARTNERS.find((p) => p.cur.includes(cur) && (!enabled || enabled.includes(p.id)))

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
