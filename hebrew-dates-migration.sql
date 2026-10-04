-- ═════════════════════════════════════════════════════════════════════════════
-- nahel-hakol — events that repeat on the Hebrew date
--
-- A Hebrew birthday or a yahrzeit falls on a different Gregorian day every
-- year, so day + month can't describe it. These columns hold the Hebrew date
-- it repeats on; the app works out each year's Gregorian date
-- (src/lib/hebrew-date.ts). day / month keep the occurrence it was saved for.
--
--   hebrew_day   — 1-30
--   hebrew_month — hebcal numbering: 1 = Nisan … 7 = Tishrei … 12 = Adar (Adar I
--                  in a leap year), 13 = Adar II
--   hebrew_year  — the Hebrew year of the original date, or a stand-in year
--                  when it isn't known (it decides which Adar is meant)
--
-- Paste into Supabase → SQL Editor → Run.
--
-- Safe to run more than once. Nothing here changes or deletes existing rows:
-- every current event keeps NULLs and goes on repeating on its Gregorian date.
-- ═════════════════════════════════════════════════════════════════════════════


-- ─── 1. COLUMNS ──────────────────────────────────────────────────────────────

ALTER TABLE public.events ADD COLUMN IF NOT EXISTS hebrew_day   smallint;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS hebrew_month smallint;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS hebrew_year  smallint;


-- ─── 2. CONSTRAINTS ──────────────────────────────────────────────────────────
-- All three or none, each in range. The IS NOT NULLs matter: a CHECK that
-- comes out NULL passes, so without them a lone hebrew_day would get through.

ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_hebrew_date_check;
ALTER TABLE public.events ADD CONSTRAINT events_hebrew_date_check CHECK (
  (hebrew_day IS NULL AND hebrew_month IS NULL AND hebrew_year IS NULL)
  OR (
    hebrew_day IS NOT NULL AND hebrew_month IS NOT NULL AND hebrew_year IS NOT NULL
    AND hebrew_day   BETWEEN 1 AND 30
    AND hebrew_month BETWEEN 1 AND 13
    AND hebrew_year  BETWEEN 5600 AND 6000
  )
);


-- ─── 3. API ──────────────────────────────────────────────────────────────────
-- So the app sees the new columns right away.

NOTIFY pgrst, 'reload schema';


-- ─── 4. REPORT ───────────────────────────────────────────────────────────────
-- Read-only.

SELECT column_name, data_type
  FROM information_schema.columns
 WHERE table_schema = 'public' AND table_name = 'events' AND column_name LIKE 'hebrew_%'
 ORDER BY column_name;
