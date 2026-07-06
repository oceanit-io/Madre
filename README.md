# Loja de Prata 925

E-commerce multitenant de joias em prata 925, ao vivo em **[lojadeprata925.com.br](https://lojadeprata925.com.br)**.

Plataforma onde **revendedoras** abrem suas próprias lojas customizáveis, vendem joias do catálogo Prata 15, e recebem comissão automática via split de pagamento Pagar.me. Catálogo sincronizado da Tray, frete em tempo real via Correios PPN, pagamento online via Pagar.me (cartão + PIX + 3x sem juros).

---

## 🏗️ Stack

- **Frontend + API**: Next.js 14 (App Router) + TypeScript
- **DB + Auth + Storage**: Supabase (Postgres + RLS + Auth + Storage)
- **Pagamento dos pedidos**: Pagar.me v5 (PaymentLinks + split 3-way). Fallback: PagBank.
- **Pagamento do cadastro/mensalidade da revendedora**: InfinitePay (ativação automática via webhook)
- **Frete**: Correios PPN (PAC + SEDEX)
- **Catálogo**: Tray web_api (público, sem auth) — sync diário
- **Emails**: Resend (transacionais) + Supabase Auth (reset de senha, via SMTP custom)
- **Hosting**: Vercel (4 cron jobs)

---

## ⚡ Quick start (dev local)

```bash
# 1. Clone e instala
git clone <repo>
cd prata15
npm install

# 2. Variáveis de ambiente
cp .env.example .env.local
# edita .env.local com credenciais Supabase + Pagar.me (sk_test) + Resend

# 3. Roda local
npm run dev
# → http://localhost:3000
```

📖 **Setup completo (Vercel + Supabase + integrações)**: [docs/SETUP.md](./docs/SETUP.md)

### 🧬 Pra DUPLICAR o projeto do zero
Na ordem:
1. **Contas externas**: Supabase, Vercel, Pagar.me, InfinitePay, Resend, Correios PPN, Tray. (Tray usa o web_api público — sem conta.)
2. **Supabase**: criar projeto (região São Paulo) → aplicar as migrations (`supabase-schema.sql` + `supabase/*.sql`, ordem em [SETUP](./docs/SETUP.md#3-aplicar-migrations)) → configurar SMTP custom (Auth → para o reset de senha sair) → criar buckets de Storage.
3. **Env vars**: copiar **todas** de [docs/ENV_VARS.md](./docs/ENV_VARS.md) pro Vercel.
4. **Webhooks**: apontar Pagar.me / InfinitePay / PagBank pros endpoints `/api/webhook/*` e setar os tokens.
5. **Deploy**: push na `main` → Vercel deploya. Os 4 crons sobem do `vercel.json`.
6. **Checklist final**: ver o fim do [SETUP](./docs/SETUP.md#-checklist-de-produção).

---

## 📚 Documentação

| Doc | Pra quê |
|---|---|
| **[ARCHITECTURE](./docs/ARCHITECTURE.md)** | Como o sistema se encaixa, fluxos de dados |
| **[SETUP](./docs/SETUP.md)** | Configuração inicial (1ª vez) |
| **[ENV_VARS](./docs/ENV_VARS.md)** | Todas as env vars de produção e dev |
| **[DATABASE](./docs/DATABASE.md)** | Schema, migrations, como aplicar SQL |
| **[RUNBOOK](./docs/RUNBOOK.md)** | Operações comuns (sync Tray, refund, etc.) |
| **[Pagar.me](./docs/integrations/PAGARME.md)** | PaymentLinks, split, webhook |
| **[Correios](./docs/integrations/CORREIOS.md)** | PPN, debug, fallback |
| **[Tray](./docs/integrations/TRAY.md)** | Sync de catálogo, subcategorias |
| **[Resend](./docs/integrations/RESEND.md)** | Emails transacionais, templates |
| **[TESTES_E2E](./docs/TESTES_E2E.md)** | Testes automatizados: cobertura, como rodar, o que falta |

E pra agentes de IA (Claude, Cursor, etc.) trabalhando neste codebase: **[CLAUDE.md](./CLAUDE.md)**.

---

## 🗂️ Estrutura do repositório

```
src/
  app/                          # Next.js App Router
    landing/                    # landing pra captação de revendedoras
    loja/[slug]/                # storefront público (uma loja por revendedora)
      page.tsx                  # vitrine com drawer, banner, categorias
      produto/[id]/             # PDP com calc frete + variações
    carrinho/                   # carrinho (selection estilo Shopee)
    checkout/                   # checkout com PAC/SEDEX
    pedido/[id]/                # confirmação + link pagamento
    perfil/                     # painel revendedora
      recebedor/                # cadastro de recipient Pagar.me
    dashboard/                  # home do painel revendedora
    vendas/                     # vendas com detalhe + comissão
    saldo/                      # saldo + saques
    configurar-loja/            # personalização da loja
    minha-loja/                 # redirect pra configurar-loja
    admin/                      # painel admin (PIN protegido)
      pedidos/                  # gerenciar pedidos (status, envio)
      destaques/                # curar destaques + sync Tray
      revendedoras/             # gerenciar revendedoras
      ativar/                   # ativar revendedoras (mensalidade)
      relatorio-tray/           # relatório de fulfillment via Tray
    api/                        # API routes
      loja/[slug]/              # dados da loja
      produtos/                 # listagem + busca + árvore categorias
      produtos/[id]/            # detalhe produto
      pedidos/                  # criar pedido + split
      frete/                    # cotação PAC/SEDEX/fallback
      webhook/pagarme/          # webhook events
      revendedora/              # auth-protected endpoints
        financeiro/             # totais + comissões
        pedidos/                # pedidos da loja
        recebedor/              # CRUD do recipient Pagar.me
        loja/                   # PATCH personalização
      admin/                    # endpoints admin
        correios-diag/          # diagnóstico envs Correios
        correios-diag-v2/       # diagnóstico passo-a-passo
        recebedor-test/         # debug payload Pagar.me
        pedidos/                # CRUD admin de pedidos
      cron/tray-sync/           # cron sync Tray (Vercel)
      cep/[cep]/                # ViaCEP proxy
  components/
    CalculadoraFrete.tsx        # input CEP → PAC/SEDEX
    CarrinhoFloatingButton.tsx  # FAB do carrinho (com hide-list)
    CropperModal.tsx            # editor de foto (react-easy-crop)
    dashboard/BottomNav.tsx     # tab bar mobile
  contexts/
    CarrinhoContext.tsx         # estado do carrinho (localStorage)
  lib/
    pagarme.ts                  # PaymentLinks + split
    pagarmeRecipient.ts         # POST /v5/recipients
    correios.ts                 # PPN auth + cotação
    traySync.ts                 # sync produtos + categorias
    frete.ts                    # frete (Correios + fallback)
    temasLoja.ts                # paletas, fontes, banners
    bancosBR.ts                 # lista de bancos brasileiros
    recebedorValidacao.ts       # CPF/CNPJ/CEP/banco/etc
    emailTemplates.ts           # HTML de emails
    pedidoEmails.ts             # disparo de emails ao mudar status
    ultimaLoja.ts               # rastreio da última loja visitada
    revendedoraAuth.ts          # auth helper das APIs auth-protegidas
    revendedoraClient.ts        # client-side helper
    comissoesCalc.ts            # cálculos de comissão
    adminAuth.ts                # PIN admin
    pedidoStatus.ts             # transições válidas de status
    supabase.ts                 # cliente client-side
    supabaseAdmin.ts            # cliente service_role
supabase/                       # SQL migrations (rodar manualmente via Management API)
public/                         # estáticos
```

---

## 🚦 Status do projeto

| Componente | Status |
|---|---|
| Site live em produção | ✅ |
| Pagar.me PaymentLinks (cartão + PIX + 3x) + split | ✅ |
| InfinitePay — cobrança do cadastro/mensalidade | ✅ |
| Ativação automática da loja ao pagar (webhook) | ✅ infra pronta* |
| Correios PPN (PAC + SEDEX) | ✅ |
| Resend (transacionais) + BCC de monitoramento | ✅ |
| Reset de senha (fluxo implícito, qualquer navegador) | ✅ (precisa SMTP custom no Supabase) |
| Tray sync diário + destaques = best-sellers | ✅ |
| Admin multi-usuário + acesso "somente leitura" | ✅ |
| Dashboard: visitas, mensagem do dia, comunidade, guia | ✅ |
| Mapa de cadastros por estado (admin) | ✅ |
| Privacidade / consentimento LGPD / cookies | ✅ |
| Correções de segurança (auditoria jun/2026) | ✅ |
| Webhook refund handler + botão refund em /admin | ⏳ Pendente |
| Verificação de assinatura nos webhooks (obrigatória) | ⏳ Pendente |

\* O link dinâmico (ativação 100% automática) está temporariamente atrás do flag `INFINITEPAY_LINK_DINAMICO` (bug no checkout da InfinitePay sendo investigado); usa-se o link estático enquanto isso.

---

## 🧪 Testes automatizados

O projeto usa **Playwright** para testes E2E contra produção (somente leitura).

```bash
# 1. Crie o .env.test na raiz (nunca vai pro git)
# Modelo completo em docs/TESTES_E2E.md

# 2. Rode os testes
npm run test:e2e

# 3. Veja o relatório
npm run test:e2e:report
```

> **Importante:** o `.env.test` não está no repositório — você precisa criá-lo localmente com suas credenciais antes de rodar os testes. Ver [docs/TESTES_E2E.md](./docs/TESTES_E2E.md) para o modelo completo e instruções.

**Resultado atual:** ✅ 77 passando · ⏭ 6 pulados (loja de teste sem produtos) · ❌ 0 falhando

---

## 🤝 Contribuindo

Este é um projeto privado. Mudanças passam por revisão. Pra estilo de código, convenções e pitfalls, ver **[CLAUDE.md](./CLAUDE.md)**.

## 📝 Licença

Privado.
