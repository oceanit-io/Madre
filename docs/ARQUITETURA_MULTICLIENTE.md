# Arquitetura Multi-Cliente — Análise e Recomendações

> Documento elaborado a partir de debate técnico sobre a estrutura atual do projeto e as opções para crescimento sustentável.
> Destinado à leitura da responsável pelo produto para embasar a decisão arquitetural.

---

## 1. Como o modelo de negócio funciona (confirmação de entendimento)

```
Prata 15 (fornecedor / catálogo central)
        │
        ▼
   Plataforma (produto vendido pela Gabriela)
        │
        ├── Cliente X  → repo, Vercel, Supabase, back office próprios
        │       └── Revendedor A, B, C... (afiliados ao Cliente X)
        │
        ├── Cliente Y  → idem
        │       └── Revendedor D, E...
        │
        └── Cliente Z  → idem
                └── Revendedor F, G...
```

Existem dois níveis distintos:

| Nível | Quem é | Isolamento atual |
|---|---|---|
| **Cliente (B2B)** | Quem compra a plataforma | Repo, deploy, DB, back office separados |
| **Revendedor (B2C)** | Quem abre loja dentro do Cliente X | Multi-tenant dentro da instância (`/loja/[slug]`, RLS, recipient Pagar.me) |

---

## 2. A decisão atual: um repositório por cliente

### O que é
Ao vender a plataforma para um novo cliente, o repositório atual é copiado e provisionado do zero: novo projeto Vercel, novo Supabase, novas credenciais.

### Por que faz sentido neste nível

- Cliente Y cair não derruba Cliente X
- Dados de pedidos e comissões ficam em bancos separados
- Credenciais Pagar.me, Correios, domínio — tudo isolado por cliente
- Um deploy com bug no Cliente Z não afeta os outros
- Contratualmente, cada cliente "tem o sistema dele" (argumento comercial)

Este modelo é chamado de **white-label com instância dedicada por cliente** — comum em agências e SaaS B2B. A decisão de isolamento em si é defensável.

### Onde está o problema

O problema não é o isolamento. É usar **cópia de repositório** como mecanismo de criar cada instância:

```
Cliente X repo  ←── cópia ──→  Cliente Y repo  ←── cópia ──→  Cliente Z repo
     │                              │                              │
  fix Pagar.me                  esqueceu de aplicar            versão antiga
  webhook idempotente           o fix                        com bug no frete
```

Com 2–3 clientes parece administrável. Com 8–10 vira pesadelo silencioso:
cada um numa versão diferente, bug corrigido só em um, feature nova só no favorito.

---

## 3. A situação real hoje (3 clientes)

| Cliente | Situação |
|---|---|
| Cliente 1 | Sistema padrão — este repositório |
| Cliente 2 | Tem e-commerce integrado — **diferença de código** |
| Cliente 3 | Tem e-commerce integrado — **diferença de código** |
| Futuros | Podem ter features a mais ou a menos |

Isso confirma que as diferenças entre clientes não são só de configuração (credenciais, tema, domínio). Existem diferenças de comportamento e código — o que exige uma estratégia mais elaborada do que simplesmente trocar variáveis de ambiente.

---

## 4. As três opções arquiteturais

### Opção A — Feature Flags (mais simples de adotar agora)

**Como funciona:** um único repositório, N deploys independentes. Cada deploy tem seu `.env` com flags que ativam ou desativam módulos.

```ts
// src/lib/features.ts
export const features = {
  ecommerceIntegrado: process.env.FEATURE_ECOMMERCE === 'true',
  integracaoWhatsapp: process.env.FEATURE_WHATSAPP === 'true',
  relatorioAvancado: process.env.FEATURE_RELATORIO === 'true',
}
```

```tsx
// uso no código
{features.ecommerceIntegrado && <ModuloEcommerce />}
```

**Prós:**
- Migração mais fácil a partir do estado atual
- Isolamento de deploy se mantém (cada cliente = projeto Vercel separado)
- Fix no código → todos os clientes recebem na próxima atualização

**Contras:**
- Com muitas features diferentes, o código acumula condicionais em todo lugar
- Funciona bem quando as diferenças são **aditivas** (cliente Y tem tudo que X tem + algo a mais). Se um cliente tem algo que outro *não deve ter*, fica mais difícil de controlar
- Não resolve bem features que mudam profundamente o fluxo principal

**Quando escolher:** se as diferenças entre clientes são módulos opcionais que se encaixam sem alterar o núcleo.

---

### Opção B — Monorepo (mais robusto para longo prazo)

**Como funciona:** um único repositório com separação clara entre o que é compartilhado e o que é exclusivo de cada cliente.

```
monorepo/
  packages/
    core/          ← lógica compartilhada (Pagar.me, Correios, Tray, auth, DB)
    ui/            ← componentes visuais base
  apps/
    prata925/      ← Cliente 1 (padrão): importa core + monta a app
    cliente-x/     ← Cliente 2: importa core + adiciona módulo e-commerce
    cliente-y/     ← Cliente 3: importa core + adiciona módulo e-commerce
```

Cada `app/` tem seu próprio `package.json` e é deployada como projeto separado no Vercel — o isolamento se mantém.

**Prós:**
- Fix no `core` → todos os `apps/` recebem automaticamente
- Feature exclusiva do Cliente X fica contida em `apps/cliente-x/` — não polui o core
- Escala bem com muitos clientes e muitas variações
- É a estrutura usada por empresas que vendem white-label SaaS a múltiplos clientes

**Contras:**
- Setup inicial mais trabalhoso (configurar Turborepo ou Nx, ajustar Vercel para monorepo)
- Exige disciplina da equipe para decidir o que vai no `core` vs no `app`
- Migração do estado atual exige reorganização de pastas e imports

**Quando escolher:** quando as diferenças entre clientes são suficientemente grandes para justificar apps separadas com código próprio.

---

### Opção C — Template repo organizado (evolução do que existe hoje)

**Como funciona:** manter um repositório oficial chamado `prata925-core` — o template "canônico". Ao criar um cliente novo, faz-se um fork controlado, nunca uma cópia manual.

A disciplina aqui é: **nunca editar o fork diretamente sem avaliar se a mudança pertence ao core**. Fixes e features do core são propagados via `git merge` ou `git cherry-pick` do upstream para cada fork.

**Prós:**
- Menor esforço de migração — é o que já existe, com mais organização
- Cada cliente ainda "tem o seu repo" (argumento comercial preservado)

**Contras:**
- Merge entre fork e upstream é trabalhoso e propenso a conflito
- Continua sendo N repos para manter, só com mais processo
- Não escala bem acima de 5–6 clientes

**Quando escolher:** se a prioridade é o menor esforço de migração agora, com a intenção de evoluir para Opção A ou B depois.

---

## 5. Comparativo direto

| Critério | Opção A (Feature Flags) | Opção B (Monorepo) | Opção C (Template repo) |
|---|---|---|---|
| Esforço de migração | Médio | Alto | Baixo |
| Isolamento por cliente | Mantido | Mantido | Mantido |
| Manutenção com 10+ clientes | Média | Boa | Ruim |
| Features exclusivas por cliente | Possível (com disciplina) | Limpo e natural | Difícil |
| Divergência de código entre clientes | Eliminada | Eliminada | Ainda existe |
| Complexidade de setup | Baixa | Alta | Baixa |

---

## 6. Recomendação técnica

**Curto prazo (agora até ~5 clientes):** adotar **Opção A (Feature Flags)** com provisionamento padronizado. É a migração de menor risco e já elimina a divergência de código entre clientes.

**Longo prazo (se o número de clientes crescer e as variações de código aumentarem):** evoluir para **Opção B (Monorepo)**. A Opção A pode ser uma etapa de transição — um codebase com feature flags já é muito mais fácil de migrar para monorepo do que N repositórios divergentes.

**O que evitar:** continuar com cópias manuais de repositório (modelo atual) sem um processo formal de propagação de fixes. O risco aumenta linearmente com cada novo cliente.

---

## 7. Analogia para facilitar a decisão

> "Cada cliente já tem casa separada (Vercel, Supabase, domínio). O que estamos duplicando desnecessariamente é a **planta da casa**, não a casa em si. Se a planta tem um vazamento (bug), hoje precisamos consertar em cada cópia. Se tivermos uma planta só e construirmos N casas a partir dela, o isolamento continua — só não repetimos o projeto arquitetônico."

---

## 8. Próximos passos sugeridos (qualquer opção escolhida)

1. **Definir o que é "core"** — listar quais partes do código nunca mudam entre clientes (Pagar.me, Correios, Tray, auth, RLS)
2. **Definir o que é "feature"** — listar as diferenças conhecidas hoje (e-commerce integrado, etc.) e classificar se são configuração ou código
3. **Padronizar provisionamento** — criar um checklist/script de "novo cliente" independente da opção escolhida
4. **Escolher a opção** com base no volume esperado de clientes e variações nos próximos 12 meses

---

*Documento gerado em 22/06/2026 com base em análise técnica do codebase atual.*
