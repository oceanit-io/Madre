# Runbook

Operações comuns. Receitas pra fazer coisas rotineiras sem ter que reinventar.

---

## 🔄 Sincronizar catálogo da Tray

**Quando**: produtos novos chegaram na Tray, ou preços/estoque mudaram.

**Frequência automática**: 1× por dia (cron 03:00).

**Manual**:
1. Vai em `https://lojadeprata925.com.br/admin/destaques`.
2. Coloca PIN admin (`prata925`).
3. Click **"🔄 Sincronizar Tray"**.
4. Aguarda 2-5 min (vai puxar todos os ~3000 produtos).
5. Refresh a página → checa "Última sincronização" no topo.

**Via terminal** (se a UI estiver fora):
```bash
curl -H "Authorization: Bearer prata925" \
  https://lojadeprata925.com.br/api/cron/tray-sync
```

**Erro comum**: timeout em 60s no Hobby Vercel. Considerar upgrade Pro pra mais tempo.

---

## ✅ Ativar nova revendedora

**Cenário**: revendedora se cadastrou e pagou a primeira mensalidade.

1. Vai em `/admin/revendedoras` ou `/admin/ativar`.
2. Acha a linha dela (status = `pendente`).
3. Verifica que veio o pagamento da mensalidade (link pag.ae).
4. Click **"Ativar"**.
5. Sistema:
   - Muda `status` pra `ativa`.
   - Cria mensalidade pro mês atual com `status='paga'`.
   - Manda email "Bem-vinda, sua loja está no ar".

---

## 📦 Marcar pedido como enviado

**Cenário**: P15 despachou via Tray. Agora marca no nosso sistema.

1. Vai em `/admin/pedidos`.
2. Filtra por status = `pago`.
3. Acha o pedido.
4. Click **"Marcar como enviado"** ou dropdown de status.
5. (Opcional) Cola código de rastreio.
6. Sistema:
   - Muda `status` pra `enviado`, atualiza `data_envio`.
   - Dispara email "Pedido enviado" pro cliente.

---

## 💸 Processar saque de revendedora

**Cenário**: revendedora solicitou saque PIX em `/saldo`.

1. Vai em `/admin/revendedoras` → click na revendedora.
2. Aba **"Saques"**.
3. Acha saque com status `solicitado`.
4. **Fora do sistema**: faz o PIX dos dados que ela cadastrou.
5. Volta no painel → click **"Marcar como pago"**.
6. Sistema:
   - Muda status pra `pago`.
   - Debita `saldo_disponivel` da revendedora.
   - Manda email "Saque pago".

⚠️ **Não há integração bancária**. Você faz o PIX manualmente e só registra.

---

## ↩️ Reembolsar pedido (manual)

**Cenário**: cliente pediu reembolso, ou foi pedido de teste.

### Refund no Pagar.me
1. https://dash.pagar.me → Pedidos.
2. Acha o pedido pelo `numero_pedido`.
3. Click **"Estornar"** ou **"Reembolsar"**.
4. Confirma valor (parcial ou total).
5. PIX: na hora. Cartão: 1-5 dias úteis.

### Atualizar nosso DB (manualmente — refund handler não implementado ainda)
Via SQL Editor Supabase:

```sql
-- 1. Achar o pedido
select id, numero_pedido, status, total
from pedidos
where numero_pedido = 'PED-AAAAMMDD-NNNN';

-- 2. Mudar status pra cancelado (dispara reverter comissão)
update pedidos
set status = 'cancelado'
where numero_pedido = 'PED-AAAAMMDD-NNNN';

-- 3. (Opcional) Deletar comissão se trigger não reverteu
delete from comissoes
where numero_pedido = 'PED-AAAAMMDD-NNNN'
  and status = 'processando';
```

⚠️ **Débito técnico**: refund handler no webhook não está implementado. Quando implementar, esse passo manual some.

---

## 🧪 Compra de teste end-to-end

**Cenário**: validar que tudo funciona após mudança grande ou deploy de produção.

1. **Incognito** (Ctrl+Shift+N).
2. Abre uma loja: `https://lojadeprata925.com.br/loja/gabrielafernandez-5034`.
3. Escolhe peça barata (R$5-30) — abaixo de R$250 pra não disparar frete grátis.
4. Carrinho → Finalizar compra.
5. Preenche dados reais (CPF, email, telefone, CEP teus).
6. Escolhe PAC ou SEDEX.
7. Continuar para pagamento.
8. Paga real (PIX é mais rápido pra refundar depois).
9. Aguarda redirect de volta.

### O que verificar
- ✅ Email "Pedido recebido" no inbox (1-2 min).
- ✅ Email "Pagamento confirmado" no inbox (após pagar, depende do webhook).
- ✅ Em `/admin/pedidos` o pedido figura como **"Pago"**.
- ✅ Em `/vendas` da revendedora aparece a venda com a comissão calculada.

### Após validar
- Refund pelo painel Pagar.me.
- Update manual no DB (ver seção acima).

---

## 🔍 Debug Pagar.me

### Recipient não está sendo criado
```bash
# Vê resposta crua do Pagar.me pra o cadastro
curl -H "Authorization: Bearer prata925" \
  "https://lojadeprata925.com.br/api/admin/recebedor-test?slug=gabrielafernandez-5034" \
  | jq
```

Retorna status HTTP, body do Pagar.me, payload enviado (mascarado).

### Webhook não está atualizando status
1. Verifica no painel Pagar.me → Webhooks → "Eventos enviados" se o webhook foi enviado.
2. Se enviou, vê os logs Vercel pelo timestamp.
3. Possíveis causas:
   - URL do webhook errada no painel Pagar.me.
   - `PAGARME_WEBHOOK_USER`/`_PASS` setados em Vercel mas não no painel (Basic Auth falha).
   - Bug no handler — checar logs.

---

## 🔍 Debug Correios

### Frete sempre cai pra tabela fixa
```bash
# 1. Vê quais envs estão presentes
curl -H "Authorization: Bearer prata925" \
  https://lojadeprata925.com.br/api/admin/correios-diag | jq

# 2. Vê resposta crua de auth + cotação
curl -H "Authorization: Bearer prata925" \
  "https://lojadeprata925.com.br/api/admin/correios-diag-v2?cep=01310100" | jq
```

Vai dizer exatamente em qual passo deu pau (auth/preco/prazo) e qual mensagem o Correios devolveu.

### Erros comuns
- `TOK-003: Cartão de postagem não localizado` → `CORREIOS_CARTAO_POSTAGEM` errado (geralmente faltam zeros à esquerda).
- `Auth 401` → `CORREIOS_USUARIO`/`SENHA` errados.
- `Auth 403` → conta API não tem permissão PPN.
- `405 Method POST not supported` → bug do código (deve ser GET com query string).
- `CMN-XXX contrato inválido` → `CORREIOS_CONTRATO` ou `CORREIOS_DR` errados.

---

## 🚨 Site fora do ar

### DNS apontando pra IP errada
- Vercel troca IPs apex às vezes. Atualizar A record do domínio pra a IP atual mostrada em `Vercel → Settings → Domains`.
- IP atual (jun/2026): `76.76.21.21`.

### Build falhou
1. Vercel → Deployments → último.
2. Vê "View Build Logs".
3. Geralmente é typo TypeScript ou import faltando.
4. Fix local, push, redeploy.

### DB offline
1. Supabase dashboard → Project → Health.
2. Se offline, esperar (em geral resolve em minutos).
3. Se persistir, abrir ticket no Supabase support.

---

## 🧰 Backup / restore

### Backup do DB
Supabase faz backup automático diário (em planos pagos). Em Hobby, exportar via SQL Editor:

```sql
-- Pra dump completo, usar pg_dump (em outro lugar)
-- Aqui só dump das tabelas críticas via copy
```

Recomenda-se setup adicional com pg_dump agendado em algum servidor próprio.

### Export simples (CSV)
Dashboard Supabase → Table Editor → cada tabela → "Export".

---

## 🛡️ Segurança recorrente

### Rotar tokens
A cada 90 dias rotar:
- `PAGARME_SECRET_KEY` (criar nova em Pagar.me dashboard → revogar antiga).
- `SUPABASE_SERVICE_ROLE_KEY` (em Supabase dashboard → Settings → API → Reset).
- `SUPABASE_ACCESS_TOKEN` (em Supabase account tokens).
- `RESEND_API_KEY` (em Resend dashboard).
- `ADMIN_PIN` (qualquer string > 12 chars).

### Atualizar Vercel + redeploy
Ao trocar qualquer env, redeploy obrigatório.

---

## 📚 Veja também

- [DATABASE](./DATABASE.md) — schemas e queries.
- [integrations/PAGARME](./integrations/PAGARME.md) — debug profundo.
- [integrations/CORREIOS](./integrations/CORREIOS.md) — debug profundo.
