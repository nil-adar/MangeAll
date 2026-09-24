// Demo data for new users — shown faded until they add their first expense
export const expenses = [
  { id: "demo-1", vendor: "סופר-פארם", amount: 180, category: "shopping", date: "2026-09-10" },
  { id: "demo-2", vendor: "מקדונלד'ס", amount: 65, category: "family", date: "2026-09-08" },
  { id: "demo-3", vendor: "YES", amount: 220, category: "work", date: "2026-09-05" },
];

export const recurringExpenses = [
  { id: "demo-r1", vendor: "נטפליקס", amount: 54, category: "shopping", repeat: "monthly" as const },
  { id: "demo-r2", vendor: "ביטוח רכב", amount: 350, category: "money", repeat: "monthly" as const },
  { id: "demo-r3", vendor: "חדר כושר", amount: 150, category: "health", repeat: "monthly" as const },
];
