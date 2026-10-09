-- Escape AVG — microtareas, horario semanal e ideas.
-- Migración ADITIVA e IDEMPOTENTE: se puede ejecutar varias veces sin perder ni cambiar datos existentes.
--
-- Microtareas: son tareas normales (tabla tasks) marcadas con quick = true. Así cuentan como tareas
-- completadas en estadísticas y constancia, pero nunca suman tiempo productivo por sí solas
-- (actual_seconds solo crece con sesiones de concentración reales).

-- ---------------------------------------------------------------------------
-- Plantillas y tareas recurrentes de microtareas
--   repeat_days vacío = plantilla de un clic; con días (0 = domingo … 6 = sábado) = se crea sola esos días.
-- ---------------------------------------------------------------------------
create table if not exists public.quick_task_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  repeat_days smallint[] not null default '{}' check (repeat_days <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]),
  position integer not null default 0,
  -- Último día en que se creó la tarea recurrente (si la borras ese día, no vuelve a aparecer).
  last_spawned_on date,
  created_at timestamptz not null default now(),
  unique (id, user_id)
);
alter table public.quick_task_templates add column if not exists last_spawned_on date;
create index if not exists quick_task_templates_user_idx on public.quick_task_templates (user_id);

alter table public.tasks add column if not exists quick boolean not null default false;
alter table public.tasks add column if not exists quick_template_id uuid;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'tasks_quick_template_fk') then
    alter table public.tasks add constraint tasks_quick_template_fk
      foreign key (quick_template_id, user_id) references public.quick_task_templates (id, user_id) on delete set null (quick_template_id);
  end if;
end $$;
-- Una tarea recurrente se crea como mucho una vez por día.
create unique index if not exists tasks_quick_template_day on public.tasks (quick_template_id, due_date);
create index if not exists tasks_user_quick_idx on public.tasks (user_id, due_date) where quick;

-- Reinicio diario: true = las pendientes siguen al día siguiente; false = se archivan.
alter table public.profiles add column if not exists quick_tasks_carry_over boolean not null default true;

-- ---------------------------------------------------------------------------
-- Horario semanal (tipo horario de clases). Cada bloque es un día de la semana con hora de inicio y fin.
--   idea_key enlaza con una idea del catálogo de la app (texto, opcional).
-- ---------------------------------------------------------------------------
create table if not exists public.schedule_blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  start_minute smallint not null check (start_minute between 0 and 1439),
  end_minute smallint not null check (end_minute between 1 and 1440),
  title text not null check (char_length(btrim(title)) between 1 and 80),
  color text not null default '#6366f1' check (color ~ '^#[0-9a-fA-F]{6}$'),
  idea_key text check (char_length(idea_key) <= 80),
  note text check (char_length(note) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_minute > start_minute)
);
create index if not exists schedule_blocks_user_day_idx on public.schedule_blocks (user_id, day_of_week, start_minute);

drop trigger if exists schedule_blocks_updated_at on public.schedule_blocks;
create trigger schedule_blocks_updated_at before update on public.schedule_blocks
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Privacidad: cada persona solo ve y cambia sus propias filas.
-- ---------------------------------------------------------------------------
alter table public.quick_task_templates enable row level security;
alter table public.schedule_blocks enable row level security;

do $$
declare t text;
begin
  foreach t in array array['quick_task_templates', 'schedule_blocks']
  loop
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = t || ': own rows') then
      execute format(
        'create policy "%1$s: own rows" on public.%1$I for all to authenticated
           using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
    end if;
  end loop;
end $$;

grant select, insert, update, delete on public.quick_task_templates, public.schedule_blocks to authenticated;
