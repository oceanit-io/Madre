# Integração Correios PPN

Cotação real PAC + SEDEX via Plataforma Pronta de Negócios (PPN) dos Correios.

## 📌 Visão geral

- **Endpoint base produção**: `https://api.correios.com.br`
- **Endpoint base homologação**: `https://apihom.correios.com.br`
- **Auth**: JWT via cartão de postagem.
- **Cache**: token tem TTL ~24h, cacheado em memória do processo.
- **Fallback**: se qualquer env faltar ou auth/cotação falhar, cai pra tabela fixa por região (`R$15` sudeste, `R$18` sul, `R$22` nordeste, `R$30` norte/centro-oeste).

## 🔐 Setup

1. Ter **contrato comercial** com Correios. PPN não disponível pra contas de balcão.
2. Pedir ao gestor:
   - Usuário API + senha
   - Número do contrato (10 dígitos)
   - Número do cartão de postagem (10 dígitos)
   - Código da DR (numérico — ex 72 pra Sergipe, 10 pra SP capital, 35 pra RJ)
   - CEP de origem das postagens
   - Códigos dos serviços contratados (PAC e SEDEX) — geralmente `0XXXX`

3. Setar 8 envs:

```bash
CORREIOS_USUARIO=...
CORREIOS_SENHA=...
CORREIOS_CONTRATO=9912265452
CORREIOS_CARTAO_POSTAGEM=0066885507
CORREIOS_DR=72
CORREIOS_CEP_ORIGEM=49000000
CORREIOS_PAC_CODIGO=03298
CORREIOS_SEDEX_CODIGO=03220
```

4. Redeploy Vercel.

5. Validar:
```bash
curl -H "Authorization: Bearer prata925" \
  "https://lojadeprata925.com.br/api/admin/correios-diag-v2?cep=01310100" | jq
```

## 🔄 Fluxo de cotação

```
POST /api/frete
  body: { uf, cep, subtotal, qntItens }
    ↓
calcularFretes() em lib/frete.ts
    ↓
1. Se subtotal ≥ R$250 → frete grátis (PAC + SEDEX em R$0 com prazos típicos)
2. Senão → calcularFretesCorreios() em lib/correios.ts
   ↓
   2a. obterToken() — JWT cacheado em memória, TTL 23h
       POST /token/v1/autentica/cartaopostagem
   2b. Em paralelo:
       GET /preco/v1/nacional/{codigoPAC}?... (query string)
       GET /prazo/v1/nacional/{codigoPAC}?...
       GET /preco/v1/nacional/{codigoSEDEX}?...
       GET /prazo/v1/nacional/{codigoSEDEX}?...
   2c. Mapeia respostas pra { servico, valor, prazo }
       ↓
3. Se Correios retornou alguma opção → usa
   Senão → fallback tabela fixa
   ↓
   Resposta: { regiao, opcoes: [{servico, valor, prazo_dias_min, prazo_dias_max, gratis, origem}] }
```

`origem` é `correios` ou `tabela` — útil pra debug.

### Parâmetros da cotação
- **Peso**: fixo 500g (pacote contratual da Gabriela é até 1kg, então 500g é margem segura).
- **Dimensões**: caixinha 16×11×4 cm (caixa pequena padrão joia).

Constants em `src/lib/correios.ts`:
```ts
export const PESO_FIXO_GRAMAS = 500
export const CAIXA_PADRAO = { comprimentoCm: 16, larguraCm: 11, alturaCm: 4 }
```

## 🐛 Pegadinhas / debug

### Endpoints individuais usam GET com query string
**Não POST**. A doc Correios confunde com o endpoint bulk (`/preco/v1/nacional` sem `{coProduto}`) que aceita POST.

Exemplo correto:
```bash
GET /preco/v1/nacional/03298?nuRequisicao=1&nuContrato=...&nuDR=72&cepOrigem=49000000&cepDestino=01310100&psObjeto=500&comprimento=16&largura=11&altura=4&tpObjeto=2
```

### DR é numérico, não sigla
- ❌ Errado: `CORREIOS_DR=SE`
- ✅ Certo: `CORREIOS_DR=72`

Tabela aproximada (consultar doc Correios pra atualizada):
- SP capital: 10
- SP interior: 72
- RJ: 35
- MG: 28
- BA: 07
- PE: 53
- RS: 85
- PR: 42
- SC: 80
- SE: 72

Pra confirmar a tua, faça auth e veja o `dr` no body do response:
```bash
curl -H "Authorization: Bearer prata925" \
  "https://lojadeprata925.com.br/api/admin/correios-diag-v2?cep=01310100" | jq '.auth.producao.body_preview'
```

### Cartão de postagem com zeros à esquerda
Geralmente tem 10 dígitos: `0066885507`, não `66885507`. Se faltar zero, auth retorna `TOK-003: Cartão de postagem não localizado`.

### Códigos PAC/SEDEX são DO contrato
- Contratuais: `03298` (PAC), `03220` (SEDEX).
- Balcão: `04510`, `04014`. **Não funcionam pra API PPN**.

Confirme com gestor qual o teu.

### Token cache
Memória do processo. Cold start de serverless re-autentica (1 request extra). OK pra volume normal.

### Categoria da conta "Pl0"
A conta da Gabriela tem categoria `Pl0` (consta no response do auth). Não impacta o fluxo nosso. Só vai aparecer em alguns retornos como `categoria: "Pl0"`.

## 🧪 Endpoints de diagnóstico

### `/api/admin/correios-diag` — status das envs
```bash
curl -H "Authorization: Bearer prata925" \
  https://lojadeprata925.com.br/api/admin/correios-diag | jq
```

Retorna:
- `envs_presentes` — quais envs estão setadas (sem expor valores).
- `cep_origem_digitos` — comprimento detectado (pega typo de CEP).
- `params_default` — peso e caixa hard-coded.

### `/api/admin/correios-diag-v2?cep=01310100` — passo-a-passo
```bash
curl -H "Authorization: Bearer prata925" \
  "https://lojadeprata925.com.br/api/admin/correios-diag-v2?cep=01310100" | jq
```

Tenta auth em **prod E homologação** em paralelo (pra detectar se as credenciais são de hom). Depois testa cotação PAC + SEDEX com a base que funcionou. Retorna response cru de cada passo.

## 🔍 Erros comuns

| Sintoma | Causa típica | Fix |
|---|---|---|
| `Status: 000 timeout` | Site fora do ar | Ver dashboard Vercel |
| `Auth 401 sem corpo` | Usuário/senha errado, ou cartão não vinculado | Validar com gestor |
| `Auth 403` | Conta sem permissão PPN | Pedir gestor habilitar |
| `TOK-003: Cartão não localizado` | `CORREIOS_CARTAO_POSTAGEM` errado (faltam zeros à esquerda) | Conferir no painel Meu Correios |
| `405 Method POST not supported` | Bug do código (esperado GET) | Ver lib/correios.ts |
| `CMN-XXX contrato inválido` | `CORREIOS_CONTRATO` ou `CORREIOS_DR` errado | Conferir contrato impresso |
| Cotação devolve só `PADRAO` da tabela | Alguma das 8 envs faltando | `/api/admin/correios-diag` |

## 📚 Links Correios

- Manual PPN: https://www.correios.com.br/atendimento/developers/manual-do-usuario-ppn
- Painel Meu Correios: https://meucorreios.correios.com.br
