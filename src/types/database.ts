export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type LeadPipelineStatus =
  | "novo"
  | "contato"
  | "qualificado"
  | "proposta"
  | "negociacao"
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
  assigned_user_id?: string | null;
  campaign_id?: string | null;
  ad_id?: string | null;
  first_source?: string | null;
  first_medium?: string | null;
  first_campaign?: string | null;
  last_source?: string | null;
  last_medium?: string | null;
  last_campaign?: string | null;
  fbclid?: string | null;
  fbc?: string | null;
  fbp?: string | null;
  meta_lead_id?: string | null;
  consent_status?: "unknown" | "granted" | "denied";
  consent_at?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  last_inbound_at?: string | null;
  last_outbound_at?: string | null;
  awaiting_response?: boolean;
  cadence_status?: "inactive" | "waiting" | "active" | "responded" | "completed" | "paused" | "cancelled" | "blocked";
  automation_contact_allowed?: boolean;
  do_not_contact_at?: string | null;
  do_not_contact_reason?: string | null;
  ai_enabled?: boolean;
  human_handoff?: boolean;
  stage_entered_at?: string | null;
  closed_value?: number | null;
  updated_at?: string | null;
}

export interface LeadTouchpoint {
  [key: string]: unknown;
  id: string;
  lead_id: string;
  channel: string;
  direction: "inbound" | "outbound" | "system";
  source: string | null;
  medium: string | null;
  campaign: string | null;
  external_event_id: string | null;
  payload: Json;
  occurred_at: string;
  created_at: string;
}

export interface IntegrationIdempotency {
  [key: string]: unknown;
  idempotency_key: string;
  request_hash: string;
  response_status: number | null;
  response_body: Json | null;
  created_at: string;
}

export interface LeadStageHistory {
  [key: string]: unknown;
  id: string;
  lead_id: string;
  from_stage: string | null;
  to_stage: string;
  changed_by: string | null;
  reason: string | null;
  created_at: string;
}

export interface MessageTemplate {
  [key: string]: unknown;
  id: string;
  name: string;
  body: string;
  version: number;
  approved: boolean;
  active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CadenceConfig {
  [key: string]: unknown;
  id: string;
  name: string;
  active: boolean;
  timezone: string;
  allowed_weekdays: number[];
  window_start: string;
  window_end: string;
  auto_start_enabled: boolean;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CadenceStep {
  [key: string]: unknown;
  id: string;
  cadence_config_id: string;
  step_order: number;
  interval_value: number;
  interval_unit: "hours" | "days";
  template_id: string;
  active: boolean;
  created_at: string;
  updated_at: string;
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
      lead_touchpoints: {
        Row: LeadTouchpoint;
        Insert: Omit<LeadTouchpoint, "id" | "created_at" | "occurred_at"> &
          Partial<Pick<LeadTouchpoint, "id" | "created_at" | "occurred_at">>;
        Update: Partial<LeadTouchpoint>;
        Relationships: [];
      };
      integration_idempotency: {
        Row: IntegrationIdempotency;
        Insert: Omit<IntegrationIdempotency, "created_at"> &
          Partial<Pick<IntegrationIdempotency, "created_at">>;
        Update: Partial<IntegrationIdempotency>;
        Relationships: [];
      };
      lead_stage_history: {
        Row: LeadStageHistory;
        Insert: Omit<LeadStageHistory, "id" | "created_at"> &
          Partial<Pick<LeadStageHistory, "id" | "created_at">>;
        Update: Partial<LeadStageHistory>;
        Relationships: [];
      };
      message_templates: {
        Row: MessageTemplate;
        Insert: Omit<MessageTemplate, "id" | "created_at" | "updated_at"> & Partial<Pick<MessageTemplate, "id" | "created_at" | "updated_at">>;
        Update: Partial<MessageTemplate>;
        Relationships: [];
      };
      cadence_config: {
        Row: CadenceConfig;
        Insert: Omit<CadenceConfig, "id" | "created_at" | "updated_at"> & Partial<Pick<CadenceConfig, "id" | "created_at" | "updated_at">>;
        Update: Partial<CadenceConfig>;
        Relationships: [];
      };
      cadence_steps: {
        Row: CadenceStep;
        Insert: Omit<CadenceStep, "id" | "created_at" | "updated_at"> & Partial<Pick<CadenceStep, "id" | "created_at" | "updated_at">>;
        Update: Partial<CadenceStep>;
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
    Functions: {
      cadence_start_for_lead: {
        Args: { target_lead_id: string; outbound_at?: string };
        Returns: Record<string, unknown>;
      };
      cadence_register_inbound: {
        Args: { target_lead_id: string; inbound_at?: string };
        Returns: Record<string, unknown>;
      };
      cadence_apply_opt_out: {
        Args: { target_lead_id: string; reason: string; blocked_at?: string };
        Returns: Record<string, unknown>;
      };
      cadence_claim_due: {
        Args: { worker_name: string; batch_size?: number };
        Returns: Array<{
          attempt_id: string;
          cycle_id: string;
          lead_id: string;
          phone: string;
          lead_name: string;
          template_body: string;
          idempotency_key: string;
          technical_attempts: number;
        }>;
      };
      cadence_complete_attempt: {
        Args: { target_attempt_id: string; message_id: string; completed_at?: string };
        Returns: Record<string, unknown>;
      };
      cadence_fail_attempt: {
        Args: { target_attempt_id: string; failure_message: string; failed_at?: string };
        Returns: Record<string, unknown>;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
