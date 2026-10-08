-- Saját csengőhang: az admin feltölthet hangfájlt. Futtasd az update8.sql után.
alter table settings add column if not exists bell_sound_url text;     -- üres = az alapértelmezett, beépített csengő

-- Hang-tároló: publikusan olvasható, max 2 MB, csak hangformátumok.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('sounds', 'sounds', true, 2097152,
  array['audio/mpeg','audio/mp3','audio/ogg','audio/wav','audio/x-wav','audio/mp4','audio/x-m4a','audio/aac','audio/webm'])
on conflict (id) do nothing;

-- Írni csak az adott iskola adminja tud, a saját mappájába (<school_id>/fájl).
drop policy if exists sounds_admin_write on storage.objects;
create policy sounds_admin_write on storage.objects for all to authenticated
  using (bucket_id = 'sounds' and is_school_admin(((storage.foldername(name))[1])::uuid))
  with check (bucket_id = 'sounds' and is_school_admin(((storage.foldername(name))[1])::uuid));
