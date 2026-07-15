-- Vivi sync: one-time setup. Paste this whole block into the Supabase SQL editor and Run.
-- Access is ONLY through the two functions below; you must know the sync id to read or write.

create table if not exists vivi_sync (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table vivi_sync enable row level security;
-- no policies: direct table access is blocked for anon/authenticated

create or replace function vivi_get(sync_id text)
returns table (data jsonb, updated_at timestamptz)
language sql security definer set search_path = public as $$
  select data, updated_at from vivi_sync where id = sync_id;
$$;

create or replace function vivi_put(sync_id text, payload jsonb)
returns timestamptz
language sql security definer set search_path = public as $$
  insert into vivi_sync (id, data, updated_at)
  values (sync_id, payload, now())
  on conflict (id) do update set data = excluded.data, updated_at = now()
  returning updated_at;
$$;

revoke all on vivi_sync from anon, authenticated;
grant execute on function vivi_get(text) to anon;
grant execute on function vivi_put(text, jsonb) to anon;
