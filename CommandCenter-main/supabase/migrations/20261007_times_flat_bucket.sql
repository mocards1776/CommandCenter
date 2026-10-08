-- Public page images for the flat Times. Readers download without a session.
-- Authenticated printers upload and prune. Seven-day retention is enforced
-- by scripts/times-flat-print.mjs, not by this bucket.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'times-flat',
  'times-flat',
  true,
  12582912,
  array['image/webp', 'image/png', 'application/json']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "times flat read" on storage.objects;
drop policy if exists "times flat write" on storage.objects;
drop policy if exists "times flat update" on storage.objects;
drop policy if exists "times flat delete" on storage.objects;

create policy "times flat read"
  on storage.objects for select
  using (bucket_id = 'times-flat');

create policy "times flat write"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'times-flat');

create policy "times flat update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'times-flat')
  with check (bucket_id = 'times-flat');

create policy "times flat delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'times-flat');
