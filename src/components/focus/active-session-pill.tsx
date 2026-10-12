"use client";

import Link from "next/link";
import { Pause, Timer } from "lucide-react";
import { elapsedSeconds, formatClock, remainingSeconds } from "@/lib/domain/timer";
import type { FocusSession } from "@/lib/types";
import { useNow } from "./use-ticker";

export function ActiveSessionPill({ session }: { session: FocusSession }) {
  const now = useNow(session.status === "running");
  const remaining = remainingSeconds(session, now);
  const shown = remaining ?? elapsedSeconds(session, now);
  return (
    <Link
      href="/focus"
      data-tone="coral"
      className="press shine fixed bottom-28 right-4 z-40 flex items-center gap-2.5 rounded-full bg-gradient-to-br from-tone to-tone-2 py-2 pl-2.5 pr-4 text-sm font-semibold text-white shadow-[0_16px_32px_-12px_var(--tone)] lg:bottom-6"
    >
      <span className="grid h-7 w-7 place-items-center rounded-full bg-white/20">
        {session.status === "paused" ? <Pause size={14} /> : <Timer size={14} className="animate-pulse" />}
      </span>
      <span className="tabular font-display text-base">{formatClock(shown)}</span>
      <span className="text-white/80">{session.kind === "break" ? "Descanso" : session.status === "paused" ? "En pausa" : "Concentrado"}</span>
    </Link>
  );
}
