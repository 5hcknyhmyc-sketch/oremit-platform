-- CoRemit core schema (Postgres / Supabase). Mirrors the shapes in src/lib/engine.js.
create extension if not exists "pgcrypto";

create table tenants (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null, legal_name text, short text,
  status text not null check (status in ('review','live','suspended')) default 'review',
  plan text default 'Starter', frn text, mlr text, email text,
  brand jsonb not null default '{}',          -- color, accent, logo_url, app_name
  compliance jsonb not null default '{}',     -- thresholds, auto_release, mlro, idv, screening
  bank jsonb not null default '{}',           -- safeguarding account details
  roles jsonb not null default '{}',          -- role -> [modules]
  checks jsonb not null default '{}',         -- approval checklist
  setup_seconds int, live_at timestamptz, created_at timestamptz default now()
);
create table tenant_domains (hostname text primary key, tenant_id uuid references tenants, ssl_status text default 'pending');
create table tenant_corridors (tenant_id uuid references tenants, cur text, enabled bool default true, fee numeric, margin numeric, min numeric, max numeric, partner_id text, primary key (tenant_id, cur));
create table tenant_partners (tenant_id uuid references tenants, partner_id text, prefund_balance numeric default 0, primary key (tenant_id, partner_id));
create table payout_partners (id text primary key, name text, currencies text[], methods text[], api_config jsonb);
create table onboarding_invites (token text primary key, label text, created_by text, created_at timestamptz default now(), expires_at timestamptz, used_by uuid references tenants);

create table users (
  id uuid primary key, tenant_id uuid references tenants,  -- null for super admins
  name text, email text unique, role text, created_at timestamptz default now()
);

create table customers (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants,
  type text default 'individual', name text not null, email text, phone text, dob date, address text, postcode text, occupation text, nationality text,
  status text default 'active', pep bool default false, pep_detail jsonb,
  kyc_status text default 'not_started', kyc_verified_at timestamptz,
  screening jsonb, risk jsonb, created_at timestamptz default now()
);
create table customer_documents (id uuid primary key default gen_random_uuid(), customer_id uuid references customers, type text, status text default 'pending', file_path text, expiry date, uploaded_at timestamptz default now(), reviewed_by text);
create table recipients (id uuid primary key default gen_random_uuid(), tenant_id uuid references tenants, customer_id uuid references customers, name text, cur text, method text, bank text, account text, relationship text, screening jsonb, created_at timestamptz default now());

create table transfers (
  id uuid primary key default gen_random_uuid(), ref text unique not null, tenant_id uuid references tenants,
  customer_id uuid references customers, recipient_id uuid references recipients,
  send_amount numeric, fee numeric, total numeric, cur text, rate numeric, receive_amount numeric,
  partner_id text, method text, purpose text, sof text, channel text, fraud_confirm bool,
  status text not null, hits jsonb default '[]', case_id uuid, pay_in_id uuid, note text,
  created_at timestamptz default now(), updated_at timestamptz default now()
);
create table transfer_events (id bigserial primary key, transfer_id uuid references transfers, status text, note text, actor text, at timestamptz default now());
create table pay_ins (id uuid primary key default gen_random_uuid(), tenant_id uuid references tenants, amount numeric, payer text, reference text, method text, received_at timestamptz, status text default 'unmatched', transfer_id uuid references transfers, matched_by text, note text);

create table rules (id uuid primary key default gen_random_uuid(), tenant_id uuid references tenants, type text, name text, enabled bool default true, action text, severity text, params jsonb);
create table cases (id uuid primary key default gen_random_uuid(), ref text, tenant_id uuid references tenants, kind text, transfer_id uuid, customer_id uuid, recipient_id uuid, severity text, blocking bool, holding bool, title text, hits jsonb, status text, outcome text, assignee text, created_at timestamptz default now(), closed_at timestamptz, closed_by text, sar_id uuid);
create table case_notes (id bigserial primary key, case_id uuid references cases, by_user text, text text, at timestamptz default now());
create table sars (id uuid primary key default gen_random_uuid(), ref text, tenant_id uuid references tenants, case_id uuid, customer_id uuid, transfer_id uuid, grounds text, status text, nca_ref text, moratorium_ends timestamptz, raised_by text, decision jsonb, created_at timestamptz default now());
create table policies (id uuid primary key default gen_random_uuid(), tenant_id uuid references tenants, key text, title text, audience text);
create table policy_versions (id bigserial primary key, policy_id uuid references policies, v int, body text, by_user text, approved_by text, at timestamptz default now());
create table top_ups (id uuid primary key default gen_random_uuid(), tenant_id uuid references tenants, partner_id text, amount numeric, by_user text, at timestamptz default now());
create table audit_log (id bigserial primary key, tenant_id uuid, actor text, action text, target text, at timestamptz default now());

-- Row-level security sketch (enable per table):
-- alter table transfers enable row level security;
-- create policy tenant_isolation on transfers using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid or (auth.jwt() ->> 'role') = 'super');
