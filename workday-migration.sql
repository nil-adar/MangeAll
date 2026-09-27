-- ═════════════════════════════════════════════════════════════════════════════
-- nahel-hakol — daily work-status tracking (work_days table)
--
-- Adds the table behind the "איפה עבדת היום?" home-page question and the
-- /workday monthly log. Paste into Supabase → SQL Editor → Run.
--
-- Safe to run more than once: every step checks before it changes anything.
-- Nothing here deletes rows.
-- ═════════════════════════════════════════════════════════════════════════════


-- ─── 1. TABLE ────────────────────────────────────────────────────────────────
-- One row per user per day. status is one of: office / home / off / sick / absent
-- (see WORK_STATUS in src/lib/queries.ts — keep the two in sync).

CREATE TABLE IF NOT EXISTS public.work_days (
  user_id    uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  date       date NOT NULL,
  status     text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, date)
);

ALTER TABLE public.work_days DROP CONSTRAINT IF EXISTS work_days_status_check;
ALTER TABLE public.work_days ADD CONSTRAINT work_days_status_check
  CHECK (status IN ('office', 'home', 'off', 'sick', 'absent'));


-- ─── 2. INDEXES ──────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS work_days_user_date_idx ON public.work_days (user_id, date DESC);


-- ─── 3. ROW LEVEL SECURITY ───────────────────────────────────────────────────

ALTER TABLE public.work_days ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own rows" ON public.work_days;
CREATE POLICY "own rows" ON public.work_days FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);


-- ─── 4. REPORT ───────────────────────────────────────────────────────────────
-- Shows what you have after the migration. Read-only.

SELECT 'work_days total'  AS check, count(*)::text AS result FROM public.work_days
UNION ALL
SELECT 'RLS off on: work_days', ''
  FROM pg_tables
 WHERE schemaname = 'public' AND tablename = 'work_days' AND NOT rowsecurity;
