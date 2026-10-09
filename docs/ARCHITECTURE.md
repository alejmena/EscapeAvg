# Escape Average — Arquitectura

> *Escape the Average. Become the 0.1%.*
> Plataforma para transformar intenciones en acciones y demostrar el progreso con datos reales.

Este documento describe la arquitectura, el modelo de datos y el plan por fases. Es la referencia para
cualquier cambio estructural: si una fase futura necesita algo que no encaja aquí, primero se actualiza este documento.

## 1. Decisiones técnicas

| Pieza | Elección | Por qué |
|---|---|---|
| Framework | **Next.js 16 (App Router) + React 19** | Server Components para leer datos sin exponer lógica, Server Actions para mutaciones validadas en servidor, rutas por carpeta, despliegue trivial en Vercel. Base sólida para PWA. |
| Lenguaje | **TypeScript estricto** | Tipos compartidos entre UI, acciones y lógica de dominio. |
| Estilos | **Tailwind CSS v4** con tokens CSS | Diseño consistente, modo claro/oscuro con variables, sin hojas de estilo dispersas. |
| Base de datos | **PostgreSQL (Supabase)** | Relacional (tareas ↔ sesiones ↔ categorías ↔ hábitos), agregaciones SQL para estadísticas, RLS para privacidad por usuario. |
| Autenticación | **Supabase Auth** | Contraseñas con hash bcrypt gestionadas por GoTrue (nunca se guardan en texto plano), sesiones JWT en cookies httpOnly, fácil añadir OAuth/magic link. |
| Sincronización | Estado en servidor + timestamps | El temporizador se guarda como `started_at` / `paused_seconds` en la BD: cualquier dispositivo reconstruye el mismo estado. Realtime de Supabase puede añadirse sin cambiar el modelo. |
| Validación | **Zod** en Server Actions + `CHECK` y RLS en Postgres | Tres capas: UI (comodidad), servidor (zod), base de datos (constraints + RLS). El cliente nunca es la única defensa. |
| Pruebas | **Vitest** | Unitarias para la lógica de dominio pura y pruebas de integración SQL contra un Postgres real (migraciones, RLS, triggers, funciones de estadísticas). |

### Capas

```
src/
  app/                    Rutas (App Router)
    (auth)/               login, registro
    (app)/                área privada: dashboard, tasks, focus, habits, notes, stats, settings
      */actions.ts        Server Actions: validan con zod y escriben vía Supabase (RLS aplica)
  components/             UI reutilizable (ui/ primitivos, y por funcionalidad)
  lib/
    domain/               Lógica pura y testeada: rachas, recurrencia, temporizador, estadísticas,
                          recomendaciones, descomposición "Just Start". Sin dependencias de React/Supabase.
    supabase/             Clientes de servidor/navegador y middleware de sesión
    validation/           Esquemas zod compartidos
    data/                 Consultas de lectura reutilizables (server-only)
supabase/
  migrations/             SQL versionado: esquema, RLS, triggers, funciones
tests/
  db/                     Pruebas SQL contra Postgres real
```

La regla clave: **la lógica que decide números (estadísticas, rachas, cumplimiento, XP futuro) vive en
`lib/domain` o en funciones SQL, nunca dentro de componentes.** Así es testeable y reutilizable por la futura app móvil.

## 2. Modelo de datos

Todas las tablas de usuario llevan `user_id uuid references auth.users` y una política RLS `user_id = auth.uid()`.
Las fechas se guardan en `timestamptz`; los "días" se calculan con la zona horaria del perfil.

| Tabla | Propósito | Campos clave |
|---|---|---|
| `profiles` | Perfil y preferencias | `display_name`, `username`, `timezone`, `week_starts_on`, `pomodoro_settings` (jsonb), `weekly_focus_goal_minutes`, `streaks_enabled`, `share_stats` (consentimiento social, `false` por defecto) |
| `categories` | Estudio, Trabajo, Proyectos, Ejercicio, Lectura… | `name`, `color`, `icon` — se crean por defecto al registrarse |
| `projects` | Planes para proyectos grandes | `name`, `description`, `category_id`, `status`, `target_date` |
| `tasks` | Tareas y subtareas | `parent_id` (subtareas), `project_id`, `category_id`, `priority` 0–3, `status`, `due_date`, `estimated_minutes`, `actual_seconds` (mantenido por trigger), `progress_current/target/unit` (contadores "15 de 30 ejercicios"), `recurrence` (jsonb), `postponed_count` (trigger), `completed_at` |
| `focus_sessions` | Pomodoro, cronómetro, Just Start, manual, descansos | `kind`, `status`, `task_id`, `planned_seconds`, `started_at`, `ended_at`, `paused_seconds`, `paused_at`, `focus_seconds` |
| `session_interruptions` | Registro de interrupciones | `session_id`, `kind` (interna/externa), `note` |
| `habits` | Hábitos y rutinas | `frequency` (`daily`, `weekly`, `specific_days`), `times_per_week`, `days_of_week`, `target_value` + `unit`, `streaks_enabled` |
| `habit_logs` | Registro diario de hábitos | `log_date`, `status` (`done`, `skipped`, `rest`), `value`. `rest` = descanso justificado: no rompe rachas |
| `rest_days` | Días de descanso globales | No rompen la racha de constancia |
| `goals` | Objetivos activos | `metric` (`focus_minutes`, `tasks_completed`, `habit_completions`, `manual`), `period` (`weekly`, `monthly`, `custom`), `target_value`, `category_id` |
| `boards` | Tableros de notas | `name`, `color`, `position` |
| `notes` | Sticky notes | `x`, `y`, `width`, `height`, `z_index`, `color`, `content`, `group_label`, `task_id` (si se convirtió en tarea) |
| `activity_events` | **Registro de eventos inmutable** | `type`, `entity_type`, `entity_id`, `occurred_at`, `payload` — lo escriben triggers |

### Por qué `activity_events`

Es la columna vertebral para las fases siguientes. Los triggers registran `task.completed`, `focus.completed`,
`habit.logged`, etc. Sobre ese log:

- **Fase 2 (análisis):** mapas de calor y "mejores horarios" sin tocar las tablas de origen.
- **Fase 3 (gamificación):** XP y logros se calculan *a partir de eventos verificados* (sesiones con tiempo real,
  tareas con antigüedad mínima), lo que evita que crear tareas vacías dé puntos.
- **Fase 4 (social):** el feed y las clasificaciones leen agregados de eventos de usuarios que dieron consentimiento.
- **Fase 5 (IA):** el historial de eventos es el contexto que se resume para el modelo.

### Estadísticas

`public.stats_daily(from, to)` (SQL, `security invoker` → respeta RLS) devuelve por día local:
minutos de concentración, sesiones, interrupciones, tareas completadas, hábitos cumplidos.
`public.stats_by_category(from, to)` agrupa el tiempo por categoría. Siempre se calculan desde los datos
de origen, así que se actualizan automáticamente con cada registro y nunca hay números inventados.

Las comparaciones (semana vs. semana anterior, etc.) y la racha de constancia se calculan en
`lib/domain/stats.ts` y `lib/domain/streaks.ts`. Si no hay datos suficientes en el período anterior,
**no se muestra porcentaje** (se muestra "sin datos previos").

**Transparencia:** más horas no significa más productividad. Por eso el dashboard muestra varias señales
(concentración, tareas cerradas, hábitos, constancia, precisión de estimaciones) en lugar de una única
"puntuación de productividad".

## 3. Seguridad

- Contraseñas: solo Supabase Auth (bcrypt). La app nunca las ve tras el envío del formulario.
- Sesión: cookies httpOnly gestionadas por `@supabase/ssr`; `src/proxy.ts` (middleware de Next) refresca la sesión y protege las rutas privadas.
- Autorización: RLS en **todas** las tablas. Aunque una Server Action tuviera un bug, Postgres no devuelve ni
  modifica filas de otro usuario. Probado en `tests/db`.
- Integridad: claves foráneas compuestas impiden enlazar una tarea a la categoría o proyecto de otro usuario.
- Validación: zod en cada Server Action + `CHECK` en la BD (prioridad 0–3, tamaños de nota, longitudes, etc.).
- La clave `service_role` no se usa en la app.

## 4. Fases

### Fase 1 — MVP funcional
- Registro, inicio de sesión, cierre de sesión, rutas protegidas.
- Dashboard: resumen del día, tareas pendientes/completadas, tiempo de concentración, hábitos, racha de constancia,
  progreso semanal, objetivos activos, comparación con ayer y la semana anterior, botón "Empezar a concentrarme".
- Tareas: CRUD, prioridades, fechas, categorías, subtareas, recurrentes, estimación vs. tiempo real, notas,
  contadores de progreso, proyectos, temporizador por tarea.
- Concentración: Pomodoro configurable, cronómetro, pausa/continuar/finalizar, descansos, historial,
  interrupciones, modo sin distracciones, **Just Start** (2 o 5 min) y división de tareas en pasos.
- Hábitos: frecuencia configurable, objetivo, historial, % de cumplimiento, calendario, rachas opcionales con descansos.
- Sticky notes: varios tableros, arrastrar, redimensionar, colores, grupos, convertir en tarea, autoguardado.
- Estadísticas básicas: hoy / semana / mes / rango, comparación con el período anterior, por categoría, gráfico diario.
- Recomendaciones iniciales basadas en reglas (tareas pospuestas, estimaciones, hábitos en caída, mejor horario).

### Fase 2 — Análisis avanzado (implementada)
Sin cambios de esquema: todo se calcula sobre `stats_daily` y las tablas de origen, así que no requiere migraciones.

- **Estadísticas › Tendencias** (`/stats/trends`): semana, mes y año en curso frente al mismo tramo del período
  anterior, con frases como "Esta semana te concentraste 12 h, un 25 % más que la semana anterior" (sin porcentaje si la
  base es muy pequeña o anterior a la cuenta); calendario de actividad de hasta 53 semanas (concentración, tareas,
  hábitos o actividad; niveles por cuartiles de tu propio historial; al tocar un día se abren sus estadísticas);
  últimas 12 semanas y 12 meses; tendencia de 90 días con media móvil de 7 días y frase de constancia
  ("Tu constancia mejoró durante los últimos 90 días…"); récords personales.
- **Estadísticas › Horarios y patrones** (`/stats/patterns`): mapa de calor día × hora (filtrable por categoría),
  media por día de la semana con el mejor día si sobresale (≥ 1,4× y ≥ 4 semanas), mejor franja por categoría,
  % de sesiones terminadas por franja y precisión de estimaciones por categoría.
- **Estadísticas › Proyectos** (`/stats/projects`): tiempo dedicado, avance, ritmo de las últimas 4 semanas,
  proyección de fin frente a la fecha objetivo y proyectos parados.
- **Resumen**: rango "Este año" y descarga CSV de las estadísticas diarias (`/stats/export`).
- **Inicio**: calendario de constancia de las últimas 16 semanas.
- **Recomendaciones**: nuevas reglas de constancia (90 días), mejor día de la semana y proyectos retrasados o parados.

Lógica pura y testeada en `lib/domain/analytics.ts`; consultas en `lib/data/analytics.ts` (paginadas: PostgREST de
Supabase devuelve 1000 filas por petición). Los días se calculan siempre en la zona horaria del perfil
(`zonedDayStart`, `zonedParts`). Si el volumen crece, las agregaciones pueden pasar a funciones SQL o vistas
materializadas sin cambiar la interfaz de `lib/domain`.

### Fase 3 — Gamificación
Tablas nuevas: `xp_ledger` (asientos derivados de `activity_events`, con regla y referencia al evento),
`achievements` / `user_achievements`, `challenges`. Niveles = función de XP. Reglas anti‑abuso: XP solo por
tiempo de concentración real, tareas con antigüedad mínima y hábitos, con topes diarios.

### Fase 4 — Social
Tablas nuevas: `friendships` (solicitud/aceptación), `groups`, `group_members`, `shared_challenges`,
`stat_shares` (qué métrica se comparte con quién). Las clasificaciones leen funciones `security definer`
que solo exponen agregados de usuarios con `share_stats = true` y relación aceptada. **No se mostrarán percentiles
("Top 1%") hasta que exista una población mínima verificable**; antes se muestran posiciones dentro del grupo.

### Fase 5 — IA
`lib/domain/recommendations.ts` define la interfaz `Recommendation`. El motor de reglas actual es un
`RecommendationProvider`; un proveedor basado en LLM implementará la misma interfaz usando resúmenes de
`activity_events`, con caché en una tabla `insights`.

### PWA / móvil
`manifest.webmanifest` incluido. Fase posterior: service worker para modo offline y notificaciones del temporizador.
La lógica de dominio y la API de Supabase son reutilizables desde React Native/Expo.
