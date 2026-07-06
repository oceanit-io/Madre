# Documentação — lojadeprata925.com.br

Índice de toda a documentação técnica do projeto.

## Visão geral

E-commerce multitenant onde cada **revendedora** tem sua própria loja personalizada. Pagamento via Pagar.me com split automático. Frete via Correios PPN.

**Stack:** Next.js 14 App Router · TypeScript · Supabase · Vercel

---

## Documentos disponíveis

| Documento | O que cobre |
|---|---|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Desenho do sistema, fluxo de dados, decisões de arquitetura |
| [DATABASE.md](./DATABASE.md) | Tabelas, relacionamentos, RLS e triggers do Supabase |
| [ENV_VARS.md](./ENV_VARS.md) | Todas as variáveis de ambiente e onde configurá-las |
| [SETUP.md](./SETUP.md) | Como rodar o projeto localmente do zero |
| [RUNBOOK.md](./RUNBOOK.md) | Operações comuns em produção (deploy, sync, debug) |
| [TESTES_E2E.md](./TESTES_E2E.md) | Suite de testes automatizados: cobertura, resultados, como rodar |

### Integrações externas

| Documento | O que cobre |
|---|---|
| [integrations/PAGARME.md](./integrations/PAGARME.md) | Pagar.me v5: pagamento, split, recebedores (KYC), webhooks |
| [integrations/CORREIOS.md](./integrations/CORREIOS.md) | Correios PPN: autenticação, cotação PAC/SEDEX, diagnóstico |
| [integrations/TRAY.md](./integrations/TRAY.md) | Tray: sync de produtos do catálogo central |
| [integrations/RESEND.md](./integrations/RESEND.md) | Resend: emails transacionais (pedido, cadastro, saque) |

---

## Situação atual dos testes (2026-06-22)

**77 testes passando · 6 pulados · 0 falhando**

Os 6 pulados aguardam produtos cadastrados na loja de teste. Ver [TESTES_E2E.md](./TESTES_E2E.md) para detalhes completos.
