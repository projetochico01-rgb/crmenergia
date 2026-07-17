import assert from 'node:assert/strict';
import test from 'node:test';
import { canAssignLead, canQueueConversion, canReturnToAi, commercialStage } from '../src/lib/crm-rules.ts';

test('administrador transfere qualquer lead e atendente somente assume ou libera o próprio', () => {
  assert.equal(canAssignLead('admin', 'admin', 'u1', 'u2'), true);
  assert.equal(canAssignLead('atendente', 'u1', null, 'u1'), true);
  assert.equal(canAssignLead('atendente', 'u1', 'u1', null), true);
  assert.equal(canAssignLead('atendente', 'u1', 'u2', 'u1'), false);
  assert.equal(canAssignLead('atendente', 'u1', null, 'u2'), false);
});

test('opt-out bloqueia retorno para IA e conversão sem consentimento', () => {
  assert.equal(canReturnToAi(false, true), false);
  assert.equal(canReturnToAi(true, true), true);
  assert.equal(canQueueConversion('denied'), false);
  assert.equal(canQueueConversion('granted'), true);
  assert.equal(canQueueConversion('granted', 'pending'), false);
  assert.equal(canQueueConversion('granted', 'cancelled'), true);
});

test('etapas legadas são apresentadas no funil comercial correto', () => {
  assert.equal(commercialStage('em_atendimento_ia'), 'contato');
  assert.equal(commercialStage('contrato_enviado'), 'proposta');
  assert.equal(commercialStage('fechado'), 'fechado');
});
