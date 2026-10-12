"use client";

import { useRouter } from "next/navigation";
import { useEffect, useOptimistic, useState, useTransition } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { useStatsPending } from "@/components/stats/stats-pending";

const RANGES = [
  { id: "day", label: "Hoy" },
  { id: "week", label: "Semana" },
  { id: "month", label: "Mes" },
  { id: "30d", label: "30 días" },
  { id: "90d", label: "90 días" },
  { id: "ytd", label: "Este año" },
  { id: "year", label: "12 meses" },
  { id: "custom", label: "Rango" },
];

export function RangePicker({ current, from, to }: { current: string; from: string; to: string }) {
  const router = useRouter();
  const [f, setF] = useState(from);
  const [t, setT] = useState(to);
  const [pending, startTransition] = useTransition();
  // El botón elegido se marca al instante, aunque los datos tarden un momento en llegar.
  const [selected, setSelected] = useOptimistic(current);
  const setPagePending = useStatsPending();

  useEffect(() => {
    setPagePending(pending);
    return () => setPagePending(false);
  }, [pending, setPagePending]);

  const go = (id: string, url: string) =>
    startTransition(() => {
      setSelected(id);
      router.push(url, { scroll: false });
    });

  return (
    <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2">
      <div className="max-w-full overflow-x-auto rounded-full [scrollbar-width:none]">
        <div className="seg" role="group" aria-label="Período">
          {RANGES.map((r) => {
            const active = selected === r.id;
            return (
              <button
                key={r.id}
                type="button"
                aria-pressed={active}
                onClick={() => go(r.id, r.id === "custom" ? `/stats?range=custom&from=${f}&to=${t}` : `/stats?range=${r.id}`)}
                className="press aria-pressed:text-tone-ink"
              >
                {active && pending && <Loader2 size={13} className="animate-spin" aria-hidden />}
                {r.label}
              </button>
            );
          })}
        </div>
      </div>
      {current === "custom" && (
        <form
          className="pop-in flex flex-wrap items-center gap-2 rounded-full border border-border bg-surface/70 p-1 pl-2"
          onSubmit={(e) => {
            e.preventDefault();
            go("custom", `/stats?range=custom&from=${f}&to=${t}`);
          }}
        >
          <Input type="date" value={f} onChange={(e) => setF(e.target.value)} className="h-8 w-auto rounded-full px-3 text-[13px]" aria-label="Desde" />
          <ArrowRight size={14} className="text-faint" aria-hidden />
          <Input type="date" value={t} onChange={(e) => setT(e.target.value)} className="h-8 w-auto rounded-full px-3 text-[13px]" aria-label="Hasta" />
          <Button type="submit" size="sm" variant="tone">
            Aplicar
          </Button>
        </form>
      )}
    </div>
  );
}
