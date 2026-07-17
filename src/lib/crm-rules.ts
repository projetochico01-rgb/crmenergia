import type { LeadPipelineStatus } from '@/types/database';

export type CrmRole = 'admin' | 'atendente';

export function canAssignLead(role: CrmRole, actorId: string, currentOwnerId: string | null, targetOwnerId: string | null) {
  if (role === 'admin') return true;
  const canAccess = currentOwnerId === null || currentOwnerId === actorId;
  return canAccess && (targetOwnerId === null || targetOwnerId === actorId);
}

export function canReturnToAi(automationContactAllowed: boolean, humanHandoff: boolean) {
  return automationContactAllowed && humanHandoff;
}

export function canQueueConversion(consentStatus: string | null | undefined, existingStatus?: string | null) {
  return consentStatus === 'granted' && (!existingStatus || existingStatus === 'cancelled');
}

const legacyStages: Partial<Record<LeadPipelineStatus, LeadPipelineStatus>> = {
  em_atendimento_ia: 'contato',
  atendimento_humano: 'contato',
  analise_fatura: 'qualificado',
  contrato_enviado: 'proposta',
};

export function commercialStage(status: LeadPipelineStatus | null | undefined): LeadPipelineStatus {
  return legacyStages[status ?? 'novo'] ?? status ?? 'novo';
}
