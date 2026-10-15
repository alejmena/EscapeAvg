# Escape Average — guía visual

Referencia para cualquier cambio de interfaz. Los estilos viven en `src/app/globals.css` y los componentes base en
`src/components/ui/`. Si una pantalla necesita algo que no está aquí, primero se añade aquí (o a los componentes base).

## Principios

1. **Energía con propósito.** La app es para salir de la media: se ve viva, con color y profundidad, pero cada color
   significa algo (sección, categoría, estado). Nada de gris sobre gris.
2. **Una protagonista por pantalla.** Cada página tiene como mucho una tarjeta destacada (`variant="feature"`): la
   cifra o la acción más importante. El resto, cristal (`glass`) o tinte suave (`tint`).
3. **Jerarquía clara.** Titulares y cifras en la tipografía de display (Bricolage Grotesque); texto en Figtree. Las
   cifras importantes son grandes (`num-xl`); las etiquetas, pequeñas y en gris (`text-muted`).
4. **Color por sección.** Cada sección tiene su tono (ver `src/lib/sections.ts`). El `<main>` lleva `data-tone`, así
   que `var(--tone)` y las utilidades `text-tone`, `bg-tone`, `bg-tone-soft`, `text-tone-ink`, `from-tone to-tone-2`
   ya son del color de la página. Puedes poner `data-tone="green"` (o el prop `tone`) en un bloque para cambiarlo.
5. **Movimiento sutil.** Entradas suaves, elevación al pasar por encima, luz que sigue al cursor. Todo respeta
   "reducir movimiento" (ya lo hace `globals.css`).
6. **Claro, oscuro y móvil.** Toda pantalla se revisa en los tres. En oscuro el fondo es casi negro con brillos de
   color; usa siempre variables (`bg-surface`, `text-muted`…), nunca colores fijos como `bg-white` o `text-gray-500`.

## Tonos

`violet` (Inicio) · `indigo` (Plan) · `blue` (Tareas) · `coral` (Concentración) · `orange` (Hábitos) · `teal`
(Horario) · `amber` (Ideas) · `lime` (Notas) · `green` (Objetivos) · `cyan` (Estadísticas) · `gold` (Progreso) ·
`fuchsia` (Filosofía) · `sky` (Social) · `pink` (Tareas rápidas) · `slate` (Ajustes).

Cada tono define `--tone`, `--tone-2` (pareja del degradado), `--tone-soft` (fondo suave) y `--tone-ink` (texto
legible sobre el fondo suave), en claro y en oscuro.

Colores de marca: `accent` (violeta), `accent-2` (magenta), `accent-3` (rosa coral), `--brand-gradient`.
Estados: `success`, `warning`, `danger` (+ `-soft`). Oro para metas cumplidas: `gold`, `gold-soft`, `.text-gold`.
Superficies: `bg`, `surface`, `surface-2`, `surface-3`; bordes `border`, `border-strong`; texto `text`, `muted`, `faint`.

## Componentes base (`src/components/ui`)

| Componente | Uso |
|---|---|
| `PageHeader` | Título de página. Pone solo la ficha de icono y el color de la sección (por la ruta). Props: `title`, `subtitle`, `action`, `eyebrow`, `icon`. |
| `Card` | `variant`: `glass` (por defecto, con luz al cursor), `tint` (tinte del tono), `feature` (degradado intenso, texto blanco: una por pantalla), `solid`, `outline`. `tone` para cambiar el color. |
| `CardTitle` | Título de tarjeta con `icon` (en ficha suave del tono), `subtitle` y `action`. |
| `StatTile` | Cifra clave: `icon`, `label`, `value`, `delta` + `trend` (`up`/`down`/`flat`), `footnote`, `tone`. |
| `Badge` | `variant`: `neutral`, `tone`, `accent`, `success`, `warning`, `danger`, `gold`, `solid`; o `color` (hex de categoría). |
| `ProgressBar` | Degradado del tono con brillo. `size`: `sm`, `md`, `lg`; `color` opcional. |
| `ProgressRing` | Anillo con degradado del tono. |
| `EmptyState` | Estado vacío ilustrado: `icon`, `title`, `children`, `action`. |
| `Button` / `buttonClass` | `variant`: `primary` (marca, para la acción principal), `tone` (color de la sección), `inverse` (blanco, para la acción principal dentro de una tarjeta `feature`), `secondary`, `ghost`, `danger`, `success`. `size`: `sm`, `md`, `lg`, `icon`. |
| `Input`, `Select`, `Textarea`, `Field`, `Label` | Campos con foco luminoso; el `Select` trae su propia flecha. |
| `Modal` | Diálogo (y hoja inferior en móvil con `sheet`). |
| `ThemeToggle`, `useTheme`, `setTheme` | Selector de tema y su estado compartido (`components/theme-toggle.tsx`): cualquier selector de tema debe usarlos. |

Gráficas (`src/components/charts`): `BarChart` usa por defecto el degradado del tono (`color`, `unit` `"minutes"`/`"count"`
para un eje con cifras redondas, `average` para la línea de media), `LineChart`/`Sparkline`, `CalendarHeatmap` y
`HourHeatmap`; colores por nivel con `levelColor`/`levelBackground` y degradados con `barGradient` (`charts/colors.ts`).
Se animan al entrar en pantalla con `useInView`.

Celebraciones: `burst(host, colores)` (`components/fx/burst.ts`) lanza chispas y una onda desde un elemento; no hace
nada con "reducir movimiento".

## Clases del sistema (`globals.css`)

- Superficies: `card-glass`, `card-tint`, `card-feature`, `glass`.
- Fichas de icono: `tone-chip` (degradado, icono blanco), `tone-chip-soft` (fondo suave, icono del tono). Tamaños
  típicos: `h-8 w-8 rounded-xl`, `h-10 w-10 rounded-2xl`, `h-12 w-12 rounded-[16px]`.
- Texto: `num-xl` (cifra grande de display), `eyebrow` (etiqueta en mayúsculas del tono), `text-gradient` (marca),
  `text-tone-gradient` (tono), `text-gold`, `font-display`, `tabular`.
- Control segmentado: `seg` en el contenedor; el elemento activo con `aria-pressed="true"`, `aria-current="page"`,
  `aria-selected="true"` o `data-active="true"`.
- Interacción: `spotlight` (luz al cursor), `lift` (elevación de tarjetas-enlace), `press` (escala al pulsar),
  `shine` (brillo que cruza un botón).
- Animación: `animate-in`, `page-in`, `stagger` (hijos escalonados), `pop-in`, `bar-in`, `grow-up` (barras
  verticales), `ring-in`, `animate-float`, `animate-glow`, `skeleton`, `live-dot`.
- Aparición al hacer scroll: añade `data-reveal` a bloques que están debajo del primer pantallazo (no en lo que se ve
  al cargar). Es solo CSS (`animation-timeline: view()`): avanza con el scroll, no toca el DOM y, sin soporte o con
  "reducir movimiento", el bloque se ve sin animación. Para escalonar elementos de una misma fila usa
  `data-reveal="60"`, `"120"`, `"240"` o `"360"`. `reveal-grow` hace crecer una barra horizontal al verse.
- Utilidades: `no-scrollbar` (filas que se desplazan en horizontal), `select-chevron` (flecha propia de los `<select>`,
  ya incluida en `Select`).
- Decoración: `dot-grid` (rejilla de puntos), manchas de color con `bg-tone opacity-[0.15] blur-3xl rounded-full`
  en un `absolute` con `pointer-events-none` y `aria-hidden`.

Las clases del sistema están en `@layer components`, así que cualquier utilidad de Tailwind las sobrescribe. El foco
global (`:focus-visible`) está en `@layer base`: `focus:outline-none` lo anula donde haya un foco propio.

La luz que sigue al cursor (`spotlight`) la mueve `<Interactions />`, montado en el `AppShell`; una página pública que
use `spotlight` debe montarlo también (como la portada).

## Patrones

- **Página:** `PageHeader` → (opcional) tarjeta destacada → rejilla de `StatTile` → contenido en tarjetas `glass`.
  Espaciado entre bloques `gap-5`/`space-y-6`; tarjetas `rounded-[26px]`, internas `rounded-2xl`.
- **Catálogos grandes (Ideas):** una sugerencia destacada, accesos por intención y un buscador con áreas visibles.
  Los filtros avanzados se despliegan y cada filtro activo se puede quitar por separado. Las tarjetas muestran
  los primeros pasos; la vista de lista compacta permite comparar. En la tarjeta destacada, profundizar los tonos
  del degradado cuando sea necesario para mantener legibles los textos pequeños. La inspiración adicional se
  despliega bajo demanda y no debe cambiar de tamaño mientras se escribe en el buscador.
- **Listas:** filas `rounded-2xl px-3 py-2.5` con `hover:bg-surface-2/60`, separadas por espacio, no por bordes
  grises. Acciones secundarias visibles al pasar por encima en escritorio, siempre visibles en táctil.
- **Datos:** el tono de la sección para la serie principal, `--tone-2` para la secundaria; categorías con su color
  propio. Barras con esquinas redondeadas y degradado; ejes y rejillas muy tenues (`--grid-line`).
- **Estados:** vacío con `EmptyState` (icono + frase amable + acción); éxito en verde o oro; error en `danger`.
- **Tarjetas destacadas:** el tono se oscurece solo dentro de `card-feature` (más en modo oscuro) para que el texto
  blanco se lea; no añadas capas oscuras propias. Decoraciones que se salen de una tarjeta → `overflow-clip`, no
  `overflow-hidden` (con hidden la tarjeta se vuelve desplazable y el foco puede moverla).
- **Tarjetas que cambian según su ancho:** consultas de contenedor de Tailwind (`@container` en el padre, `@3xl:` en
  los hijos), como la tarjeta de tareas rápidas en el Inicio frente a `/microtasks`.
- **Overlays fijos dentro de una página** (p. ej. el modo sin distracciones): renderízalos con `createPortal` en
  `document.body`.
- **Accesibilidad:** contraste AA en claro y oscuro; foco visible (ya global); iconos decorativos con `aria-hidden`;
  no quites textos, etiquetas, roles ni `data-testid`: las pruebas E2E dependen de ellos.
