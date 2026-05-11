export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activity: {
        Row: {
          action: string
          actor_id: string | null
          at: string
          field: string | null
          id: number
          new_value: Json | null
          old_value: Json | null
          ticket_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          at?: string
          field?: string | null
          id?: number
          new_value?: Json | null
          old_value?: Json | null
          ticket_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          at?: string
          field?: string | null
          id?: number
          new_value?: Json | null
          old_value?: Json | null
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          author_id: string | null
          body: string
          created_at: string
          id: string
          ticket_id: string
        }
        Insert: {
          author_id?: string | null
          body: string
          created_at?: string
          id?: string
          ticket_id: string
        }
        Update: {
          author_id?: string | null
          body?: string
          created_at?: string
          id?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      metric_observations: {
        Row: {
          actor_id: string | null
          captured_at: string
          id: number
          note: string | null
          outcome_id: string
          source: string | null
          value: number
        }
        Insert: {
          actor_id?: string | null
          captured_at?: string
          id?: number
          note?: string | null
          outcome_id: string
          source?: string | null
          value: number
        }
        Update: {
          actor_id?: string | null
          captured_at?: string
          id?: number
          note?: string | null
          outcome_id?: string
          source?: string | null
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "metric_observations_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "metric_observations_outcome_id_fkey"
            columns: ["outcome_id"]
            isOneToOne: false
            referencedRelation: "outcomes"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunities: {
        Row: {
          confidence: string | null
          created_at: string
          description: string | null
          evidence_url: string | null
          id: string
          impact_estimate: string | null
          outcome_id: string
          owner_id: string | null
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          confidence?: string | null
          created_at?: string
          description?: string | null
          evidence_url?: string | null
          id?: string
          impact_estimate?: string | null
          outcome_id: string
          owner_id?: string | null
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          confidence?: string | null
          created_at?: string
          description?: string | null
          evidence_url?: string | null
          id?: string
          impact_estimate?: string | null
          outcome_id?: string
          owner_id?: string | null
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunities_outcome_id_fkey"
            columns: ["outcome_id"]
            isOneToOne: false
            referencedRelation: "outcomes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      outcomes: {
        Row: {
          baseline_value: number | null
          cadence: string | null
          created_at: string
          current_value: number | null
          description: string | null
          direction: string
          horizon: string
          id: string
          metric_unit: string | null
          name: string
          owner_id: string | null
          sort_order: number
          target_value: number | null
          updated_at: string
        }
        Insert: {
          baseline_value?: number | null
          cadence?: string | null
          created_at?: string
          current_value?: number | null
          description?: string | null
          direction?: string
          horizon?: string
          id?: string
          metric_unit?: string | null
          name: string
          owner_id?: string | null
          sort_order?: number
          target_value?: number | null
          updated_at?: string
        }
        Update: {
          baseline_value?: number | null
          cadence?: string | null
          created_at?: string
          current_value?: number | null
          description?: string | null
          direction?: string
          horizon?: string
          id?: string
          metric_unit?: string | null
          name?: string
          owner_id?: string | null
          sort_order?: number
          target_value?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "outcomes_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          color: string
          created_at: string
          email: string
          id: string
          initials: string
          last_seen_at: string | null
          name: string
          role: string
        }
        Insert: {
          color?: string
          created_at?: string
          email: string
          id: string
          initials: string
          last_seen_at?: string | null
          name: string
          role?: string
        }
        Update: {
          color?: string
          created_at?: string
          email?: string
          id?: string
          initials?: string
          last_seen_at?: string | null
          name?: string
          role?: string
        }
        Relationships: []
      }
      tickets: {
        Row: {
          code: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          esfuerzo: string | null
          id: string
          impacto: string | null
          item: string
          opportunity_id: string | null
          owner_id: string | null
          prioridad: string | null
          progress: number
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          esfuerzo?: string | null
          id?: string
          impacto?: string | null
          item: string
          opportunity_id?: string | null
          owner_id?: string | null
          prioridad?: string | null
          progress?: number
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          esfuerzo?: string | null
          id?: string
          impacto?: string | null
          item?: string
          opportunity_id?: string | null
          owner_id?: string | null
          prioridad?: string | null
          progress?: number
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tickets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_toteat_user: { Args: never; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
