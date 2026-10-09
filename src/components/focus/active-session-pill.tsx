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
      className="fixed bottom-28 right-4 z-40 flex items-center gap-2 rounded-full bg-text px-4 py-2.5 text-sm font-medium text-bg shadow-lg lg:bottom-6"
    >
      {session.status === "paused" ? <Pause size={16} /> : <Timer size={16} className="animate-pulse" />}
      <span className="tabular">{formatClock(shown)}</span>
      <span className="text-bg/70">{session.kind === "break" ? "Descanso" : session.status === "paused" ? "En pausa" : "Concentrado"}</span>
    </Link>
  );
}
