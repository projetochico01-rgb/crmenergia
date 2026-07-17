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

export interface CrmUserProfile {
  [key: string]: unknown;
  user_id: string;
  display_name: string | null;
  role: "admin" | "atendente";
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Campaign {
  [key: string]: unknown;
  id: string;
  provider: string;
  external_id: string | null;
  name: string;
  source: string | null;
  medium: string | null;
  active: boolean;
  metadata: Json;
  created_at: string;
  updated_at: string;
}

export interface CampaignAd {
  [key: string]: unknown;
  id: string;
  campaign_id: string | null;
  external_adset_id: string | null;
  external_ad_id: string | null;
  name: string | null;
  metadata: Json;
  created_at: string;
}

export interface LeadCadence {
  [key: string]: unknown;
  id: string;
  lead_id: string;
  cadence_config_id: string;
  status: "waiting" | "active" | "responded" | "completed" | "paused" | "cancelled" | "blocked";
  current_step: number;
  next_run_at: string | null;
  last_inbound_at: string | null;
  last_outbound_at: string | null;
  started_at: string;
  ended_at: string | null;
  started_by: "diana";
  created_at: string;
  updated_at: string;
}

export interface CadenceAttempt {
  [key: string]: unknown;
  id: string;
  lead_cadence_id: string;
  cadence_step_id: string;
  status: "scheduled" | "claimed" | "sent" | "cancelled" | "error";
  scheduled_for: string;
  claimed_at: string | null;
  claimed_by: string | null;
  sent_at: string | null;
  evolution_message_id: string | null;
  template_snapshot: string;
  technical_attempts: number;
  error_message: string | null;
  idempotency_key: string;
  created_at: string;
  updated_at: string;
}

export interface CrmMessage {
  [key: string]: unknown;
  id: string;
  lead_id: string;
  external_message_id: string | null;
  channel: string;
  direction: "inbound" | "outbound";
  sender_type: "lead" | "diana" | "human" | "system";
  body: string | null;
  media_url: string | null;
  media_type: string | null;
  sent_at: string;
  metadata: Json;
  created_at: string;
}

export interface AuditLog {
  [key: string]: unknown;
  id: number;
  actor_user_id: string | null;
  actor_type: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  before_data: Json | null;
  after_data: Json | null;
  ip_address: string | null;
  created_at: string;
}

export interface ConversionOutbox {
  [key: string]: unknown;
  id: string;
  lead_id: string;
  event_name: string;
  event_id: string;
  payload: Json;
  status: "pending" | "sent" | "cancelled" | "error";
  attempts: number;
  available_at: string;
  sent_at: string | null;
  error_message: string | null;
  created_at: string;
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
      crm_user_profiles: {
        Row: CrmUserProfile;
        Insert: Omit<CrmUserProfile, "created_at" | "updated_at"> & Partial<Pick<CrmUserProfile, "created_at" | "updated_at">>;
        Update: Partial<CrmUserProfile>;
        Relationships: [];
      };
      campaigns: {
        Row: Campaign;
        Insert: Omit<Campaign, "id" | "created_at" | "updated_at"> & Partial<Pick<Campaign, "id" | "created_at" | "updated_at">>;
        Update: Partial<Campaign>;
        Relationships: [];
      };
      campaign_ads: {
        Row: CampaignAd;
        Insert: Omit<CampaignAd, "id" | "created_at"> & Partial<Pick<CampaignAd, "id" | "created_at">>;
        Update: Partial<CampaignAd>;
        Relationships: [];
      };
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
      lead_cadences: {
        Row: LeadCadence;
        Insert: Omit<LeadCadence, "id" | "created_at" | "updated_at"> & Partial<Pick<LeadCadence, "id" | "created_at" | "updated_at">>;
        Update: Partial<LeadCadence>;
        Relationships: [];
      };
      cadence_attempts: {
        Row: CadenceAttempt;
        Insert: Omit<CadenceAttempt, "id" | "created_at" | "updated_at" | "idempotency_key"> & Partial<Pick<CadenceAttempt, "id" | "created_at" | "updated_at" | "idempotency_key">>;
        Update: Partial<CadenceAttempt>;
        Relationships: [];
      };
      crm_messages: {
        Row: CrmMessage;
        Insert: Omit<CrmMessage, "id" | "created_at" | "sent_at"> & Partial<Pick<CrmMessage, "id" | "created_at" | "sent_at">>;
        Update: Partial<CrmMessage>;
        Relationships: [];
      };
      audit_log: {
        Row: AuditLog;
        Insert: Omit<AuditLog, "id" | "created_at"> & Partial<Pick<AuditLog, "id" | "created_at">>;
        Update: Partial<AuditLog>;
        Relationships: [];
      };
      conversion_outbox: {
        Row: ConversionOutbox;
        Insert: Omit<ConversionOutbox, "id" | "event_id" | "created_at" | "available_at"> & Partial<Pick<ConversionOutbox, "id" | "event_id" | "created_at" | "available_at">>;
        Update: Partial<ConversionOutbox>;
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
