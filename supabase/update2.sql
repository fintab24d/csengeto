-- Visszaszámlálók (szünetek, ünnepek). Futtasd az update.sql után.
create table if not exists countdowns (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  title text not null,
  kind text not null default 'other' check (kind in ('summer','autumn','winter','spring','other')),
  target_date date not null,
  target_time time not null default '00:00',
  created_at timestamptz not null default now()
);
create index if not exists countdowns_school_idx on countdowns(school_id, target_date);
alter table countdowns enable row level security;
drop policy if exists read_all on countdowns;
create policy read_all on countdowns for select using (true);
drop policy if exists admin_write on countdowns;
create policy admin_write on countdowns for all using (is_school_admin(school_id)) with check (is_school_admin(school_id));

-- PÉLDA adatok (az /admin oldalon átírhatók, a valódi tanév rendjét ellenőrizd!)
insert into countdowns (school_id, title, kind, target_date, target_time)
select s.id, v.t, v.k, v.d::date, v.h::time from schools s,
  (values ('Téli szünet','winter','2026-12-18','14:15'),('Tavaszi szünet','spring','2027-03-25','14:15'),('Nyári szünet','summer','2027-06-15','12:00')) v(t,k,d,h)
where s.slug = 'demo' and not exists (select 1 from countdowns);
