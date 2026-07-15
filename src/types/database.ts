export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type LeadPipelineStatus =
  | "novo"
  | "em_atendimento_ia"
  | "atendimento_humano"
  | "analise_fatura"
  | "contrato_enviado"
  | "fechado"
  | "perdido";

export interface LeadsPipeline {
  [key: string]: unknown;
  id: string;
  name: string;
  value: number | null;
  status: LeadPipelineStatus | null;
  deadline: string | null;
  created_at: string | null;
  observations: string | null;
  phone: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  os: string | null;
  navegador: string | null;
  dispositivo: string | null;
  intervencao_humana: boolean | null;
  email: string | null;
  cidade: string | null;
  origem: string | null;
  score: number | null;
}

export interface BaseDeConhecimento {
  [key: string]: unknown;
  id: number;
  pergunta_ou_objecao: string;
  resposta_ideal: string;
  tipo: string | null;
  created_at: string | null;
  updated_at: string | null;
  search_vector: unknown | null;
}

export interface Database {
  public: {
    Tables: {
      leads_pipeline: {
        Row: LeadsPipeline;
        Insert: Omit<LeadsPipeline, "id" | "created_at"> &
          Partial<Pick<LeadsPipeline, "id" | "created_at">>;
        Update: Partial<LeadsPipeline>;
        Relationships: [];
      };
      base_de_conhecimento: {
        Row: BaseDeConhecimento;
        Insert: Omit<BaseDeConhecimento, "id" | "created_at" | "updated_at" | "search_vector"> &
          Partial<Pick<BaseDeConhecimento, "id" | "created_at" | "updated_at">>;
        Update: Partial<Omit<BaseDeConhecimento, "search_vector">>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
