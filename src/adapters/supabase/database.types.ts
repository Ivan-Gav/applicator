export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      application: {
        Row: {
          application_url: string | null;
          applied_at: string | null;
          archived_at: string | null;
          channel: string;
          city: string | null;
          company_name: string;
          contact_email: string | null;
          contact_name: string | null;
          contact_phone: string | null;
          contact_role: string | null;
          contact_url: string | null;
          country: string | null;
          created_at: string;
          id: string;
          last_contact_at: string | null;
          notes: string | null;
          position_title: string;
          salary_advertised_max: number | null;
          salary_advertised_min: number | null;
          salary_asked_max: number | null;
          salary_asked_min: number | null;
          salary_currency: string | null;
          salary_estimated_max: number | null;
          salary_estimated_min: number | null;
          salary_period: string;
          seniority: string | null;
          source: string | null;
          source_url: string | null;
          status: string;
          status_changed_at: string;
          updated_at: string;
          user_id: string;
          work_mode: string | null;
        };
        Insert: {
          application_url?: string | null;
          applied_at?: string | null;
          archived_at?: string | null;
          channel?: string;
          city?: string | null;
          company_name: string;
          contact_email?: string | null;
          contact_name?: string | null;
          contact_phone?: string | null;
          contact_role?: string | null;
          contact_url?: string | null;
          country?: string | null;
          created_at?: string;
          id?: string;
          last_contact_at?: string | null;
          notes?: string | null;
          position_title: string;
          salary_advertised_max?: number | null;
          salary_advertised_min?: number | null;
          salary_asked_max?: number | null;
          salary_asked_min?: number | null;
          salary_currency?: string | null;
          salary_estimated_max?: number | null;
          salary_estimated_min?: number | null;
          salary_period?: string;
          seniority?: string | null;
          source?: string | null;
          source_url?: string | null;
          status?: string;
          status_changed_at?: string;
          updated_at?: string;
          user_id: string;
          work_mode?: string | null;
        };
        Update: {
          application_url?: string | null;
          applied_at?: string | null;
          archived_at?: string | null;
          channel?: string;
          city?: string | null;
          company_name?: string;
          contact_email?: string | null;
          contact_name?: string | null;
          contact_phone?: string | null;
          contact_role?: string | null;
          contact_url?: string | null;
          country?: string | null;
          created_at?: string;
          id?: string;
          last_contact_at?: string | null;
          notes?: string | null;
          position_title?: string;
          salary_advertised_max?: number | null;
          salary_advertised_min?: number | null;
          salary_asked_max?: number | null;
          salary_asked_min?: number | null;
          salary_currency?: string | null;
          salary_estimated_max?: number | null;
          salary_estimated_min?: number | null;
          salary_period?: string;
          seniority?: string | null;
          source?: string | null;
          source_url?: string | null;
          status?: string;
          status_changed_at?: string;
          updated_at?: string;
          user_id?: string;
          work_mode?: string | null;
        };
        Relationships: [];
      };
      application_document: {
        Row: {
          application_id: string;
          created_at: string;
          document_id: string;
          user_id: string;
        };
        Insert: {
          application_id: string;
          created_at?: string;
          document_id: string;
          user_id: string;
        };
        Update: {
          application_id?: string;
          created_at?: string;
          document_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "application_document_application_id_fkey";
            columns: ["application_id"];
            isOneToOne: false;
            referencedRelation: "application";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "application_document_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "document";
            referencedColumns: ["id"];
          },
        ];
      };
      document: {
        Row: {
          created_at: string;
          id: string;
          kind: string;
          language: string | null;
          storage_path: string;
          title: string;
          updated_at: string;
          user_id: string;
          version_label: string | null;
        };
        Insert: {
          created_at?: string;
          id?: string;
          kind: string;
          language?: string | null;
          storage_path: string;
          title: string;
          updated_at?: string;
          user_id: string;
          version_label?: string | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          kind?: string;
          language?: string | null;
          storage_path?: string;
          title?: string;
          updated_at?: string;
          user_id?: string;
          version_label?: string | null;
        };
        Relationships: [];
      };
      interview: {
        Row: {
          application_id: string;
          created_at: string;
          duration_minutes: number | null;
          format: string | null;
          id: string;
          kind: string | null;
          notes: string | null;
          outcome: string;
          participants: string | null;
          round_number: number;
          scheduled_at: string | null;
          timezone: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          application_id: string;
          created_at?: string;
          duration_minutes?: number | null;
          format?: string | null;
          id?: string;
          kind?: string | null;
          notes?: string | null;
          outcome?: string;
          participants?: string | null;
          round_number?: number;
          scheduled_at?: string | null;
          timezone?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          application_id?: string;
          created_at?: string;
          duration_minutes?: number | null;
          format?: string | null;
          id?: string;
          kind?: string | null;
          notes?: string | null;
          outcome?: string;
          participants?: string | null;
          round_number?: number;
          scheduled_at?: string | null;
          timezone?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "interview_application_id_fkey";
            columns: ["application_id"];
            isOneToOne: false;
            referencedRelation: "application";
            referencedColumns: ["id"];
          },
        ];
      };
      status_event: {
        Row: {
          application_id: string;
          created_at: string;
          id: string;
          occurred_at: string;
          status: string;
          user_id: string;
        };
        Insert: {
          application_id: string;
          created_at?: string;
          id?: string;
          occurred_at?: string;
          status: string;
          user_id: string;
        };
        Update: {
          application_id?: string;
          created_at?: string;
          id?: string;
          occurred_at?: string;
          status?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "status_event_application_id_fkey";
            columns: ["application_id"];
            isOneToOne: false;
            referencedRelation: "application";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
