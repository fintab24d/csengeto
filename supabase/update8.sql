-- QR-kód a TV-nézeten (/display) – az adminban ki-be kapcsolható. Futtasd az update7.sql után.
alter table settings add column if not exists tv_show_qr boolean not null default true;
