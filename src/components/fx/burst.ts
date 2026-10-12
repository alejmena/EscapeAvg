/**
 * Celebración breve: chispas y una onda que salen del centro de `host` (Web Animations API, sin CSS extra).
 * `host` debe ser un elemento posicionado y vacío dentro de un contenedor con overflow oculto.
 * Con "reducir movimiento" no hace nada.
 */
export function burst(host: HTMLElement | null, colors: string[], { count = 16, spread = 56 }: { count?: number; spread?: number } = {}) {
  try {
    if (!host || matchMedia("(prefers-reduced-motion: reduce)").matches || typeof host.animate !== "function") return;
    const easing = "cubic-bezier(0.22, 1, 0.36, 1)";
    const ring = document.createElement("span");
    Object.assign(ring.style, {
      position: "absolute",
      left: "50%",
      top: "50%",
      width: `${spread}px`,
      height: `${spread}px`,
      margin: `${-spread / 2}px 0 0 ${-spread / 2}px`,
      borderRadius: "999px",
      border: `2px solid ${colors[0]}`,
      pointerEvents: "none",
    });
    host.appendChild(ring);
    ring.animate([{ transform: "scale(0.3)", opacity: 0.9 }, { transform: "scale(2.2)", opacity: 0 }], { duration: 700, easing }).onfinish = () => ring.remove();

    for (let i = 0; i < count; i++) {
      const p = document.createElement("span");
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
      const dist = spread * (0.7 + Math.random() * 0.6);
      const size = 4 + Math.random() * 5;
      Object.assign(p.style, {
        position: "absolute",
        left: "50%",
        top: "50%",
        width: `${size}px`,
        height: `${i % 3 === 0 ? size * 1.8 : size}px`,
        margin: `${-size / 2}px 0 0 ${-size / 2}px`,
        borderRadius: i % 3 === 0 ? "2px" : "999px",
        background: colors[i % colors.length],
        pointerEvents: "none",
      });
      host.appendChild(p);
      const x = Math.cos(angle) * dist;
      const y = Math.sin(angle) * dist;
      p.animate(
        [
          { transform: "translate(0, 0) scale(0.3)", opacity: 0 },
          { transform: `translate(${x * 0.8}px, ${y * 0.8}px) scale(1)`, opacity: 1, offset: 0.45 },
          { transform: `translate(${x}px, ${y + 16}px) scale(0.4) rotate(${Math.round(Math.random() * 220)}deg)`, opacity: 0 },
        ],
        { duration: 760 + Math.random() * 420, delay: Math.random() * 90, easing, fill: "backwards" },
      ).onfinish = () => p.remove();
    }
  } catch {
    // Solo decorativo.
  }
}
