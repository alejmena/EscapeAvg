# Escape Average

> **Escape the Average. Become the 0.1%.**
> Plataforma para combatir la procrastinación, concentrarse y medir el progreso con datos reales.

Arquitectura, modelo de datos y plan por fases: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Stack

Next.js 16 (App Router, Server Actions) · React 19 · TypeScript · Tailwind CSS 4 · Supabase (Postgres, Auth, RLS) · Zod · Vitest · Playwright.

## Qué incluye (Fases 1 a 5)

| Área | Funciona |
|---|---|
| Cuenta | Registro, inicio y cierre de sesión (Supabase Auth, contraseñas con hash). Rutas privadas protegidas. Datos privados por usuario con RLS. |
| Dashboard | Resumen del día, comparación con ayer y con los mismos días de la semana anterior, objetivo semanal, racha de constancia (con "día de descanso"), calendario de constancia de 16 semanas, tareas de hoy, hábitos de hoy, objetivos activos, sugerencias, botón **Empezar a concentrarme** y **Just Start**. |
| Tareas | Crear, editar, eliminar, completar. Prioridad, fecha, categoría, proyecto, notas, subtareas (pasos), recurrentes (diaria/semanal con días/mensual), estimación vs. tiempo real, contadores ("15 de 30 ejercicios"), registro manual de tiempo, "dividir en pasos". Vistas Hoy / Próximas / Todas / Completadas. |
| Concentración | Pomodoro configurable, cronómetro, pausa/continuar/finalizar/descartar, descansos corto y largo, sesión asociada a tarea, registro de interrupciones (internas/externas), modo sin distracciones, historial. **Just Start** de 2 o 5 min con opción de seguir. El tiempo lo calcula la base de datos y se sincroniza entre dispositivos. |
| Hábitos | Diario, días concretos o X veces por semana; objetivo y unidad; historial y calendario; % de cumplimiento; rachas opcionales; descansos justificados que no rompen la racha. |
| Notas adhesivas | Varios tableros; crear, escribir, arrastrar (ratón, táctil o teclado), redimensionar, colores, grupos por tema, "Agrupar" en columnas, convertir en tarea (las listas se convierten en pasos). Autoguardado. |
| Objetivos | Semanales, mensuales o por fechas; minutos de concentración, tareas, hábitos o manual; por categoría; progreso calculado con datos reales. |
| Estadísticas | Hoy, semana, mes, 30/90 días, 12 meses o rango; comparación con el período anterior equivalente; concentración y tareas por día/semana/mes; por categoría; horas del día; mejores días; días activos; cumplimiento de fechas y hábitos; estimado vs. real; interrupciones. |
| Análisis avanzado (Fase 2) | Comparativas semana/mes/año con el mismo tramo anterior, calendario de actividad (mapa de calor), últimas 12 semanas y 12 meses, tendencia de 90 días, récords personales, mapa de calor día × hora por categoría, mejor día y franja, sesiones terminadas por franja, estimado vs. real por categoría, estadísticas por proyecto con proyección de fin, exportación CSV. |
| Progreso (Fase 3) | Niveles y XP calculados solo con actividad real (concentración medida, tareas con antigüedad mínima, hábitos, días y semanas constantes, objetivos alcanzados) con topes anti‑abuso; 26 logros con fecha de desbloqueo; desafíos personales de 7 días basados en tu media; XP por semana y récords; barra de nivel en Inicio. |
| Social (Fase 4) | Nombre de usuario, amigos (solicitud/aceptación), grupos con enlace de invitación, comparación semanal justa (constancia, % del objetivo propio, mejora) solo dentro de tu círculo y sin percentiles, desafíos compartidos con meta por persona. Compartir es opcional, recíproco y solo incluye totales. |
| Plan (Fase 5) | Plan del día según tu ritmo real (vencimientos, prioridad, tareas pospuestas, precisión de tus estimaciones, mejor franja) con motivos visibles y "Mover a mañana" para lo que no cabe; resumen semanal con logros, mejoras y metas alcanzables. Preparado para un proveedor de IA. |
| Recomendaciones | Motor de reglas con evidencia visible: tareas pospuestas, dificultad para empezar, hábitos en caída, precisión de estimaciones, mejor franja horaria, interrupciones, constancia de 90 días, mejor día de la semana, proyectos retrasados o parados. Interfaz preparada para un proveedor de IA. |
| UX | Modo claro/oscuro/sistema, responsive con navegación inferior en móvil, PWA instalable (manifest), accesibilidad básica (roles ARIA, foco visible, movimiento reducido). |

## Puesta en marcha

1. Instala dependencias: `npm install`
2. Base de datos (elige una):
   - **Supabase en la nube:** crea un proyecto y ejecuta `supabase link` + `supabase db push`, o pega los archivos de `supabase/migrations/` en el editor SQL en orden.
   - **Local (Docker):** `npx supabase start` (aplica las migraciones automáticamente).
3. `cp .env.example .env.local` y rellena `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. `npm run dev` → http://localhost:3000

Sin variables de entorno, la app muestra `/setup` con estas instrucciones.

## Pruebas

| Comando | Qué prueba |
|---|---|
| `npm test` | Lógica de dominio (fechas y zonas horarias, recurrencia, rachas, hábitos, estadísticas, análisis avanzado, gamificación, comparaciones sociales, plan del día y resumen semanal, temporizador, objetivos, Just Start, recomendaciones). |
| `npm run test:db` | Migraciones, RLS, triggers y funciones SQL contra un Postgres real. Requiere `TEST_DATABASE_URL` (un Postgres vacío; **la base se reinicia**). |
| `npm run test:e2e` | Flujo completo en el navegador contra la app en marcha y un Supabase real: registro, tareas, recurrencia, pomodoro, Just Start, hábitos, notas, objetivos, estadísticas, privacidad entre usuarios, móvil/oscuro. |
| `npm run lint` / `npm run typecheck` | ESLint y TypeScript. |

CI (`.github/workflows/ci.yml`) ejecuta todo lo anterior; las pruebas E2E usan `supabase start`.

## Estructura

```
src/app/(auth)        login, registro, Server Actions de autenticación
src/app/(app)         dashboard, tasks, focus, habits, notes, goals, stats, progress, social, plan, settings (+ actions.ts por sección)
src/components        UI por funcionalidad y primitivos en ui/
src/lib/domain        lógica pura y testeada
src/lib/data          consultas de estadísticas (servidor)
src/lib/validation    esquemas zod
supabase/migrations   esquema, RLS, triggers, funciones de estadísticas
tests/db              pruebas SQL
e2e                   pruebas Playwright
```
