/** Esqueleto de carga: imita el patrón de página (encabezado, tarjeta destacada, cifras y contenido). */
export default function Loading() {
  return (
    <div className="animate-in space-y-6 [animation-delay:120ms]" aria-busy="true" aria-label="Cargando">
      <span className="sr-only">Cargando…</span>

      {/* Encabezado */}
      <div className="relative flex items-center gap-4 pb-2">
        <div className="pointer-events-none absolute -left-16 -top-20 h-56 w-56 rounded-full bg-tone opacity-[0.12] blur-3xl" aria-hidden />
        <div className="relative h-12 w-12 shrink-0 animate-pulse rounded-[16px] bg-gradient-to-br from-tone/45 to-tone-2/45 sm:h-14 sm:w-14 sm:rounded-[18px]" />
        <div className="relative space-y-2.5">
          <div className="skeleton h-3 w-28 rounded-full" />
          <div className="skeleton h-8 w-48 rounded-xl sm:h-10 sm:w-72" />
        </div>
      </div>

      {/* Tarjeta destacada */}
      <div className="card-tint relative overflow-hidden rounded-[26px] p-5 sm:p-6">
        <div className="flex items-center gap-5">
          <div className="h-20 w-20 shrink-0 animate-pulse rounded-full border-[7px] border-tone/30 sm:h-24 sm:w-24" />
          <div className="min-w-0 flex-1 space-y-3">
            <div className="skeleton h-3 w-24 rounded-full" />
            <div className="skeleton h-7 w-3/4 max-w-sm rounded-xl" />
            <div className="skeleton h-3 w-1/2 max-w-xs rounded-full" />
          </div>
        </div>
      </div>

      {/* Cifras */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="card-glass rounded-[22px] p-4 sm:p-5">
            <div className="flex items-center gap-2.5">
              <div className="skeleton h-8 w-8 rounded-xl" />
              <div className="skeleton h-3 w-16 rounded-full" />
            </div>
            <div className="skeleton mt-4 h-8 w-20 rounded-lg" />
          </div>
        ))}
      </div>

      {/* Contenido */}
      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="card-glass rounded-[26px] p-5 sm:p-6">
          <div className="mb-5 flex items-center gap-2.5">
            <div className="skeleton h-8 w-8 rounded-xl" />
            <div className="skeleton h-4 w-36 rounded-full" />
          </div>
          <div className="space-y-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 rounded-2xl px-1 py-2">
                <div className="skeleton h-5 w-5 shrink-0 rounded-full" />
                <div className="skeleton h-3.5 rounded-full" style={{ width: `${70 - i * 12}%` }} />
                <div className="skeleton ml-auto h-5 w-12 shrink-0 rounded-full" />
              </div>
            ))}
          </div>
        </div>
        <div className="card-glass rounded-[26px] p-5 sm:p-6">
          <div className="mb-5 flex items-center gap-2.5">
            <div className="skeleton h-8 w-8 rounded-xl" />
            <div className="skeleton h-4 w-28 rounded-full" />
          </div>
          <div className="flex h-36 items-end gap-2">
            {[45, 70, 55, 85, 60, 95, 50].map((h, i) => (
              <div
                key={i}
                className={i === 5 ? "flex-1 animate-pulse rounded-t-[10px] rounded-b-md bg-gradient-to-t from-tone/40 to-tone-2/40" : "skeleton flex-1 rounded-t-[10px] rounded-b-md"}
                style={{ height: `${h}%` }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
