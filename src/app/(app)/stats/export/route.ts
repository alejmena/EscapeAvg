import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { addDays, diffDays, isISODate } from "@/lib/domain/dates";
import { getDaily } from "@/lib/data/stats";

/** Exporta las estadísticas diarias del usuario en CSV (tus datos son tuyos). Máximo ~3 años por descarga. */
export async function GET(request: Request) {
  const { supabase, today } = await requireUser();
  const url = new URL(request.url);
  let to = url.searchParams.get("to") ?? today;
  let from = url.searchParams.get("from") ?? addDays(today, -364);
  if (!isISODate(to) || to > today) to = today;
  if (!isISODate(from) || from > to) from = addDays(to, -364);
  if (diffDays(to, from) > 1095) from = addDays(to, -1095);

  const days = await getDaily(supabase, from, to);
  const header = "fecha,minutos_concentracion,sesiones,interrupciones,tareas_completadas,habitos_cumplidos";
  const rows = days.map((d) => [d.day, (d.focus_seconds / 60).toFixed(1), d.focus_sessions, d.interruptions, d.tasks_completed, d.habits_done].join(","));
  return new NextResponse([header, ...rows].join("\n") + "\n", {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="escape-average_${from}_${to}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
