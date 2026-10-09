-- Escape Average — esquema inicial (Fase 1)
-- Convenciones:
--   * Toda fila de usuario lleva user_id (default auth.uid()) y RLS "solo mis filas".
--   * Las FKs entre tablas de usuario son compuestas (id, user_id) para que sea imposible
--     enlazar datos de otro usuario aunque se conozca su id.
--   * Los cálculos de tiempo de concentración se hacen en la BD (triggers), no en el cliente.

-- ---------------------------------------------------------------------------
-- Utilidades
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create or replace function public.is_valid_timezone(tz text)
returns boolean language plpgsql stable as $$
begin
  perform now() at time zone tz;
  return true;
exception when others then
  return false;
end $$;

-- ---------------------------------------------------------------------------
-- Perfiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 60),
  username text unique check (username ~ '^[a-z0-9_]{3,24}$'),
  timezone text not null default 'UTC',
  week_starts_on smallint not null default 1 check (week_starts_on between 0 and 6),
  pomodoro_settings jsonb not null default
    '{"focus_minutes":25,"short_break_minutes":5,"long_break_minutes":15,"sessions_before_long_break":4}'::jsonb,
  weekly_focus_goal_minutes integer not null default 600 check (weekly_focus_goal_minutes between 0 and 10080),
  streaks_enabled boolean not null default true,
  -- Consentimiento para la futura fase social. Nada se comparte sin esto.
  share_stats boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_pomodoro_settings_object check (jsonb_typeof(pomodoro_settings) = 'object')
);

create or replace function public.profiles_validate()
returns trigger language plpgsql as $$
begin
  if not public.is_valid_timezone(new.timezone) then
    raise exception 'invalid timezone: %', new.timezone using errcode = '22023';
  end if;
  return new;
end $$;

create trigger profiles_validate before insert or update on public.profiles
  for each row execute function public.profiles_validate();
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Categorías y proyectos
-- ---------------------------------------------------------------------------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  color text not null default '#6366f1' check (color ~ '^#[0-9a-fA-F]{6}$'),
  icon text check (char_length(icon) <= 40),
  position integer not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, name),
  unique (id, user_id)
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  description text check (char_length(description) <= 5000),
  category_id uuid,
  status text not null default 'active' check (status in ('active', 'paused', 'done', 'archived')),
  target_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (category_id, user_id) references public.categories (id, user_id) on delete set null (category_id)
);
create trigger projects_updated_at before update on public.projects
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Tareas
-- ---------------------------------------------------------------------------
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  parent_id uuid,
  project_id uuid,
  category_id uuid,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  notes text check (char_length(notes) <= 10000),
  priority smallint not null default 0 check (priority between 0 and 3),
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'done', 'archived')),
  due_date date,
  estimated_minutes integer check (estimated_minutes between 1 and 10000),
  -- Mantenido por trigger a partir de focus_sessions completadas. No editable por el cliente.
  actual_seconds integer not null default 0 check (actual_seconds >= 0),
  progress_current integer not null default 0 check (progress_current between 0 and 100000),
  progress_target integer check (progress_target between 1 and 100000),
  progress_unit text check (char_length(progress_unit) <= 30),
  -- {"freq":"daily"|"weekly"|"monthly","interval":1,"weekdays":[1,3,5]}
  recurrence jsonb check (recurrence is null or jsonb_typeof(recurrence) = 'object'),
  recurrence_source_id uuid,
  -- Cuántas veces se movió la fecha límite hacia adelante (para detectar procrastinación).
  postponed_count integer not null default 0 check (postponed_count >= 0),
  position double precision not null default 0,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  check (parent_id is null or parent_id <> id),
  foreign key (parent_id, user_id) references public.tasks (id, user_id) on delete cascade,
  foreign key (project_id, user_id) references public.projects (id, user_id) on delete set null (project_id),
  foreign key (category_id, user_id) references public.categories (id, user_id) on delete set null (category_id)
);
create index tasks_user_status_idx on public.tasks (user_id, status);
create index tasks_user_due_idx on public.tasks (user_id, due_date) where status <> 'done';
create index tasks_user_completed_idx on public.tasks (user_id, completed_at) where completed_at is not null;
create index tasks_parent_idx on public.tasks (parent_id);
create index tasks_recurrence_source_idx on public.tasks (recurrence_source_id) where recurrence_source_id is not null;

create or replace function public.tasks_before_write()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    new.actual_seconds := 0;
    new.postponed_count := 0;
    new.completed_at := case when new.status = 'done' then now() else null end;
    return new;
  end if;

  -- Campos derivados: el cliente no puede reescribirlos. Solo los triggers internos
  -- (profundidad > 1, p. ej. refresh_task_actual_seconds) pueden actualizar actual_seconds.
  if pg_trigger_depth() <= 1 then
    new.actual_seconds := old.actual_seconds;
  end if;
  new.postponed_count := old.postponed_count;
  new.user_id := old.user_id;

  if new.status = 'done' and old.status <> 'done' then
    new.completed_at := now();
  elsif new.status <> 'done' then
    new.completed_at := null;
  else
    new.completed_at := old.completed_at;
  end if;

  if old.due_date is not null and new.due_date is not null and new.due_date > old.due_date then
    new.postponed_count := old.postponed_count + 1;
  end if;
  return new;
end $$;

create trigger tasks_before_write before insert or update on public.tasks
  for each row execute function public.tasks_before_write();
create trigger tasks_updated_at before update on public.tasks
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Sesiones de concentración
-- ---------------------------------------------------------------------------
create table public.focus_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  task_id uuid,
  kind text not null check (kind in ('pomodoro', 'stopwatch', 'just_start', 'manual', 'break')),
  status text not null default 'running' check (status in ('running', 'paused', 'completed', 'abandoned')),
  planned_seconds integer check (planned_seconds between 60 and 14400),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  paused_at timestamptz,
  paused_seconds integer not null default 0 check (paused_seconds >= 0),
  focus_seconds integer check (focus_seconds between 0 and 43200),
  note text check (char_length(note) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  check (ended_at is null or ended_at >= started_at),
  check (status not in ('completed', 'abandoned') or ended_at is not null),
  foreign key (task_id, user_id) references public.tasks (id, user_id) on delete set null (task_id)
);
-- Solo una sesión activa (en curso o en pausa) por usuario: sincronización entre dispositivos.
create unique index focus_sessions_one_active on public.focus_sessions (user_id)
  where status in ('running', 'paused');
create index focus_sessions_user_started_idx on public.focus_sessions (user_id, started_at desc);
create index focus_sessions_task_idx on public.focus_sessions (task_id) where task_id is not null;

-- Duración máxima contabilizada por sesión (evita que un cronómetro olvidado infle las estadísticas).
create or replace function public.focus_max_seconds() returns integer language sql immutable as $$ select 43200 $$;

create or replace function public.focus_sessions_before_write()
returns trigger language plpgsql as $$
declare
  v_now timestamptz := now();
  v_elapsed integer;
begin
  if tg_op = 'INSERT' then
    if new.kind = 'manual' then
      -- Registro manual de tiempo: requiere inicio y fin, no en el futuro, máx. 12 h.
      if new.ended_at is null or new.ended_at > v_now + interval '1 minute' then
        raise exception 'manual sessions need a past ended_at' using errcode = '22023';
      end if;
      new.status := 'completed';
    else
      new.started_at := v_now;
      new.ended_at := null;
      new.status := 'running';
    end if;
    new.paused_at := null;
    new.paused_seconds := 0;
  else
    -- Inmutables tras crear.
    new.user_id := old.user_id;
    new.kind := old.kind;
    new.started_at := old.started_at;
    new.paused_seconds := old.paused_seconds;
    new.paused_at := old.paused_at;
    if old.status in ('completed', 'abandoned') then
      if new.status <> old.status then
        raise exception 'session already finished' using errcode = '22023';
      end if;
      new.ended_at := old.ended_at;
      new.focus_seconds := old.focus_seconds;
      new.planned_seconds := old.planned_seconds;
      return new;
    end if;

    if old.status = 'running' and new.status = 'paused' then
      new.paused_at := v_now;
    elsif old.status = 'paused' and new.status = 'running' then
      new.paused_seconds := old.paused_seconds + greatest(0, extract(epoch from v_now - old.paused_at)::integer);
      new.paused_at := null;
    elsif new.status in ('completed', 'abandoned') then
      new.ended_at := v_now;
      if old.status = 'paused' then
        new.paused_seconds := old.paused_seconds + greatest(0, extract(epoch from v_now - old.paused_at)::integer);
      end if;
      new.paused_at := null;
    elsif new.status <> old.status then
      raise exception 'invalid status transition % -> %', old.status, new.status using errcode = '22023';
    end if;
  end if;

  if new.status in ('completed', 'abandoned') then
    v_elapsed := greatest(0, extract(epoch from new.ended_at - new.started_at)::integer - new.paused_seconds);
    if new.planned_seconds is not null and new.kind in ('pomodoro', 'break') then
      v_elapsed := least(v_elapsed, new.planned_seconds);
    end if;
    new.focus_seconds := least(v_elapsed, public.focus_max_seconds());
  else
    new.focus_seconds := null;
  end if;
  return new;
end $$;

create trigger focus_sessions_before_write before insert or update on public.focus_sessions
  for each row execute function public.focus_sessions_before_write();
create trigger focus_sessions_updated_at before update on public.focus_sessions
  for each row execute function public.set_updated_at();

create table public.session_interruptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  session_id uuid not null,
  kind text not null default 'internal' check (kind in ('internal', 'external')),
  note text check (char_length(note) <= 280),
  occurred_at timestamptz not null default now(),
  foreign key (session_id, user_id) references public.focus_sessions (id, user_id) on delete cascade
);
create index session_interruptions_session_idx on public.session_interruptions (session_id);
create index session_interruptions_user_idx on public.session_interruptions (user_id, occurred_at);

-- Tiempo real dedicado a cada tarea = suma de sus sesiones completadas.
create or replace function public.refresh_task_actual_seconds(p_task_id uuid)
returns void language sql security definer set search_path = '' as $$
  update public.tasks t
     set actual_seconds = coalesce((
       select sum(s.focus_seconds) from public.focus_sessions s
        where s.task_id = p_task_id and s.status = 'completed' and s.kind <> 'break'), 0)
   where t.id = p_task_id;
$$;
-- Supabase concede EXECUTE por defecto a anon/authenticated: se revoca explícitamente (uso interno de triggers).
revoke execute on function public.refresh_task_actual_seconds(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Hábitos
-- ---------------------------------------------------------------------------
create table public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  description text check (char_length(description) <= 500),
  category_id uuid,
  color text not null default '#10b981' check (color ~ '^#[0-9a-fA-F]{6}$'),
  frequency text not null default 'daily' check (frequency in ('daily', 'weekly', 'specific_days')),
  times_per_week smallint check (times_per_week between 1 and 7),
  days_of_week smallint[] check (days_of_week <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]),
  target_value numeric(10, 2) check (target_value > 0),
  unit text check (char_length(unit) <= 20),
  streaks_enabled boolean not null default true,
  position integer not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  check (frequency <> 'weekly' or times_per_week is not null),
  check (frequency <> 'specific_days' or cardinality(days_of_week) > 0),
  foreign key (category_id, user_id) references public.categories (id, user_id) on delete set null (category_id)
);
create trigger habits_updated_at before update on public.habits
  for each row execute function public.set_updated_at();

create table public.habit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  habit_id uuid not null,
  log_date date not null check (log_date <= (now() at time zone 'utc')::date + 1),
  -- done: cumplido. skipped: no hecho. rest: descanso justificado (no rompe la racha).
  status text not null default 'done' check (status in ('done', 'skipped', 'rest')),
  value numeric(10, 2) check (value >= 0),
  note text check (char_length(note) <= 280),
  created_at timestamptz not null default now(),
  unique (habit_id, log_date),
  foreign key (habit_id, user_id) references public.habits (id, user_id) on delete cascade
);
create index habit_logs_user_date_idx on public.habit_logs (user_id, log_date);

create table public.rest_days (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day date not null,
  reason text check (char_length(reason) <= 140),
  created_at timestamptz not null default now(),
  primary key (user_id, day)
);

-- ---------------------------------------------------------------------------
-- Objetivos
-- ---------------------------------------------------------------------------
create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  description text check (char_length(description) <= 1000),
  metric text not null check (metric in ('focus_minutes', 'tasks_completed', 'habit_completions', 'manual')),
  period text not null default 'weekly' check (period in ('weekly', 'monthly', 'custom')),
  start_date date,
  end_date date,
  target_value numeric(12, 2) not null check (target_value > 0),
  manual_value numeric(12, 2) not null default 0 check (manual_value >= 0),
  category_id uuid,
  status text not null default 'active' check (status in ('active', 'achieved', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (period <> 'custom' or (start_date is not null and end_date is not null and end_date >= start_date)),
  foreign key (category_id, user_id) references public.categories (id, user_id) on delete set null (category_id)
);
create trigger goals_updated_at before update on public.goals
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Tableros y notas adhesivas
-- ---------------------------------------------------------------------------
create table public.boards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  color text not null default '#f59e0b' check (color ~ '^#[0-9a-fA-F]{6}$'),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);
create trigger boards_updated_at before update on public.boards
  for each row execute function public.set_updated_at();

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  board_id uuid not null,
  content text not null default '' check (char_length(content) <= 5000),
  color text not null default 'yellow' check (color in ('yellow', 'pink', 'blue', 'green', 'purple', 'orange', 'gray')),
  x integer not null default 40 check (x between 0 and 20000),
  y integer not null default 40 check (y between 0 and 20000),
  width integer not null default 220 check (width between 140 and 800),
  height integer not null default 180 check (height between 100 and 800),
  z_index integer not null default 0,
  group_label text check (char_length(group_label) <= 40),
  task_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (board_id, user_id) references public.boards (id, user_id) on delete cascade,
  foreign key (task_id, user_id) references public.tasks (id, user_id) on delete set null (task_id)
);
create index notes_board_idx on public.notes (board_id);
create trigger notes_updated_at before update on public.notes
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Registro de eventos (base para analítica, gamificación, social e IA)
-- ---------------------------------------------------------------------------
create table public.activity_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null,
  entity_type text not null,
  entity_id uuid,
  occurred_at timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb
);
create index activity_events_user_time_idx on public.activity_events (user_id, occurred_at desc);
create index activity_events_user_type_idx on public.activity_events (user_id, type, occurred_at desc);

create or replace function public.log_activity()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name = 'tasks' then
    if new.status = 'done' and (tg_op = 'INSERT' or old.status <> 'done') then
      insert into public.activity_events (user_id, type, entity_type, entity_id, payload)
      values (new.user_id, 'task.completed', 'task', new.id, jsonb_build_object(
        'category_id', new.category_id, 'priority', new.priority, 'is_subtask', new.parent_id is not null,
        'estimated_minutes', new.estimated_minutes, 'actual_seconds', new.actual_seconds,
        'postponed_count', new.postponed_count, 'created_at', new.created_at));
    elsif tg_op = 'UPDATE' and old.status = 'done' and new.status <> 'done' then
      insert into public.activity_events (user_id, type, entity_type, entity_id)
      values (new.user_id, 'task.reopened', 'task', new.id);
    end if;
  elsif tg_table_name = 'focus_sessions' then
    if new.status = 'completed' and (tg_op = 'INSERT' or old.status <> 'completed') then
      insert into public.activity_events (user_id, type, entity_type, entity_id, occurred_at, payload)
      values (new.user_id, case when new.kind = 'break' then 'break.completed' else 'focus.completed' end,
        'focus_session', new.id, new.ended_at, jsonb_build_object(
          'kind', new.kind, 'task_id', new.task_id, 'focus_seconds', new.focus_seconds,
          'planned_seconds', new.planned_seconds, 'started_at', new.started_at));
    end if;
    if new.task_id is not null then
      perform public.refresh_task_actual_seconds(new.task_id);
    end if;
    if tg_op = 'UPDATE' and old.task_id is not null and old.task_id is distinct from new.task_id then
      perform public.refresh_task_actual_seconds(old.task_id);
    end if;
  elsif tg_table_name = 'habit_logs' then
    if new.status = 'done' and (tg_op = 'INSERT' or old.status <> 'done') then
      insert into public.activity_events (user_id, type, entity_type, entity_id, payload)
      values (new.user_id, 'habit.done', 'habit', new.habit_id,
        jsonb_build_object('log_date', new.log_date, 'value', new.value));
    end if;
  end if;
  return new;
end $$;

create trigger tasks_log_activity after insert or update of status on public.tasks
  for each row execute function public.log_activity();
create trigger focus_sessions_log_activity after insert or update on public.focus_sessions
  for each row execute function public.log_activity();
create trigger habit_logs_log_activity after insert or update of status on public.habit_logs
  for each row execute function public.log_activity();

-- ---------------------------------------------------------------------------
-- Alta de usuario: perfil + categorías + tablero por defecto
-- ---------------------------------------------------------------------------
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
    (new.id, 'Lectura', '#ec4899', 'library', 4);

  insert into public.boards (user_id, name) values (new.id, 'Mi tablero');
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.projects enable row level security;
alter table public.tasks enable row level security;
alter table public.focus_sessions enable row level security;
alter table public.session_interruptions enable row level security;
alter table public.habits enable row level security;
alter table public.habit_logs enable row level security;
alter table public.rest_days enable row level security;
alter table public.goals enable row level security;
alter table public.boards enable row level security;
alter table public.notes enable row level security;
alter table public.activity_events enable row level security;

create policy "profiles: read own" on public.profiles for select to authenticated
  using (id = (select auth.uid()));
create policy "profiles: update own" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

do $$
declare t text;
begin
  foreach t in array array['categories', 'projects', 'tasks', 'focus_sessions', 'session_interruptions',
                           'habits', 'habit_logs', 'rest_days', 'goals', 'boards', 'notes']
  loop
    execute format(
      'create policy "%1$s: own rows" on public.%1$I for all to authenticated
         using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
  end loop;
end $$;

-- Los eventos solo se leen; los escriben los triggers (security definer).
create policy "activity_events: read own" on public.activity_events for select to authenticated
  using (user_id = (select auth.uid()));
