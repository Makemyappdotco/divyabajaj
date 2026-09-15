-- Lets Divya add extra bookable windows beyond the simple one-row-per-weekday
-- grid: either another recurring window on a weekday (e.g. a second Sunday
-- slot), or a one-off window tied to a single calendar date that never
-- repeats. The slot-computation engine already supports multiple rules per
-- day; this only adds what the admin panel needs to store the new kinds.
--
-- kind distinguishes what the simple weekly grid (PUT /hours) is allowed to
-- wipe and replace on every save ('grid') from windows added and removed
-- individually through their own endpoints ('extra'), so saving the grid can
-- never delete an extra window Divya added separately.
--
-- specific_date is null for anything that recurs every week on `weekday`,
-- and set to one exact date for a window that applies once and never repeats.
alter table public.availability_rules
  add column if not exists specific_date date,
  add column if not exists kind text not null default 'grid';

alter table public.availability_rules
  drop constraint if exists availability_rules_kind_check;
alter table public.availability_rules
  add constraint availability_rules_kind_check check (kind in ('grid', 'extra'));

create index if not exists availability_rules_specific_date_idx
  on public.availability_rules (environment, specific_date)
  where specific_date is not null;
