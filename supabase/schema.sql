-- Futtasd a Supabase SQL Editorban. Többiskolás szerkezet, RLS-sel.
create extension if not exists pgcrypto;

create table schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now()
);
-- "users": a hitelesítést a Supabase Auth (auth.users) végzi, jelszó nálunk nem tárolódik.
create table school_members (
  user_id uuid not null references auth.users(id) on delete cascade,
  school_id uuid not null references schools(id) on delete cascade,
  primary key (user_id, school_id)
);
create table schedules (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  name text not null,
  weekdays int[] not null default '{}',      -- 1=hétfő … 7=vasárnap; üres = csak alapértelmezettként él
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index one_default_schedule on schedules(school_id) where is_default;
create index schedules_school_idx on schedules(school_id);
create table lessons (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references schedules(id) on delete cascade,
  label text not null,
  start_time time not null,
  end_time time not null,
  position int not null,
  check (end_time > start_time)
);
create index lessons_schedule_idx on lessons(schedule_id, position);
create table settings (
  school_id uuid primary key references schools(id) on delete cascade,
  timezone text not null default 'Europe/Budapest',
  theme text not null default 'dark' check (theme in ('dark','light')),
  sound_enabled boolean not null default false,
  logo_url text
);
create table closed_days (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  day date not null,
  reason text not null,
  unique (school_id, day)
);

-- RLS: olvasni bárki (kijelző), írni csak az iskola adminja.
create function is_school_admin(sid uuid) returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from school_members where user_id = auth.uid() and school_id = sid) $$;

alter table schools enable row level security;
alter table school_members enable row level security;
alter table schedules enable row level security;
alter table lessons enable row level security;
alter table settings enable row level security;
alter table closed_days enable row level security;

create policy read_all on schools for select using (true);
create policy admin_write on schools for all using (is_school_admin(id)) with check (is_school_admin(id));
create policy own_membership on school_members for select using (user_id = auth.uid());
create policy read_all on schedules for select using (true);
create policy admin_write on schedules for all using (is_school_admin(school_id)) with check (is_school_admin(school_id));
create policy read_all on lessons for select using (true);
create policy admin_write on lessons for all
  using (is_school_admin((select school_id from schedules s where s.id = schedule_id)))
  with check (is_school_admin((select school_id from schedules s where s.id = schedule_id)));
create policy read_all on settings for select using (true);
create policy admin_write on settings for all using (is_school_admin(school_id)) with check (is_school_admin(school_id));
create policy read_all on closed_days for select using (true);
create policy admin_write on closed_days for all using (is_school_admin(school_id)) with check (is_school_admin(school_id));

-- Kezdő adatok
with s as (insert into schools(name, slug) values ('Minta Iskola','demo') returning id),
st as (insert into settings(school_id) select id from s),
sc as (insert into schedules(school_id, name, is_default) select id, 'Normál nap', true from s returning id),
cd as (insert into closed_days(school_id, day, reason) select id, d, r from s,
  (values ('2026-10-23'::date,'Ünnepnap'),('2026-11-02','Tanítás nélküli munkanap')) v(d,r))
insert into lessons(schedule_id, label, start_time, end_time, position)
select sc.id, v.n || '. óra', v.a::time, v.b::time, v.n from sc, (values
 (1,'08:00','08:45'),(2,'08:55','09:40'),(3,'09:50','10:35'),(4,'10:45','11:30'),
 (5,'11:40','12:25'),(6,'12:35','13:20'),(7,'13:30','14:15'),(8,'14:25','15:10')) v(n,a,b);
