import { cn } from "@/lib/cn";

/**
 * Cifra con las unidades en pequeño: "1 h 28 min" → 1 h 28 min con "h" y "min" más discretos.
 * El texto completo no cambia (los espacios se conservan), así que se lee y se busca igual.
 */
export function Units({ text, className }: { text: string; className?: string }) {
  if (!/\d/.test(text)) return <>{text}</>;
  const parts = text.split(/(\d+(?:[.,]\d+)?)/);
  return (
    <>
      {parts.map((p, i) =>
        p === "" ? null : /^\d/.test(p) ? (
          <span key={i}>{p}</span>
        ) : (
          <span key={i} className={cn("text-[0.5em] font-semibold tracking-normal opacity-70", className)}>
            {p}
          </span>
        ),
      )}
    </>
  );
}
