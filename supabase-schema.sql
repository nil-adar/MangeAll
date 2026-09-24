-- הפעל את הקוד הזה ב: Supabase → SQL Editor

-- טבלת משימות
create table tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  due text not null default 'בהמשך',
  priority text not null default 'רגילה',
  category text not null default 'personal',
  done boolean not null default false,
  today boolean not null default false,
  created_at timestamptz not null default now()
);

-- טבלת אירועים
create table events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  day int not null,
  time text not null,
  end_time text,
  location text,
  category text not null default 'personal',
  is_birthday boolean not null default false,
  created_at timestamptz not null default now()
);

-- טבלת הוצאות
create table expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  vendor text not null,
  amount numeric not null,
  category text not null default 'general',
  date date not null default current_date,
  repeat text,
  created_at timestamptz not null default now()
);

-- טבלת רשימת קניות
create table shopping_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  qty int not null default 1,
  unit text,
  category text not null default 'general',
  checked boolean not null default false,
  created_at timestamptz not null default now()
);

-- Row Level Security — כל משתמש רואה רק את הנתונים שלו
alter table tasks enable row level security;
alter table events enable row level security;
alter table expenses enable row level security;
alter table shopping_items enable row level security;

create policy "tasks: user owns rows" on tasks for all using (auth.uid() = user_id);
create policy "events: user owns rows" on events for all using (auth.uid() = user_id);
create policy "expenses: user owns rows" on expenses for all using (auth.uid() = user_id);
create policy "shopping_items: user owns rows" on shopping_items for all using (auth.uid() = user_id);
