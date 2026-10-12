"use client";

import { useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/cn";

export type Theme = "light" | "dark" | "system";

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

/** Tema elegido (claro, oscuro o el del sistema), compartido por todos los selectores de la app. */
export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, readTheme, () => "system" as Theme);
}

export function setTheme(t: Theme) {
  try {
    localStorage.setItem("theme", t);
  } catch {
    // Almacenamiento no disponible: el tema se aplica igualmente en esta sesión.
  }
  apply(t);
  listeners.forEach((l) => l());
}

export function ThemeToggle({ className }: { className?: string }) {
  const theme = useTheme();
  const choose = setTheme;
  const opts: { value: Theme; icon: React.ReactNode; label: string }[] = [
    { value: "light", icon: <Sun size={14} />, label: "Claro" },
    { value: "dark", icon: <Moon size={14} />, label: "Oscuro" },
    { value: "system", icon: <Monitor size={14} />, label: "Sistema" },
  ];
  return (
    <div className={cn("inline-flex rounded-full border border-border bg-surface-2/60 p-0.5", className)} role="radiogroup" aria-label="Tema">
      {opts.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={theme === o.value}
          title={o.label}
          onClick={() => choose(o.value)}
          className={cn(
            "press rounded-full p-1.5",
            theme === o.value ? "bg-surface text-text shadow-[0_1px_2px_rgb(21_19_43/0.1)] dark:bg-surface-3" : "text-muted hover:text-text",
          )}
        >
          {o.icon}
        </button>
      ))}
    </div>
  );
}
