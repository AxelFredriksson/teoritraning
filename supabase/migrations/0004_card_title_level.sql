-- Card heading and level (1 Grund, 2 Fördjupning, 3 Avancerat)
alter table cards add column title text, add column level smallint not null default 2 check (level between 1 and 3);
