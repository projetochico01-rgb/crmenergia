# Plano de implantação do frontend — BeHub CRM

## Objetivo

Adequar integralmente o frontend do CRM à estrutura criada no Supabase, nas APIs internas e nos workflows de teste do n8n.

Ao final, administradores e atendentes devem conseguir executar todas as tarefas diárias pelo CRM, sem acessar diretamente Supabase, n8n, Evolution ou Redis.

## Regras desta implantação

- Não ativar os workflows do n8n durante a implantação visual.
- Não enviar mensagens reais de WhatsApp sem autorização.
- Não ativar Meta Conversions API nesta etapa.
- Não misturar etapa comercial, estado da IA, handoff e cadência.
- Manter o Supabase como autoridade de opt-out.
- Preservar a pasta `skills`, que não pertence às alterações do CRM.
- Entregar cada fase com responsividade, estados vazios, carregamento, erro e confirmação.

---

## Fase 1 — Responsáveis e operação comercial

### 1.1 Responsáveis nos leads

- [ ] Carregar perfis ativos de `crm_user_profiles`.
- [ ] Mostrar nome e função do responsável em vez do UUID.
- [ ] Adicionar filtro por responsável no Kanban.
- [ ] Permitir que um atendente assuma um lead livre.
- [ ] Permitir que administrador transfira um lead.
- [ ] Permitir devolver o lead para a fila livre.
- [ ] Registrar alteração de responsável na auditoria.
- [ ] Respeitar RLS para impedir transferência não autorizada.

### 1.2 Kanban completo

- [ ] Mostrar quantidade de leads por coluna.
- [ ] Mostrar valor potencial por coluna.
- [ ] Destacar tempo excessivo na etapa.
- [ ] Exibir campanha, responsável, IA, handoff e cadência no card.
- [ ] Adicionar ações rápidas no card.
- [ ] Melhorar drag-and-drop em telas menores.
- [ ] Criar alternativa ao arraste para dispositivos móveis.
- [ ] Manter rollback visual quando uma atualização falhar.

### 1.3 Cadastro e edição do lead

- [ ] Completar formulário de criação.
- [ ] Permitir editar nome, telefone, e-mail, cidade e observações.
- [ ] Permitir editar valor potencial e valor fechado.
- [ ] Validar e exibir telefone em E.164 de forma amigável.
- [ ] Impedir alterações indevidas em first-touch.
- [ ] Exibir confirmação antes de ações comerciais irreversíveis.

### Critérios de aceite da fase 1

- [ ] Atendente enxerga somente seus leads e a fila livre.
- [ ] Administrador enxerga e transfere todos os leads.
- [ ] Alterações aparecem sem recarregar manualmente a página.
- [ ] Kanban funciona em desktop, tablet e celular.
- [ ] Falhas não deixam o card na coluna errada.

---

## Fase 2 — Detalhes e histórico completo do lead

### 2.1 Painel unificado

- [ ] Criar rota ou modal amplo para detalhes do lead.
- [ ] Organizar o painel em abas ou seções.
- [ ] Exibir cadastro e informações comerciais.
- [ ] Exibir responsável e ações de atribuição.
- [ ] Exibir first-touch e last-touch.
- [ ] Exibir UTMs, Meta Lead ID, `fbclid`, `fbc` e `fbp`.
- [ ] Exibir consentimento e opt-out.

### 2.2 Histórico comercial

- [ ] Ler `lead_stage_history`.
- [ ] Mostrar etapa anterior, nova etapa, usuário e horário.
- [ ] Exibir linha do tempo do funil.
- [ ] Permitir filtrar o histórico por tipo de evento.

### 2.3 Touchpoints e reincidências

- [ ] Ler `lead_touchpoints`.
- [ ] Mostrar todas as entradas do mesmo telefone.
- [ ] Identificar canal, campanha e evento externo.
- [ ] Diferenciar primeira entrada de reincidências.

### 2.4 Histórico da cadência

- [ ] Ler `lead_cadences` e `cadence_attempts`.
- [ ] Mostrar ciclo atual e ciclos anteriores.
- [ ] Mostrar etapa, template, agendamento e resultado.
- [ ] Destacar tentativas canceladas, enviadas e com erro.
- [ ] Exibir motivo de bloqueio ou encerramento.

### Critérios de aceite da fase 2

- [ ] Todo o histórico do lead pode ser consultado em um único lugar.
- [ ] O painel diferencia comercial, IA, handoff e cadência.
- [ ] Nenhuma informação técnica sensível é mostrada ao atendente.

---

## Fase 3 — Central de atendimento e IA

### 3.1 Lista de conversas

- [ ] Melhorar busca por nome e telefone.
- [ ] Criar filtros para não lidas, IA ativa, humano e opt-out.
- [ ] Mostrar horário e resumo da última mensagem.
- [ ] Mostrar contador de não lidas quando disponível.
- [ ] Vincular a conversa ao lead pelo telefone normalizado.
- [ ] Tratar conversa sem lead com ação para criar ou vincular cadastro.

### 3.2 Área de mensagens

- [ ] Melhorar diferenciação visual entre lead, IA e humano.
- [ ] Exibir status de envio e erro.
- [ ] Preparar visualização de áudio, imagem e documento.
- [ ] Exibir carregamento e paginação do histórico.
- [ ] Manter envio manual disponível após opt-out com aviso vermelho.
- [ ] Impedir duplicidade visual de mensagens.

### 3.3 Controle da IA e handoff

- [ ] Mostrar estado real da IA no Supabase e no Redis.
- [ ] Pausar a IA por períodos predefinidos.
- [ ] Permitir pausa por tempo indeterminado.
- [ ] Retomar a IA.
- [ ] Transferir explicitamente para atendimento humano.
- [ ] Devolver o atendimento para a IA.
- [ ] Exibir quem realizou a ação e quando.
- [ ] Desabilitar cadência enquanto houver atendimento humano.

### 3.4 Opt-out

- [ ] Mostrar data e motivo do pedido para não incomodar.
- [ ] Exibir bloqueio permanente de IA e cadência.
- [ ] Criar ação administrativa para corrigir bloqueio aplicado por engano.
- [ ] Exigir motivo e registrar auditoria ao remover um opt-out.

### Critérios de aceite da fase 3

- [ ] Atendimento manual pode ser realizado sem celular.
- [ ] Pausa, retomada e handoff têm feedback visual confiável.
- [ ] Opt-out nunca é confundido com etapa do funil.
- [ ] Nenhum teste envia WhatsApp sem autorização explícita.

---

## Fase 4 — Administração de usuários

### 4.1 Tela de usuários

- [ ] Listar administradores e atendentes.
- [ ] Mostrar estado ativo ou inativo.
- [ ] Alterar nome de exibição.
- [ ] Alterar função entre administrador e atendente.
- [ ] Desativar acesso sem apagar histórico.
- [ ] Mostrar quantidade de leads atribuídos.
- [ ] Impedir que o último administrador ativo seja desativado.

### 4.2 Convites e criação

- [ ] Definir fluxo seguro de convite.
- [ ] Criar usuário sem expor senha no frontend.
- [ ] Exibir estado do convite.
- [ ] Permitir reenvio de convite quando aplicável.

### Critérios de aceite da fase 4

- [ ] Gestão de acessos não exige abrir o Supabase.
- [ ] Somente administradores acessam esta tela.
- [ ] Todas as alterações ficam auditadas.

---

## Fase 5 — Campanhas e atribuição

### 5.1 Tela de campanhas

- [ ] Listar campanhas de `campaigns`.
- [ ] Listar conjuntos e anúncios de `campaign_ads`.
- [ ] Mostrar origem, meio e estado ativo.
- [ ] Mostrar leads, qualificados, fechados e perdidos.
- [ ] Calcular conversão e valores por campanha.
- [ ] Permitir abrir os leads relacionados.

### 5.2 Atribuição do lead

- [ ] Exibir first-touch e last-touch separadamente.
- [ ] Mostrar UTMs e identificadores da Meta.
- [ ] Diferenciar campanha original da campanha mais recente.
- [ ] Criar filtros por campanha, anúncio e período.

### Critérios de aceite da fase 5

- [ ] A origem de cada lead pode ser explicada pelo frontend.
- [ ] O dashboard e a tela de campanhas apresentam números coerentes.
- [ ] Não há envio de eventos para a Meta nesta fase.

---

## Fase 6 — Templates e configuração da cadência

### 6.1 Gestão de templates

- [ ] Listar templates e versões.
- [ ] Criar template.
- [ ] Editar criando nova versão, sem alterar versão usada no passado.
- [ ] Aprovar ou reprovar versão.
- [ ] Ativar ou desativar template.
- [ ] Pré-visualizar variáveis como `{{nome}}`.
- [ ] Impedir exclusão de template usado em tentativas.

### 6.2 Configurador da cadência

- [x] Ativar ou desativar configuração global.
- [x] Configurar início automático.
- [x] Configurar dias, horários e timezone.
- [x] Adicionar, remover e reordenar etapas.
- [x] Selecionar templates aprovados.
- [x] Mostrar preview da sequência.
- [ ] Exibir quantidade de leads em cada estado da cadência.
- [ ] Exibir aviso sobre alterações que afetam somente novos agendamentos.
- [ ] Criar histórico de alterações da configuração.

### 6.3 Monitor da cadência

- [ ] Listar tentativas próximas.
- [ ] Listar enviadas, canceladas e com erro.
- [ ] Filtrar por lead, período e estado.
- [ ] Exibir tentativas técnicas e último erro.
- [ ] Preparar reprocessamento administrativo seguro.

### Critérios de aceite da fase 6

- [ ] Administrador gerencia templates e cadência sem SQL.
- [ ] Versões utilizadas permanecem imutáveis no histórico.
- [ ] Configuração continua desligada até autorização de ativação.

---

## Fase 7 — Auditoria e integrações

### 7.1 Auditoria

- [ ] Criar tela baseada em `audit_log`.
- [ ] Filtrar por usuário, entidade, ação e período.
- [ ] Exibir alterações relevantes com linguagem amigável.
- [ ] Restringir a tela a administradores.

### 7.2 Monitor de integrações

- [ ] Mostrar estado de Supabase, Evolution, Redis e n8n.
- [ ] Mostrar últimas entradas pela API de leads.
- [ ] Mostrar erros por integração.
- [ ] Diferenciar erro transitório de erro persistente.
- [ ] Criar ação segura de reprocessamento quando suportada.
- [ ] Nunca exibir tokens ou chaves privadas.

### Critérios de aceite da fase 7

- [ ] Administrador identifica falhas sem acessar logs técnicos externos.
- [ ] Segredos nunca aparecem no navegador.
- [ ] Reprocessamentos são idempotentes e auditados.

---

## Fase 8 — Meta Conversions API no frontend

### 8.1 Ações comerciais

- [ ] Criar ação “Marcar como qualificado”.
- [ ] Criar ação “Registrar venda”.
- [ ] Solicitar valor e data do fechamento.
- [ ] Mostrar consentimento e atribuição antes de gerar evento.

### 8.2 Monitor da outbox

- [ ] Ler `conversion_outbox`.
- [ ] Mostrar eventos pendentes, enviados e com erro.
- [ ] Exibir tentativas e último erro.
- [ ] Preparar reprocessamento manual.
- [ ] Impedir duplicidade de eventos.

### Critérios de aceite da fase 8

- [ ] O frontend prepara e acompanha eventos de conversão.
- [ ] O envio real permanece desligado até autorização específica.
- [ ] Eventos sem consentimento não são enviados.

---

## Fase 9 — Qualidade visual, acessibilidade e responsividade

- [ ] Padronizar estados de carregamento.
- [ ] Padronizar estados vazios.
- [ ] Padronizar mensagens de erro e sucesso.
- [ ] Revisar contraste e navegação por teclado.
- [ ] Garantir foco visível em botões e formulários.
- [ ] Validar desktop, tablet e celular.
- [ ] Revisar tabelas e modais em telas pequenas.
- [ ] Adicionar skeletons onde houver carregamento perceptível.
- [ ] Evitar perda de formulário ao fechar modal acidentalmente.
- [ ] Confirmar identidade visual BeHub em todas as telas.

### Critérios de aceite da fase 9

- [ ] Não existem controles inacessíveis pelo teclado.
- [ ] Não há conteúdo cortado nos principais breakpoints.
- [ ] Todas as páginas possuem feedback de carregamento e erro.

---

## Fase 10 — Testes e implantação

### Testes técnicos

- [ ] Criar testes dos componentes críticos.
- [ ] Testar atribuição e transferência de responsáveis.
- [ ] Testar rollback do Kanban.
- [ ] Testar filtros e permissões por função.
- [ ] Testar formulários e validações.
- [ ] Testar estados de opt-out, handoff e cadência.
- [ ] Executar `npm test`.
- [ ] Executar `npm run lint`.
- [ ] Executar `npm run build`.

### Validação em produção

- [ ] Publicar cada fase em commits separados.
- [ ] Confirmar deploy da Vercel.
- [ ] Validar login de administrador.
- [ ] Validar login de atendente.
- [ ] Validar RLS após cada novo módulo administrativo.
- [ ] Verificar páginas em desktop e celular.
- [ ] Confirmar que workflows continuam inativos.

---

## Ordem de implantação recomendada

1. Fase 1 — Responsáveis e operação comercial.
2. Fase 2 — Detalhes e histórico do lead.
3. Fase 3 — Central de atendimento e IA.
4. Fase 4 — Administração de usuários.
5. Fase 6 — Templates e monitor da cadência.
6. Fase 5 — Campanhas e atribuição.
7. Fase 7 — Auditoria e integrações.
8. Fase 8 — Meta Conversions API no frontend.
9. Fase 9 — Revisão visual e acessibilidade.
10. Fase 10 — Testes e implantação final.

## Marcos sugeridos

### Marco A — Operação comercial completa

Fases 1 e 2 concluídas. A equipe gerencia responsáveis, Kanban e histórico completo do lead.

### Marco B — Atendimento centralizado

Fase 3 concluída. O atendente opera conversas e controles da IA pelo CRM, ainda em ambiente de teste.

### Marco C — Administração completa

Fases 4, 5, 6 e 7 concluídas. Usuários, campanhas, templates, cadência e auditoria são gerenciados pelo frontend.

### Marco D — Preparação para otimização da Meta

Fase 8 concluída. Eventos podem ser preparados e monitorados, mas o envio real segue desligado.

### Marco E — Frontend pronto para operação

Fases 9 e 10 concluídas. Interface responsiva, acessível, testada e publicada.

## Definição de concluído

O frontend será considerado implantado quando:

- [ ] Nenhuma operação comercial diária exigir acesso ao Supabase.
- [ ] Nenhuma administração comum exigir acesso ao n8n.
- [ ] Atendentes puderem operar leads e conversas pelo CRM.
- [ ] Administradores puderem gerenciar usuários, campanhas, templates e auditoria.
- [ ] Estados de IA, handoff, cadência e opt-out forem independentes e confiáveis.
- [ ] Todas as telas forem responsivas e protegidas por função.
- [ ] Testes, lint, build e validação pós-deploy estiverem aprovados.
- [ ] Ativações de WhatsApp, IA, cadência e Meta dependerem de autorização separada.
