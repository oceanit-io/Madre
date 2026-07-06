# White-label — abrir uma marca nova

Este projeto é um **motor multitenant de revendedoras** que roda para várias
marcas de prata. O código é UM só; cada marca é uma **instância** (Vercel +
Supabase + domínio próprios) configurada por variáveis de ambiente.

A marca "Loja de Prata 925" (com Tray) é só o **default**. Abrir outra marca
NÃO exige mexer no código — só configuração.

> Tudo que é identidade de marca mora em [`src/lib/brand.ts`](../src/lib/brand.ts).
> "prata 925" como **material** (o metal) NÃO é marca — continua igual pra
> qualquer empresa de prata.

---

## Variáveis de marca (`NEXT_PUBLIC_BRAND_*`)

Setar no projeto Vercel da marca nova. Sem elas, cai no default (Prata 925).

| Env | Pra que serve | Exemplo |
|-----|---------------|---------|
| `NEXT_PUBLIC_BRAND_NOME` | Nome comercial (títulos, e-mails, rodapés) | `Lunara Joias` |
| `NEXT_PUBLIC_BRAND_LOGO_PREFIXO` | 1ª parte do logo textual | `Lunara` |
| `NEXT_PUBLIC_BRAND_LOGO_DESTAQUE` | 2ª parte (colorida). Vazio = sem split | `Joias` |
| `NEXT_PUBLIC_BRAND_FORNECEDOR` | Supplier que provê o catálogo (split + selo) | `Lunara Atacado` |
| `NEXT_PUBLIC_BRAND_FORNECEDOR_LOGO` | Caminho do logo do fornecedor | `/branding/logo-lunara.png` |
| `NEXT_PUBLIC_BRAND_OPERADORA` | Operadora legal (rodapé, privacidade) | `Ocean IT` |
| `NEXT_PUBLIC_BRAND_DOMINIO` | Domínio sem protocolo | `lunarajoias.com.br` |
| `NEXT_PUBLIC_APP_URL` | URL completa com https | `https://lunarajoias.com.br` |
| `NEXT_PUBLIC_BRAND_COR` | Cor de destaque (logo/acentos) | `#7C5CFF` |
| `NEXT_PUBLIC_BRAND_CATALOGO` | `tray` (sync auto) ou `manual` (CRUD admin) | `manual` |

> O split (quem recebe quanto) e os recipients do Pagar.me são **outras** envs
> server-side (`PAGARME_*`) — ver [ENV_VARS.md](./ENV_VARS.md). Já eram por env,
> então cada marca tem os seus.

---

## Passo a passo pra abrir uma marca nova

### 1. Banco (Supabase)
- Criar um **projeto Supabase novo** (região São Paulo).
- Rodar todas as migrations de [`supabase/*.sql`](../supabase/) (via Management API
  ou SQL editor), na ordem.
- Anotar `NEXT_PUBLIC_SUPABASE_URL`, anon key e `SUPABASE_SERVICE_ROLE_KEY`.

### 2. Catálogo (sem Tray)
A marca nova provavelmente **não tem Tray**. Os produtos vivem na tabela
`produtos` e a vitrine não liga de onde vieram. Opções:
- **Manual:** cadastrar no admin (`/admin/produtos`) — já existe CRUD.
- **CSV/planilha:** importar em lote (pequeno desenvolvimento, se precisar).
- **Outra API:** trocar `lib/traySync.ts` pelo endpoint do novo fornecedor.

Setar `NEXT_PUBLIC_BRAND_CATALOGO=manual` e **não** configurar as envs/cron da Tray.

### 3. Pagamento (Pagar.me)
- Criar/usar a conta Pagar.me da marca.
- Recipients: conta mãe + fornecedor (supplier). Revendedoras criam o
  recipient delas pelo fluxo de KYC normal.
- Setar `PAGARME_*` (secret key, recipient IDs, percentuais) no Vercel.

### 4. E-mails (Resend)
- Verificar o **domínio da marca** no Resend.
- Setar `RESEND_API_KEY` e `EMAIL_FROM="<Nome> <pedidos@dominio-da-marca>"`.
  O nome de exibição é forçado pra `brand.nome` automaticamente.

### 5. Hospedagem (Vercel)
- Criar um **projeto Vercel novo** apontando pra este MESMO repositório.
- Setar TODAS as envs: `NEXT_PUBLIC_BRAND_*` + Supabase + Pagar.me + Resend + Correios.
- Production branch = `main`.

### 6. Domínio
- Apontar o domínio da marca pro projeto Vercel.

### 7. Assets da marca
Trocar os arquivos em [`public/branding/`](../public/branding/):
- `favicon-925.svg` → favicon da marca
- `logo-<fornecedor>.png` → logo do fornecedor (e apontar `NEXT_PUBLIC_BRAND_FORNECEDOR_LOGO`)

### 8. Conferir
- Abrir o domínio → título, logo e rodapé já são da marca nova.
- Fazer um pedido de teste pequeno (R$5–30) em aba anônima.
- Conferir e-mail de boas-vindas e split no Pagar.me.

---

## Demo pra mostrar a clientes

Pra um demo vivo (vender a plataforma pra outras empresas de prata):
1. Projeto Vercel novo (mesmo repo) com `NEXT_PUBLIC_BRAND_*` de uma marca-exemplo.
2. Supabase de demo com ~15 produtos de amostra cadastrados à mão.
3. URL grátis `*.vercel.app` → manda pro cliente clicar e ver o modelo com outra marca.

---

## Checklist rápido (copiar por marca)

```
[ ] Supabase novo + migrations rodadas
[ ] Catálogo carregado (manual/CSV/API)  — NEXT_PUBLIC_BRAND_CATALOGO=manual
[ ] Pagar.me: secret + recipients (mãe + fornecedor) + percentuais
[ ] Resend: domínio verificado + EMAIL_FROM
[ ] Vercel: projeto novo, mesmo repo, todas as envs, branch main
[ ] Domínio apontado
[ ] Assets em public/branding/ trocados
[ ] NEXT_PUBLIC_BRAND_* preenchidas
[ ] Pedido de teste OK + e-mail + split conferidos
```
