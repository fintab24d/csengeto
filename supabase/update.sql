-- Futtasd a schema.sql UTÁN (üres és már használt adatbázison is biztonságos).
alter table settings
  add column if not exists tv_show_seconds boolean not null default false,
  add column if not exists tv_show_next boolean not null default true,
  add column if not exists tv_scale int not null default 100 check (tv_scale between 50 and 150);

-- Logó-tároló: publikusan olvasható, max 1 MB, csak képformátum. (SVG szándékosan nincs: lehet benne script.)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('logos', 'logos', true, 1048576, array['image/png','image/jpeg','image/webp'])
on conflict (id) do nothing;

-- Írni csak az adott iskola adminja tud, a saját mappájába (<school_id>/fájl).
drop policy if exists logos_admin_write on storage.objects;
create policy logos_admin_write on storage.objects for all to authenticated
  using (bucket_id = 'logos' and is_school_admin(((storage.foldername(name))[1])::uuid))
  with check (bucket_id = 'logos' and is_school_admin(((storage.foldername(name))[1])::uuid));
