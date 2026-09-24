/**
 * Task status over time.
 *
 * Tasks store `due` as a label picked at creation ("היום", "מחר", "השבוע",
 * "בהמשך") — not a date. So a task created three days ago with due="היום"
 * still claimed to be today's. Combining that label with `created_at` gives
 * the deadline it actually meant, and anything past it is overdue.
 */

export type TaskBucket = "overdue" | "today" | "soon" | "later";

export const BUCKET_LABEL: Record<TaskBucket, string> = {
  overdue: "באיחור",
  today: "היום",
  soon: "השבוע",
  later: "בהמשך",
};

/** How many days after creation the label allows. null = no deadline. */
function horizonOf(due: string): number | null {
  const d = due ?? "";
  if (d.includes("היום")) return 0;
  if (d.includes("מחר")) return 1;
  if (d.includes("השבוע")) return 7;
  return null; // "בהמשך" and anything unrecognised never goes overdue
}

/** Whole days between two dates, counting from midnight to midnight. */
function daysBetween(fromISO: string, to: Date): number | null {
  if (!fromISO) return null;
  const from = new Date(fromISO);
  if (Number.isNaN(from.getTime())) return null;
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const b = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

export type TaskLike = { due: string; created_at: string };

/** Days past the deadline; 0 when not overdue. */
export function daysLate(task: TaskLike, now = new Date()): number {
  const horizon = horizonOf(task.due);
  if (horizon === null) return 0;
  const age = daysBetween(task.created_at, now);
  if (age === null || age <= horizon) return 0;
  return age - horizon;
}

export function taskBucket(task: TaskLike, now = new Date()): TaskBucket {
  if (daysLate(task, now) > 0) return "overdue";
  const d = task.due ?? "";
  if (d.includes("היום")) return "today";
  if (d.includes("מחר") || d.includes("השבוע")) return "soon";
  return "later";
}

/** "באיחור 3 ימים" / "באיחור יום" — for the overdue chip. */
export function lateLabel(days: number): string {
  if (days <= 0) return "";
  if (days === 1) return "באיחור יום";
  return `באיחור ${days} ימים`;
}

export const BUCKET_ORDER: TaskBucket[] = ["overdue", "today", "soon", "later"];
