import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import type { Board, Note } from "@/lib/types";
import { BoardView } from "@/components/notes/board-view";

export const metadata: Metadata = { title: "Notas" };

export default async function BoardPage({ params }: { params: Promise<{ boardId: string }> }) {
  const { boardId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(boardId)) notFound();
  const { supabase } = await requireUser();
  const [boardsRes, notesRes] = await Promise.all([
    supabase.from("boards").select("*").order("position").order("created_at"),
    supabase.from("notes").select("*").eq("board_id", boardId).order("z_index"),
  ]);
  const boards = (boardsRes.data ?? []) as Board[];
  const board = boards.find((b) => b.id === boardId);
  if (!board) notFound();
  return <BoardView key={board.id} board={board} boards={boards} initialNotes={(notesRes.data ?? []) as Note[]} />;
}
