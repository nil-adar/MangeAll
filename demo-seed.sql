-- ═════════════════════════════════════════════════════════════════════════════
-- nahel-hakol — demo account data (for screenshots and showing the app)
--
-- Fills ONE demo account with realistic sample data in every area of the app:
-- tasks, events, birthdays, expenses + budget, shopping list, work days.
-- All dates are relative to today, so the demo always looks current —
-- re-run it any time to refresh.
--
-- Paste into Supabase → SQL Editor → Run.
--
-- ⚠️  It first DELETES all existing data of the demo account below, so the
--     result is always clean. It refuses to run on the real account.
--     Change demo_email if you use a different demo account.
-- ═════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  demo_email text := 'niladar+demo@gmail.com';
  uid uuid;
  d date := current_date;
  month_start date := date_trunc('month', current_date)::date;
BEGIN
  IF lower(demo_email) = 'niladar@gmail.com' THEN
    RAISE EXCEPTION 'זה החשבון האמיתי — הסקריפט מוחק את כל הנתונים של החשבון. השתמש בחשבון דמו.';
  END IF;

  SELECT id INTO uid FROM auth.users WHERE lower(email) = lower(demo_email);
  IF uid IS NULL THEN
    RAISE EXCEPTION 'לא נמצא משתמש עם האימייל % — צריך להירשם איתו לאפליקציה קודם', demo_email;
  END IF;

  -- The demo account doesn't need a working inbox: mark its email confirmed
  -- so it can log in even if the confirmation mail never arrived.
  UPDATE auth.users SET email_confirmed_at = now()
  WHERE id = uid AND email_confirmed_at IS NULL;

  -- ─── 0. Start clean (demo account only) ───────────────────────────────────
  DELETE FROM public.tasks          WHERE user_id = uid;
  DELETE FROM public.events         WHERE user_id = uid;
  DELETE FROM public.expenses       WHERE user_id = uid;
  DELETE FROM public.shopping_items WHERE user_id = uid;
  DELETE FROM public.work_days      WHERE user_id = uid;

  -- ─── 1. Profile + budget ──────────────────────────────────────────────────
  INSERT INTO public.user_settings (user_id, monthly_budget, display_name)
  VALUES (uid, 8000, 'נועה')
  ON CONFLICT (user_id) DO UPDATE
    SET monthly_budget = EXCLUDED.monthly_budget,
        display_name   = EXCLUDED.display_name;

  -- ─── 2. Events (days from today) ──────────────────────────────────────────
  INSERT INTO public.events (user_id, title, day, month, time, end_time, location, category, is_birthday)
  SELECT uid, t.title,
         extract(day   FROM d + t.n)::int,
         extract(month FROM d + t.n)::int,
         t.tm, t.te, t.loc, t.cat, t.bday
  FROM (VALUES
    (0,  'פגישת צוות שבועית',         '10:00',   '11:00', 'זום',                    'work',   false),
    (0,  'איסוף הילדים מהגן',         '16:30',   NULL,    'גן החצב',                'family', false),
    (1,  'תור לרופא שיניים',          '08:30',   '09:15', 'מרפאת שן, רמת גן',       'health', false),
    (1,  'שיחה עם רואה החשבון',       '13:00',   '13:30', NULL,                     'money',  false),
    (2,  'ארוחת ערב אצל ההורים',      '19:30',   NULL,    'חולון',                  'family', false),
    (3,  'הצגת תוצאות רבעון',         '14:00',   '15:00', 'חדר ישיבות 3',           'work',   false),
    (4,  'יום הולדת לאמא',            'כל היום', NULL,    NULL,                     'family', true),
    (5,  'חוג בלט של מאיה',           '17:00',   '18:00', 'מתנ״ס שכונתי',           'family', false),
    (6,  'קניות שבועיות',             '10:00',   NULL,    'רמי לוי',                'shopping', false),
    (9,  'בדיקות דם שנתיות',          '07:45',   NULL,    'קופת חולים',             'health', false),
    (12, 'יום הולדת לדני',            'כל היום', NULL,    NULL,                     'family', true),
    (15, 'כנס מוצר',                  '09:00',   '17:00', 'אקספו תל אביב',          'work',   false),
    (25, 'יום הולדת לסבתא רחל',       'כל היום', NULL,    NULL,                     'family', true)
  ) AS t(n, title, tm, te, loc, cat, bday);

  -- ─── 3. Tasks (age_days = how long ago it was created) ────────────────────
  INSERT INTO public.tasks (user_id, title, due, priority, category, done, today, created_at)
  SELECT uid, t.title, t.due, t.pri, t.cat, t.done, t.due = 'היום', now() - make_interval(days => t.age)
  FROM (VALUES
    ('לשלוח מצגת ללקוח',           'היום',   'גבוהה', 'work',   false, 0),
    ('לשלם חשבון חשמל',            'היום',   'רגילה', 'money',  false, 0),
    ('לקבוע תור למוסך',            'היום',   'רגילה', 'family', false, 0),
    ('לקנות מתנה לאמא',            'השבוע',  'גבוהה', 'family', false, 1),
    ('לחדש ביטוח רכב',             'השבוע',  'רגילה', 'money',  false, 2),
    ('לסכם את פגישת הצוות',        'מחר',    'רגילה', 'work',   false, 0),
    ('להחזיר ספר לספרייה',         'מחר',    'נמוכה', 'family', false, 4),
    ('לתכנן חופשה משפחתית',        'בהמשך',  'נמוכה', 'family', false, 3),
    ('להתקשר לאינסטלטור',          'היום',   'רגילה', 'family', true,  1),
    ('לעדכן קורות חיים',           'השבוע',  'רגילה', 'work',   true,  5)
  ) AS t(title, due, pri, cat, done, age);

  -- ─── 4. Expenses ──────────────────────────────────────────────────────────
  -- One-time spend this month (kept inside the current month)
  INSERT INTO public.expenses (user_id, vendor, amount, category, date, repeat)
  SELECT uid, t.vendor, t.amount, t.cat, greatest(month_start, d - t.n), 'once'
  FROM (VALUES
    ('רמי לוי',        412.90, 'shopping', 1),
    ('שופרסל דיל',     236.40, 'shopping', 6),
    ('דלק — פז',       310.00, 'money',    3),
    ('סופר-פארם',       89.90, 'health',   2),
    ('ארוחת ערב, מסעדה', 264.00, 'family',  8),
    ('קפה ומאפה',       38.00, 'family',   0)
  ) AS t(vendor, amount, cat, n);

  -- Fixed payments
  INSERT INTO public.expenses (user_id, vendor, amount, category, date, repeat)
  VALUES
    (uid, 'שכר דירה',       4200.00, 'money',  month_start, 'monthly'),
    (uid, 'ועד בית',         250.00, 'money',  month_start, 'monthly'),
    (uid, 'חבילת סלולר',      49.90, 'money',  month_start, 'monthly'),
    (uid, 'נטפליקס',          54.90, 'family', month_start, 'monthly'),
    (uid, 'ביטוח רכב',      3600.00, 'money',  month_start, 'yearly');

  -- ─── 5. Shopping list (categories = supermarket aisles) ───────────────────
  INSERT INTO public.shopping_items (user_id, title, quantity, unit, category, checked, created_at)
  SELECT uid, t.title, t.qty, t.unit, t.cat, t.checked, now() - make_interval(mins => t.ord)
  FROM (VALUES
    ('עגבניות',       1.0, 'ק״ג',    'ירקות',  false, 20),
    ('מלפפונים',      1.0, 'ק״ג',    'ירקות',  false, 19),
    ('אבוקדו',        3.0, NULL,     'ירקות',  false, 18),
    ('בננות',         1.0, NULL,     'ירקות',  true,  17),
    ('לחם מלא',       1.0, 'כיכר',   'לחם',    false, 16),
    ('פיתות',         1.0, 'אריזה',  'לחם',    false, 15),
    ('חלב 3%',        2.0, NULL,     'חלב',    false, 14),
    ('קוטג׳',         2.0, NULL,     'חלב',    false, 13),
    ('ביצים',         1.0, 'אריזה',  'חלב',    true,  12),
    ('גבינה צהובה',   1.0, NULL,     'חלב',    false, 11),
    ('חזה עוף',       1.0, 'ק״ג',    'בשר',    false, 10),
    ('פסטה',          2.0, NULL,     'מזווה',  false, 9),
    ('טחינה',         1.0, NULL,     'מזווה',  false, 8),
    ('קפה',           1.0, NULL,     'מזווה',  false, 7),
    ('מים מינרליים',  1.0, 'אריזה',  'משקאות', false, 6),
    ('נוזל כלים',     1.0, NULL,     'ניקיון', false, 5),
    ('נייר טואלט',    1.0, 'אריזה',  'ניקיון', false, 4)
  ) AS t(title, qty, unit, cat, checked, ord);

  -- ─── 6. Work days: Sun–Thu of this month, up to yesterday ─────────────────
  -- Today is left unanswered so the home page shows the daily question.
  INSERT INTO public.work_days (user_id, date, status, note)
  SELECT uid, g::date,
         CASE
           WHEN g::date = month_start + 8  THEN 'sick'
           WHEN g::date = month_start + 15 THEN 'off'
           WHEN extract(dow FROM g) = 2    THEN 'home'
           ELSE 'office'
         END,
         NULL
  FROM generate_series(month_start::timestamp, (d - 1)::timestamp, interval '1 day') AS g
  WHERE extract(dow FROM g) BETWEEN 0 AND 4;

  RAISE NOTICE 'הדמו מוכן עבור %', demo_email;
END $$;

-- ─── Check: counts per table for the demo account ──────────────────────────
SELECT 'tasks' AS table_name, count(*) FROM public.tasks t JOIN auth.users u ON u.id = t.user_id WHERE u.email = 'niladar+demo@gmail.com'
UNION ALL SELECT 'events', count(*) FROM public.events e JOIN auth.users u ON u.id = e.user_id WHERE u.email = 'niladar+demo@gmail.com'
UNION ALL SELECT 'expenses', count(*) FROM public.expenses x JOIN auth.users u ON u.id = x.user_id WHERE u.email = 'niladar+demo@gmail.com'
UNION ALL SELECT 'shopping_items', count(*) FROM public.shopping_items s JOIN auth.users u ON u.id = s.user_id WHERE u.email = 'niladar+demo@gmail.com'
UNION ALL SELECT 'work_days', count(*) FROM public.work_days w JOIN auth.users u ON u.id = w.user_id WHERE u.email = 'niladar+demo@gmail.com';
