# 🔗 Links das 4 marcas (admin, testes, painéis)

Referência rápida pra abrir e checar cada marca. Todas rodam o **mesmo código**
(white-label), com Supabase/Vercel/domínio próprios. Verificado live em 2026-06-28
— home, /admin, /auth/login, /auth/register e /landing respondem **200** nas 4.

| Marca | Cor painel | Domínio |
|---|---|---|
| **Prata 15** (matriz, revendedores REAIS) | 🩷 rosa `#E8396A` | lojadeprata925.com.br |
| **Dona de Prata** | 🟣 violeta `#9B1FB5` | donaprataeacessorios.com.br |
| **Outlet das Pratas** | 🔵 azul cobalto `#0926EC` | outletdaprata925.com.br |
| **SP Folheados** (ouro, não prata) | 🟡 dourado `#c8a14b` | spfolheado.com.br |

---

## 🩷 Prata 15 — lojadeprata925.com.br
- **Loja (home)**: https://www.lojadeprata925.com.br
- **Admin (painel)**: https://www.lojadeprata925.com.br/admin
- **Login revendedora**: https://www.lojadeprata925.com.br/auth/login
- **Cadastro revendedora**: https://www.lojadeprata925.com.br/auth/register
- **Landing (captação)**: https://www.lojadeprata925.com.br/landing
- **Dashboard revendedora**: https://www.lojadeprata925.com.br/dashboard

## 🟣 Dona de Prata — donaprataeacessorios.com.br
- **Loja (home)**: https://donaprataeacessorios.com.br
- **Admin (painel)**: https://donaprataeacessorios.com.br/admin
- **Login revendedora**: https://donaprataeacessorios.com.br/auth/login
- **Cadastro revendedora**: https://donaprataeacessorios.com.br/auth/register
- **Landing (captação)**: https://donaprataeacessorios.com.br/landing

## 🔵 Outlet das Pratas — outletdaprata925.com.br
- **Loja (home)**: https://outletdaprata925.com.br
- **Admin (painel)**: https://outletdaprata925.com.br/admin
- **Login revendedora**: https://outletdaprata925.com.br/auth/login
- **Cadastro revendedora**: https://outletdaprata925.com.br/auth/register
- **Landing (captação)**: https://outletdaprata925.com.br/landing

## 🟡 SP Folheados — spfolheado.vercel.app  (domínio .com.br ainda NÃO conectado)
> O domínio `spfolheado.com.br` ainda serve a loja Tray antiga. A app nova roda na URL
> da Vercel abaixo até o domínio ser apontado pra Vercel.
- **Loja (home)**: https://spfolheado.vercel.app
- **Admin (painel)**: https://spfolheado.vercel.app/admin
- **Login revendedora**: https://spfolheado.vercel.app/auth/login
- **Cadastro revendedora**: https://spfolheado.vercel.app/auth/register
- **Landing (captação)**: https://spfolheado.vercel.app/landing

---

## 🔐 Como entrar no Admin
- Abrir `/admin` → aparece o login. Auth **multi-usuário por PIN** (cookie de sessão, 8h).
- PINs ficam nas envs `ADMIN_PIN` (master) / `ADMIN_PIN_GABBY` / `ADMIN_PIN_VIEWER` (cada marca tem os seus na Vercel).
- Papel **`viewer`** (`ADMIN_PIN_VIEWER`) = só leitura (não grava nada).
- O Bearer antigo `prata925` está **obsoleto** (dá 401).

### 🔑 PINs de admin (master) por marca — ⚠️ CONFIDENCIAL
| Marca | PIN admin | Status |
|---|---|---|
| 🟣 **Dona de Prata** | `109772` | ✅ confirmado |
| 🔵 **Outlet das Pratas** | `PRATAZDTU6` | ✅ confirmado |
| 🟡 **SP Folheados** | `SPFolheado4f9Kq` | ✅ aplicado e testado (login OK em spfolheado.vercel.app) |
| 🩷 **Prata 15** | _(o que a Gaby já usa)_ | 🔒 criptografado na Vercel — preencher à mão |

> Não dá pra ler PIN já gravado na Vercel (criptografado). Dona/Outlet recuperados de
> arquivos locais; SP foi gerado e aplicado aqui via API da Vercel (login confirmado);
> Prata 15 é produção real — não mexer, a dona preenche o que ela já usa.

> ⚠️ **SP Folheados ainda roda em `spfolheado.vercel.app`** — o domínio `spfolheado.com.br`
> continua apontando pra loja **Tray antiga** (não foi conectado à Vercel ainda). Quando
> quiser virar a chave, é só adicionar o domínio no projeto `spfolheado` na Vercel e
> apontar o DNS. Até lá, use a URL `.vercel.app` pra admin/login.

## 🩺 Endpoints de diagnóstico (admin) — abrir nos abas internas do /admin
Funcionam em **qualquer** marca trocando o domínio. Pedem `Authorization: Bearer <ADMIN_PIN>`
(ou já logado por cookie). Devolvem JSON pra debug — não são telas de UI.

| O quê | Caminho |
|---|---|
| Financeiro (venda bruta/líquida) | `/admin/financeiro` |
| Mensalidades + vencimentos + "Pendentes p/ completar" | `/admin/mensalidades` |
| Pedidos | `/admin/pedidos` |
| Comissões pagas no Pagar.me (conferência) | `/api/admin/comissoes-pagarme-check` |
| Recebedor de uma revendedora | `/api/admin/recebedor-test?slug=<subdominio>` |
| Saldo Pagar.me | `/api/admin/saldo-pagarme` |
| Envs Pagar.me (mascarado) | `/api/admin/pagarme-envs` |
| Correios (cotação) | `/api/admin/correios-diag-v2?cep=01310100` |

**Exemplo** (Outlet, conferir comissões pagas):
`https://outletdaprata925.com.br/api/admin/comissoes-pagarme-check`

---

## ✅ Identidade de cada marca (sem misturar)
- **Cores do painel/dashboard** = cor da marca (rosa / violeta / cobalto / dourado).
- **Tipografia do painel** = Montserrat sans (limpo, profissional) nas 4. As fontes
  decorativas de marca ficam só na **vitrine/landing** (face pública).
- **Lojas das revendedoras** mantêm tema próprio (cada uma escolhe cor/fonte) — NÃO
  herdam a cor da marca.
- **Pagar.me e InfinitePay**: compartilhados (mesmo sistema de pagamento/mensalidade).
- **Resend (e-mail)**: diferente por marca (remetente próprio).
- **SP Folheados**: produto é **folheado a ouro 18k**, não prata 925.
