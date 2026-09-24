export type Database = {
  public: {
    Tables: {
      tasks: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          due: string;
          priority: "גבוהה" | "רגילה" | "נמוכה";
          category: string;
          done: boolean;
          today: boolean;
          created_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["tasks"]["Row"],
          "id" | "created_at"
        >;
        Update: Partial<Database["public"]["Tables"]["tasks"]["Insert"]>;
        Relationships: [];
      };
      events: {
        Row: {
          id: string;
          user_id: string;
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
        // month optional: the insert retries without it on older databases
        Insert: Omit<
          Database["public"]["Tables"]["events"]["Row"],
          "id" | "created_at" | "month"
        > & { month?: number | null };
        Update: Partial<Database["public"]["Tables"]["events"]["Insert"]>;
        Relationships: [];
      };
      expenses: {
        Row: {
          id: string;
          user_id: string;
          vendor: string;
          amount: number;
          category: string;
          date: string;
          repeat: "monthly" | "yearly" | "once" | null;
          created_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["expenses"]["Row"],
          "id" | "created_at"
        >;
        Update: Partial<Database["public"]["Tables"]["expenses"]["Insert"]>;
        Relationships: [];
      };
      user_settings: {
        Row: {
          user_id: string;
          monthly_budget: number;
          display_name: string | null;
          avatar_url: string | null;
          updated_at: string;
        };
        Insert: Partial<Omit<Database["public"]["Tables"]["user_settings"]["Row"], "user_id">> & { user_id: string };
        Update: Partial<Database["public"]["Tables"]["user_settings"]["Row"]>;
        Relationships: [];
      };
      shopping_items: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          quantity: number;
          unit: string | null;
          category: string;
          checked: boolean;
          created_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["shopping_items"]["Row"],
          "id" | "created_at"
        >;
        Update: Partial<
          Database["public"]["Tables"]["shopping_items"]["Insert"]
        >;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      // Sharing the shopping list — see sharing-migration.sql
      my_household: {
        Args: Record<string, never>;
        Returns: {
          code: string;
          member_count: number;
          pending_count: number;
          is_owner: boolean;
          my_status: string;
        }[];
      };
      household_people: {
        Args: Record<string, never>;
        Returns: {
          user_id: string;
          name: string;
          status: string;
          is_owner: boolean;
          is_me: boolean;
        }[];
      };
      create_household: { Args: Record<string, never>; Returns: string };
      join_household: { Args: { join_code: string }; Returns: string };
      leave_household: { Args: Record<string, never>; Returns: undefined };
      approve_member: { Args: { member_id: string }; Returns: undefined };
      remove_member: { Args: { member_id: string }; Returns: undefined };
    };
  };
};
