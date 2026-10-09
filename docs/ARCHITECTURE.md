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
- **Fase 4 (social):** las comparaciones leen agregados de usuarios que dieron consentimiento (recíproco).
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

### Fase 3 — Gamificación (implementada)
Sin cambios de esquema: el XP **no se guarda**, se recalcula en cada visita a partir de los datos verificados
(sesiones, tareas, registros de hábitos, objetivos y días de descanso). Así no hay nada que migrar, no se puede
inflar a mano y, si el usuario borra una sesión o reabre una tarea, el XP se ajusta solo.

- **XP** (`XP_RULES` en `lib/domain/gamification.ts`): 1 XP por minuto de concentración (máx. 120 min por sesión y
  480 XP al día; el registro manual cuenta la mitad); +10 por Just Start (≥ 90 s, máx. 3 al día); +10 por tarea y +3
  por paso solo si tenían ≥ 10 min de antigüedad o ≥ 5 min medidos (máx. 15 tareas y 20 pasos al día); +15 por hábito;
  +20 por día activo; +50 por semana constante (4 días activos, cada descanso justificado reduce lo exigido);
  +50/+150 por objetivo semanal/mensual alcanzado y hasta +150 por desafío (máx. 3 por semana; los objetivos manuales
  o triviales no dan XP).
- **Niveles**: el nivel L→L+1 cuesta `150 + 75·(L−1)` XP; títulos de "Primer paso" a "Leyenda".
- **Logros**: 26 logros (primeros pasos, horas acumuladas, tareas, rachas, sesiones profundas, Just Start, horarios,
  estimaciones, hábitos, semanas constantes, regreso tras una pausa, objetivos) con fecha de desbloqueo calculada.
- **Desafíos personales**: sugerencias de 7 días un ~10 % por encima de la media de las últimas 4 semanas; al
  aceptarlas se crean como objetivo por fechas (`period = custom`), así que reutilizan el progreso de Objetivos.
- **Pantallas**: `/progress` (nivel, XP de hoy y de la semana, XP por fuente, reglas, desafíos, XP por semana,
  récords y logros) y barra de nivel en Inicio. Los objetivos por fechas vencidos pasan a "Anteriores".

Lógica pura y testeada en `lib/domain/gamification.ts`; consultas paginadas en `lib/data/gamification.ts`. Si el
historial crece mucho, el cálculo puede pasar a una tabla `xp_ledger` materializada sin cambiar la interfaz.

### Fase 4 — Social (implementada)
Migración `20261010000000_social.sql`: **solo añade** tablas y funciones (idempotente; no toca datos existentes).

| Tabla | Propósito | RLS |
|---|---|---|
| `friendships` | Solicitud (`pending`) y amistad (`accepted`), un par único por pareja | Leer/borrar solo si participas; crear y aceptar solo vía RPC |
| `groups` | Grupos con `invite_code` | Solo miembros leen; solo el dueño edita o borra |
| `group_members` | Miembros (`owner`/`member`) | Solo miembros leen; unirse solo vía `join_group`; salir uno mismo o expulsar el dueño |
| `shared_challenges` | Desafíos de grupo: métrica, meta por persona y fechas (≤ 3 meses) | Miembros leen y crean; borra quien lo creó o el dueño |

Funciones `security definer` (con `search_path = ''`, ejecutables solo por `authenticated`): `send_friend_request`
(por nombre de usuario; si la otra persona ya te la envió, se acepta), `respond_friend_request`, `list_friends`,
`create_group`, `join_group`, `rotate_group_code`, `group_members_list` y `social_stats`.

**Privacidad.** Los perfiles ajenos nunca se leen directamente: las funciones devuelven solo nombre y usuario.
`social_stats(ids, from, to)` devuelve únicamente agregados (minutos, tareas, hábitos, días activos y objetivo semanal)
de quien llama y de personas para las que `can_see_stats` es cierto: **ambas** tienen `share_stats = true` (recíproco)
y son amigas aceptadas o comparten grupo. Cada persona se calcula en su propia zona horaria.

**Comparaciones justas** (`lib/domain/social.ts`): por defecto se ordena por constancia (días activos, desempate por %
del objetivo propio); también por % del objetivo semanal de cada uno, mejora frente a su propia semana anterior (solo
con una base ≥ 30 min), concentración o tareas. Empates comparten posición. **Sin percentiles ni rankings globales**:
solo posiciones dentro de tus amigos o de un grupo. Los desafíos compartidos fijan una meta por persona (nadie pierde
por quedarse atrás).

**Pantallas**: `/social` (perfil social y consentimiento, amigos, comparación semanal, grupos), `/social/groups/[id]`
(comparación del grupo, desafíos, invitación, miembros) y `/social/join/[code]` (enlace de invitación con
confirmación). Insignia de solicitudes pendientes en la navegación. Si la migración aún no está aplicada, la app sigue
funcionando y `/social` muestra un aviso.

### Fase 5 — IA
`lib/domain/recommendations.ts` define la interfaz `Recommendation`. El motor de reglas actual es un
`RecommendationProvider`; un proveedor basado en LLM implementará la misma interfaz usando resúmenes de
`activity_events`, con caché en una tabla `insights`.

### PWA / móvil
`manifest.webmanifest` incluido. Fase posterior: service worker para modo offline y notificaciones del temporizador.
La lógica de dominio y la API de Supabase son reutilizables desde React Native/Expo.
