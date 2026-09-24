import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

export const supabase = createClient<Database>(
  "https://yklmgblnvzbsiqmymjid.supabase.co",
  "sb_publishable_4mV9o7eS1Rm5x-6plHC86g_h_ae96_0"
);
