import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "./supabase";
import { categories, type CategoryKey } from "./config";

// Helper: safe category lookup
export function getCat(category: string) {
  return (
    categories[category as CategoryKey] ?? {
      label: category,
      dot: "bg-muted",
      soft: "bg-muted text-muted-foreground",
    }
  );
}

// Helper: current authenticated user id (all rows are scoped per-user via RLS)
async function requireUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error("לא מחובר");
  return data.user.id;
}

// ── Types ────────────────────────────────────────────────────────────────────

export type Task = {
  id: string;
  title: string;
  due: string;
  priority: "גבוהה" | "רגילה" | "נמוכה";
  category: string;
  done: boolean;
  today: boolean;
  created_at: string;
};

export type CalEvent = {
  id: string;
  title: string;
  day: number;
  month: number | null;
  time: string;
  end_time: string | null;
  location: string | null;
  category: string;
  is_birthday: boolean;
  created_at: string;
};

/**
 * Does this event fall on the given calendar date? `month` is 1-12.
 *
 * Events store day + month but no year, so a birthday recurs every year on the
 * same day/month for free. Filtering on `day` alone — which every caller used
 * to do — makes a 21 January birthday show up on the 21st of every month.
 *
 * Rows written before `month` was populated have month === null; those keep
 * their old "matches any month" behaviour so existing data doesn't vanish.
 */
export function occursOn(e: CalEvent, day: number, month: number): boolean {
  if (e.day !== day) return false;

  if (e.month == null) {
    // A birthday with no month has no real date — showing it on the Nth of
    // every month is the bug, not the fallback. It stays visible on the
    // birthdays page, labelled "תאריך חסר", so it can be fixed.
    if (e.is_birthday) return false;
    // A plain event predates the month column; keep its old behaviour.
    return true;
  }

  return e.month === month;
}

/**
 * Is a "YYYY-MM-DD" date in the current calendar month?
 * One-time expenses only count toward the month they were spent in, so the
 * monthly total resets on the 1st. Compared as strings to avoid timezone
 * shifts from `new Date("YYYY-MM-DD")`, which parses as UTC.
 */
export function isThisMonth(date: string | null | undefined): boolean {
  if (!date) return false;
  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  return date.slice(0, 7) === ym;
}

export type Expense = {
  id: string;
  vendor: string;
  amount: number;
  category: string;
  date: string;
  repeat: "monthly" | "yearly" | "once" | null;
  created_at: string;
};

// ── Tasks ────────────────────────────────────────────────────────────────────

export function useTasks() {
  return useQuery({
    queryKey: ["tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Task[];
    },
  });
}

export function useToggleTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, done }: { id: string; done: boolean }) => {
      const { error } = await supabase.from("tasks").update({ done }).eq("id", id);
      if (error) throw error;
    },
    // Optimistic update
    onMutate: async ({ id, done }) => {
      await qc.cancelQueries({ queryKey: ["tasks"] });
      const prev = qc.getQueryData<Task[]>(["tasks"]);
      qc.setQueryData<Task[]>(["tasks"], (old) =>
        old?.map((t) => (t.id === id ? { ...t, done } : t)) ?? []
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(["tasks"], ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });
}

// ── Events ───────────────────────────────────────────────────────────────────

export function useEvents() {
  return useQuery({
    queryKey: ["events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .order("day", { ascending: true })
        .order("time", { ascending: true });
      if (error) throw error;
      return data as CalEvent[];
    },
  });
}

// ── Add Event ────────────────────────────────────────────────────────────────

export function useAddEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (event: Omit<CalEvent, "id" | "created_at" | "month"> & { month?: number | null }) => {
      const user_id = await requireUserId();
      const { error } = await supabase.from("events").insert({ ...event, user_id });
      if (!error) return;

      // If the events table has no `month` column yet, PostgREST rejects the
      // whole insert and the record is lost. Retry without it so the save still
      // succeeds; running supabase-checklist.sql adds the column for real.
      const missingMonth = /month/i.test(error.message ?? "");
      if (missingMonth && "month" in event) {
        const { month: _drop, ...rest } = event;
        const retry = await supabase.from("events").insert({ ...rest, user_id });
        if (retry.error) throw retry.error;
        return;
      }
      throw error;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["events"] }),
  });
}

// ── Add Task ─────────────────────────────────────────────────────────────────

export function useAddTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (task: Omit<Task, "id" | "created_at">) => {
      const user_id = await requireUserId();
      const { error } = await supabase.from("tasks").insert({ ...task, user_id });
      if (error) throw error;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["tasks"] });
      const prev = qc.getQueryData<Task[]>(["tasks"]);
      qc.setQueryData<Task[]>(["tasks"], (old) => old?.filter((t) => t.id !== id) ?? []);
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(["tasks"], ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });
}

export function useDeleteEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("events").delete().eq("id", id);
      if (error) throw error;
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["events"] });
      const prev = qc.getQueryData<CalEvent[]>(["events"]);
      qc.setQueryData<CalEvent[]>(["events"], (old) => old?.filter((e) => e.id !== id) ?? []);
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(["events"], ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["events"] }),
  });
}

// ── Shopping ──────────────────────────────────────────────────────────────────

export type ShoppingItem = {
  id: string;
  title: string;
  quantity: number;
  unit: string | null;
  category: string;
  checked: boolean;
  created_at: string;
};

export function useShoppingItems() {
  return useQuery({
    queryKey: ["shopping"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shopping_items")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as ShoppingItem[];
    },
  });
}

export function useAddShoppingItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (item: Omit<ShoppingItem, "id" | "created_at">) => {
      const user_id = await requireUserId();
      const { error } = await supabase.from("shopping_items").insert({ ...item, user_id });
      if (error) throw error;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["shopping"] }),
  });
}

export function useToggleShoppingItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, checked }: { id: string; checked: boolean }) => {
      const { error } = await supabase.from("shopping_items").update({ checked }).eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, checked }) => {
      await qc.cancelQueries({ queryKey: ["shopping"] });
      const prev = qc.getQueryData<ShoppingItem[]>(["shopping"]);
      qc.setQueryData<ShoppingItem[]>(["shopping"], (old) =>
        old?.map((i) => (i.id === id ? { ...i, checked } : i)) ?? []
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(["shopping"], ctx.prev); },
    onSettled: () => qc.invalidateQueries({ queryKey: ["shopping"] }),
  });
}

/** Change quantity (merging duplicates, +/- steppers). Optimistic. */
export function useUpdateShoppingQuantity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, quantity }: { id: string; quantity: number }) => {
      const { error } = await supabase.from("shopping_items").update({ quantity }).eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, quantity }) => {
      await qc.cancelQueries({ queryKey: ["shopping"] });
      const prev = qc.getQueryData<ShoppingItem[]>(["shopping"]);
      qc.setQueryData<ShoppingItem[]>(["shopping"], (old) =>
        old?.map((i) => (i.id === id ? { ...i, quantity } : i)) ?? []
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(["shopping"], ctx.prev); },
    onSettled: () => qc.invalidateQueries({ queryKey: ["shopping"] }),
  });
}

export function useDeleteShoppingItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("shopping_items").delete().eq("id", id);
      if (error) throw error;
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["shopping"] });
      const prev = qc.getQueryData<ShoppingItem[]>(["shopping"]);
      qc.setQueryData<ShoppingItem[]>(["shopping"], (old) => old?.filter((i) => i.id !== id) ?? []);
      return { prev };
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(["shopping"], ctx.prev); },
    onSettled: () => qc.invalidateQueries({ queryKey: ["shopping"] }),
  });
}

export function useClearCheckedShoppingItems() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("shopping_items").delete().eq("checked", true);
      if (error) throw error;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["shopping"] }),
  });
}

// ── Sharing the shopping list (household) ────────────────────────────────────

export type Household = {
  code: string;
  memberCount: number;
  pendingCount: number;
  isOwner: boolean;
  /** "active" = in the list, "pending" = waiting for the owner to approve */
  myStatus: "active" | "pending";
} | null;

export type HouseholdPerson = {
  userId: string;
  name: string;
  status: "active" | "pending";
  isOwner: boolean;
  isMe: boolean;
};

/** The household I'm in, or null when my list is private. */
export function useHousehold() {
  return useQuery({
    queryKey: ["household"],
    queryFn: async (): Promise<Household> => {
      const { data, error } = await supabase.rpc("my_household");
      // The sharing migration may not have run yet — degrade to "not shared"
      // instead of breaking the shopping page.
      if (error) return null;
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) return null;
      return {
        code: row.code as string,
        memberCount: (row.member_count as number) ?? 1,
        pendingCount: (row.pending_count as number) ?? 0,
        isOwner: (row.is_owner as boolean) ?? false,
        myStatus: ((row.my_status as string) === "pending" ? "pending" : "active"),
      };
    },
  });
}

export function useCreateHousehold() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<string> => {
      const { data, error } = await supabase.rpc("create_household");
      if (error) throw error;
      return data as string;
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["household"] });
      qc.invalidateQueries({ queryKey: ["shopping"] });
    },
  });
}

/** People in my household, and anyone waiting to be let in. */
export function useHouseholdPeople(enabled: boolean) {
  return useQuery({
    queryKey: ["household-people"],
    enabled,
    queryFn: async (): Promise<HouseholdPerson[]> => {
      const { data, error } = await supabase.rpc("household_people");
      if (error) return [];
      return (data ?? []).map((r) => ({
        userId: r.user_id as string,
        name: r.name as string,
        status: (r.status as string) === "pending" ? "pending" : "active",
        isOwner: r.is_owner as boolean,
        isMe: r.is_me as boolean,
      }));
    },
  });
}

function useHouseholdAction<T>(fn: (arg: T) => Promise<void>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["household"] });
      qc.invalidateQueries({ queryKey: ["household-people"] });
      qc.invalidateQueries({ queryKey: ["shopping"] });
    },
  });
}

export function useApproveMember() {
  return useHouseholdAction<string>(async (memberId) => {
    const { error } = await supabase.rpc("approve_member", { member_id: memberId });
    if (error) throw error;
  });
}

export function useRemoveMember() {
  return useHouseholdAction<string>(async (memberId) => {
    const { error } = await supabase.rpc("remove_member", { member_id: memberId });
    if (error) throw error;
  });
}

export type JoinResult = "pending" | "joined" | "not_found";

export function useJoinHousehold() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (code: string): Promise<JoinResult> => {
      const { data, error } = await supabase.rpc("join_household", { join_code: code });
      if (error) throw error;
      return (data as JoinResult) ?? "not_found";
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["household"] });
      qc.invalidateQueries({ queryKey: ["shopping"] });
    },
  });
}

export function useLeaveHousehold() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("leave_household");
      if (error) throw error;
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["household"] });
      qc.invalidateQueries({ queryKey: ["shopping"] });
    },
  });
}

/**
 * Live updates: refetch the list whenever anyone changes a row. Realtime
 * respects the same RLS policy as a query, so this only ever delivers rows
 * this user is allowed to see.
 */
export function useShoppingRealtime(enabled: boolean) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!enabled) return;
    const channel = supabase
      .channel("shopping-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "shopping_items" }, () => {
        qc.invalidateQueries({ queryKey: ["shopping"] });
      })
      // Membership too: this is how a pending phone learns it was approved,
      // and how the owner sees a new request arrive.
      .on("postgres_changes", { event: "*", schema: "public", table: "household_members" }, () => {
        qc.invalidateQueries({ queryKey: ["household"] });
        qc.invalidateQueries({ queryKey: ["household-people"] });
        qc.invalidateQueries({ queryKey: ["shopping"] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [enabled, qc]);
}

// ── Expenses ─────────────────────────────────────────────────────────────────

export function useExpenses() {
  return useQuery({
    queryKey: ["expenses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Expense[];
    },
  });
}

export function useAddExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (expense: Omit<Expense, "id" | "created_at">) => {
      const user_id = await requireUserId();
      const { error } = await supabase.from("expenses").insert({ ...expense, user_id });
      if (error) throw error;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["expenses"] }),
  });
}

export function useDeleteExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("expenses").delete().eq("id", id);
      if (error) throw error;
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["expenses"] });
      const prev = qc.getQueryData<Expense[]>(["expenses"]);
      qc.setQueryData<Expense[]>(["expenses"], (old) => old?.filter((e) => e.id !== id) ?? []);
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(["expenses"], ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["expenses"] }),
  });
}

// ── Monthly Budget (user_settings) ───────────────────────────────────────────

import { DEFAULT_MONTHLY_BUDGET } from "./config";

export function useMonthlyBudget() {
  return useQuery({
    queryKey: ["monthly_budget"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_settings")
        .select("monthly_budget")
        .maybeSingle();
      if (error) throw error;
      return (data?.monthly_budget as number | null) ?? DEFAULT_MONTHLY_BUDGET;
    },
  });
}

// ── Profile (user_settings + auth) ───────────────────────────────────────────

export type Profile = {
  display_name: string | null;
  avatar_url: string | null;
  email: string | null;
  created_at: string | null;
  /** false when user_settings is missing the profile columns (SQL not run yet) */
  settingsReady: boolean;
};

export function useProfile() {
  return useQuery({
    queryKey: ["profile"],
    queryFn: async (): Promise<Profile> => {
      // Auth first: this always works, so the page can show the account even
      // when the settings table hasn't been migrated.
      const { data: auth } = await supabase.auth.getUser();
      const base: Profile = {
        display_name: null,
        avatar_url: null,
        email: auth.user?.email ?? null,
        created_at: auth.user?.created_at ?? null,
        settingsReady: true,
      };

      const { data, error } = await supabase
        .from("user_settings")
        .select("display_name, avatar_url")
        .maybeSingle();

      // display_name / avatar_url don't exist until profile-setup.sql runs.
      // Degrade to the auth-only view rather than failing the whole query.
      if (error) return { ...base, settingsReady: false };

      return {
        ...base,
        display_name: (data?.display_name as string | null) ?? null,
        avatar_url: (data?.avatar_url as string | null) ?? null,
      };
    },
  });
}

export function useRemoveAvatar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const user_id = await requireUserId();

      // Clear the pointer first — it's what the UI reads, so a storage
      // failure can never leave a row pointing at a deleted file.
      const { error } = await supabase
        .from("user_settings")
        .upsert({ user_id, avatar_url: null }, { onConflict: "user_id" });
      if (error) throw error;

      // Best-effort cleanup of the stored file(s).
      const { data: files } = await supabase.storage.from("avatars").list(user_id);
      if (files?.length) {
        await supabase.storage
          .from("avatars")
          .remove(files.map((f) => `${user_id}/${f.name}`));
      }
    },
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ["profile"] });
      const prev = qc.getQueryData<Profile>(["profile"]);
      qc.setQueryData<Profile>(["profile"], (old) =>
        old ? { ...old, avatar_url: null } : old
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["profile"], ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["profile"] }),
  });
}

export function useSetDisplayName() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (display_name: string) => {
      const user_id = await requireUserId();
      const { error } = await supabase
        .from("user_settings")
        .upsert({ user_id, display_name }, { onConflict: "user_id" });
      if (error) throw error;
    },
    onMutate: async (display_name) => {
      await qc.cancelQueries({ queryKey: ["profile"] });
      const prev = qc.getQueryData<Profile>(["profile"]);
      qc.setQueryData<Profile>(["profile"], (old) =>
        old ? { ...old, display_name } : old
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["profile"], ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["profile"] }),
  });
}

export function useUploadAvatar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const user_id = await requireUserId();
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${user_id}/avatar.${ext}`;

      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, cacheControl: "3600" });
      if (upErr) throw upErr;

      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      // Cache-bust: the path is stable across re-uploads, so without this the
      // browser keeps serving the old image.
      const avatar_url = `${data.publicUrl}?v=${Date.now()}`;

      const { error } = await supabase
        .from("user_settings")
        .upsert({ user_id, avatar_url }, { onConflict: "user_id" });
      if (error) throw error;

      return avatar_url;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["profile"] }),
  });
}

export function useSetMonthlyBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (budget: number) => {
      const user_id = await requireUserId();
      const { error } = await supabase
        .from("user_settings")
        .upsert({ user_id, monthly_budget: budget }, { onConflict: "user_id" });
      if (error) throw error;
    },
    onMutate: async (budget) => {
      await qc.cancelQueries({ queryKey: ["monthly_budget"] });
      const prev = qc.getQueryData<number>(["monthly_budget"]);
      qc.setQueryData<number>(["monthly_budget"], budget);
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev !== undefined) qc.setQueryData(["monthly_budget"], ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["monthly_budget"] }),
  });
}
