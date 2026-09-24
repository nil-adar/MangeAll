-- ═════════════════════════════════════════════════════════════════════════════
-- שיתוף רשימת הקניות — עם אישור הצטרפות ורשימת חברים
-- הרץ ב-Supabase ← SQL Editor ← Run. מחליף גרסאות קודמות.
-- בטוח להרצה חוזרת. לא מוחק שום שורה.
-- ═════════════════════════════════════════════════════════════════════════════


-- ─── 1. טבלאות ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.households (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code       text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.household_members (
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (household_id, user_id)
);

-- pending = ביקש להצטרף וממתין לאישור. קיימים נשארים active.
ALTER TABLE public.household_members
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'household_members_status_values') THEN
    ALTER TABLE public.household_members ADD CONSTRAINT household_members_status_values
      CHECK (status IN ('active', 'pending')) NOT VALID;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS household_members_one_per_user
  ON public.household_members (user_id);

ALTER TABLE public.shopping_items
  ADD COLUMN IF NOT EXISTS household_id uuid REFERENCES public.households(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS shopping_items_household_idx
  ON public.shopping_items (household_id) WHERE household_id IS NOT NULL;


-- ─── 2. מי אני ───────────────────────────────────────────────────────────────

/** רק חברות מאושרת נותנת גישה לרשימה. */
CREATE OR REPLACE FUNCTION public.my_household_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT household_id FROM public.household_members
   WHERE user_id = auth.uid() AND status = 'active' LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.i_own_household()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.households
     WHERE id = public.my_household_id() AND owner_id = auth.uid()
  );
$$;


-- ─── 3. הרשאות ───────────────────────────────────────────────────────────────

ALTER TABLE public.households        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members read household" ON public.households;
CREATE POLICY "members read household" ON public.households
  FOR SELECT TO authenticated USING (id = public.my_household_id());

DROP POLICY IF EXISTS "read own membership" ON public.household_members;
CREATE POLICY "read own membership" ON public.household_members
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "own rows" ON public.shopping_items;
DROP POLICY IF EXISTS "own or household rows" ON public.shopping_items;
CREATE POLICY "own or household rows" ON public.shopping_items
  FOR ALL TO authenticated
  USING (
    user_id = auth.uid()
    OR (household_id IS NOT NULL AND household_id = public.my_household_id())
  )
  WITH CHECK (
    user_id = auth.uid()
    OR (household_id IS NOT NULL AND household_id = public.my_household_id())
  );


-- ─── 4. פריט חדש נכנס אוטומטית לרשימה המשותפת ───────────────────────────────

CREATE OR REPLACE FUNCTION public.stamp_household()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.household_id IS NULL THEN
    NEW.household_id := public.my_household_id();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS shopping_items_stamp_household ON public.shopping_items;
CREATE TRIGGER shopping_items_stamp_household
  BEFORE INSERT ON public.shopping_items
  FOR EACH ROW EXECUTE FUNCTION public.stamp_household();


-- ─── 5. יצירה והצטרפות ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.generate_household_code()
RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';  -- בלי O/0/I/1
  candidate text; i int;
BEGIN
  LOOP
    candidate := '';
    FOR i IN 1..6 LOOP
      candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.households WHERE code = candidate);
  END LOOP;
  RETURN candidate;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_household()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); hid uuid; hcode text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  SELECT household_id INTO hid FROM public.household_members
   WHERE user_id = uid AND status = 'active';
  IF hid IS NOT NULL THEN
    SELECT code INTO hcode FROM public.households WHERE id = hid;
    RETURN hcode;
  END IF;

  hcode := public.generate_household_code();
  INSERT INTO public.households (owner_id, code) VALUES (uid, hcode) RETURNING id INTO hid;

  DELETE FROM public.household_members WHERE user_id = uid;       -- clear a stale request
  INSERT INTO public.household_members (household_id, user_id, status)
       VALUES (hid, uid, 'active');

  UPDATE public.shopping_items SET household_id = hid
   WHERE user_id = uid AND household_id IS NULL;

  RETURN hcode;
END;
$$;

/** בקשת הצטרפות. מחזיר 'pending' / 'joined' / 'not_found'. */
DROP FUNCTION IF EXISTS public.join_household(text);
CREATE FUNCTION public.join_household(join_code text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); hid uuid; existing text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  SELECT id INTO hid FROM public.households WHERE upper(code) = upper(trim(join_code));
  IF hid IS NULL THEN RETURN 'not_found'; END IF;

  SELECT status INTO existing FROM public.household_members
   WHERE user_id = uid AND household_id = hid;
  IF existing = 'active' THEN RETURN 'joined'; END IF;
  IF existing = 'pending' THEN RETURN 'pending'; END IF;

  DELETE FROM public.household_members WHERE user_id = uid;
  INSERT INTO public.household_members (household_id, user_id, status)
       VALUES (hid, uid, 'pending');
  RETURN 'pending';
END;
$$;

/** עזיבה, או ביטול בקשה שממתינה. */
CREATE OR REPLACE FUNCTION public.leave_household()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  UPDATE public.shopping_items SET household_id = NULL WHERE user_id = uid;
  DELETE FROM public.household_members WHERE user_id = uid;
END;
$$;


-- ─── 6. ניהול חברים (בעל הרשימה בלבד) ────────────────────────────────────────

/**
 * מי ברשימה. שם התצוגה בלבד, בלי כתובת מייל.
 * SECURITY DEFINER כדי לא לפתוח את user_settings לקריאה של אחרים.
 */
CREATE OR REPLACE FUNCTION public.household_people()
RETURNS TABLE (user_id uuid, name text, status text, is_owner boolean, is_me boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT m.user_id,
         COALESCE(NULLIF(btrim(s.display_name), ''), 'חבר/ה') AS name,
         m.status,
         (h.owner_id = m.user_id) AS is_owner,
         (m.user_id = auth.uid()) AS is_me
    FROM public.household_members m
    JOIN public.households h ON h.id = m.household_id
    LEFT JOIN public.user_settings s ON s.user_id = m.user_id
   WHERE m.household_id = public.my_household_id()
   ORDER BY (h.owner_id = m.user_id) DESC, m.status, m.joined_at;
$$;

CREATE OR REPLACE FUNCTION public.approve_member(member_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE hid uuid := public.my_household_id();
BEGIN
  IF NOT public.i_own_household() THEN RAISE EXCEPTION 'only the owner can approve'; END IF;

  UPDATE public.household_members SET status = 'active', joined_at = now()
   WHERE household_id = hid AND user_id = member_id AND status = 'pending';

  -- הפריטים שלו נכנסים לרשימה המשותפת
  UPDATE public.shopping_items SET household_id = hid
   WHERE user_id = member_id AND household_id IS NULL;
END;
$$;

/** דחיית בקשה או הסרת חבר. הפריטים שלו חוזרים אליו. */
CREATE OR REPLACE FUNCTION public.remove_member(member_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE hid uuid := public.my_household_id();
BEGIN
  IF NOT public.i_own_household() THEN RAISE EXCEPTION 'only the owner can remove'; END IF;
  IF member_id = auth.uid() THEN RAISE EXCEPTION 'use leave_household instead'; END IF;

  UPDATE public.shopping_items SET household_id = NULL WHERE user_id = member_id;
  DELETE FROM public.household_members
   WHERE household_id = hid AND user_id = member_id;
END;
$$;

/** הקוד, כמה מאושרים, כמה ממתינים, והאם אני הבעלים. */
DROP FUNCTION IF EXISTS public.my_household();
CREATE FUNCTION public.my_household()
RETURNS TABLE (code text, member_count int, pending_count int, is_owner boolean, my_status text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT h.code,
         (SELECT count(*)::int FROM public.household_members m
           WHERE m.household_id = h.id AND m.status = 'active'),
         (SELECT count(*)::int FROM public.household_members m
           WHERE m.household_id = h.id AND m.status = 'pending'),
         (h.owner_id = auth.uid()),
         me.status
    FROM public.household_members me
    JOIN public.households h ON h.id = me.household_id
   WHERE me.user_id = auth.uid()
   LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.generate_household_code() FROM public, anon;


-- ─── 7. עדכון חי ─────────────────────────────────────────────────────────────

ALTER TABLE public.shopping_items    REPLICA IDENTITY FULL;
ALTER TABLE public.household_members REPLICA IDENTITY FULL;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['shopping_items', 'household_members'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;


-- ─── 8. בדיקה ────────────────────────────────────────────────────────────────

SELECT 'households' AS check, count(*)::text AS result FROM public.households
UNION ALL
SELECT 'active members', count(*)::text FROM public.household_members WHERE status = 'active'
UNION ALL
SELECT 'pending requests', count(*)::text FROM public.household_members WHERE status = 'pending'
UNION ALL
SELECT 'shared items', count(*)::text FROM public.shopping_items WHERE household_id IS NOT NULL
UNION ALL
SELECT 'realtime ready',
       CASE WHEN (SELECT count(*) FROM pg_publication_tables
                   WHERE pubname='supabase_realtime'
                     AND tablename IN ('shopping_items','household_members')) = 2
            THEN 'yes' ELSE 'NO' END;
