import type { RecurrenceRule } from "@/lib/domain/recurrence";
import type { HabitFrequency, HabitLogStatus } from "@/lib/domain/habits";
import type { SessionKind, SessionStatus } from "@/lib/domain/timer";
import type { GoalMetric, GoalPeriod } from "@/lib/domain/goals";

export type Profile = {
  id: string;
  display_name: string | null;
  username: string | null;
  timezone: string;
  week_starts_on: number;
  pomodoro_settings: unknown;
  weekly_focus_goal_minutes: number;
  streaks_enabled: boolean;
  share_stats: boolean;
  /** Objetivo diario de horas productivas (minutos). Ausente hasta aplicar la migración de disciplina. */
  daily_goal_minutes?: number | null;
};

export type Category = {
  id: string;
  name: string;
  color: string;
  icon: string | null;
  position: number;
  /** Ausente hasta aplicar la migración de disciplina (equivale a true). */
  counts_as_development?: boolean;
};

export type Project = {
  id: string;
  name: string;
  description: string | null;
  category_id: string | null;
  status: "active" | "paused" | "done" | "archived";
  target_date: string | null;
};

export type TaskStatus = "todo" | "in_progress" | "done" | "archived";

export type Task = {
  id: string;
  parent_id: string | null;
  project_id: string | null;
  category_id: string | null;
  title: string;
  notes: string | null;
  priority: 0 | 1 | 2 | 3;
  status: TaskStatus;
  due_date: string | null;
  estimated_minutes: number | null;
  actual_seconds: number;
  progress_current: number;
  progress_target: number | null;
  progress_unit: string | null;
  recurrence: RecurrenceRule | null;
  recurrence_source_id: string | null;
  postponed_count: number;
  position: number;
  completed_at: string | null;
  created_at: string;
};

export type FocusSession = {
  id: string;
  task_id: string | null;
  kind: SessionKind;
  status: SessionStatus;
  planned_seconds: number | null;
  started_at: string;
  ended_at: string | null;
  paused_at: string | null;
  paused_seconds: number;
  focus_seconds: number | null;
  note: string | null;
  title?: string | null;
  category_id?: string | null;
  quality?: number | null;
  outcome?: string | null;
};

export type Habit = {
  id: string;
  name: string;
  description: string | null;
  category_id: string | null;
  color: string;
  frequency: HabitFrequency;
  times_per_week: number | null;
  days_of_week: number[] | null;
  target_value: number | null;
  unit: string | null;
  streaks_enabled: boolean;
  position: number;
  archived_at: string | null;
  created_at: string;
};

export type HabitLog = {
  id: string;
  habit_id: string;
  log_date: string;
  status: HabitLogStatus;
  value: number | null;
};

export type Goal = {
  id: string;
  title: string;
  description: string | null;
  metric: GoalMetric;
  period: GoalPeriod;
  start_date: string | null;
  end_date: string | null;
  target_value: number;
  manual_value: number;
  category_id: string | null;
  status: "active" | "achieved" | "archived";
};

export type Board = { id: string; name: string; color: string; position: number };

export type NoteColor = "yellow" | "pink" | "blue" | "green" | "purple" | "orange" | "gray";

export type Note = {
  id: string;
  board_id: string;
  content: string;
  color: NoteColor;
  x: number;
  y: number;
  width: number;
  height: number;
  z_index: number;
  group_label: string | null;
  task_id: string | null;
};

export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };
