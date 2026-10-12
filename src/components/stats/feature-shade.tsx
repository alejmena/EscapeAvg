/**
 * Decoración de las tarjetas destacadas de Estadísticas: un brillo arriba a la derecha y una sombra
 * suave bajo el texto (el tono ya se oscurece en .card-feature para que el blanco se lea bien).
 */
export function FeatureShade() {
  return (
    <>
      <div className="animate-glow pointer-events-none absolute -right-20 -top-28 h-72 w-72 rounded-full bg-surface-3 blur-3xl" aria-hidden />
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(90%_110%_at_0%_100%,rgb(0_0_0/0.14),transparent_65%)]"
        aria-hidden
      />
    </>
  );
}
