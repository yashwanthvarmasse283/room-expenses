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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      chat_messages: {
        Row: {
          admin_id: string
          content: string
          created_at: string
          id: string
          sender_id: string
          sender_name: string
        }
        Insert: {
          admin_id: string
          content: string
          created_at?: string
          id?: string
          sender_id: string
          sender_name: string
        }
        Update: {
          admin_id?: string
          content?: string
          created_at?: string
          id?: string
          sender_id?: string
          sender_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      food_toggle: {
        Row: {
          admin_id: string
          date: string
          eating_home: boolean
          id: string
          updated_at: string
          user_id: string
          user_name: string
        }
        Insert: {
          admin_id: string
          date?: string
          eating_home?: boolean
          id?: string
          updated_at?: string
          user_id: string
          user_name: string
        }
        Update: {
          admin_id?: string
          date?: string
          eating_home?: boolean
          id?: string
          updated_at?: string
          user_id?: string
          user_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "food_toggle_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          created_at: string
          from_user_id: string
          from_user_name: string
          id: string
          read: boolean
          reply: string | null
          to_admin_id: string
        }
        Insert: {
          content: string
          created_at?: string
          from_user_id: string
          from_user_name: string
          id?: string
          read?: boolean
          reply?: string | null
          to_admin_id: string
        }
        Update: {
          content?: string
          created_at?: string
          from_user_id?: string
          from_user_name?: string
          id?: string
          read?: boolean
          reply?: string | null
          to_admin_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_to_admin_id_fkey"
            columns: ["to_admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_contributions: {
        Row: {
          admin_id: string
          created_at: string
          id: string
          marked_by: string | null
          month: number
          paid: boolean
          paid_at: string | null
          term: number
          updated_at: string
          user_id: string
          user_name: string
          year: number
        }
        Insert: {
          admin_id: string
          created_at?: string
          id?: string
          marked_by?: string | null
          month: number
          paid?: boolean
          paid_at?: string | null
          term: number
          updated_at?: string
          user_id: string
          user_name: string
          year: number
        }
        Update: {
          admin_id?: string
          created_at?: string
          id?: string
          marked_by?: string | null
          month?: number
          paid?: boolean
          paid_at?: string | null
          term?: number
          updated_at?: string
          user_id?: string
          user_name?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "monthly_contributions_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notices: {
        Row: {
          admin_id: string
          content: string
          created_at: string
          id: string
          title: string
        }
        Insert: {
          admin_id: string
          content: string
          created_at?: string
          id?: string
          title: string
        }
        Update: {
          admin_id?: string
          content?: string
          created_at?: string
          id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "notices_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          message: string
          read: boolean
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          read?: boolean
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          read?: boolean
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      personal_expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          date: string
          description: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          category: string
          created_at?: string
          date?: string
          description?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          date?: string
          description?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          admin_code: string | null
          admin_id: string | null
          approved: boolean
          avatar_url: string | null
          created_at: string
          daily_food_budget: number
          email: string
          id: string
          mobile_number: string | null
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_code?: string | null
          admin_id?: string | null
          approved?: boolean
          avatar_url?: string | null
          created_at?: string
          daily_food_budget?: number
          email: string
          id?: string
          mobile_number?: string | null
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_code?: string | null
          admin_id?: string | null
          approved?: boolean
          avatar_url?: string | null
          created_at?: string
          daily_food_budget?: number
          email?: string
          id?: string
          mobile_number?: string | null
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      purse_transactions: {
        Row: {
          admin_id: string
          amount: number
          created_at: string
          date: string
          description: string | null
          id: string
          type: string
        }
        Insert: {
          admin_id: string
          amount: number
          created_at?: string
          date?: string
          description?: string | null
          id?: string
          type: string
        }
        Update: {
          admin_id?: string
          amount?: number
          created_at?: string
          date?: string
          description?: string | null
          id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "purse_transactions_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_bills: {
        Row: {
          active: boolean
          admin_id: string
          amount: number
          category: string
          created_at: string
          due_day: number
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          admin_id: string
          amount: number
          category?: string
          created_at?: string
          due_day: number
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          admin_id?: string
          amount?: number
          category?: string
          created_at?: string
          due_day?: number
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_bills_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      room_expenses: {
        Row: {
          admin_id: string
          amount: number
          category: string
          created_at: string
          date: string
          description: string | null
          id: string
          image_url: string | null
          paid_by: string | null
          split_among: string[] | null
          updated_at: string
        }
        Insert: {
          admin_id: string
          amount: number
          category: string
          created_at?: string
          date?: string
          description?: string | null
          id?: string
          image_url?: string | null
          paid_by?: string | null
          split_among?: string[] | null
          updated_at?: string
        }
        Update: {
          admin_id?: string
          amount?: number
          category?: string
          created_at?: string
          date?: string
          description?: string | null
          id?: string
          image_url?: string | null
          paid_by?: string | null
          split_among?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_expenses_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_my_admin_id: { Args: never; Returns: string }
      get_my_profile_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
