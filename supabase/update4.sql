-- Oldal verziója (az /admin oldalon szerkeszthető, a főoldal alján jelenik meg). Futtasd az update3.sql után.
alter table settings
  add column if not exists site_version text not null default '1.0.0',
  add column if not exists version_note text not null default '';
