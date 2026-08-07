// Generated from the live Supabase schema. Regenerate after any migration.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  __InternalSupabase: { PostgrestVersion: "14.5" };
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          weather_lat: number | null;
          weather_lon: number | null;
          weather_label: string | null;
          timezone: string;
          daily_page_goal: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          weather_lat?: number | null;
          weather_lon?: number | null;
          weather_label?: string | null;
          timezone?: string;
          daily_page_goal?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string | null;
          weather_lat?: number | null;
          weather_lon?: number | null;
          weather_label?: string | null;
          timezone?: string;
          daily_page_goal?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      habits: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          description: string | null;
          color: string | null;
          icon: string | null;
          frequency: string;
          custom_days: number[] | null;
          target_minutes: number | null;
          time_hour: number | null;
          time_minute: number | null;
          sort_order: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          description?: string | null;
          color?: string | null;
          icon?: string | null;
          frequency?: string;
          custom_days?: number[] | null;
          target_minutes?: number | null;
          time_hour?: number | null;
          time_minute?: number | null;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["habits"]["Insert"]>;
        Relationships: [];
      };
      habit_completions: {
        Row: {
          id: string;
          user_id: string;
          habit_id: string;
          completed_date: string;
          note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          habit_id: string;
          completed_date: string;
          note?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["habit_completions"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "habit_completions_habit_id_fkey";
            columns: ["habit_id"];
            isOneToOne: false;
            referencedRelation: "habits";
            referencedColumns: ["id"];
          },
        ];
      };
      time_entries: {
        Row: {
          id: string;
          user_id: string;
          todoist_task_id: string | null;
          habit_id: string | null;
          started_at: string;
          ended_at: string | null;
          note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          todoist_task_id?: string | null;
          habit_id?: string | null;
          started_at: string;
          ended_at?: string | null;
          note?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["time_entries"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "time_entries_habit_id_fkey";
            columns: ["habit_id"];
            isOneToOne: false;
            referencedRelation: "habits";
            referencedColumns: ["id"];
          },
        ];
      };
      time_blocks: {
        Row: {
          id: string;
          user_id: string;
          todoist_task_id: string | null;
          title: string;
          start_time: string;
          end_time: string;
          color: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          todoist_task_id?: string | null;
          title: string;
          start_time: string;
          end_time: string;
          color?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["time_blocks"]["Insert"]>;
        Relationships: [];
      };
      notes: {
        Row: {
          id: string;
          user_id: string;
          title: string | null;
          content: string;
          tags: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title?: string | null;
          content: string;
          tags?: string[];
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["notes"]["Insert"]>;
        Relationships: [];
      };
      crm_people: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          email: string | null;
          phone: string | null;
          company: string | null;
          notes: string | null;
          last_contacted: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          email?: string | null;
          phone?: string | null;
          company?: string | null;
          notes?: string | null;
          last_contacted?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["crm_people"]["Insert"]>;
        Relationships: [];
      };
      braindump_entries: {
        Row: {
          id: string;
          user_id: string;
          raw_text: string;
          processed: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          raw_text: string;
          processed?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["braindump_entries"]["Insert"]>;
        Relationships: [];
      };
      books: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          authors: string | null;
          contributors: string | null;
          isbn: string | null;
          format: string | null;
          status: string;
          date_added: string | null;
          last_date_read: string | null;
          dates_read: string | null;
          read_count: number;
          star_rating: number | null;
          review: string | null;
          moods: string | null;
          pace: string | null;
          tags: string[];
          owned: boolean;
          subtitle: string | null;
          page_count: number | null;
          current_page: number;
          publisher: string | null;
          published_year: number | null;
          series: string | null;
          series_position: number | null;
          description: string | null;
          subjects: string[] | null;
          fiction: boolean | null;
          classified_at: string | null;
          cover_url: string | null;
          cover_path: string | null;
          source_url: string | null;
          locked_at: string | null;
          started_at: string | null;
          finished_at: string | null;
          favorite: boolean;
          on_deck: boolean;
          on_deck_order: number;
          enriched_at: string | null;
          read_log: { start: string | null; end: string | null }[];
          progress_mode: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          authors?: string | null;
          contributors?: string | null;
          isbn?: string | null;
          format?: string | null;
          status?: string;
          date_added?: string | null;
          last_date_read?: string | null;
          dates_read?: string | null;
          read_count?: number;
          star_rating?: number | null;
          review?: string | null;
          moods?: string | null;
          pace?: string | null;
          tags?: string[];
          owned?: boolean;
          subtitle?: string | null;
          page_count?: number | null;
          current_page?: number;
          publisher?: string | null;
          published_year?: number | null;
          series?: string | null;
          series_position?: number | null;
          description?: string | null;
          subjects?: string[] | null;
          fiction?: boolean | null;
          classified_at?: string | null;
          cover_url?: string | null;
          cover_path?: string | null;
          source_url?: string | null;
          locked_at?: string | null;
          started_at?: string | null;
          finished_at?: string | null;
          favorite?: boolean;
          on_deck?: boolean;
          on_deck_order?: number;
          enriched_at?: string | null;
          read_log?: { start: string | null; end: string | null }[];
          progress_mode?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["books"]["Insert"]>;
        Relationships: [];
      };
      book_highlights: {
        Row: {
          id: string;
          user_id: string;
          book_id: string | null;
          readwise_id: number;
          readwise_book_id: number | null;
          source_title: string | null;
          source_author: string | null;
          category: string | null;
          text: string;
          note: string | null;
          my_note: string | null;
          location: number | null;
          location_type: string | null;
          color: string | null;
          url: string | null;
          highlighted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          book_id?: string | null;
          readwise_id: number;
          readwise_book_id?: number | null;
          source_title?: string | null;
          source_author?: string | null;
          category?: string | null;
          text: string;
          note?: string | null;
          my_note?: string | null;
          location?: number | null;
          location_type?: string | null;
          color?: string | null;
          url?: string | null;
          highlighted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["book_highlights"]["Insert"]>;
        Relationships: [];
      };
      integration_sync: {
        Row: {
          user_id: string;
          service: string;
          synced_at: string | null;
          detail: Record<string, unknown>;
        };
        Insert: {
          user_id: string;
          service: string;
          synced_at?: string | null;
          detail?: Record<string, unknown>;
        };
        Update: Partial<Database["public"]["Tables"]["integration_sync"]["Insert"]>;
        Relationships: [];
      };
      reading_goals: {
        Row: {
          id: string;
          user_id: string;
          year: number;
          target_books: number | null;
          target_pages: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          year: number;
          target_books?: number | null;
          target_pages?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["reading_goals"]["Insert"]>;
        Relationships: [];
      };
      reading_sessions: {
        Row: {
          id: string;
          user_id: string;
          book_id: string | null;
          session_date: string;
          pages_read: number;
          minutes: number | null;
          note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          book_id?: string | null;
          session_date: string;
          pages_read?: number;
          minutes?: number | null;
          note?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["reading_sessions"]["Insert"]>;
        Relationships: [];
      };
      favorite_sports_teams: {
        Row: {
          id: string;
          user_id: string;
          team_name: string;
          league: string | null;
          sport: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          team_name: string;
          league?: string | null;
          sport?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["favorite_sports_teams"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

type PublicSchema = Database["public"];
export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"];
export type TablesInsert<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Update"];
