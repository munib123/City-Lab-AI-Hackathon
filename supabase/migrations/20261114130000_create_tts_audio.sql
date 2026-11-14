-- MedLens: cache of read-aloud audio (Edge TTS). Each distinct text and voice is synthesized once.
-- The audio files live in a PRIVATE storage bucket; the API hands out short-lived signed links.
-- Only the API server (service role) can read or write: row level security is on with no policies.

create table public.tts_audio (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  text_hash    text not null,        -- sha256 of voice + text
  voice        text not null,
  source       text not null,        -- 'chat:<chat_messages.id>' or 'report:P004:summary'
  text         text not null,        -- exactly what was spoken
  storage_path text not null,        -- path inside the tts-audio bucket
  byte_size    integer not null check (byte_size > 0),
  unique (text_hash, voice)
);

alter table public.tts_audio enable row level security;
comment on table public.tts_audio is 'Read-aloud audio cache (Edge TTS). Files are in the private tts-audio bucket. Written by the API server only.';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('tts-audio', 'tts-audio', false, 5242880, array['audio/mpeg'])
on conflict (id) do nothing;
