# Architecture

## Tenancy
- `tenants` is the root of everything. Every other table carries `tenant_id`.
- A request is resolved to a tenant by hostname: `<slug>.coremit.app` or a custom domain in `tenant_domains`. See `src/lib/tenancy.js`.
- Postgres row-level security: a staff user can only read/write rows where `tenant_id = auth.jwt() ->> 'tenant_id'`; super admins carry `role = 'super'` and bypass. Customers see only their own rows.

## Roles
| Role | Scope | Notes |
|---|---|---|
| Super Admin | all tenants | TheFXSoft. Creates onboarding links, approves/suspends MSBs, manages payout network, billing. Can open any MSB portal (impersonation is audited). |
| MSB Admin | one tenant | Everything in their tenant incl. branding, pricing, partners, staff, roles. |
| MSB staff (MLRO, Compliance officer, Cashier, Agent, custom) | one tenant | Module access set per role in `tenant.roles`. MLRO/Admin decide SARs and release blocking holds. |
| Customer | own records | App only. |

## Engine → API
`src/lib/engine.js` is written as pure functions over a `db` object. In production each becomes an endpoint (Supabase edge function or a small Node API) that runs inside one database transaction:

| Engine op | Endpoint |
|---|---|
| `createInvite`, `completeOnboarding`, `setTenantStatus` | `POST /admin/invites`, `POST /onboard/:token`, `POST /admin/tenants/:id/status` |
| `createCustomer`, `addDocument`, `reviewDocument`, `setCustomerRisk`, `setCustomerStatus`, `addRecipient` | `/customers/*` |
| `quote`, `createTransaction`, `cancelTransaction`, `release`, `completePayout` | `/transfers/*` (`completePayout` is the partner webhook) |
| `recordPayIn`, `matchPayIn`, `returnPayIn` | `/payments/*` (`recordPayIn` is the bank-feed webhook) |
| `runCompliance`, `assignCase`, `addCaseNote`, `decideCase`, `resolveScreening`, `raiseSar`, `decideSar` | `/compliance/*` |
| `topUp` | `/treasury/top-ups` |

`src/lib/rules.js` (rule evaluation) and `src/lib/screening.js` are pure and can move server-side unchanged.

## Data flow for one transfer
1. Customer app → `createTransaction` → status `awaiting_funds`, reference `NGR-XXXXXX`.
2. Bank feed webhook → `recordPayIn` → match by reference + amount → `funds_received`.
3. `runCompliance` evaluates every enabled rule → `on_hold` (+ case) or `pending_release`.
4. `release` (auto or by staff) debits the partner prefund balance → `released` → partner API.
5. Partner webhook → `completePayout` → `paid`.

## AI
`netlify/functions/ai.mjs` holds the Anthropic key. The client sends a small context object (never the whole database). Before production: verify the caller's session and tenant, and log every call to `audit_log`.

## Mobile
PWA first (installable from the browser on day one, `public/manifest.webmanifest`). Native store apps later via Capacitor/Expo from the same code, built per tenant with its icon and name.
