import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import type { Board, Note } from "@/lib/types";
import { BoardView, type NotePreview } from "@/components/notes/board-view";

export const metadata: Metadata = { title: "Notas" };

export default async function BoardPage({ params }: { params: Promise<{ boardId: string }> }) {
  const { boardId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(boardId)) notFound();
  const { supabase } = await requireUser();
  const [boardsRes, notesRes, previewRes] = await Promise.all([
    supabase.from("boards").select("*").order("position").order("created_at"),
    supabase.from("notes").select("*").eq("board_id", boardId).order("z_index"),
    // Solo para las miniaturas de los tableros (posición y color de cada nota).
    supabase.from("notes").select("board_id, color, x, y, width, height"),
  ]);
  const boards = (boardsRes.data ?? []) as Board[];
  const board = boards.find((b) => b.id === boardId);
  if (!board) notFound();
  const previews: Record<string, NotePreview[]> = {};
  for (const n of (previewRes.data ?? []) as (NotePreview & { board_id: string })[]) (previews[n.board_id] ??= []).push(n);
  return <BoardView key={board.id} board={board} boards={boards} previews={previews} initialNotes={(notesRes.data ?? []) as Note[]} />;
}
