-- Időjárás a kijelzőn (Open-Meteo, ingyenes, kulcs nélkül). Futtasd az update6.sql után.
alter table settings
  add column if not exists weather_enabled boolean not null default false,   -- az adminban kell bekapcsolni és várost választani
  add column if not exists weather_city text not null default 'Budapest',
  add column if not exists weather_lat double precision not null default 47.4979,
  add column if not exists weather_lon double precision not null default 19.0402;
