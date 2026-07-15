# BeHub CRM — Energia Solar

CRM para receber, qualificar e acompanhar leads de energia solar vindos de campanhas, landing pages, WhatsApp e integrações do n8n.

## Componentes

- **Next.js:** dashboard, Kanban, atendimento e configuração da cadência.
- **Supabase:** autenticação, leads, campanhas, RLS, histórico, cadência e auditoria.
- **n8n / Diana:** triagem por IA, opt-out, handoff e execução futura dos follow-ups.
- **Evolution API:** leitura e envio de mensagens do WhatsApp.
- **Redis:** pausa operacional da IA.

Produção: <https://crmenergia.vercel.app>

## Estado de segurança

- Os workflows do WhatsApp, cadência e erros permanecem **inativos**.
- A configuração global da cadência está **inativa** e com início automático desligado.
- Envio para Meta Conversions API ainda não está habilitado; existe apenas a outbox para uso futuro.
- Opt-out bloqueia IA e cadência, mas mantém resposta manual disponível com aviso visual.

## Variáveis de ambiente

Copie `.env.example` para `.env.local` e preencha somente no ambiente seguro. Nunca use prefixo `NEXT_PUBLIC_` em segredos de servidor.

Principais variáveis:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `LEADS_INTAKE_TOKEN`
- `N8N_CADENCE_TOKEN`
- `EVOLUTION_API_URL`, `EVOLUTION_API_KEY` e `EVOLUTION_INSTANCE`
- `REDIS_URL`

## Entrada única de leads

`POST /api/leads/intake`

Cabeçalhos obrigatórios:

```text
Authorization: Bearer <LEADS_INTAKE_TOKEN>
Idempotency-Key: <identificador-unico-do-evento>
Content-Type: application/json
```

Exemplo de payload:

```json
{
  "name": "Nome do lead",
  "phone": "51999999999",
  "email": "lead@example.com",
  "source": "facebook",
  "medium": "paid_social",
  "campaign": "campanha-energia",
  "metaLeadId": "identificador-meta",
  "consent": "granted"
}
```

O telefone é normalizado para E.164 (`+55...`). Reentradas atualizam o lead e criam um novo touchpoint, preservando first-touch e last-touch.

## Cadência preparada

A configuração inicial, ainda desligada, usa dias úteis das 08h às 18h em `America/Sao_Paulo`:

1. Após 2 horas — Retomada curta.
2. Após mais 1 dia — Lembrete de análise.
3. Após mais 2 dias — Encerramento gentil.

As funções do banco impedem ciclos simultâneos, fazem claim atômico, cancelam pendências após resposta ou opt-out e revalidam bloqueios antes do envio.

## Workflows n8n de teste

- `FIoAlqxwvqA0cJqO` — Diana adaptada ao CRM.
- `396lWRRA76jSUlhA` — Cadência de follow-up.
- `cAMYy4lVuxmGOBpB` — Registro de erros.

Todos devem permanecer inativos até autorização explícita para testar Evolution, Redis, IA e envio real.

## Desenvolvimento e validação

```bash
npm install
npm run dev
npm test
npm run lint
npm run build
```

Migrações aplicadas ficam em `supabase/migrations/`. As políticas RLS foram verificadas para visitante anônimo, atendente e administrador.

## Antes da futura ativação

- Confirmar `N8N_COMMUNITY_PACKAGES_ALLOW_TOOL_USAGE=true` no servidor do n8n.
- Associar o Error Workflow aos fluxos que serão ativados.
- Testar Evolution API e Redis em ambiente controlado.
- Testar resposta, opt-out, handoff, retomada e falhas sem usar contatos reais.
- Só então ativar a Diana e o agendador de cadência.
