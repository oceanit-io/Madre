# Setup

Como configurar este projeto do zero — dev local e produção.

## 🖥️ Dev local

### Pré-requisitos
- Node.js 20+
- npm
- Git
- Acesso a:
  - Conta Supabase com projeto criado
  - Conta Pagar.me com sk_test_
  - Conta Resend (opcional pra dev)

### Passos

```bash
# Clone
git clone <repo>
cd prata15

# Dependencies
npm install

# Variables (copie de exemplo, edite com tuas credenciais)
cp .env.example .env.local  # se houver, senão crie manualmente
```

Conteúdo mínimo do `.env.local`:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=ey...
SUPABASE_SERVICE_ROLE_KEY=ey...
SUPABASE_ACCESS_TOKEN=sbp_...  # token Management API (pra aplicar SQL)

# Pagar.me (sandbox) — pagamento dos pedidos
PAGARME_SECRET_KEY=sk_test_...
PAGARME_MAX_PARCELAS=3

# InfinitePay — pagamento do cadastro/mensalidade da revendedora
INFINITEPAY_HANDLE=oceanit

# Resend (opcional em dev — sem isso emails são silenciosos)
RESEND_API_KEY=re_...
EMAIL_FROM="Loja de Prata 925 <pedidos@lojadeprata925.com.br>"  # endereço do domínio verificado

# Admin PIN (multi-usuário; use PIN longo aleatório, não "prata925")
ADMIN_PIN=<pin-master-longo>
# ADMIN_PIN_VIEWER=<pin>   # opcional: acesso somente leitura

# App URL (importante pros redirects de pagamento)
APP_URL=http://localhost:3000

# Tray base (mantém o oficial)
TRAY_BASE_URL=https://www.pratade15reais.com.br/web_api
```

Ver [ENV_VARS.md](./ENV_VARS.md) pra lista completa com explicação.

### Rodar

```bash
npm run dev
# → http://localhost:3000
```

Páginas pra testar rápido:
- `/` — redirect pra `/landing`.
- `/landing` — captação de revendedora.
- `/loja/{algum-slug-existente}` — vitrine pública.
- `/admin/destaques` — admin (PIN: `prata925`).

### Type check / build

```bash
npx tsc --noEmit
npx next build
```

---

## ☁️ Setup de produção (Vercel)

### Pré-requisitos
- Conta Vercel.
- Repo GitHub.
- Domínio próprio (ex `lojadeprata925.com.br`) com acesso aos DNS records.

### 1. Conectar repo ao Vercel
1. Vercel → New Project → Import do GitHub.
2. Framework preset: Next.js (auto-detectado).
3. Build command e output: defaults.

### 2. Configurar Environment Variables
Vercel → Settings → Environment Variables → Add.

Ver [ENV_VARS.md](./ENV_VARS.md) pra lista completa. Marca todos os 3 ambientes (Production + Preview + Development).

### 3. Configurar domínio custom
Vercel → Settings → Domains → Add `lojadeprata925.com.br`.

Vercel vai pedir 1 record DNS no registrador (ex Registro.br):
- **Apex (raiz)**: `A` → `76.76.21.21`
- **www**: `CNAME` → `cname.vercel-dns.com`

⚠️ **Cuidado**: as IPs do Vercel mudam às vezes. O dashboard do Vercel sempre mostra a IP correta atual. Se DNS quebrar, conferir lá.

### 4. Crons (Vercel)
O `vercel.json` já tem **4 crons** (todos 1x/dia, horário UTC):

```json
{
  "crons": [
    { "path": "/api/cron/tray-sync",        "schedule": "0 9 * * *" },
    { "path": "/api/cron/mensalidades",      "schedule": "0 12 * * *" },
    { "path": "/api/cron/lembretes-cadastro","schedule": "0 14 * * *" },
    { "path": "/api/cron/mensagem-diaria",   "schedule": "0 10 * * *" }
  ]
}
```

- `tray-sync` — atualiza catálogo + best-sellers/destaques. **Roda por padrão**; setar `TRAY_SYNC_ENABLED=0` desliga.
- `mensalidades` — avisa/suspende vencidas + libera comissões maduras (20d).
- `lembretes-cadastro` — lembra quem cadastrou e não pagou.
- `mensagem-diaria` — e-mail motivacional 7h BRT (10:00 UTC) pras ativas.

Setar `CRON_SECRET` no Vercel (os crons também aceitam o header `x-vercel-cron`).

### 5. Primeiro deploy
Push pra `main` → Vercel deploya auto.

Verificar deploy bem-sucedido:
```bash
curl -I https://lojadeprata925.com.br
# HTTP/2 200 ou 307 (redirect pra /landing)
```

---

## 🗄️ Supabase

### 1. Criar projeto
1. https://supabase.com → New Project.
2. Região: **South America (São Paulo)** — pra latência baixa pros usuários BR.
3. Senha forte do DB.

### 2. Pegar credenciais
- **URL**: Settings → API → Project URL.
- **Anon key**: Settings → API → Project API keys → anon public.
- **Service role**: idem, mas service_role (KEEP SECRET).
- **Management API token**: https://supabase.com/dashboard/account/tokens → New token.

Coloca tudo em `.env.local` e em Vercel.

### 3. Aplicar migrations
**Primeiro** o schema base (na RAIZ do repo), depois os arquivos em `supabase/*.sql`.
A maioria é aditiva (`ALTER TABLE … ADD COLUMN IF NOT EXISTS`) e idempotente; a ordem importa só pras tabelas/triggers base existirem antes.

**0. Base (raiz):** `supabase-schema.sql` — tabelas `revendedoras`, `produtos`, etc.

**Negócio / financeiro:**
1. `comissoes.sql`
2. `comissoes_saldo.sql`
3. `comissoes_20d.sql`
4. `mensalidades.sql`
5. `mensalidade_auto_ativacao.sql`  ← ativação automática (trigger + RPC)
6. `pedidos.sql`
7. `pedidos_status_flexivel.sql`
8. `codigo_rastreio.sql`
9. `recebedor_pagarme.sql`
10. `pix_split.sql`

**Loja / personalização:**
11. `loja_personalizacao.sql`
12. `loja_fonte.sql`
13. `loja_fundo.sql`
14. `blocos_loja.sql`
15. `banner_preset.sql`
16. `video_loja.sql`
17. `cinta_cor.sql`
18. `hero_opcoes.sql`
19. `hero_texto_cor.sql`
20. `hero_texto_editavel.sql`
21. `whatsapp_mensagem.sql`

**Tray / catálogo:**
22. `tray_sync.sql`
23. `destaque_tray.sql`
24. `referencia_tray.sql`
25. `variacoes_tray.sql`
26. `subcategoria_tray.sql`
27. `relatorio_tray.sql`

**Admin / compliance / segurança:**
28. `admin_alertas.sql`
29. `admin_audit_log.sql`
30. `aceite_lgpd.sql`
31. `security_hardening.sql`
32. `security_fixes.sql`  ← já aplicado em prod (revoga RPC pública, RLS admin)

**Como aplicar**: rode contra Supabase Management API:

```bash
TOKEN="seu_SUPABASE_ACCESS_TOKEN"
REF="seu_project_ref"  # ex: ipovxwzzqjjywratrbjx

for f in supabase-schema.sql supabase/*.sql; do
  echo "Aplicando $f"
  SQL=$(cat "$f")
  curl -s -X POST "https://api.supabase.com/v1/projects/$REF/database/query" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    --data-raw "$(jq -n --arg q "$SQL" '{query:$q}')"
done
```

Ou cole no SQL Editor do dashboard Supabase um por um.

⚠️ Algumas migrations são aditivas (ALTER TABLE ADD COLUMN IF NOT EXISTS) e podem rodar de novo sem efeito. Outras (criação de tabela, trigger) precisam rodar 1ª vez certinho.

### 4. Storage buckets
Pra logos e banners das revendedoras:
- Bucket `loja-fotos` (public).
- Pasta `logos/` e `banners/`.

Criar via dashboard Storage. Policies padrão (public read, authenticated write).

---

## 💳 Pagar.me (pagamento dos PEDIDOS)

Ver [docs/integrations/PAGARME.md](./integrations/PAGARME.md) pra detalhes.

Resumo:
1. Conta Pagar.me com perfil **Marketplace habilitado**.
2. Pegar **sk_live_** em Configurações → Chaves → Criar chave.
3. Criar **webhook** apontando pra `https://lojadeprata925.com.br/api/webhook/pagarme` com eventos: `order.paid`, `charge.paid`, `charge.refunded`, `charge.payment_failed`, `charge.chargedback`, `charge.partial_canceled`, `order.canceled`, `order.payment_failed`, `recipient.created`, `recipient.updated`.
4. Setar `PAGARME_WEBHOOK_USER`/`PAGARME_WEBHOOK_PASS` (Basic Auth no webhook).
5. Pedir ao gestor Pagar.me pra habilitar **split settings**.
6. Setar `PAGARME_SECRET_KEY` (+ `PAGARME_MAIN_RECIPIENT_ID` e `PAGARME_PRATA15_RECIPIENT_ID` pro split) no Vercel.

## 💎 InfinitePay (pagamento do CADASTRO/mensalidade)

A taxa de ativação/mensalidade da revendedora é cobrada pela InfinitePay.

1. Conta InfinitePay (CloudWalk) com a **InfiniteTag** (handle).
2. Setar `INFINITEPAY_HANDLE` (ex: `oceanit`).
3. Configurar o **webhook global** da conta InfinitePay pra `https://lojadeprata925.com.br/api/webhook/infinitepay` e setar `INFINITEPAY_WEBHOOK_TOKEN`.
4. A app gera link **dinâmico** (`order_nsu=cad_<id>`) → o webhook ativa a loja sozinho. Flag em `src/lib/infinitepayConfig.ts`.

## 📮 Correios PPN

Ver [docs/integrations/CORREIOS.md](./integrations/CORREIOS.md) pra detalhes.

Resumo:
1. Ter contrato comercial com Correios + acesso API PPN.
2. Pegar do gestor Correios:
   - usuário API, senha
   - número do contrato, cartão de postagem, código DR
   - CEP origem, código PAC contratual, código SEDEX contratual
3. Setar 8 envs `CORREIOS_*` no Vercel.

## 📧 Resend

Ver [docs/integrations/RESEND.md](./integrations/RESEND.md) pra detalhes.

Resumo:
1. Conta Resend.
2. Add domain `lojadeprata925.com.br` → setar 3 records DNS no registrador.
3. Verify no painel Resend.
4. Pegar API key.
5. Setar env `RESEND_API_KEY` + `EMAIL_FROM` (endereço do **domínio verificado**) no Vercel.
6. ⚠️ **E-mails de auth (reset de senha)** são do **Supabase**, não do Resend. Configure SMTP custom no Supabase → Authentication → SMTP apontando pro Resend (host `smtp.resend.com`, user `resend`, pass = API key), senão o reset não chega.

## 🛒 Tray

Setup mínimo (sem auth):
- Env `TRAY_BASE_URL=https://www.pratade15reais.com.br/web_api` (já no default).
- Disparar sync via `/admin/destaques` → "Sincronizar Tray".

---

## ✅ Checklist de produção

- [ ] Vercel deploy OK.
- [ ] Domínio custom funcionando.
- [ ] Todas envs em Vercel (Production + Preview + Development).
- [ ] Migrations aplicadas no Supabase.
- [ ] Storage buckets criados.
- [ ] Sync Tray rodou pelo menos uma vez.
- [ ] Resend domain verified.
- [ ] Pagar.me webhook ativo, eventos disparando.
- [ ] Correios PPN respondendo (testar via `/api/admin/correios-diag-v2`).
- [ ] Cron Vercel agendado.
- [ ] Mensalidades configuradas (link pagamento atualizado).
- [ ] 1 compra teste completada end-to-end + reembolsada.
- [ ] Páginas legais (em construção).
- [ ] Footer com CNPJ (em construção).
