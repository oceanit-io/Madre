# Integração Tray

Sync de catálogo da loja Prata 15 na Tray.

## 📌 Visão geral

- **Source**: `https://www.pratade15reais.com.br/web_api/products`
- **Auth**: nenhum (endpoint público).
- **Frequência**: diária (cron Vercel) + manual (admin).
- **Direção**: 1-way (Tray → nosso DB). Nunca escrevemos na Tray.

A Tray é a loja **Prata de 15 reais**, que é a fornecedora do nosso catálogo. Sincronizamos a vitrine deles pra ter no nosso DB (com nossa personalização, comissões, etc).

## 🔄 Fluxo de sync

```
GET /web_api/products?limit=50&page=N
  ↓
Pra cada produto:
  - Detecta disponibilidade (available + available_for_purchase)
  - Mapeia campos pra nossa schema
  - Aprende categoria pai e subcategoria do SLUG
  - Filtra fotos (descarta data: URLs e placeholders)
  - Upsert em `produtos` por `sku` (= id da Tray)
  ↓
Backfill de descrições (separado, pois /products lista não traz description completa):
  - Lista produtos sem `descricao`
  - Pra cada: GET /web_api/products/{id}
  - UPDATE produtos SET descricao = ...
  ↓
Atualiza sync_estado.tray com { total, upserted, erros, em }
```

## 🌲 Categoria + subcategoria via slug

A categoria_id da Tray **não é confiável** pra hierarquia (a mesma categoria_id aparece em paths diferentes).

Por isso, a hierarquia é derivada do **slug** Tray, que tem formato:
- `correntes/com-pingente/corrente-45cm-...` → 3 segmentos
- `pingentes/pingente-coracao-...` → 2 segmentos

Lógica em `lib/traySync.ts`:
- Categoria pai = 1º segmento (`correntes` → `Correntes`).
- Subcategoria = 2º segmento (`com-pingente` → `Com Pingente`) se slug tem 3+ partes.
- Senão, sem subcategoria.

Função `bonito(seg)` faz a capitalização (`com-pingente` → `Com Pingente`).

## 🎯 Endpoints

### Cron
`GET /api/cron/tray-sync` — Vercel cron diário 03:00.

Gates:
- Sem `Authorization: Bearer ${CRON_SECRET}` E sem header `x-vercel-cron: 1` → 401.
- Sem `TRAY_SYNC_ENABLED=1` → 200 ok ignored.
- Pode aceitar `?dry=1` pra preview sem escrever.

### Admin manual
`/admin/destaques` → botões "Tray: prévia" (dry=1) e "🔄 Sincronizar Tray" (real).

Internamente faz `GET /api/cron/tray-sync` com Bearer admin.

## 🗂️ Campos mapeados

| Tray | Nosso DB | Notas |
|---|---|---|
| `id` | `produtos.sku` (text) | PK do upsert |
| `name` | `produtos.nome` | |
| `price` | `produtos.preco` | Sempre preço cheio (ignora `promotional_price`) |
| `available` + `available_for_purchase` | `produtos.ativo` + `produtos.estoque` (999/0) | Combinados |
| `category_id` | (não usado direto) | Hierarquia vem do slug |
| `slug` | (parse) → `categoria` + `subcategoria` | |
| `ProductImage[].http(s)` | `produtos.fotos[]` | Filtra `data:` URLs |
| `hot` | `produtos.destaque_tray` | Vem do "destaque" da Tray |
| `has_variation` | `produtos.has_variation` | Indica se tem variações (tamanho/cor) |

### Campos buscados sob demanda (lazy)
- **Descrição** (`descricao`): backfill no próprio sync, mas em batches (100/run) pra não estourar timeout.
- **Variações** (`variacoes_cache`): buscadas em `/api/produtos/[id]/variacoes` quando o cliente abre a PDP. Cache em DB.
- **Referência** (`referencia`): scraping HTML em `/api/produtos/[id]/referencia` quando cliente abre a PDP.

## 🐛 Pegadinhas

### `destaque` (curado) é preservado
O sync atualiza `nome`, `preco`, `fotos`, `ativo`, `estoque`, `destaque_tray`, `has_variation`, `categoria`, `subcategoria`.

**Nunca toca em `destaque`** (curado manual via `/admin/destaques`).

### `referencia` é preservada
A Tray expõe `model` em `/products/{id}`, mas a referência real (formato `CESTA17-4`) só está no HTML da página do produto. Por isso buscamos lazy via scraping em `lib/trayReferencia.ts` e cacheamos em `produtos.referencia`.

O sync não sobrescreve esse campo.

### Slugs lixo
A Tray devolve slugs `Q`, `2`, `-` em alguns produtos. O algoritmo de "aprender categoria do slug" filtra slugs com < 2 caracteres ou só 1 segmento.

### Timeout Vercel Hobby (60s)
3000 produtos + backfill descrições estoura facilmente. Workaround:
- `BACKFILL_MAX = 100` por execução.
- Em 5-6 execuções (manual ou cron diário), catálogo inteiro fica preenchido.

Pra plano Pro o limite é maior — pode rodar tudo numa só.

## 🧪 Validar sync

### Status atual
```sql
select valor from sync_estado where chave = 'tray';
-- { total: 3045, upserted: 3045, categorias: 12, erros: 0, em: "2026-06-09T..." }
```

### Produtos por categoria
```sql
select categoria, count(*) from produtos where ativo = true group by categoria order by 2 desc;
```

### Produtos sem descrição (pendentes de backfill)
```sql
select count(*) from produtos where ativo = true and descricao is null;
```

## 📚 Links

- Tray web_api docs: https://devs.tray.com.br/documentation/
