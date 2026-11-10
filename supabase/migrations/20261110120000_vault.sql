-- Almari: the family vault's server side.
--
-- The server stores and relays locked boxes. It never holds a key, so it can
-- never read what a family keeps. See docs/BACKEND.md for the design.
--
-- Conventions
-- * Every table has row-level security on. Clients read through RLS and write
--   only through the security-definer functions below, which check membership
--   and keep the rules in one place.
-- * Functions use an empty search_path and fully qualified names.

-- ---------------------------------------------------------------- tables

create table public.user_vaults (
  user_id uuid primary key references auth.users (id) on delete cascade,
  current_version int not null default 1 check (current_version >= 1),
  keyring_box text not null check (length(keyring_box) <= 20000),
  recovery_box text check (length(recovery_box) <= 20000),
  kit_created_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_keys (
  user_id uuid not null references auth.users (id) on delete cascade,
  version int not null check (version >= 1),
  public_key text not null check (length(public_key) between 40 and 64),
  created_at timestamptz not null default now(),
  primary key (user_id, version)
);

create table public.families (
  id uuid primary key,
  key_version int not null default 1,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.family_members (
  family_id uuid not null references public.families (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  member_id text not null check (length(member_id) between 1 and 100),
  joined_at timestamptz not null default now(),
  primary key (family_id, user_id),
  unique (family_id, member_id)
);
create index family_members_user on public.family_members (user_id);

create table public.family_keys (
  family_id uuid not null references public.families (id) on delete cascade,
  key_version int not null default 1,
  user_id uuid not null references auth.users (id) on delete cascade,
  user_key_version int not null,
  box text not null check (length(box) <= 1000),
  sealed_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (family_id, key_version, user_id, user_key_version)
);
create index family_keys_user on public.family_keys (user_id);

create sequence public.records_seq;

create table public.records (
  family_id uuid not null references public.families (id) on delete cascade,
  id text not null check (length(id) between 1 and 100),
  kind text not null check (kind in ('family', 'member', 'document', 'login', 'bank', 'card', 'note', 'task', 'contact', 'activity', 'prefs')),
  visible_to uuid references auth.users (id) on delete cascade,
  key_ref text check (length(key_ref) <= 100),
  key_box text check (length(key_box) <= 1000),
  data_box text check (length(data_box) <= 400000),
  purged boolean not null default false,
  seq bigint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  primary key (family_id, id),
  check (purged or (key_ref is not null and key_box is not null and data_box is not null))
);
create index records_family_seq on public.records (family_id, seq);

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  email text not null check (email = lower(email) and length(email) <= 320),
  member_id text not null check (length(member_id) between 1 and 100),
  box text not null check (length(box) <= 4000),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 days',
  requested_by uuid references auth.users (id) on delete set null,
  requested_key_version int,
  requested_at timestamptz,
  accepted_by uuid references auth.users (id) on delete set null,
  accepted_at timestamptz,
  revoked_at timestamptz
);
create index invites_email on public.invites (email);
create index invites_family on public.invites (family_id);

create table public.devices (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (length(name) between 1 and 80),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid references auth.users (id) on delete set null
);
create index devices_user on public.devices (user_id);

create table public.device_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  device_id uuid not null,
  device_name text not null check (length(device_name) between 1 and 80),
  public_key text not null check (length(public_key) between 40 and 64),
  next_version int not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 minutes',
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined', 'done')),
  mode text check (mode in ('own', 'family')),
  approved_by uuid references auth.users (id) on delete set null,
  keyring_box text check (length(keyring_box) <= 20000)
);
create index device_requests_user on public.device_requests (user_id);

create table public.removal_requests (
  family_id uuid not null references public.families (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  requested_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (family_id, user_id)
);

-- Failed password sign-ins, by a hash of the email. Read and written only
-- through the functions below.
create table public.sign_in_failures (
  email_hash text primary key,
  failures int not null default 0,
  paused_until timestamptz,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- helpers

create function public.is_family_member(p_family_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.family_members m
    where m.family_id = p_family_id and m.user_id = auth.uid()
  );
$$;

create function public.shares_family(p_user_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select p_user_id = auth.uid() or exists (
    select 1
    from public.family_members a
    join public.family_members b on a.family_id = b.family_id
    where a.user_id = auth.uid() and b.user_id = p_user_id
  );
$$;

create function public.my_email()
returns text
language sql stable security definer set search_path = ''
as $$
  select lower(u.email) from auth.users u where u.id = auth.uid();
$$;

create function public.my_current_version()
returns int
language sql stable security definer set search_path = ''
as $$
  select v.current_version from public.user_vaults v where v.user_id = auth.uid();
$$;

create function public.email_hash(p_email text)
returns text
language sql immutable set search_path = ''
as $$
  select encode(sha256(convert_to(lower(trim(p_email)), 'UTF8')), 'hex');
$$;

-- For storage policies: is the first folder of an object's name a family the caller belongs to?
create function public.can_use_family_object(p_name text)
returns boolean
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_family uuid;
begin
  begin
    v_family := split_part(p_name, '/', 1)::uuid;
  exception when others then
    return false;
  end;
  return exists (select 1 from public.family_members m where m.family_id = v_family and m.user_id = auth.uid());
end;
$$;

create function public.require_user()
returns uuid
language plpgsql stable set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in first' using errcode = '28000';
  end if;
  return auth.uid();
end;
$$;

create function public.require_member(p_family_id uuid)
returns uuid
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_me uuid := public.require_user();
begin
  if not exists (select 1 from public.family_members m where m.family_id = p_family_id and m.user_id = v_me) then
    raise exception 'You are not in this family' using errcode = '42501';
  end if;
  return v_me;
end;
$$;

create function public.touch_updated_at()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger user_vaults_updated before update on public.user_vaults
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------- the account's keys

create function public.init_vault(p_public_key text, p_keyring_box text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_me uuid := public.require_user();
begin
  if exists (select 1 from public.user_vaults where user_id = v_me) then
    raise exception 'This account already has keys' using errcode = '23505';
  end if;
  insert into public.user_vaults (user_id, current_version, keyring_box) values (v_me, 1, p_keyring_box);
  insert into public.user_keys (user_id, version, public_key) values (v_me, 1, p_public_key);
end;
$$;

-- ---------------------------------------------------------------- families

create function public.create_family(p_family_id uuid, p_member_id text, p_key_box text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_me uuid := public.require_user();
  v_version int := public.my_current_version();
begin
  if v_version is null then
    raise exception 'Set up this device first' using errcode = '22023';
  end if;
  if (select count(*) from public.family_members where user_id = v_me) >= 3 then
    raise exception 'You can be in up to 3 families. Leave one to start another.' using errcode = '22023';
  end if;
  insert into public.families (id, created_by) values (p_family_id, v_me);
  insert into public.family_members (family_id, user_id, member_id) values (p_family_id, v_me, p_member_id);
  insert into public.family_keys (family_id, key_version, user_id, user_key_version, box, sealed_by)
    values (p_family_id, 1, v_me, v_version, p_key_box, v_me);
end;
$$;

-- Removes the caller (or a removed member) from a family: membership, keys,
-- pending requests and records only they could read. A family with nobody
-- left is deleted with all its records.
create function public.drop_membership(p_family_id uuid, p_user_id uuid)
returns boolean
language plpgsql security definer set search_path = ''
as $$
begin
  delete from public.family_members where family_id = p_family_id and user_id = p_user_id;
  delete from public.family_keys where family_id = p_family_id and user_id = p_user_id;
  delete from public.removal_requests where family_id = p_family_id and (user_id = p_user_id or requested_by = p_user_id);
  delete from public.records where family_id = p_family_id and visible_to = p_user_id;
  if not exists (select 1 from public.family_members where family_id = p_family_id) then
    delete from public.families where id = p_family_id;
    return true;
  end if;
  return false;
end;
$$;

create function public.leave_family(p_family_id uuid)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_me uuid := public.require_member(p_family_id);
begin
  return public.drop_membership(p_family_id, v_me);
end;
$$;

create function public.request_removal(p_family_id uuid, p_user_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_me uuid := public.require_member(p_family_id);
begin
  if p_user_id = v_me then
    raise exception 'To remove yourself, leave the family' using errcode = '22023';
  end if;
  if not exists (select 1 from public.family_members where family_id = p_family_id and user_id = p_user_id) then
    raise exception 'This person is not in the family' using errcode = '22023';
  end if;
  insert into public.removal_requests (family_id, user_id, requested_by) values (p_family_id, p_user_id, v_me)
    on conflict (family_id, user_id) do nothing;
end;
$$;

create function public.approve_removal(p_family_id uuid, p_user_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_me uuid := public.require_member(p_family_id);
  v_request public.removal_requests%rowtype;
begin
  select * into v_request from public.removal_requests where family_id = p_family_id and user_id = p_user_id;
  if not found then
    raise exception 'Nobody asked to remove this person' using errcode = '22023';
  end if;
  if v_request.requested_by = v_me or p_user_id = v_me then
    raise exception 'A second member, not the one who asked, must approve' using errcode = '42501';
  end if;
  perform public.drop_membership(p_family_id, p_user_id);
end;
$$;

create function public.cancel_removal(p_family_id uuid, p_user_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.require_member(p_family_id);
  delete from public.removal_requests where family_id = p_family_id and user_id = p_user_id;
end;
$$;

-- ---------------------------------------------------------------- records

create function public.push_records(p_family_id uuid, p_rows jsonb)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_me uuid := public.require_member(p_family_id);
  v_row jsonb;
  v_cur public.records%rowtype;
  v_exists boolean;
  v_out jsonb := '[]'::jsonb;
  v_id text;
  v_kind text;
  v_base bigint;
  v_purge boolean;
  v_visible uuid;
  v_seq bigint;
  v_activity boolean := false;
begin
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 or jsonb_array_length(p_rows) > 200 then
    raise exception 'Send between 1 and 200 records at a time' using errcode = '22023';
  end if;
  -- One writer per family at a time, so sequence numbers follow commit order within a family.
  perform pg_advisory_xact_lock(hashtextextended(p_family_id::text, 7));

  for v_row in select value from jsonb_array_elements(p_rows) loop
    v_id := v_row ->> 'id';
    v_kind := v_row ->> 'kind';
    v_base := (v_row ->> 'base_seq')::bigint;
    v_purge := coalesce((v_row ->> 'purge')::boolean, false);
    v_visible := nullif(v_row ->> 'visible_to', '')::uuid;
    if v_id is null or length(v_id) = 0 or length(v_id) > 100 then
      raise exception 'A record id is missing or too long' using errcode = '22023';
    end if;

    select * into v_cur from public.records r where r.family_id = p_family_id and r.id = v_id for update;
    v_exists := found;

    if v_exists then
      if v_cur.visible_to is not null and v_cur.visible_to <> v_me then
        v_out := v_out || jsonb_build_array(jsonb_build_object('id', v_id, 'status', 'forbidden'));
        continue;
      end if;
      if v_cur.purged or v_base is distinct from v_cur.seq then
        v_out := v_out || jsonb_build_array(jsonb_build_object('id', v_id, 'status', 'conflict', 'current', jsonb_build_object(
          'id', v_cur.id, 'kind', v_cur.kind, 'visible', true, 'key_ref', v_cur.key_ref, 'key_box', v_cur.key_box,
          'data_box', v_cur.data_box, 'purged', v_cur.purged, 'seq', v_cur.seq,
          'updated_at', v_cur.updated_at, 'updated_by', v_cur.updated_by)));
        continue;
      end if;
    elsif v_base is not null then
      -- The device saw this record, but it is gone (its only reader left the family).
      v_out := v_out || jsonb_build_array(jsonb_build_object('id', v_id, 'status', 'gone'));
      continue;
    end if;

    v_seq := nextval('public.records_seq');

    if v_purge then
      if not v_exists then
        v_out := v_out || jsonb_build_array(jsonb_build_object('id', v_id, 'status', 'gone'));
        continue;
      end if;
      update public.records r
        set purged = true, visible_to = null, key_ref = null, key_box = null, data_box = null,
            seq = v_seq, updated_at = now(), updated_by = v_me
        where r.family_id = p_family_id and r.id = v_id;
    else
      if v_exists and v_kind is distinct from v_cur.kind then
        raise exception 'A record cannot change its kind' using errcode = '22023';
      end if;
      if v_visible is not null and not exists (
        select 1 from public.family_members m where m.family_id = p_family_id and m.user_id = v_visible
      ) then
        raise exception 'A private record must belong to someone in the family' using errcode = '22023';
      end if;
      if v_exists then
        update public.records r
          set visible_to = v_visible, key_ref = v_row ->> 'key_ref', key_box = v_row ->> 'key_box',
              data_box = v_row ->> 'data_box', seq = v_seq, updated_at = now(), updated_by = v_me
          where r.family_id = p_family_id and r.id = v_id;
      else
        insert into public.records (family_id, id, kind, visible_to, key_ref, key_box, data_box, seq, updated_by)
          values (p_family_id, v_id, v_kind, v_visible, v_row ->> 'key_ref', v_row ->> 'key_box', v_row ->> 'data_box', v_seq, v_me);
        if v_kind = 'activity' then
          v_activity := true;
        end if;
      end if;
    end if;

    v_out := v_out || jsonb_build_array(jsonb_build_object('id', v_id, 'status', 'ok', 'seq', v_seq));
  end loop;

  -- The activity list keeps the latest 500 entries per family.
  if v_activity then
    delete from public.records r
      where r.family_id = p_family_id and r.kind = 'activity' and r.seq <= (
        select a.seq from public.records a
        where a.family_id = p_family_id and a.kind = 'activity'
        order by a.seq desc offset 500 limit 1
      );
  end if;

  return v_out;
end;
$$;

-- Everything that changed in a family after a cursor. Records the caller may
-- not read come back as hidden stubs, so their device can drop them.
create function public.pull_records(p_family_id uuid, p_since bigint, p_limit int default 500)
returns table (
  id text, kind text, visible boolean, key_ref text, key_box text, data_box text,
  purged boolean, seq bigint, updated_at timestamptz, updated_by uuid
)
language sql stable security definer set search_path = ''
as $$
  select r.id, r.kind, v.visible,
    case when v.visible then r.key_ref end,
    case when v.visible then r.key_box end,
    case when v.visible then r.data_box end,
    r.purged, r.seq, r.updated_at, r.updated_by
  from public.records r
  cross join lateral (select (r.visible_to is null or r.visible_to = auth.uid()) as visible) v
  where r.family_id = p_family_id
    and public.is_family_member(p_family_id)
    and r.seq > p_since
  order by r.seq
  limit least(greatest(p_limit, 1), 1000);
$$;

-- ---------------------------------------------------------------- invites

create function public.revoke_invite(p_invite_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_family uuid;
begin
  select family_id into v_family from public.invites where id = p_invite_id;
  if v_family is null then
    raise exception 'This invite no longer exists' using errcode = '22023';
  end if;
  perform public.require_member(v_family);
  update public.invites set revoked_at = now() where id = p_invite_id and accepted_at is null;
end;
$$;

-- Checks an invite for the signed-in person and returns it, or raises a plain-language error.
create function public.check_invite_for_me(p_invite_id uuid)
returns public.invites
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_me uuid := public.require_user();
  v_invite public.invites%rowtype;
  v_confirmed timestamptz;
begin
  select * into v_invite from public.invites where id = p_invite_id;
  if not found or v_invite.revoked_at is not null then
    raise exception 'This invite was cancelled. Ask for a new one.' using errcode = '22023';
  end if;
  if v_invite.accepted_at is not null then
    raise exception 'This invite has already been used' using errcode = '22023';
  end if;
  if v_invite.expires_at < now() then
    raise exception 'This invite has expired. Ask for a new one.' using errcode = '22023';
  end if;
  select u.email_confirmed_at into v_confirmed from auth.users u where u.id = v_me;
  if v_invite.email <> public.my_email() then
    raise exception 'This invite is for %. Sign in with that email.', v_invite.email using errcode = '42501';
  end if;
  if v_confirmed is null then
    raise exception 'Confirm your email first' using errcode = '42501';
  end if;
  if exists (select 1 from public.family_members m where m.family_id = v_invite.family_id and m.user_id = v_me) then
    raise exception 'You are already in this family' using errcode = '23505';
  end if;
  if (select count(*) from public.family_members m where m.user_id = v_me) >= 3 then
    raise exception 'You can be in up to 3 families. Leave one to join another.' using errcode = '22023';
  end if;
  return v_invite;
end;
$$;

-- Joining with the link: the app opened the invite with the secret from the link
-- and seals the family key to its own public key.
create function public.accept_invite(p_invite_id uuid, p_key_box text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_me uuid := public.require_user();
  v_invite public.invites%rowtype := public.check_invite_for_me(p_invite_id);
  v_version int := public.my_current_version();
begin
  if v_version is null then
    raise exception 'Set up this device first' using errcode = '22023';
  end if;
  insert into public.family_members (family_id, user_id, member_id) values (v_invite.family_id, v_me, v_invite.member_id);
  insert into public.family_keys (family_id, key_version, user_id, user_key_version, box, sealed_by)
    select v_invite.family_id, f.key_version, v_me, v_version, p_key_box, v_me from public.families f where f.id = v_invite.family_id;
  update public.invites set accepted_by = v_me, accepted_at = now() where id = p_invite_id;
  return jsonb_build_object('family_id', v_invite.family_id, 'member_id', v_invite.member_id);
end;
$$;

-- Joining without the link: ask, and any family member's app completes it.
create function public.request_join(p_invite_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_me uuid := public.require_user();
  v_invite public.invites%rowtype := public.check_invite_for_me(p_invite_id);
  v_version int := public.my_current_version();
begin
  if v_version is null then
    raise exception 'Set up this device first' using errcode = '22023';
  end if;
  update public.invites
    set requested_by = v_me, requested_key_version = v_version, requested_at = now()
    where id = v_invite.id;
end;
$$;

create function public.pending_joins(p_family_id uuid)
returns table (invite_id uuid, email text, member_id text, user_id uuid, user_key_version int, public_key text)
language sql stable security definer set search_path = ''
as $$
  select i.id, i.email, i.member_id, i.requested_by, i.requested_key_version, k.public_key
  from public.invites i
  join public.user_keys k on k.user_id = i.requested_by and k.version = i.requested_key_version
  where i.family_id = p_family_id
    and public.is_family_member(p_family_id)
    and i.requested_by is not null
    and i.accepted_at is null and i.revoked_at is null and i.expires_at > now()
    and not exists (select 1 from public.family_members m where m.family_id = i.family_id and m.user_id = i.requested_by);
$$;

create function public.complete_join(p_invite_id uuid, p_key_box text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_me uuid;
  v_invite public.invites%rowtype;
begin
  select * into v_invite from public.invites where id = p_invite_id;
  if not found then
    raise exception 'This invite no longer exists' using errcode = '22023';
  end if;
  v_me := public.require_member(v_invite.family_id);
  if v_invite.requested_by is null or v_invite.accepted_at is not null or v_invite.revoked_at is not null or v_invite.expires_at < now() then
    raise exception 'This invite is not waiting to be completed' using errcode = '22023';
  end if;
  if (select count(*) from public.family_members m where m.user_id = v_invite.requested_by) >= 3 then
    raise exception 'They are already in 3 families' using errcode = '22023';
  end if;
  insert into public.family_members (family_id, user_id, member_id)
    values (v_invite.family_id, v_invite.requested_by, v_invite.member_id);
  insert into public.family_keys (family_id, key_version, user_id, user_key_version, box, sealed_by)
    select v_invite.family_id, f.key_version, v_invite.requested_by, v_invite.requested_key_version, p_key_box, v_me
    from public.families f where f.id = v_invite.family_id;
  update public.invites set accepted_by = v_invite.requested_by, accepted_at = now() where id = p_invite_id;
end;
$$;

-- ---------------------------------------------------------------- devices

create function public.touch_device(p_device_id uuid, p_name text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_me uuid := public.require_user();
  v_device public.devices%rowtype;
begin
  select * into v_device from public.devices where id = p_device_id;
  if found and v_device.user_id <> v_me then
    raise exception 'This device belongs to another account' using errcode = '42501';
  end if;
  if not found then
    insert into public.devices (id, user_id, name) values (p_device_id, v_me, left(p_name, 80));
    return jsonb_build_object('revoked', false);
  end if;
  update public.devices set last_seen_at = now(), name = left(p_name, 80) where id = p_device_id;
  return jsonb_build_object('revoked', v_device.revoked_at is not null);
end;
$$;

create function public.revoke_device(p_device_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_me uuid := public.require_user();
  v_owner uuid;
begin
  select user_id into v_owner from public.devices where id = p_device_id;
  if v_owner is null or not public.shares_family(v_owner) then
    raise exception 'You cannot remove this device' using errcode = '42501';
  end if;
  update public.devices set revoked_at = now(), revoked_by = v_me where id = p_device_id and revoked_at is null;
end;
$$;

-- A new device asks to be let in. It sends the public key of the key version it
-- would use if a family member approves; an own device seals the keyring to it.
create function public.create_device_request(p_device_id uuid, p_device_name text, p_public_key text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_me uuid := public.require_user();
  v_version int := public.my_current_version();
  v_id uuid;
begin
  if v_version is null then
    raise exception 'This account has no keys yet' using errcode = '22023';
  end if;
  update public.device_requests set status = 'declined'
    where user_id = v_me and device_id = p_device_id and status = 'pending';
  insert into public.device_requests (user_id, device_id, device_name, public_key, next_version)
    values (v_me, p_device_id, left(p_device_name, 80), p_public_key, v_version + 1)
    returning id into v_id;
  return v_id;
end;
$$;

create function public.approve_device_request_own(p_request_id uuid, p_keyring_box text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_me uuid := public.require_user();
begin
  update public.device_requests
    set status = 'approved', mode = 'own', approved_by = v_me, keyring_box = p_keyring_box
    where id = p_request_id and user_id = v_me and status = 'pending' and expires_at > now();
  if not found then
    raise exception 'This request has expired or was already answered' using errcode = '22023';
  end if;
end;
$$;

-- p_boxes: [{ "family_id": uuid, "key_version": int, "box": text }], each family key sealed to the request's public key.
create function public.approve_device_request_family(p_request_id uuid, p_boxes jsonb)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_me uuid := public.require_user();
  v_request public.device_requests%rowtype;
  v_box jsonb;
  v_family uuid;
  v_count int := 0;
begin
  select * into v_request from public.device_requests where id = p_request_id for update;
  if not found or v_request.status <> 'pending' or v_request.expires_at < now() then
    raise exception 'This request has expired or was already answered' using errcode = '22023';
  end if;
  if v_request.user_id = v_me then
    raise exception 'Approve from your own other device, or ask someone in the family' using errcode = '42501';
  end if;
  for v_box in select value from jsonb_array_elements(p_boxes) loop
    v_family := (v_box ->> 'family_id')::uuid;
    if exists (select 1 from public.family_members m where m.family_id = v_family and m.user_id = v_me)
       and exists (select 1 from public.family_members m where m.family_id = v_family and m.user_id = v_request.user_id) then
      insert into public.family_keys (family_id, key_version, user_id, user_key_version, box, sealed_by)
        values (v_family, (v_box ->> 'key_version')::int, v_request.user_id, v_request.next_version, v_box ->> 'box', v_me)
        on conflict (family_id, key_version, user_id, user_key_version) do update set box = excluded.box, sealed_by = excluded.sealed_by;
      v_count := v_count + 1;
    end if;
  end loop;
  if v_count = 0 then
    raise exception 'You do not share a family with this person' using errcode = '42501';
  end if;
  update public.device_requests set status = 'approved', mode = 'family', approved_by = v_me where id = p_request_id;
end;
$$;

create function public.decline_device_request(p_request_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_owner uuid;
begin
  perform public.require_user();
  select user_id into v_owner from public.device_requests where id = p_request_id;
  if v_owner is null or not public.shares_family(v_owner) then
    raise exception 'You cannot answer this request' using errcode = '42501';
  end if;
  update public.device_requests set status = 'declined' where id = p_request_id and status = 'pending';
end;
$$;

-- The new device, after an own-device approval, marks the request used.
create function public.finish_own_approval(p_request_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  update public.device_requests set status = 'done', keyring_box = null
    where id = p_request_id and user_id = public.require_user() and status = 'approved' and mode = 'own';
  if not found then
    raise exception 'This request is not approved' using errcode = '22023';
  end if;
end;
$$;

-- The new device, after a family approval: its new key version becomes the
-- account's, and the account's other devices are signed out.
create function public.finish_family_recovery(p_request_id uuid, p_keyring_box text)
returns int
language plpgsql security definer set search_path = ''
as $$
declare
  v_me uuid := public.require_user();
  v_request public.device_requests%rowtype;
begin
  select * into v_request from public.device_requests
    where id = p_request_id and user_id = v_me and status = 'approved' and mode = 'family' for update;
  if not found then
    raise exception 'This request is not approved by the family' using errcode = '22023';
  end if;
  if v_request.next_version <> public.my_current_version() + 1 then
    raise exception 'Your keys changed since this request. Ask again.' using errcode = '22023';
  end if;
  insert into public.user_keys (user_id, version, public_key) values (v_me, v_request.next_version, v_request.public_key);
  update public.user_vaults set current_version = v_request.next_version, keyring_box = p_keyring_box where user_id = v_me;
  update public.devices set revoked_at = now(), revoked_by = v_me
    where user_id = v_me and id <> v_request.device_id and revoked_at is null;
  update public.device_requests set status = 'done' where id = p_request_id;
  return v_request.next_version;
end;
$$;

-- Starting fresh, for someone with no other device, no Recovery Kit and no
-- family member who could let them back in. Only allowed when no family they
-- are in has another member; the app deletes those families' files first.
create function public.reset_vault(p_public_key text, p_keyring_box text)
returns int
language plpgsql security definer set search_path = ''
as $$
declare
  v_me uuid := public.require_user();
  v_next int := coalesce(public.my_current_version(), 0) + 1;
  v_family uuid;
begin
  if exists (
    select 1 from public.family_members a
    join public.family_members b on a.family_id = b.family_id and b.user_id <> a.user_id
    where a.user_id = v_me
  ) then
    raise exception 'Someone in your family can let you back in. Ask them to approve this device.' using errcode = '42501';
  end if;
  for v_family in select family_id from public.family_members where user_id = v_me loop
    perform public.drop_membership(v_family, v_me);
  end loop;
  insert into public.user_keys (user_id, version, public_key) values (v_me, v_next, p_public_key);
  insert into public.user_vaults (user_id, current_version, keyring_box) values (v_me, v_next, p_keyring_box)
    on conflict (user_id) do update set current_version = excluded.current_version, keyring_box = excluded.keyring_box,
      recovery_box = null, kit_created_at = null;
  update public.devices set revoked_at = now(), revoked_by = v_me where user_id = v_me and revoked_at is null;
  return v_next;
end;
$$;

-- ---------------------------------------------------------------- password sign-in pause

create function public.sign_in_status(p_email text)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(
    (select jsonb_build_object('failures', f.failures, 'paused_until', f.paused_until)
       from public.sign_in_failures f
       where f.email_hash = public.email_hash(p_email) and (f.paused_until is null or f.paused_until > now() or f.failures > 0)),
    jsonb_build_object('failures', 0, 'paused_until', null)
  );
$$;

create function public.note_sign_in_failure(p_email text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_hash text := public.email_hash(p_email);
  v_row public.sign_in_failures%rowtype;
begin
  select * into v_row from public.sign_in_failures where email_hash = v_hash for update;
  if found and v_row.paused_until is not null and v_row.paused_until > now() then
    return jsonb_build_object('failures', 0, 'paused_until', v_row.paused_until);
  end if;
  if not found then
    insert into public.sign_in_failures (email_hash, failures) values (v_hash, 1) returning * into v_row;
  else
    update public.sign_in_failures
      set failures = case when v_row.paused_until is not null then 1 else v_row.failures + 1 end,
          paused_until = null, updated_at = now()
      where email_hash = v_hash returning * into v_row;
  end if;
  if v_row.failures >= 5 then
    update public.sign_in_failures set failures = 0, paused_until = now() + interval '30 minutes', updated_at = now()
      where email_hash = v_hash returning * into v_row;
  end if;
  delete from public.sign_in_failures where updated_at < now() - interval '1 day' and (paused_until is null or paused_until < now());
  return jsonb_build_object('failures', v_row.failures, 'paused_until', v_row.paused_until);
end;
$$;

create function public.clear_sign_in_failures()
returns void
language sql security definer set search_path = ''
as $$
  delete from public.sign_in_failures where email_hash = public.email_hash(public.my_email());
$$;

-- ---------------------------------------------------------------- deleting an account

-- The app first removes the person's personal records and files, then calls this.
create function public.delete_my_account()
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_me uuid := public.require_user();
  v_family uuid;
begin
  for v_family in select family_id from public.family_members where user_id = v_me loop
    perform public.drop_membership(v_family, v_me);
  end loop;
  delete from public.sign_in_failures where email_hash = public.email_hash(public.my_email());
  delete from auth.users where id = v_me;
end;
$$;

-- ---------------------------------------------------------------- row-level security

alter table public.user_vaults enable row level security;
alter table public.user_keys enable row level security;
alter table public.families enable row level security;
alter table public.family_members enable row level security;
alter table public.family_keys enable row level security;
alter table public.records enable row level security;
alter table public.invites enable row level security;
alter table public.devices enable row level security;
alter table public.device_requests enable row level security;
alter table public.removal_requests enable row level security;
alter table public.sign_in_failures enable row level security;

create policy "own vault" on public.user_vaults for select to authenticated using (user_id = (select auth.uid()));
create policy "own vault update" on public.user_vaults for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "keys of family" on public.user_keys for select to authenticated using (public.shares_family(user_id));

create policy "my families" on public.families for select to authenticated using (public.is_family_member(id));

create policy "members of my families" on public.family_members for select to authenticated
  using (public.is_family_member(family_id));

create policy "my family keys" on public.family_keys for select to authenticated using (user_id = (select auth.uid()));

create policy "records I can read" on public.records for select to authenticated
  using (public.is_family_member(family_id) and (visible_to is null or visible_to = (select auth.uid())));

create policy "invites of my families or for me" on public.invites for select to authenticated
  using (public.is_family_member(family_id) or email = public.my_email());
create policy "invite into my family" on public.invites for insert to authenticated
  with check (public.is_family_member(family_id) and created_by = (select auth.uid()));

create policy "devices of my family" on public.devices for select to authenticated using (public.shares_family(user_id));

create policy "device requests of my family" on public.device_requests for select to authenticated
  using (public.shares_family(user_id));

create policy "removals in my families" on public.removal_requests for select to authenticated
  using (public.is_family_member(family_id));

-- No policies on sign_in_failures: only the functions above touch it.

-- ---------------------------------------------------------------- grants

revoke all on public.user_vaults, public.user_keys, public.families, public.family_members, public.family_keys,
  public.records, public.invites, public.devices, public.device_requests, public.removal_requests,
  public.sign_in_failures from anon, authenticated;

grant select on public.user_vaults, public.user_keys, public.families, public.family_members, public.family_keys,
  public.records, public.invites, public.devices, public.device_requests, public.removal_requests to authenticated;
grant update (keyring_box, recovery_box, kit_created_at) on public.user_vaults to authenticated;
grant insert (family_id, email, member_id, box, created_by) on public.invites to authenticated;
revoke all on sequence public.records_seq from anon, authenticated;

do $$
declare
  f text;
begin
  -- Helpers and functions: nobody but signed-in people, and only those meant for them.
  foreach f in array array[
    'is_family_member(uuid)', 'shares_family(uuid)', 'my_email()', 'my_current_version()', 'email_hash(text)',
    'can_use_family_object(text)', 'require_user()', 'require_member(uuid)', 'touch_updated_at()', 'drop_membership(uuid, uuid)',
    'check_invite_for_me(uuid)',
    'init_vault(text, text)', 'create_family(uuid, text, text)', 'leave_family(uuid)', 'request_removal(uuid, uuid)',
    'approve_removal(uuid, uuid)', 'cancel_removal(uuid, uuid)', 'push_records(uuid, jsonb)', 'pull_records(uuid, bigint, int)',
    'revoke_invite(uuid)', 'accept_invite(uuid, text)', 'request_join(uuid)', 'pending_joins(uuid)', 'complete_join(uuid, text)',
    'touch_device(uuid, text)', 'revoke_device(uuid)', 'create_device_request(uuid, text, text)',
    'approve_device_request_own(uuid, text)', 'approve_device_request_family(uuid, jsonb)', 'decline_device_request(uuid)',
    'finish_own_approval(uuid)', 'finish_family_recovery(uuid, text)', 'reset_vault(text, text)',
    'sign_in_status(text)', 'note_sign_in_failure(text)', 'clear_sign_in_failures()', 'delete_my_account()'
  ] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
  end loop;

  -- Used inside RLS policies and storage policies, so signed-in people must be able to run them.
  foreach f in array array[
    'is_family_member(uuid)', 'shares_family(uuid)', 'my_email()', 'can_use_family_object(text)',
    'init_vault(text, text)', 'create_family(uuid, text, text)', 'leave_family(uuid)', 'request_removal(uuid, uuid)',
    'approve_removal(uuid, uuid)', 'cancel_removal(uuid, uuid)', 'push_records(uuid, jsonb)', 'pull_records(uuid, bigint, int)',
    'revoke_invite(uuid)', 'accept_invite(uuid, text)', 'request_join(uuid)', 'pending_joins(uuid)', 'complete_join(uuid, text)',
    'touch_device(uuid, text)', 'revoke_device(uuid)', 'create_device_request(uuid, text, text)',
    'approve_device_request_own(uuid, text)', 'approve_device_request_family(uuid, jsonb)', 'decline_device_request(uuid)',
    'finish_own_approval(uuid)', 'finish_family_recovery(uuid, text)', 'reset_vault(text, text)',
    'clear_sign_in_failures()', 'delete_my_account()'
  ] loop
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;

  -- Checked before signing in.
  foreach f in array array['sign_in_status(text)', 'note_sign_in_failure(text)'] loop
    execute format('grant execute on function public.%s to anon, authenticated', f);
  end loop;
end;
$$;

-- ---------------------------------------------------------------- files

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('family-files', 'family-files', false, 12582912, array['application/octet-stream'])
on conflict (id) do nothing;

create policy "family files: read" on storage.objects for select to authenticated
  using (bucket_id = 'family-files' and public.can_use_family_object(name));
create policy "family files: add" on storage.objects for insert to authenticated
  with check (bucket_id = 'family-files' and public.can_use_family_object(name));
create policy "family files: replace" on storage.objects for update to authenticated
  using (bucket_id = 'family-files' and public.can_use_family_object(name))
  with check (bucket_id = 'family-files' and public.can_use_family_object(name));
create policy "family files: remove" on storage.objects for delete to authenticated
  using (bucket_id = 'family-files' and public.can_use_family_object(name));

-- ---------------------------------------------------------------- realtime: tell open apps to pull

alter publication supabase_realtime add table public.records, public.family_members, public.invites,
  public.device_requests, public.removal_requests, public.devices;
