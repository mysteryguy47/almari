-- Vehicles (19 Nov 2026): a family's car, scooter or tractor is now a record of its
-- own, with its RC, insurance, PUC and service bills filed under it.
--
-- Only the list of record kinds changes. Like every record, a vehicle reaches the
-- server locked; the server sees its kind and nothing else.
--
-- Until this runs, the app keeps vehicles on the device and syncs everything else.

alter table public.records drop constraint if exists records_kind_check;
alter table public.records add constraint records_kind_check check (
  kind in ('family', 'member', 'document', 'login', 'bank', 'card', 'note', 'vehicle', 'task', 'contact', 'activity', 'prefs')
);
