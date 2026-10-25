-- Run once in this project's Supabase SQL Editor. No existing local files are changed.
begin;

create table if not exists public.wardrobe_garments (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  record jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, id),
  constraint wardrobe_item_record check (jsonb_typeof(record) = 'object' and record->>'id' = id)
);
create table if not exists public.wardrobe_fits (
  user_id uuid not null references auth.users(id) on delete cascade,
  id uuid not null,
  fingerprint text not null,
  record jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, id),
  unique (user_id, fingerprint),
  constraint wardrobe_fit_record check (jsonb_typeof(record) = 'object' and record->>'id' = id::text)
);
create table if not exists public.wardrobe_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  reference_path text not null check (reference_path ~ '^reference/[a-f0-9-]{36}\.png$')
);

alter table public.wardrobe_garments enable row level security;
alter table public.wardrobe_fits enable row level security;
alter table public.wardrobe_settings enable row level security;

drop policy if exists "wardrobe_garments_owner" on public.wardrobe_garments;
create policy "wardrobe_garments_owner" on public.wardrobe_garments for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "wardrobe_fits_owner" on public.wardrobe_fits;
create policy "wardrobe_fits_owner" on public.wardrobe_fits for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "wardrobe_settings_owner" on public.wardrobe_settings;
create policy "wardrobe_settings_owner" on public.wardrobe_settings for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

revoke all on public.wardrobe_garments, public.wardrobe_fits, public.wardrobe_settings from anon;
grant select, insert, update, delete on public.wardrobe_garments, public.wardrobe_fits, public.wardrobe_settings to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('wardrobe-private', 'wardrobe-private', false, 26214400, array['image/png'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- A restrictive boundary keeps older, broad storage policies from exposing this bucket.
drop policy if exists "wardrobe_private_boundary" on storage.objects;
create policy "wardrobe_private_boundary" on storage.objects as restrictive for all to public
  using (bucket_id <> 'wardrobe-private' or (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id <> 'wardrobe-private' or (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "wardrobe_private_read" on storage.objects;
create policy "wardrobe_private_read" on storage.objects for select to authenticated
  using (bucket_id = 'wardrobe-private' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "wardrobe_private_insert" on storage.objects;
create policy "wardrobe_private_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'wardrobe-private' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "wardrobe_private_update" on storage.objects;
create policy "wardrobe_private_update" on storage.objects for update to authenticated
  using (bucket_id = 'wardrobe-private' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'wardrobe-private' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "wardrobe_private_delete" on storage.objects;
create policy "wardrobe_private_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'wardrobe-private' and (storage.foldername(name))[1] = (select auth.uid())::text);

commit;
