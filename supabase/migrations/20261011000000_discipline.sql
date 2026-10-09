-- Escape AVG — sistema de disciplina: rangos diarios, actividades con categoría y calidad, frases favoritas.
-- Migración ADITIVA e IDEMPOTENTE: se puede ejecutar varias veces sin perder ni cambiar datos existentes.

-- ---------------------------------------------------------------------------
-- Objetivo diario (minutos productivos). Por defecto 11 h (Élite — Top 1 %), configurable en Ajustes.
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists daily_goal_minutes integer not null default 660;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_daily_goal_minutes_range') then
    alter table public.profiles add constraint profiles_daily_goal_minutes_range check (daily_goal_minutes between 60 and 960);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Categorías: cada una decide si cuenta como desarrollo personal (el ocio no suma horas).
-- ---------------------------------------------------------------------------
alter table public.categories add column if not exists counts_as_development boolean not null default true;

-- ---------------------------------------------------------------------------
-- Actividades = sesiones de concentración con nombre, categoría propia, calidad y resultados.
--   quality: 1 = solo ocupado (no suma horas productivas), 2 = productiva, 3 = concentración profunda.
-- ---------------------------------------------------------------------------
alter table public.focus_sessions add column if not exists title text;
alter table public.focus_sessions add column if not exists category_id uuid;
alter table public.focus_sessions add column if not exists quality smallint;
alter table public.focus_sessions add column if not exists outcome text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'focus_sessions_title_len') then
    alter table public.focus_sessions add constraint focus_sessions_title_len check (char_length(title) <= 120);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'focus_sessions_quality_range') then
    alter table public.focus_sessions add constraint focus_sessions_quality_range check (quality between 1 and 3);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'focus_sessions_outcome_len') then
    alter table public.focus_sessions add constraint focus_sessions_outcome_len check (char_length(outcome) <= 2000);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'focus_sessions_category_fk') then
    alter table public.focus_sessions add constraint focus_sessions_category_fk
      foreign key (category_id, user_id) references public.categories (id, user_id) on delete set null (category_id);
  end if;
end $$;
create index if not exists focus_sessions_category_idx on public.focus_sessions (category_id) where category_id is not null;

-- Las horas no se cuentan dos veces: un registro manual no puede solaparse con otra actividad.
create or replace function public.focus_sessions_no_overlap()
returns trigger language plpgsql as $$
begin
  if new.kind = 'manual' and exists (
    select 1 from public.focus_sessions s
     where s.user_id = new.user_id
       and s.id <> new.id
       and s.kind <> 'break'
       and s.status in ('completed', 'running', 'paused')
       and s.started_at < new.ended_at
       and coalesce(s.ended_at, now()) > new.started_at
  ) then
    raise exception 'focus_sessions_overlap' using errcode = '23P01';
  end if;
  return new;
end $$;

drop trigger if exists focus_sessions_no_overlap on public.focus_sessions;
create trigger focus_sessions_no_overlap before insert on public.focus_sessions
  for each row execute function public.focus_sessions_no_overlap();

-- La categoría de una actividad es la suya propia o, si no tiene, la de su tarea.
create or replace function public.stats_by_category(p_from date, p_to date)
returns table (
  category_id uuid,
  name text,
  color text,
  focus_seconds bigint,
  tasks_completed integer
)
language sql stable security invoker set search_path = '' as $$
  with tz as (select public.user_timezone() as name),
  b as (
    select (p_from::timestamp at time zone tz.name) as t0, ((p_to + 1)::timestamp at time zone tz.name) as t1 from tz
  ),
  f as (
    select coalesce(s.category_id, k.category_id) as category_id, sum(s.focus_seconds)::bigint as secs
      from public.focus_sessions s
      left join public.tasks k on k.id = s.task_id
      cross join b
     where s.user_id = auth.uid() and s.status = 'completed' and s.kind <> 'break'
       and s.started_at >= b.t0 and s.started_at < b.t1
     group by 1
  ),
  t as (
    select k.category_id, count(*)::integer as n
      from public.tasks k cross join b
     where k.user_id = auth.uid() and k.status = 'done' and k.completed_at >= b.t0 and k.completed_at < b.t1
     group by 1
  ),
  keys as (select category_id from f union select category_id from t)
  select keys.category_id, coalesce(c.name, 'Sin categoría'), coalesce(c.color, '#94a3b8'),
         coalesce(f.secs, 0), coalesce(t.n, 0)
    from keys
    left join public.categories c on c.id = keys.category_id
    left join f on f.category_id is not distinct from keys.category_id
    left join t on t.category_id is not distinct from keys.category_id
   order by 4 desc, 5 desc;
$$;

-- ---------------------------------------------------------------------------
-- Frases favoritas (las frases viven en el código; aquí solo se guarda cuáles marcaste).
-- ---------------------------------------------------------------------------
create table if not exists public.favorite_quotes (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  quote_id text not null check (quote_id ~ '^[a-z0-9-]{1,40}$'),
  created_at timestamptz not null default now(),
  primary key (user_id, quote_id)
);
alter table public.favorite_quotes enable row level security;
drop policy if exists "favorite_quotes: own rows" on public.favorite_quotes;
create policy "favorite_quotes: own rows" on public.favorite_quotes for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
grant select, insert, delete on public.favorite_quotes to authenticated;

-- ---------------------------------------------------------------------------
-- Categorías de desarrollo personal: se añaden las que falten (no se toca ninguna existente).
-- ---------------------------------------------------------------------------
insert into public.categories (user_id, name, color, icon, position)
select u.id, c.name, c.color, c.icon, c.position
  from auth.users u
 cross join (values
   ('Idiomas', '#14b8a6', 'languages', 5),
   ('Programación', '#8b5cf6', 'code', 6),
   ('Habilidades profesionales', '#f97316', 'trending-up', 7),
   ('Cultura', '#e11d48', 'landmark', 8)
 ) as c (name, color, icon, position)
on conflict (user_id, name) do nothing;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_tz text := coalesce(new.raw_user_meta_data ->> 'timezone', 'UTC');
begin
  if not public.is_valid_timezone(v_tz) then
    v_tz := 'UTC';
  end if;
  insert into public.profiles (id, display_name, timezone)
  values (new.id, left(nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''), 60), v_tz);

  insert into public.categories (user_id, name, color, icon, position) values
    (new.id, 'Estudio', '#6366f1', 'book-open', 0),
    (new.id, 'Trabajo', '#0ea5e9', 'briefcase', 1),
    (new.id, 'Proyectos personales', '#f59e0b', 'rocket', 2),
    (new.id, 'Ejercicio', '#10b981', 'dumbbell', 3),
    (new.id, 'Lectura', '#ec4899', 'library', 4),
    (new.id, 'Idiomas', '#14b8a6', 'languages', 5),
    (new.id, 'Programación', '#8b5cf6', 'code', 6),
    (new.id, 'Habilidades profesionales', '#f97316', 'trending-up', 7),
    (new.id, 'Cultura', '#e11d48', 'landmark', 8);

  insert into public.boards (user_id, name) values (new.id, 'Mi tablero');
  return new;
end $$;

-- Que la API vea las columnas nuevas al momento.
notify pgrst, 'reload schema';
