-- Különleges napok, mai változások, étlap, kiemelt közlemény, tanév. Futtasd az update5.sql után.
alter table settings
  add column if not exists alert_text text not null default '',
  add column if not exists alert_active boolean not null default false,
  add column if not exists lunch_after int,          -- hányadik óra UTÁNI szünet az ebédszünet
  add column if not exists year_start date,
  add column if not exists year_end date;

create table if not exists schedule_dates (            -- egy konkrét napra más csengetési rend
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  day date not null,
  schedule_id uuid not null references schedules(id) on delete cascade,
  unique (school_id, day));
create table if not exists changes (                   -- mai változások (a kijelzőn csak az adott napon látszanak)
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  day date not null,
  kind text not null default 'info' check (kind in ('cancel','substitute','room','info')),
  lesson_label text not null default '',
  text text not null default '',
  created_at timestamptz not null default now());
create table if not exists menus (                     -- napi étlap
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  day date not null,
  text text not null,
  unique (school_id, day));
create index if not exists changes_school_day_idx on changes(school_id, day);

do $$ declare t text; begin
  foreach t in array array['schedule_dates','changes','menus'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists read_all on %I', t);
    execute format('create policy read_all on %I for select using (true)', t);
    execute format('drop policy if exists admin_write on %I', t);
    execute format('create policy admin_write on %I for all using (is_school_admin(school_id)) with check (is_school_admin(school_id))', t);
    execute format('drop trigger if exists audit_%1$s on %1$I', t);                       -- a módosítási napló ezeket is rögzíti
    execute format('create trigger audit_%1$s after insert or update or delete on %1$I for each row execute function audit_trigger()', t);
  end loop;
end $$;
