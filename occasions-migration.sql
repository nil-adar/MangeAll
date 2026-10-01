-- ═════════════════════════════════════════════════════════════════════════════
-- nahel-hakol — life events ("שמחות": weddings, engagements, bar/bat mitzvahs,
-- brit, anniversaries) on the events table
--
-- Events store day + month only, so everything on the calendar repeats every
-- year. That's right for birthdays and anniversaries, wrong for a wedding.
-- This adds the columns behind the /occasions page:
--   occasion — which kind of life event (NULL = a regular event / birthday)
--   year     — the year it happens. One-time occasions only show in that year;
--              for an anniversary it's the year of the wedding ("שנה 5").
--   gift     — optional gift amount in ₪
--
-- Paste into Supabase → SQL Editor → Run.
--
-- Safe to run more than once: every step checks before it changes anything.
-- Nothing here deletes rows. Until it runs, the app still saves occasions —
-- it retries without the missing columns — but they repeat yearly.
-- ═════════════════════════════════════════════════════════════════════════════


-- ─── 1. COLUMNS ──────────────────────────────────────────────────────────────

ALTER TABLE public.events ADD COLUMN IF NOT EXISTS occasion text;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS year     int;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS gift     numeric(10, 2);


-- ─── 2. CONSTRAINTS ──────────────────────────────────────────────────────────
-- Keep in sync with OCCASION_ORDER in src/lib/occasions.ts.

ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_occasion_check;
ALTER TABLE public.events ADD CONSTRAINT events_occasion_check
  CHECK (occasion IS NULL OR occasion IN
    ('wedding', 'engagement', 'bar_mitzvah', 'bat_mitzvah', 'brit', 'anniversary'));

ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_year_range;
ALTER TABLE public.events ADD CONSTRAINT events_year_range
  CHECK (year IS NULL OR year BETWEEN 1900 AND 2200);

ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_gift_positive;
ALTER TABLE public.events ADD CONSTRAINT events_gift_positive
  CHECK (gift IS NULL OR gift >= 0);


-- ─── 3. INDEXES ──────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS events_user_occasion_idx ON public.events (user_id) WHERE occasion IS NOT NULL;


-- ─── 4. REPORT ───────────────────────────────────────────────────────────────
-- Shows what you have after the migration. Read-only.

SELECT 'occasions total'          AS check, count(*)::text AS result FROM public.events WHERE occasion IS NOT NULL
UNION ALL
SELECT 'occasions missing a year', count(*)::text FROM public.events WHERE occasion IS NOT NULL AND year IS NULL;
