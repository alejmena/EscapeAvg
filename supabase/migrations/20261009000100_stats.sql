-- Funciones de estadísticas. Todas son SECURITY INVOKER: respetan RLS y solo ven datos del usuario actual.
-- Los días se calculan en la zona horaria del perfil. Una sesión cuenta en el día local en que empezó.

create or replace function public.user_timezone()
returns text language sql stable security invoker set search_path = '' as $$
  select coalesce((select p.timezone from public.profiles p where p.id = auth.uid()), 'UTC');
$$;

create or replace function public.stats_daily(p_from date, p_to date)
returns table (
  day date,
  focus_seconds bigint,
  focus_sessions integer,
  interruptions integer,
  tasks_completed integer,
  habits_done integer
)
language sql stable security invoker set search_path = '' as $$
  with tz as (select public.user_timezone() as name),
  bounds as (
    select (p_from::timestamp at time zone tz.name) as t0,
           ((p_to + 1)::timestamp at time zone tz.name) as t1,
           tz.name as tzname
      from tz
     where p_to >= p_from and p_to - p_from <= 1100
  ),
  days as (
    select d::date as day from bounds, generate_series(p_from, p_to, interval '1 day') d
  ),
  f as (
    select (s.started_at at time zone b.tzname)::date as day,
           sum(s.focus_seconds)::bigint as secs, count(*)::integer as n
      from public.focus_sessions s, bounds b
     where s.user_id = auth.uid() and s.status = 'completed' and s.kind <> 'break'
       and s.started_at >= b.t0 and s.started_at < b.t1
     group by 1
  ),
  i as (
    select (x.occurred_at at time zone b.tzname)::date as day, count(*)::integer as n
      from public.session_interruptions x, bounds b
     where x.user_id = auth.uid() and x.occurred_at >= b.t0 and x.occurred_at < b.t1
     group by 1
  ),
  t as (
    select (k.completed_at at time zone b.tzname)::date as day, count(*)::integer as n
      from public.tasks k, bounds b
     where k.user_id = auth.uid() and k.status = 'done'
       and k.completed_at >= b.t0 and k.completed_at < b.t1
     group by 1
  ),
  h as (
    select l.log_date as day, count(*)::integer as n
      from public.habit_logs l
     where l.user_id = auth.uid() and l.status = 'done' and l.log_date between p_from and p_to
     group by 1
  )
  select d.day,
         coalesce(f.secs, 0), coalesce(f.n, 0), coalesce(i.n, 0), coalesce(t.n, 0), coalesce(h.n, 0)
    from days d
    left join f on f.day = d.day
    left join i on i.day = d.day
    left join t on t.day = d.day
    left join h on h.day = d.day
   order by d.day;
$$;

-- Tiempo de concentración y tareas completadas por categoría (la categoría de una sesión es la de su tarea).
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
    select k.category_id, sum(s.focus_seconds)::bigint as secs
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

-- Concentración por hora local del día (para detectar los mejores horarios).
create or replace function public.stats_hourly(p_from date, p_to date)
returns table (hour integer, focus_seconds bigint, focus_sessions integer)
language sql stable security invoker set search_path = '' as $$
  with tz as (select public.user_timezone() as name)
  select extract(hour from s.started_at at time zone tz.name)::integer,
         sum(s.focus_seconds)::bigint, count(*)::integer
    from public.focus_sessions s, tz
   where s.user_id = auth.uid() and s.status = 'completed' and s.kind <> 'break'
     and s.started_at >= (p_from::timestamp at time zone tz.name)
     and s.started_at < ((p_to + 1)::timestamp at time zone tz.name)
   group by 1
   order by 1;
$$;

-- Días con actividad real (cualquier sesión, tarea o hábito cumplido) para la racha de constancia.
create or replace function public.active_days(p_from date, p_to date)
returns table (day date)
language sql stable security invoker set search_path = '' as $$
  select d.day from public.stats_daily(p_from, p_to) d
   where d.focus_seconds >= 60 or d.tasks_completed > 0 or d.habits_done > 0
   order by 1;
$$;

grant execute on function public.stats_daily(date, date) to authenticated;
grant execute on function public.stats_by_category(date, date) to authenticated;
grant execute on function public.stats_hourly(date, date) to authenticated;
grant execute on function public.active_days(date, date) to authenticated;
revoke execute on function public.stats_daily(date, date) from anon;
revoke execute on function public.stats_by_category(date, date) from anon;
revoke execute on function public.stats_hourly(date, date) from anon;
revoke execute on function public.active_days(date, date) from anon;
