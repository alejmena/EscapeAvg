"use client";

import { useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/cn";

type Theme = "light" | "dark" | "system";

const listeners = new Set<() => void>();

function readTheme(): Theme {
  try {
    const t = localStorage.getItem("theme");
    return t === "light" || t === "dark" ? t : "system";
  } catch {
    return "system";
  }
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

function apply(theme: Theme) {
  const dark = theme === "dark" || (theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

export function ThemeToggle({ className }: { className?: string }) {
  const theme = useSyncExternalStore(subscribe, readTheme, () => "system" as Theme);
  const choose = (t: Theme) => {
    try {
      localStorage.setItem("theme", t);
    } catch {
      // Almacenamiento no disponible: el tema se aplica igualmente en esta sesión.
    }
    apply(t);
    listeners.forEach((l) => l());
  };
  const opts: { value: Theme; icon: React.ReactNode; label: string }[] = [
    { value: "light", icon: <Sun size={14} />, label: "Claro" },
    { value: "dark", icon: <Moon size={14} />, label: "Oscuro" },
    { value: "system", icon: <Monitor size={14} />, label: "Sistema" },
  ];
  return (
    <div className={cn("inline-flex rounded-lg border border-border p-0.5", className)} role="radiogroup" aria-label="Tema">
      {opts.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={theme === o.value}
          title={o.label}
          onClick={() => choose(o.value)}
          className={cn("rounded-md p-1.5", theme === o.value ? "bg-surface-2 text-text" : "text-muted hover:text-text")}
        >
          {o.icon}
        </button>
      ))}
    </div>
  );
}
