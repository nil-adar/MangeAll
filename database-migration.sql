-- ═════════════════════════════════════════════════════════════════════════════
-- nahel-hakol — database cleanup & migration
--
-- Replaces profile-setup.sql and supabase-checklist.sql. Paste the whole file
-- into Supabase → SQL Editor → Run.
--
-- Safe to run more than once: every step checks before it changes anything.
-- Nothing here deletes rows.
-- ═════════════════════════════════════════════════════════════════════════════


-- ─── 1. TABLES ───────────────────────────────────────────────────────────────
-- CREATE IF NOT EXISTS for a fresh project; ADD COLUMN IF NOT EXISTS brings an
-- existing one up to what the app actually reads and writes.

CREATE TABLE IF NOT EXISTS public.events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title       text NOT NULL,
  day         smallint NOT NULL,
  month       smallint,
  time        text NOT NULL DEFAULT 'כל היום',
  end_time    text,
  location    text,
  category    text NOT NULL DEFAULT 'family',
  is_birthday boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);
-- The app saves `month` on every event. If this column was missing, every
-- birthday insert failed and the entry was lost: the "birthdays don't show" bug.
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS month smallint;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS is_birthday boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.tasks (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title      text NOT NULL,
  due        text NOT NULL DEFAULT 'היום',
  priority   text NOT NULL DEFAULT 'רגילה',
  category   text NOT NULL DEFAULT 'work',
  done       boolean NOT NULL DEFAULT false,
  today      boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.expenses (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  vendor     text NOT NULL,
  amount     numeric(12,2) NOT NULL,
  category   text NOT NULL DEFAULT 'money',
  date       date NOT NULL DEFAULT current_date,
  repeat     text DEFAULT 'once',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.shopping_items (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title      text NOT NULL,
  quantity   numeric NOT NULL DEFAULT 1,
  unit       text,
  category   text NOT NULL DEFAULT 'shopping',
  checked    boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- The app reads/writes shopping_items.title and .quantity, but the old schema
-- file said name / qty. Rename only if the old names are what's really there.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='shopping_items' AND column_name='name')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='shopping_items' AND column_name='title') THEN
    ALTER TABLE public.shopping_items RENAME COLUMN name TO title;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='shopping_items' AND column_name='qty')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='shopping_items' AND column_name='quantity') THEN
    ALTER TABLE public.shopping_items RENAME COLUMN qty TO quantity;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.user_settings (
  user_id        uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  monthly_budget integer NOT NULL DEFAULT 6500,
  updated_at     timestamptz NOT NULL DEFAULT now()
);
-- Profile page: display name + photo
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS display_name text;
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS avatar_url   text;


-- ─── 2. DATA RULES ───────────────────────────────────────────────────────────
-- NOT VALID: enforced for new/updated rows only, so an odd existing row can't
-- make this script fail. Existing data is left untouched.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'events_day_range') THEN
    ALTER TABLE public.events ADD CONSTRAINT events_day_range
      CHECK (day BETWEEN 1 AND 31) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'events_month_range') THEN
    ALTER TABLE public.events ADD CONSTRAINT events_month_range
      CHECK (month IS NULL OR month BETWEEN 1 AND 12) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'expenses_repeat_values') THEN
    ALTER TABLE public.expenses ADD CONSTRAINT expenses_repeat_values
      CHECK (repeat IS NULL OR repeat IN ('once','monthly','yearly')) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'expenses_amount_positive') THEN
    ALTER TABLE public.expenses ADD CONSTRAINT expenses_amount_positive
      CHECK (amount > 0) NOT VALID;
  END IF;
END $$;


-- ─── 3. INDEXES ──────────────────────────────────────────────────────────────
-- Every query is filtered by user_id through RLS; these match the app's reads.

CREATE INDEX IF NOT EXISTS events_user_month_day_idx ON public.events (user_id, month, day);
CREATE INDEX IF NOT EXISTS events_user_birthday_idx  ON public.events (user_id) WHERE is_birthday;
CREATE INDEX IF NOT EXISTS tasks_user_created_idx    ON public.tasks (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS expenses_user_date_idx    ON public.expenses (user_id, date DESC);
CREATE INDEX IF NOT EXISTS shopping_user_created_idx ON public.shopping_items (user_id, created_at);


-- ─── 4. ROW LEVEL SECURITY ───────────────────────────────────────────────────
-- Each user sees and changes only their own rows. Without RLS on, any signed-in
-- user could read everyone's data with the public key.

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['events','tasks','expenses','shopping_items','user_settings'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "own rows" ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY "own rows" ON public.%I FOR ALL TO authenticated
         USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)', t);
  END LOOP;
END $$;


-- ─── 5. PROFILE PHOTOS (storage) ─────────────────────────────────────────────
-- Photos live at <user_id>/avatar.<ext>; the first folder must be your own id.

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Avatar images are publicly readable" ON storage.objects;
CREATE POLICY "Avatar images are publicly readable"
  ON storage.objects FOR SELECT USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Users manage their own avatar" ON storage.objects;
-- Clean up the per-verb policies from the earlier profile-setup.sql
DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;
CREATE POLICY "Users manage their own avatar"
  ON storage.objects FOR ALL TO authenticated
  USING      (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);


-- ─── 6. REPORT ───────────────────────────────────────────────────────────────
-- Shows what you have after the migration. Read-only.

SELECT 'birthdays total'           AS check, count(*)::text AS result FROM public.events WHERE is_birthday
UNION ALL
SELECT 'birthdays missing a month', count(*)::text FROM public.events WHERE is_birthday AND month IS NULL
UNION ALL
SELECT 'events missing a month',    count(*)::text FROM public.events WHERE NOT is_birthday AND month IS NULL
UNION ALL
SELECT 'RLS off on: ' || coalesce(string_agg(tablename, ', '), 'none'), ''
  FROM pg_tables
 WHERE schemaname = 'public'
   AND tablename IN ('events','tasks','expenses','shopping_items','user_settings')
   AND NOT rowsecurity;


-- ─── 7. OPTIONAL: fill in old events' month ──────────────────────────────────
-- Regular events saved before `month` existed repeat on that day every month.
-- This assumes each was meant for the month it was created in. Review the
-- "events missing a month" count above first, then uncomment to apply.
--
-- UPDATE public.events
--    SET month = EXTRACT(MONTH FROM created_at)::smallint
--  WHERE NOT is_birthday AND month IS NULL;
--
-- Birthdays missing a month can't be recovered (it was never stored). They
-- show as "תאריך חסר" on the birthdays page; delete and re-add them there.
