-- MedLens: log of report emails, used ONLY to rate-limit sending (the mail goes out from a personal Gmail account,
-- so an unprotected endpoint would be a spam relay). Addresses and IPs are stored as salted hashes, never in clear.
-- Only the API server (service role) can read or write: row level security is on with no policies.

create table public.email_log (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  ip_hash    text not null,   -- sha256(salt + client ip)
  to_hash    text not null,   -- sha256(salt + lower-cased recipient)
  report_id  text not null,
  status     text not null check (status in ('sent', 'failed'))
);

create index email_log_created_idx on public.email_log (created_at desc);
create index email_log_ip_created_idx on public.email_log (ip_hash, created_at desc);
create index email_log_to_created_idx on public.email_log (to_hash, created_at desc);

alter table public.email_log enable row level security;
comment on table public.email_log is 'Hashed record of report emails, for rate limiting only. Written by the API server only.';
