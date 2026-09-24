// App-wide configuration — categories, formatters, constants

export type CategoryKey = "work" | "family" | "health" | "money" | "shopping";

export const categories: Record<CategoryKey, { label: string; dot: string; soft: string }> = {
  work:     { label: "עבודה",  dot: "bg-cat-work",     soft: "bg-cat-work/10 text-cat-work"     },
  family:   { label: "משפחה", dot: "bg-cat-family",   soft: "bg-cat-family/10 text-cat-family"   },
  health:   { label: "בריאות",dot: "bg-cat-health",   soft: "bg-cat-health/10 text-cat-health"   },
  money:    { label: "כספים", dot: "bg-cat-money",    soft: "bg-cat-money/10 text-cat-money"     },
  shopping: { label: "קניות", dot: "bg-cat-shopping", soft: "bg-cat-shopping/10 text-cat-shopping" },
};

/** Format a number as Israeli shekel */
export const shekel = (n: number) =>
  new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 0 }).format(n);

/** Default monthly budget (used as fallback before user setting loads) */
export const DEFAULT_MONTHLY_BUDGET = 6500;
