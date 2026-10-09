-- Fase 4: funciones sociales (amigos, grupos, desafíos compartidos y comparaciones voluntarias).
--
-- Esta migración SOLO AÑADE tablas y funciones nuevas: no modifica ni borra datos existentes.
-- Es idempotente: pegarla dos veces no rompe nada.
--
-- Privacidad:
--   * Nadie ve estadísticas de otra persona salvo que AMBAS tengan activado profiles.share_stats
--     y además sean amigas aceptadas o compartan un grupo.
--   * Solo se exponen agregados (minutos, tareas, hábitos, días activos y objetivo semanal), nunca
--     títulos de tareas, notas ni sesiones individuales.
--   * Los perfiles ajenos solo se leen mediante funciones que devuelven nombre y usuario.
--   * Las escrituras sensibles (solicitudes, unirse a grupos) pasan por funciones SECURITY DEFINER
--     que validan todo; las tablas no aceptan INSERT/UPDATE directos donde no hace falta.

-- ---------------------------------------------------------------------------
-- Amistades
-- ---------------------------------------------------------------------------
create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users (id) on delete cascade,
  addressee_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint friendships_not_self check (requester_id <> addressee_id)
);
create unique index if not exists friendships_pair
  on public.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));
create index if not exists friendships_addressee on public.friendships (addressee_id);

-- ---------------------------------------------------------------------------
-- Grupos
-- ---------------------------------------------------------------------------
create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 60),
  description text check (char_length(description) <= 300),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  invite_code text not null unique default substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)
    check (invite_code ~ '^[a-z0-9]{6,32}$'),
  created_at timestamptz not null default now()
);

create table if not exists public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index if not exists group_members_user on public.group_members (user_id);

create table if not exists public.shared_challenges (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  created_by uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 80),
  metric text not null check (metric in ('focus_minutes', 'tasks_completed', 'habit_completions', 'active_days')),
  target_value integer not null check (target_value between 1 and 100000),
  start_date date not null,
  end_date date not null,
  created_at timestamptz not null default now(),
  constraint shared_challenges_range check (end_date >= start_date and end_date - start_date <= 92)
);
create index if not exists shared_challenges_group on public.shared_challenges (group_id, end_date);

-- ---------------------------------------------------------------------------
-- Ayudantes (SECURITY DEFINER para no recursar en RLS)
-- ---------------------------------------------------------------------------
create or replace function public.is_group_member(p_group uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.group_members m where m.group_id = p_group and m.user_id = auth.uid()
  );
$$;

create or replace function public.is_group_owner(p_group uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.groups g where g.id = p_group and g.owner_id = auth.uid());
$$;

-- ¿Puede auth.uid() ver las estadísticas agregadas de p_user? Es recíproco: solo quien comparte ve a
-- quienes comparten, y solo si son amigos aceptados o están en un mismo grupo.
create or replace function public.can_see_stats(p_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and (
    p_user = auth.uid()
    or (
      exists (select 1 from public.profiles p where p.id = p_user and p.share_stats)
      and exists (select 1 from public.profiles p where p.id = auth.uid() and p.share_stats)
      and (
        exists (
          select 1 from public.friendships f
           where f.status = 'accepted'
             and ((f.requester_id = auth.uid() and f.addressee_id = p_user)
               or (f.addressee_id = auth.uid() and f.requester_id = p_user))
        )
        or exists (
          select 1 from public.group_members a
            join public.group_members b on b.group_id = a.group_id
           where a.user_id = auth.uid() and b.user_id = p_user
        )
      )
    )
  );
$$;

-- El dueño entra automáticamente como miembro al crear el grupo.
create or replace function public.groups_add_owner()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.group_members (group_id, user_id, role) values (new.id, new.owner_id, 'owner')
  on conflict do nothing;
  return new;
end $$;

drop trigger if exists groups_add_owner on public.groups;
create trigger groups_add_owner after insert on public.groups
  for each row execute function public.groups_add_owner();

-- Límite razonable de grupos creados por persona.
create or replace function public.groups_limit()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.groups g where g.owner_id = new.owner_id) >= 20 then
    raise exception 'too many groups' using errcode = '23514';
  end if;
  return new;
end $$;

drop trigger if exists groups_limit on public.groups;
create trigger groups_limit before insert on public.groups
  for each row execute function public.groups_limit();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.friendships enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.shared_challenges enable row level security;

drop policy if exists "friendships: read own" on public.friendships;
create policy "friendships: read own" on public.friendships for select to authenticated
  using ((select auth.uid()) in (requester_id, addressee_id));
drop policy if exists "friendships: delete own" on public.friendships;
create policy "friendships: delete own" on public.friendships for delete to authenticated
  using ((select auth.uid()) in (requester_id, addressee_id));

drop policy if exists "groups: members read" on public.groups;
create policy "groups: members read" on public.groups for select to authenticated
  using (public.is_group_member(id));
drop policy if exists "groups: create own" on public.groups;
create policy "groups: create own" on public.groups for insert to authenticated
  with check (owner_id = (select auth.uid()));
drop policy if exists "groups: owner update" on public.groups;
create policy "groups: owner update" on public.groups for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
drop policy if exists "groups: owner delete" on public.groups;
create policy "groups: owner delete" on public.groups for delete to authenticated
  using (owner_id = (select auth.uid()));

drop policy if exists "group_members: members read" on public.group_members;
create policy "group_members: members read" on public.group_members for select to authenticated
  using (public.is_group_member(group_id));
-- Salir uno mismo (el dueño no puede salir: borra el grupo) o que el dueño expulse a otro.
drop policy if exists "group_members: leave or remove" on public.group_members;
create policy "group_members: leave or remove" on public.group_members for delete to authenticated
  using (
    role <> 'owner'
    and (user_id = (select auth.uid()) or public.is_group_owner(group_id))
  );

drop policy if exists "shared_challenges: members read" on public.shared_challenges;
create policy "shared_challenges: members read" on public.shared_challenges for select to authenticated
  using (public.is_group_member(group_id));
drop policy if exists "shared_challenges: members create" on public.shared_challenges;
create policy "shared_challenges: members create" on public.shared_challenges for insert to authenticated
  with check (created_by = (select auth.uid()) and public.is_group_member(group_id));
drop policy if exists "shared_challenges: creator or owner delete" on public.shared_challenges;
create policy "shared_challenges: creator or owner delete" on public.shared_challenges for delete to authenticated
  using (created_by = (select auth.uid()) or public.is_group_owner(group_id));

grant select, delete on public.friendships to authenticated;
grant select, insert, update, delete on public.groups to authenticated;
grant select, delete on public.group_members to authenticated;
grant select, insert, delete on public.shared_challenges to authenticated;
revoke insert, update on public.friendships from authenticated;
revoke insert, update on public.group_members from authenticated;
revoke update on public.shared_challenges from authenticated;
revoke all on public.friendships, public.groups, public.group_members, public.shared_challenges from anon;

-- ---------------------------------------------------------------------------
-- Funciones (RPC)
-- ---------------------------------------------------------------------------

-- Envía una solicitud de amistad por nombre de usuario. Si la otra persona ya te la había enviado,
-- se acepta. Devuelve 'sent', 'accepted', 'already_friends', 'already_sent', 'not_found' o 'self'.
create or replace function public.send_friend_request(p_username text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := auth.uid();
  v_other uuid;
  v_row public.friendships;
begin
  if v_me is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  select p.id into v_other from public.profiles p where p.username = lower(btrim(p_username));
  if v_other is null then return 'not_found'; end if;
  if v_other = v_me then return 'self'; end if;

  select * into v_row from public.friendships f
   where least(f.requester_id, f.addressee_id) = least(v_me, v_other)
     and greatest(f.requester_id, f.addressee_id) = greatest(v_me, v_other);
  if found then
    if v_row.status = 'accepted' then return 'already_friends'; end if;
    if v_row.requester_id = v_me then return 'already_sent'; end if;
    update public.friendships set status = 'accepted', responded_at = now() where id = v_row.id;
    return 'accepted';
  end if;

  if (select count(*) from public.friendships f where f.requester_id = v_me and f.status = 'pending') >= 50 then
    raise exception 'too many pending requests' using errcode = '23514';
  end if;
  insert into public.friendships (requester_id, addressee_id) values (v_me, v_other);
  return 'sent';
end $$;

-- Acepta (p_accept = true) o rechaza (borra) una solicitud recibida.
create or replace function public.respond_friend_request(p_id uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_accept then
    update public.friendships set status = 'accepted', responded_at = now()
     where id = p_id and addressee_id = auth.uid() and status = 'pending';
  else
    delete from public.friendships where id = p_id and addressee_id = auth.uid() and status = 'pending';
  end if;
  if not found then raise exception 'request not found' using errcode = 'P0002'; end if;
end $$;

-- Amistades y solicitudes de quien llama, con el nombre visible de la otra persona.
create or replace function public.list_friends()
returns table (
  friendship_id uuid,
  user_id uuid,
  display_name text,
  username text,
  status text,
  incoming boolean,
  shares_stats boolean,
  created_at timestamptz
)
language sql stable security definer set search_path = '' as $$
  select f.id,
         p.id,
         p.display_name,
         p.username,
         f.status,
         f.addressee_id = auth.uid(),
         case when f.status = 'accepted' then p.share_stats else false end,
         f.created_at
    from public.friendships f
    join public.profiles p
      on p.id = case when f.requester_id = auth.uid() then f.addressee_id else f.requester_id end
   where auth.uid() in (f.requester_id, f.addressee_id)
   order by f.status, coalesce(p.display_name, p.username);
$$;

-- Crea un grupo y devuelve su id (el trigger añade al dueño como miembro).
create or replace function public.create_group(p_name text, p_description text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  insert into public.groups (name, description, owner_id)
  values (btrim(p_name), nullif(btrim(coalesce(p_description, '')), ''), auth.uid())
  returning id into v_id;
  return v_id;
end $$;

-- Unirse con un código de invitación. Devuelve el id del grupo (o null si el código no existe).
create or replace function public.join_group(p_code text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_group uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  select g.id into v_group from public.groups g where g.invite_code = lower(btrim(p_code));
  if v_group is null then return null; end if;
  if (select count(*) from public.group_members m where m.group_id = v_group) >= 50 then
    raise exception 'group is full' using errcode = '23514';
  end if;
  insert into public.group_members (group_id, user_id) values (v_group, auth.uid()) on conflict do nothing;
  return v_group;
end $$;

-- Genera un código de invitación nuevo (el anterior deja de funcionar). Solo el dueño.
create or replace function public.rotate_group_code(p_group uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare v_code text := substr(replace(gen_random_uuid()::text, '-', ''), 1, 10);
begin
  update public.groups set invite_code = v_code where id = p_group and owner_id = auth.uid();
  if not found then raise exception 'not the owner' using errcode = '42501'; end if;
  return v_code;
end $$;

-- Miembros de un grupo del que formas parte, con nombre visible y si comparten estadísticas.
create or replace function public.group_members_list(p_group uuid)
returns table (user_id uuid, display_name text, username text, role text, shares_stats boolean, joined_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select p.id, p.display_name, p.username, m.role, p.share_stats, m.joined_at
    from public.group_members m
    join public.profiles p on p.id = m.user_id
   where m.group_id = p_group and public.is_group_member(p_group)
   order by m.role desc, m.joined_at;
$$;

-- Estadísticas agregadas de varias personas en un rango de fechas. Cada persona se calcula con SU zona
-- horaria. Solo devuelve filas de quien llama y de quienes comparten estadísticas y son amigos aceptados
-- o comparten grupo con quien llama (ver can_see_stats). Nunca expone filas individuales.
create or replace function public.social_stats(p_user_ids uuid[], p_from date, p_to date)
returns table (
  user_id uuid,
  focus_seconds bigint,
  tasks_completed integer,
  habits_done integer,
  active_days integer,
  weekly_focus_goal_minutes integer
)
language sql stable security definer set search_path = '' as $$
  with v as (
    select p.id, p.timezone as tz, p.weekly_focus_goal_minutes as goal,
           (p_from::timestamp at time zone p.timezone) as t0,
           ((p_to + 1)::timestamp at time zone p.timezone) as t1
      from public.profiles p
     where p.id = any (p_user_ids)
       and cardinality(p_user_ids) <= 100
       and p_to >= p_from and p_to - p_from <= 400
       and public.can_see_stats(p.id)
  ),
  f as (
    select v.id, (s.started_at at time zone v.tz)::date as day, s.focus_seconds
      from v join public.focus_sessions s on s.user_id = v.id
     where s.status = 'completed' and s.kind <> 'break' and s.started_at >= v.t0 and s.started_at < v.t1
  ),
  t as (
    select v.id, (k.completed_at at time zone v.tz)::date as day
      from v join public.tasks k on k.user_id = v.id
     where k.status = 'done' and k.completed_at >= v.t0 and k.completed_at < v.t1
  ),
  h as (
    select v.id, l.log_date as day
      from v join public.habit_logs l on l.user_id = v.id
     where l.status = 'done' and l.log_date between p_from and p_to
  ),
  d as (select id, day from f union select id, day from t union select id, day from h)
  select v.id,
         coalesce((select sum(f.focus_seconds) from f where f.id = v.id), 0)::bigint,
         (select count(*) from t where t.id = v.id)::integer,
         (select count(*) from h where h.id = v.id)::integer,
         (select count(*) from d where d.id = v.id)::integer,
         v.goal
    from v;
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.is_group_member(uuid)', 'public.is_group_owner(uuid)', 'public.can_see_stats(uuid)',
    'public.send_friend_request(text)', 'public.respond_friend_request(uuid, boolean)', 'public.list_friends()',
    'public.create_group(text, text)', 'public.join_group(text)', 'public.rotate_group_code(uuid)',
    'public.group_members_list(uuid)', 'public.social_stats(uuid[], date, date)'
  ]
  loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
  execute 'revoke execute on function public.groups_add_owner() from public, anon, authenticated';
  execute 'revoke execute on function public.groups_limit() from public, anon, authenticated';
end $$;
