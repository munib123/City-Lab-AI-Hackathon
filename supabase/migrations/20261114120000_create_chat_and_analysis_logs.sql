-- MedLens: store every chat answer and every analysis of a corpus report.
-- Pasted report text is never stored (the lab's privacy rule). Only the API server (service role) can read or write:
-- row level security is on and there are deliberately no policies, so the public/anon keys get nothing.

create table public.chat_messages (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  report_id     text not null,
  question      text not null,
  answer        text not null,
  answer_type   text not null
                check (answer_type in ('answered','not_in_files','refused_other_patient','refused_diagnosis','needs_info','unavailable')),
  llm_used      boolean not null default false,
  reading_grade numeric,
  sources       jsonb not null default '[]'::jsonb,
  model         text,
  age           integer check (age is null or (age >= 0 and age <= 130)),
  sex           text check (sex is null or sex in ('Male','Female'))
);

create index chat_messages_report_created_idx on public.chat_messages (report_id, created_at desc);

create table public.analyses (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  report_id        text not null,
  demographics_key text not null,   -- e.g. 'age=40|sex=Male'; empty parts when not known
  age              integer check (age is null or (age >= 0 and age <= 130)),
  sex              text check (sex is null or sex in ('Male','Female')),
  overall          text not null
                   check (overall in ('URGENT','NOT_NORMAL','INCOMPLETE','ALL_NORMAL','NO_RESULTS')),
  result           jsonb not null,  -- the full Analysis the API returned
  unique (report_id, demographics_key)
);

alter table public.chat_messages enable row level security;
alter table public.analyses enable row level security;

comment on table public.chat_messages is 'Every chat question and answer for corpus reports. Written by the API server only.';
comment on table public.analyses is 'Latest analysis per corpus report and demographics. Written by the API server only.';
