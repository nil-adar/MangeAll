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

-- קישור הזמנה אישי: כל שליחה יוצרת קישור חדש, לכניסה אחת, תקף 7 ימים. מי
-- שפותח אותו ומאשר — נכנס מיד, בלי אישור בעל הרשימה; קישור שהועבר הלאה
-- תקף רק לראשון שפותח. אין גישה ישירה לטבלה — רק דרך הפונקציות.
CREATE TABLE IF NOT EXISTS public.household_invite_links (
  token        text PRIMARY KEY DEFAULT replace(gen_random_uuid()::text, '-', ''),
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  created_by   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL DEFAULT now() + interval '7 days',
  used_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  used_at      timestamptz
);

-- הגרסה הקודמת: קישור אחד קבוע לכל רשימה, שעבד לכל מי שמחזיק בו. מוחלף
-- בקישורים האישיים — קישורים ישנים כאלה מפסיקים לעבוד.
ALTER TABLE public.households DROP COLUMN IF EXISTS invite_token;

-- הזמנה לפי אימייל: מחכה באפליקציה של המוזמן עד שיאשר או ידחה.
CREATE TABLE IF NOT EXISTS public.household_invites (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id    uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  invited_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invited_by      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (household_id, invited_user_id)
);


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

/**
 * שם התצוגה של משתמש: מההגדרות, אחרת השם שנתן בהרשמה, אחרת "חבר/ה".
 * לשימוש פנימי בלבד (לא נגיש ישירות) — כדי שאי אפשר יהיה לשלוף שמות לפי מזהה.
 */
CREATE OR REPLACE FUNCTION public.display_name_of(who uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT NULLIF(btrim(display_name), '') FROM public.user_settings WHERE user_id = who),
    (SELECT NULLIF(btrim(raw_user_meta_data->>'display_name'), '') FROM auth.users WHERE id = who),
    'חבר/ה'
  );
$$;
REVOKE ALL ON FUNCTION public.display_name_of(uuid) FROM public, anon, authenticated;


-- ─── 3. הרשאות ───────────────────────────────────────────────────────────────

ALTER TABLE public.households        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_invites ENABLE ROW LEVEL SECURITY;
-- בלי מדיניות קריאה בכלל: את הקישורים יוצרים, בודקים וממשים רק דרך הפונקציות
ALTER TABLE public.household_invite_links ENABLE ROW LEVEL SECURITY;

-- רק המוזמן רואה את ההזמנה שלו (כך היא מגיעה אליו גם בזמן אמת).
-- יצירה, אישור ודחייה עוברים רק דרך הפונקציות למטה.
DROP POLICY IF EXISTS "read my invites" ON public.household_invites;
CREATE POLICY "read my invites" ON public.household_invites
  FOR SELECT TO authenticated USING (invited_user_id = auth.uid());

DROP POLICY IF EXISTS "members read household" ON public.households;
CREATE POLICY "members read household" ON public.households
  FOR SELECT TO authenticated USING (id = public.my_household_id());

DROP POLICY IF EXISTS "read own membership" ON public.household_members;
CREATE POLICY "read own membership" ON public.household_members
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- חברים מאושרים רואים מי עוד ברשימה (מזהה וסטטוס בלבד, בלי מייל). בלי זה בעל
-- הרשימה לא מקבל בזמן אמת בקשת הצטרפות חדשה — העדכון החי מסנן לפי ההרשאות.
DROP POLICY IF EXISTS "members read household membership" ON public.household_members;
CREATE POLICY "members read household membership" ON public.household_members
  FOR SELECT TO authenticated USING (household_id = public.my_household_id());

-- שני השמות הישנים של "רק השורות שלי" — המדיניות החדשה כוללת אותן
DROP POLICY IF EXISTS "own rows" ON public.shopping_items;
DROP POLICY IF EXISTS "shopping_items: user owns rows" ON public.shopping_items;
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
         public.display_name_of(m.user_id) AS name,
         m.status,
         (h.owner_id = m.user_id) AS is_owner,
         (m.user_id = auth.uid()) AS is_me
    FROM public.household_members m
    JOIN public.households h ON h.id = m.household_id
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


-- ─── 6ב. הזמנות: קישור ואימייל ───────────────────────────────────────────────

/**
 * מכניס את המשתמש הנוכחי לרשימה כחבר מאושר — אחרי שהוא עצמו אישר (קישור
 * או הזמנה). אם הוא כבר ברשימה משותפת עם אנשים אחרים — לא מזיז אותו
 * ('in_other_household'), שלא יעזוב אותם בלי לדעת. רשימה שהוא לבד בה פשוט נסגרת.
 * פנימית בלבד: נקראת מ-join_by_invite ו-respond_invite.
 */
CREATE OR REPLACE FUNCTION public.enter_household(hid uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); current_hid uuid; others int;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  current_hid := public.my_household_id();
  IF current_hid = hid THEN RETURN 'joined'; END IF;

  IF current_hid IS NOT NULL THEN
    SELECT count(*) INTO others FROM public.household_members
     WHERE household_id = current_hid AND user_id <> uid AND status = 'active';
    IF others > 0 THEN RETURN 'in_other_household'; END IF;
    -- רשימה של אדם אחד: אין את מי להשאיר מאחור
    UPDATE public.shopping_items SET household_id = NULL WHERE user_id = uid;
    DELETE FROM public.households WHERE id = current_hid AND owner_id = uid;
  END IF;

  DELETE FROM public.household_members WHERE user_id = uid;   -- גם בקשה ממתינה ישנה
  INSERT INTO public.household_members (household_id, user_id, status)
       VALUES (hid, uid, 'active');

  -- הפריטים שלו נכנסים לרשימה המשותפת
  UPDATE public.shopping_items SET household_id = hid
   WHERE user_id = uid AND household_id IS NULL;

  DELETE FROM public.household_invites WHERE invited_user_id = uid AND household_id = hid;
  RETURN 'joined';
END;
$$;
REVOKE ALL ON FUNCTION public.enter_household(uuid) FROM public, anon, authenticated;

/**
 * קישור אישי חדש לשליחה (לכניסה אחת, 7 ימים). אם עוד אין רשימה משותפת —
 * נוצרת אחת. כל חבר מאושר ברשימה יכול להזמין.
 */
CREATE OR REPLACE FUNCTION public.create_invite_link()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); hid uuid; t text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  hid := public.my_household_id();
  IF hid IS NULL THEN
    PERFORM public.create_household();
    hid := public.my_household_id();
  END IF;
  INSERT INTO public.household_invite_links (household_id, created_by)
       VALUES (hid, uid)
  RETURNING token INTO t;
  RETURN t;
END;
$$;

/**
 * מה שרואה מי שפתח קישור: מי מזמין, כמה כבר ברשימה, האם הוא כבר בפנים,
 * ומצב הקישור — ok / used (כבר נוצל) / expired (עברו 7 ימים).
 * קישור שלא קיים (או בוטל) — אין שורה.
 */
DROP FUNCTION IF EXISTS public.invite_info(text);
CREATE FUNCTION public.invite_info(token text)
RETURNS TABLE (inviter text, member_count int, already_member boolean, status text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.display_name_of(l.created_by),
         (SELECT count(*)::int FROM public.household_members m
           WHERE m.household_id = l.household_id AND m.status = 'active'),
         (l.household_id IS NOT DISTINCT FROM public.my_household_id()),
         CASE WHEN l.used_at IS NOT NULL THEN 'used'
              WHEN l.expires_at < now()  THEN 'expired'
              ELSE 'ok' END
    FROM public.household_invite_links l
   WHERE l.token = invite_info.token AND auth.uid() IS NOT NULL;
$$;

/**
 * אישור קישור הזמנה. מחזיר joined / used / expired / not_found / in_other_household.
 * הקישור נצרך רק כשמישהו חדש באמת נכנס — מי שכבר ברשימה (למשל השולח עצמו)
 * יכול לפתוח אותו בלי לשרוף אותו.
 */
CREATE OR REPLACE FUNCTION public.join_by_invite(token text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); link public.household_invite_links; result text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  -- FOR UPDATE: שני אנשים שלוחצים באותו רגע — רק אחד נכנס
  SELECT * INTO link FROM public.household_invite_links l
   WHERE l.token = join_by_invite.token FOR UPDATE;
  IF NOT FOUND THEN RETURN 'not_found'; END IF;

  IF link.household_id IS NOT DISTINCT FROM public.my_household_id() THEN RETURN 'joined'; END IF;
  IF link.used_at IS NOT NULL THEN RETURN 'used'; END IF;
  IF link.expires_at < now() THEN RETURN 'expired'; END IF;

  result := public.enter_household(link.household_id);
  IF result = 'joined' THEN
    UPDATE public.household_invite_links
       SET used_by = uid, used_at = now()
     WHERE household_invite_links.token = link.token;
  END IF;
  RETURN result;
END;
$$;

/**
 * הזמנה לפי אימייל מדויק (בלי חיפוש לפי שם — כך אף אחד לא רואה רשימת משתמשים).
 * אם עוד אין רשימה משותפת, נוצרת אחת. מחזיר invited / not_found / already_member / self.
 */
CREATE OR REPLACE FUNCTION public.invite_by_email(invitee_email text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); hid uuid; target uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  SELECT u.id INTO target FROM auth.users u
   WHERE lower(u.email) = lower(btrim(invitee_email)) LIMIT 1;
  IF target IS NULL THEN RETURN 'not_found'; END IF;
  IF target = uid THEN RETURN 'self'; END IF;

  hid := public.my_household_id();
  IF hid IS NULL THEN
    PERFORM public.create_household();
    hid := public.my_household_id();
  END IF;

  IF EXISTS (SELECT 1 FROM public.household_members
              WHERE household_id = hid AND user_id = target AND status = 'active') THEN
    RETURN 'already_member';
  END IF;

  INSERT INTO public.household_invites (household_id, invited_user_id, invited_by)
       VALUES (hid, target, uid)
  ON CONFLICT (household_id, invited_user_id)
    DO UPDATE SET invited_by = EXCLUDED.invited_by, created_at = now();
  RETURN 'invited';
END;
$$;

/** ההזמנות שמחכות לי. */
CREATE OR REPLACE FUNCTION public.my_invites()
RETURNS TABLE (id uuid, inviter text, member_count int, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT i.id,
         public.display_name_of(i.invited_by),
         (SELECT count(*)::int FROM public.household_members m
           WHERE m.household_id = i.household_id AND m.status = 'active'),
         i.created_at
    FROM public.household_invites i
   WHERE i.invited_user_id = auth.uid()
     AND i.household_id IS DISTINCT FROM public.my_household_id()
   ORDER BY i.created_at DESC;
$$;

/** אישור או דחייה של הזמנה. מחזיר joined / declined / in_other_household / not_found. */
CREATE OR REPLACE FUNCTION public.respond_invite(invite_id uuid, accept boolean)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE hid uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT household_id INTO hid FROM public.household_invites
   WHERE id = invite_id AND invited_user_id = auth.uid();
  IF hid IS NULL THEN RETURN 'not_found'; END IF;

  IF NOT accept THEN
    DELETE FROM public.household_invites WHERE id = invite_id;
    RETURN 'declined';
  END IF;
  RETURN public.enter_household(hid);
END;
$$;

/** ביטול כל הקישורים שנשלחו ועוד לא נוצלו. לבעל הרשימה בלבד. */
CREATE OR REPLACE FUNCTION public.reset_invite_link()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.i_own_household() THEN RAISE EXCEPTION 'only the owner can cancel links'; END IF;
  DELETE FROM public.household_invite_links
   WHERE household_id = public.my_household_id() AND used_at IS NULL;
END;
$$;


-- ─── 7. עדכון חי ─────────────────────────────────────────────────────────────

ALTER TABLE public.shopping_items    REPLICA IDENTITY FULL;
ALTER TABLE public.household_members REPLICA IDENTITY FULL;
ALTER TABLE public.household_invites REPLICA IDENTITY FULL;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['shopping_items', 'household_members', 'household_invites'] LOOP
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
SELECT 'open invites', count(*)::text FROM public.household_invites
UNION ALL
SELECT 'unused invite links', count(*)::text FROM public.household_invite_links
 WHERE used_at IS NULL AND expires_at > now()
UNION ALL
SELECT 'shared items', count(*)::text FROM public.shopping_items WHERE household_id IS NOT NULL
UNION ALL
SELECT 'realtime ready',
       CASE WHEN (SELECT count(*) FROM pg_publication_tables
                   WHERE pubname='supabase_realtime'
                     AND tablename IN ('shopping_items','household_members','household_invites')) = 3
            THEN 'yes' ELSE 'NO' END;
