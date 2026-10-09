"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";

const RANGES = [
  { id: "day", label: "Hoy" },
  { id: "week", label: "Semana" },
  { id: "month", label: "Mes" },
  { id: "30d", label: "30 días" },
  { id: "90d", label: "90 días" },
  { id: "year", label: "12 meses" },
  { id: "custom", label: "Rango" },
];

export function RangePicker({ current, from, to }: { current: string; from: string; to: string }) {
  const router = useRouter();
  const [f, setF] = useState(from);
  const [t, setT] = useState(to);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex flex-wrap rounded-xl border border-border bg-surface p-1">
        {RANGES.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => router.push(r.id === "custom" ? `/stats?range=custom&from=${f}&to=${t}` : `/stats?range=${r.id}`)}
            className={cn("rounded-lg px-3 py-1.5 text-sm", current === r.id ? "bg-accent-soft font-medium text-accent" : "text-muted hover:text-text")}
          >
            {r.label}
          </button>
        ))}
      </div>
      {current === "custom" && (
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            router.push(`/stats?range=custom&from=${f}&to=${t}`);
          }}
        >
          <Input type="date" value={f} onChange={(e) => setF(e.target.value)} className="h-9 w-auto" aria-label="Desde" />
          <Input type="date" value={t} onChange={(e) => setT(e.target.value)} className="h-9 w-auto" aria-label="Hasta" />
          <Button type="submit" size="sm" variant="secondary">
            Aplicar
          </Button>
        </form>
      )}
    </div>
  );
}
