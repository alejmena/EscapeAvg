"use client";

import { CalendarArrowUp } from "lucide-react";
import { updateTask } from "@/app/(app)/tasks/actions";
import { Button } from "@/components/ui/button";
import { useAction } from "@/components/tasks/use-action";

/** Mueve conscientemente una tarea que no cabe hoy a otro día. */
export function MoveTaskButton({ id, to, label }: { id: string; to: string; label: string }) {
  const { run, pending, error } = useAction();
  return (
    <span className="flex items-center gap-2">
      <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => updateTask(id, { due_date: to }))}>
        <CalendarArrowUp size={14} />
        {label}
      </Button>
      {error && <span className="text-xs text-danger">{error}</span>}
    </span>
  );
}
