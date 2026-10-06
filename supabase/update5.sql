-- Módosítási napló: ki, mit és mikor módosított. Futtasd az update4.sql után.
create table if not exists audit_log (
  id bigint generated always as identity primary key,
  school_id uuid,                      -- szándékosan nincs FK: a törlést sem akadályozza
  user_id uuid,                        -- üres = SQL Editor / rendszer
  user_email text,
  action text not null check (action in ('INSERT','UPDATE','DELETE')),
  table_name text not null,
  record_id text,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_log_school_idx on audit_log(school_id, created_at desc);
alter table audit_log enable row level security;
drop policy if exists admin_read on audit_log;
create policy admin_read on audit_log for select using (school_id is not null and is_school_admin(school_id));
-- Írni senki nem tud az API-n át (csak az alábbi trigger), így a napló nem hamisítható az oldalról.
revoke insert, update, delete on audit_log from anon, authenticated;

create or replace function audit_trigger() returns trigger
language plpgsql security definer set search_path = public as $$
declare o jsonb; n jsonb; r jsonb; sid uuid;
begin
  if tg_op <> 'INSERT' then o := to_jsonb(old); end if;
  if tg_op <> 'DELETE' then n := to_jsonb(new); end if;
  r := coalesce(n, o);
  sid := case tg_table_name
    when 'schools' then (r->>'id')::uuid
    when 'lessons' then (select school_id from schedules where id = (r->>'schedule_id')::uuid)
    else (r->>'school_id')::uuid end;
  if sid is null then return null; end if;   -- pl. a rend törlésekor lecascade-elt órák: a rend törlése így is naplózva van
  insert into audit_log (school_id, user_id, user_email, action, table_name, record_id, old_data, new_data)
  values (sid, auth.uid(), auth.jwt() ->> 'email', tg_op, tg_table_name, coalesce(r->>'id', r->>'user_id', r->>'school_id'), o, n);
  return null;
end $$;

do $$ declare t text; begin
  foreach t in array array['schools','settings','schedules','lessons','closed_days','countdowns','announcements','school_members'] loop
    execute format('drop trigger if exists audit_%1$s on %1$I', t);
    execute format('create trigger audit_%1$s after insert or update or delete on %1$I for each row execute function audit_trigger()', t);
  end loop;
end $$;
