-- Közlemények (TV-n és a főoldalon). Futtasd az update2.sql után.
create table if not exists announcements (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  text text not null,
  active_until date,                       -- üres = amíg nem törlöd
  created_at timestamptz not null default now()
);
create index if not exists announcements_school_idx on announcements(school_id);
alter table announcements enable row level security;
drop policy if exists read_all on announcements;
create policy read_all on announcements for select using (true);
drop policy if exists admin_write on announcements;
create policy admin_write on announcements for all using (is_school_admin(school_id)) with check (is_school_admin(school_id));
insert into announcements (school_id, text)
select id, 'Ez egy példa közlemény. Az /admin oldalon szerkesztheted vagy törölheted.' from schools
where slug = 'demo' and not exists (select 1 from announcements);
