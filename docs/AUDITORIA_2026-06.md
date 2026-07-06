# Auditoria exaustiva — prata15 (jun/2026)

Auditoria multi-agente (9 subsistemas, verificação adversarial). **100 findings confirmados**: 4 críticos, 19 altos, 37 médios, 40 baixos.

**Corrigidos nesta sessão: 9** (✅). Os demais ficam como roadmap priorizado.

Legenda: ✅ corrigido · 🔲 pendente · ⚠️ precisa decisão (dinheiro/migração)


## 🔴 CRÍTICO (4)

### ✅ Race condition no saque permite saque duplicado do mesmo saldo (optimistic lock não checa linhas afetadas)
- **Arquivo:** `src/app/api/revendedora/saque/route.ts:80-89` · tipo: dados · esforço: medio · sub: dashboard
- **Problema:** O débito do saldo faz read-then-update com lock otimista `.update(...).eq('saldo_disponivel', saldoAtual)`. O supabase-js não retorna erro quando 0 linhas batem o filtro. Em dois saques concorrentes (duplo-clique / retry), ambos leem o mesmo saldoAtual, ambos passam, ambos inserem row em `saques`. O primeiro update casa o filtro e debita; o segundo casa 0 linhas, não debita, mas `updErr` é null, então retorna ok. Resultado: 2 saques 'solicitado' pelo mesmo dinheiro, saldo debitado só 1x. O comentário promete RPC atômica `debitar_saldo` 'se existir', mas o código nunca a chama.
- **Fix:** Débito atômico condicional no Postgres via RPC SECURITY DEFINER (update ... where saldo >= valor returning), verificando row_count; se 0, deletar o saque e 400. Enquanto não houver RPC, adicionar `.select('id')` no update e checar se retornou 1 linha.

### ✅ Cookie de sessão admin é texto plano sem assinatura — bypass total de autenticação
- **Arquivo:** `src/lib/adminAuth.ts:47-52 e src/app/api/admin/login/route.ts:24` · tipo: seguranca · esforço: medio · sub: admin
- **Problema:** Confirmado. O login (login/route.ts:24) seta res.cookies.set(ADMIN_COOKIE, user, ...) com o valor sendo a string crua do identificador ('master'/'gabby'/etc), sem nenhum HMAC/JWT/assinatura. parseCookie (adminAuth.ts:47-52) só confere se o valor está em VALID_USERS. Qualquer um pode enviar `Cookie: lp925_admin=master` via curl e obter getAdminUser()='master' → checkAdminAuth()=true em todos os endpoints admin (todos usam checkAdminAuth). HttpOnly/secure/sameSite impedem JS de ler/CSRF trivial, mas NÃO impedem um atacante de forjar o header manualmente. É bypass total: hard-delete, set-password, saques, KYC. O PIN nunca é reverificado após login.
- **Fix:** Assinar o cookie com HMAC de um segredo de servidor (ex: `${user}.${hmacSHA256(user, SECRET)}`) e validar em parseCookie, ou usar JWT assinado (jose) com expiração. Rejeitar cookie cuja assinatura não bate.

### ⚠️ Comissão paga em dobro: trigger credita saldo_disponivel 30% mesmo quando o split Pagar.me NÃO pagou a revendedora (KYC inativo)
- **Arquivo:** `supabase/comissoes_20d.sql:48-66 (trigger) + src/app/api/pedidos/route.ts:327,332,346-350 (split)` · tipo: dados · esforço: medio · sub: notificacoes
- **Problema:** No checkout, a revendedora só entra no split real do Pagar.me quando revAtiva = revRecipientId && status==='active' (route.ts:327). Quando inativa, comissaoCent=0 (route.ts:332) e os 30% vão pra conta mãe no dinheiro real. Mas o trigger pedidos_apos_mudanca_status SEMPRE cria a comissão de 30% quando o pedido vira 'pago' (comissoes_20d.sql:48-66), sem checar split, e comissoes_sincronizar_saldo credita em saldo_processando→saldo_disponivel (linhas 90-126). O saldo sacável fica inflado em 30% de toda venda feita com KYC inativo. Como saque é pago manualmente de saldo_disponivel (saque/route.ts), a Gabriela transfere de novo dinheiro que já ficou na conta mãe. Reconciliação quebrada com dinheiro real.
- **Fix:** Persistir em pedidos um flag (ex.: comissao_via_split, true só se revAtiva) e condicionar o credito a esse flag no trigger; ou, com KYC inativo, criar a comissão como 'pendente' (órfã) que NÃO entra em saldo. Enquanto isso, conferir manualmente o split da venda antes de pagar saque.

### ⚠️ Risco de duplo pagamento da comissão: split Pagar.me paga 30% direto à revendedora E o trigger credita 30% no saldo_disponivel
- **Arquivo:** `src/app/api/pedidos/route.ts:332-356 + supabase/comissoes_20d.sql:54-66` · tipo: dados · esforço: medio · sub: db-seguranca
- **Problema:** Confirmado: em pedidos/route.ts linha 332, comissaoCent = revAtiva ? 30% subtotal : 0, e quando revAtiva o split (linhas 347-349) manda esse valor direto pro recipient da revendedora (dinheiro real cai na conta dela no split Pagar.me). Em paralelo, comissoes_20d.sql linha 54-64 cria comissão de round(subtotal*0.30,2) ao marcar 'pago', SEM nenhuma checagem de revAtiva/recipient ativo, que após 20d vira saldo_disponivel sacável. Logo, revendedora com KYC ativo recebe 30% duas vezes: uma no split, outra no saque. Só não estoura hoje porque (provavelmente) nenhuma revendedora tem recipient 'active' ainda.
- **Fix:** Decidir um único canal. Setar pedidos.comissao_via_split=true no insert quando revAtiva e no trigger só criar comissão sacável quando false (ou gravar status='paga' via split, sem creditar saldo). Auditar antes de qualquer KYC ativar.


## 🟠 ALTO (19)

### ✅ Pedido aceita produto sem estoque (estoque=0) — overselling
- **Arquivo:** `src/app/api/pedidos/route.ts:132-166` · tipo: dados · esforço: baixo · sub: storefront
- **Problema:** Confirmado lendo o código. O select na linha 134 busca 'id, sku, nome, preco, preco_promo, fotos, ativo, variacoes_cache' — NÃO inclui 'estoque'. O loop (linhas 159-166) só rejeita '!p || !p.ativo'. Não há nenhuma validação de estoque. Grep em src/app/api/webhook/ e src/app/api/pedidos/ não encontrou NENHUMA referência a 'estoque' — confirma que não há decremento nem validação em todo o fluxo de pedido/webhook. A vitrine filtra estoque via /api/produtos (.gt('estoque',0)), mas isso é só listagem; a fonte de verdade /api/pedidos aceita produto esgotado. Duas clientes podem comprar a última peça.
- **Fix:** No select incluir 'estoque' e no loop rejeitar item com Number(p.estoque) < quantidade retornando 409. Idealmente, no webhook ao confirmar pagamento, decrementar atômico (UPDATE ... SET estoque = estoque - q WHERE estoque >= q).

### 🔲 Endpoints públicos sem rate-limit nem proteção anti-abuso (pedidos/cep/frete)
- **Arquivo:** `src/app/api/pedidos/route.ts:74, src/app/api/cep/[cep]/route.ts, src/app/api/frete/route.ts` · tipo: seguranca · esforço: medio · sub: storefront
- **Problema:** Confirmado. POST /api/pedidos (linha 74) não tem auth/captcha/rate-limit; cria pedido, gera link Pagar.me (368), envia e-mail ao cliente (400) e à revendedora (424) e insere notificação (409). /api/cep e /api/frete são proxies abertos (ViaCEP/Correios). Grep por 'ratelimit|rate-limit|upstash' em src/ retornou ZERO resultados — não existe rate-limit em lugar nenhum. Um script pode criar pedidos em massa, estourar cota Resend, poluir o painel e gerar lixo na Pagar.me. Mantenho severidade alto: o impacto financeiro/reputacional (Resend, domínio) e operacional é concreto.
- **Fix:** Rate-limit por IP em /api/pedidos (ex 5/min), /api/cep e /api/frete (ex 30/min). Throttle adicional por e-mail/CPF em /api/pedidos.

### ⚠️ Comissões órfãs (status 'pendente') somam em 'A liberar' mas nunca são creditadas no saldo
- **Arquivo:** `src/lib/comissoesCalc.ts:79,93` · tipo: dados · esforço: medio · sub: dashboard
- **Problema:** `calcularTotais` define `aLiberar = soma(pendentes)` onde `pendentes = status 'pendente' || 'processando'`. Pelo trigger (comissoes_20d.sql:62), 'pendente' é o caso órfão (revendedora_id NULL, data_liberacao NULL). O cron `liberar_comissoes_maduras` só move 'processando'→'liberada'; nunca toca em 'pendente'. Logo a comissão órfã aparece eternamente como 'A liberar' mas nunca vira saldo sacável. O financeiro busca por `slug_revendedora.eq.subdominio`, então órfãs do slug dela entram no cálculo dela mesmo com revendedora_id NULL.
- **Fix:** Em `aLiberar` contar só 'processando'. Criar backfill admin: para comissões 'pendente' cujo slug agora casa uma revendedora, setar revendedora_id + status 'processando' + data_liberacao. Mostrar órfãs em alerta admin, não como 'a liberar' da revendedora.

### ✅ Saque não verifica status da conta — revendedora suspensa pode sacar
- **Arquivo:** `src/app/api/revendedora/saque/route.ts:25-45` · tipo: seguranca · esforço: baixo · sub: dashboard
- **Problema:** O POST /api/revendedora/saque valida sessão e valor, mas nunca checa `rev.status`. Uma revendedora 'suspensa' (fraude, chargeback, inadimplência) ou 'pendente' consegue solicitar saque do saldo_disponivel. Como o pagamento é manual a partir do email, o dinheiro pode sair antes da Gabriela perceber. Vetor de perda financeira.
- **Fix:** Adicionar guard após resolver a sessão: se `rev.status !== 'ativa'`, retornar 403. Opcionalmente bloquear saque com mensalidade vencida.

### 🔲 Vínculo entre comissões/pedidos e a loja é por string subdominio, não por id — frágil ao renomear o slug
- **Arquivo:** `src/app/configurar-loja/page.tsx:233; src/app/api/revendedora/financeiro/route.ts:22,65; src/app/api/revendedora/pedidos/route.ts:21` · tipo: risco · esforço: alto · sub: dashboard
- **Problema:** Pedidos e comissões referenciam a loja por `slug_revendedora` = subdominio. A UI permite a revendedora TROCAR o subdomínio em /configurar-loja (PATCH /api/revendedora/loja). Ao renomear, pedidos/comissões antigos param de casar com `slug_revendedora.eq.<novo subdominio>`. /pedidos e pedidosAguardando usam SÓ o slug — vendas históricas somem do painel após renomear. Comissões com revendedora_id sobrevivem no financeiro (que busca por id OR slug), mas a lista de vendas não.
- **Fix:** Consultar pedidos/comissões por `revendedora_id` (uuid imutável). Se manter slug por compat, ao trocar subdomínio fazer UPDATE nos registros antigos na mesma transação, ou limitar a troca.

### ✅ Saque pode não debitar o saldo e ainda retornar sucesso (update de 0 linhas tratado como OK)
- **Arquivo:** `src/app/api/revendedora/saque/route.ts:80-89` · tipo: dados · esforço: medio · sub: apis-rev
- **Problema:** Confirmado lendo o código. O debit em saque/route.ts:80-84 faz .update({saldo_disponivel: saldoAtual - valor}).eq('id', rev.id).eq('saldo_disponivel', saldoAtual) (optimistic lock), sem .select() e checando apenas updErr. No supabase-js, um UPDATE que casa ZERO linhas (porque saldo_disponivel mudou entre o read da linha 67-71 e o write) retorna error=null. O fluxo segue como sucesso: insere notificação, manda email pra Gabriela e responde {ok:true}, mas o saldo NÃO foi debitado. Risco de double-spend se houver saque/comissão concorrente entre o read e o write. A janela é estreita (read e write quase adjacentes) e o saldo só muda por crédito de comissão concorrente ou outro saque simultâneo, mas o caminho de double-spend é real. A RPC atômica debitar_saldo é mencionada no comentário do topo do arquivo mas NÃO é chamada.
- **Fix:** Adicionar .select('id') no update do debit e checar que retornou >=1 linha; se vazio, deletar o saque e retornar 'Saldo mudou, tente novamente'. Melhor ainda: usar uma RPC atômica (UPDATE ... SET saldo_disponivel = saldo_disponivel - valor WHERE id=$1 AND saldo_disponivel>=valor RETURNING ...) na mesma transação que insere o saque.

### 🔲 Endpoint de PIX sem autenticação expõe PII e cria cobrança real (IDOR)
- **Arquivo:** `src/app/api/pedidos/[id]/pix/route.ts:49-70` · tipo: seguranca · esforço: medio · sub: pagamentos
- **Problema:** POST /api/pedidos/[id]/pix não exige nenhuma prova de posse do pedido. Qualquer requisição com um UUID de pedido em status 'aguardando_pagamento' cria uma order PIX real no Pagar.me com split 3-way (linhas 153-179) e materializa pagarme_order_id/charge/QR no pedido. No caminho idempotente (linhas 80-88) qualquer chamador recebe de volta o copia-e-cola/QR. Não há retorno de PII no body (só orderId/chargeId/qrCodeUrl/copiaECola/expiraEm), então o vazamento de PII alegado é exagerado — a PII é lida do banco mas NÃO é devolvida ao chamador. O IDOR de ação (criar cobrança / fixar order_id de terceiro) é real.
- **Fix:** Exigir prova de posse do pedido (token/nonce assinado emitido no checkout, ou hash de numero_pedido validado no body) antes de criar/retornar o PIX. Aplicar o mesmo na página /pedido/[id]/aguardando-pagamento.

### ✅ Webhook legado Nuvemshop sem auth, com race condition de saldo e sem idempotência
- **Arquivo:** `src/app/api/webhook/route.ts:9-77` · tipo: dados · esforço: medio · sub: pagamentos
- **Problema:** A rota POST /api/webhook continua montada (Next.js auto-monta qualquer route.ts) e é pública. Confirmados: (1) ZERO autenticação — qualquer um pode POSTar order/paid forjado; (2) read-modify-write em saldo_processando (linha 57) sujeito a lost update concorrente; (3) sem idempotência/dedup por pedido — reenvio insere venda 2x e soma saldo 2x; (4) retorna 500 no catch (linha 75) garantindo loop de reenvio, ao contrário dos outros webhooks que sempre retornam 200.
- **Fix:** Como o Nuvemshop está morto (vendas é tabela legada, fluxo atual usa Pagar.me + comissoes), REMOVER a rota. Se mantida: adicionar verificação HMAC, trocar incremento por RPC atômica, dedup por pedido_id único, e sempre retornar 200.

### 🔲 Estratégia 2 do webhook InfinitePay ativa loja por match de email sem confirmar valor pago
- **Arquivo:** `src/app/api/webhook/infinitepay/route.ts:183-225` · tipo: seguranca · esforço: medio · sub: pagamentos
- **Problema:** Quando order_nsu não é cad_<id>, o webhook ativa a primeira revendedora 'pendente' cujo email (linha 188) ou telefone (linha 213) bata com o customer do payload, sem checar paid_amount contra o valor da mensalidade. Como INFINITEPAY_WEBHOOK_TOKEN é opcional (linha 53-64: se não configurado, não valida nada), um payload forjado com paid_amount>0 e o email de uma revendedora pendente ativa a loja de graça. O match por telefone carrega TODAS as pendentes para memória e faz find em JS (linha 213).
- **Fix:** Tornar INFINITEPAY_WEBHOOK_TOKEN obrigatório e/ou validar via verificarPagamentoInfinitePay() antes de ativar; validar paid_amount >= mensalidade; preferir order_nsu=cad_<id> e usar match email/telefone só como sinal para notificar, não para ativar.

### 🔲 Ativação grátis: confirmar-pagamento não valida order_nsu nem valor (bypass da taxa R$39,90)
- **Arquivo:** `src/app/api/auth/confirmar-pagamento/route.ts:54-87` · tipo: seguranca · esforço: baixo · sub: auth
- **Problema:** Confirmado lendo o código: o endpoint chama verificarPagamentoInfinitePay({order_nsu, transaction_nsu, invoice_slug}) com valores crus do body e, se r.paid===true, faz update status='ativa'. NÃO valida order_nsu === `cad_${rev.id}` (linha 55 inclusive usa fallback 'unknown' quando order_nsu vem vazio) e NÃO valida r.amount (verificarPagamentoInfinitePay em infinitepay.ts:118-140 retorna amount mas é ignorado). O handle InfinitePay é único pra tudo (infinitepay.ts:14 HANDLE_DEFAULT='oceanit', usado tanto em criarLinkCadastroInfinitePay quanto em pedidos), então payment_check de QUALQUER pagamento real sob o handle pode passar. Uma pendente que obtenha slug+transaction_nsu de qualquer pagamento (ex.: um pedido de produto) consegue ativar a própria loja sem pagar a taxa.
- **Fix:** Antes de ativar: (1) exigir order_nsu === `cad_${rev.id}` (403 se não bater) — note que o webhook em src/app/api/webhook/infinitepay/route.ts JÁ faz isso corretamente (orderNsu.startsWith('cad_') + slice(4) + lookup por id), então este endpoint é a única porta sem essa checagem; (2) validar r.amount >= 3990; (3) remover o fallback 'unknown' de order_nsu (linha 55).

### ✅ Reativar revendedora sobrescreve mensalidade_vence_em — comentário diz o contrário
- **Arquivo:** `src/app/api/admin/ativar-revendedora/route.ts:19-29` · tipo: bug · esforço: baixo · sub: admin
- **Problema:** Confirmado integralmente. O comentário (19-21) afirma 'Só atualiza se ainda for null — não sobrescreve se já tem data válida', mas o .update({ status:'ativa', mensalidade_vence_em: proxVencISO }) na linha 29 grava hoje+CICLO_DIAS INCONDICIONALMENTE. Não há leitura prévia do mensalidade_vence_em atual nem guarda. Re-ativar uma loja já ativa reseta o vencimento pra +30 dias (ciclo grátis, perde a data real de cobrança). Também não há guarda de idempotência: re-ativar reenvia email de boas-vindas e a notificação '🎉 conta ativada' (linhas 44-79). O update na linha 27-30 não usa .neq('status','ativa').
- **Fix:** Ler a rev antes; só setar mensalidade_vence_em se null. Adicionar guarda de idempotência: se status já 'ativa', retornar early sem reenviar email/notif (ou usar .neq('status','ativa') no update e só notificar quando a linha foi de fato alterada via .select()).

### ⚠️ Trocar subdomínio (slug) órfã comissões e pedidos históricos da revendedora
- **Arquivo:** `src/app/api/admin/corrigir-url/route.ts:82-91 e src/app/api/admin/financeiro/route.ts:68-88` · tipo: dados · esforço: medio · sub: admin
- **Problema:** Confirmado. corrigir-url (82-85) faz só UPDATE revendedoras SET subdominio sem tocar em comissoes.slug_revendedora nem pedidos.slug_revendedora. financeiro/route.ts agrega comissões por c.slug_revendedora (linha 71, porSlug Map) e mapeia o nome via .in('subdominio', slugs) (linha 84). Após trocar o slug, as comissões/pedidos antigos guardam o slug velho que não bate mais com nenhum subdominio → mapaNome.get() falha → aparecem com nome = o slug cru (linha 93), e a atribuição histórica por revendedora fica fragmentada (split entre slug antigo e novo). Saldo não quebra (usa revendedora_id/RPC). Atribuição financeira histórica corrompida.
- **Fix:** Na mesma operação: UPDATE comissoes SET slug_revendedora=$novo WHERE slug_revendedora=$antigo e idem pedidos (idealmente RPC transacional). Ou migrar relatórios pra agregar por revendedora_id.

### ⚠️ Reativar pedido cancelado nunca devolve a comissão (on conflict do nothing) — revendedora perde os 30%
- **Arquivo:** `supabase/comissoes_20d.sql:54-65` · tipo: dados · esforço: medio · sub: notificacoes
- **Problema:** A versão de pedidos_apos_mudanca_status em comissoes_20d.sql usa 'on conflict (pedido_id) do nothing' (linha 65). Se o fluxo de status permite pago→cancelado→pago, ao voltar pra 'pago' o INSERT bate no conflito e faz NOTHING; a comissão fica 'cancelada' pra sempre e a revendedora não recebe os 30% de uma venda efetivamente paga. O cancelamento (linhas 69-74) seta status='cancelada' e o trigger de saldo debita.
- **Fix:** Recriar pedidos_apos_mudanca_status com 'on conflict (pedido_id) do update' reativando a comissão pra 'processando' e resetando os flags em_processando/creditada de forma consistente com comissoes_sincronizar_saldo. Aplicar via Management API e marcar como a versão canônica.

### 🔲 Tabela notificacoes sem definição e sem RLS no repo — IDOR potencial (revendedora lê/edita notificação de outra)
- **Arquivo:** `src/app/dashboard/page.tsx:81-88,134-141,206-211` · tipo: seguranca · esforço: medio · sub: notificacoes
- **Problema:** Não existe 'create table notificacoes' nem policy de RLS em supabase/*.sql (grep confirmou 0 ocorrências de notificacoes em qualquer .sql). O dashboard faz select e update('lida') direto do client com a sessão do usuário, filtrando só por revendedora_id/id vindos do client (page.tsx:81-88, 134-141, 206-211). Se a RLS em produção não restringir por owner (revendedora.user_id = auth.uid()), qualquer revendedora logada lê notificações alheias (valores de saque, nomes de clientes) e marca como lida trocando o id — IDOR. Como o schema não está versionado, não há garantia de que a policy exista.
- **Fix:** Versionar supabase/notificacoes.sql com create table + enable RLS + policy 'revendedora vê/edita só as suas' (revendedora_id in (select id from revendedoras where user_id = auth.uid())) + policy service_role. Confirmar no projeto ipovxwzzqjjywratrbjx que a RLS está ligada. Idealmente mover o update de 'lida' pra um endpoint server-side.

### ✅ Webhook legacy Nuvemshop: sem assinatura, não idempotente, race no saldo e retorna 500 (loop de reenvio)
- **Arquivo:** `src/app/api/webhook/route.ts:9-77` · tipo: bug · esforço: medio · sub: notificacoes
- **Problema:** Handler montado em /api/webhook. (1) Sem verificação de assinatura/HMAC — qualquer POST de order/paid forjado credita saldo (linhas 9-31). (2) Não idempotente — mesmo evento 2x insere 2 vendas e credita saldo 2x (sem checagem por pedido_id). (3) Race read-modify-write no saldo: lê saldo_processando (linha 29) e escreve saldo+comissao (55-58); 2 webhooks concorrentes perdem um crédito. (4) Em erro retorna 500 (linha 75) — gateways reenviam em loop. Contradiz CLAUDE.md (idempotente + sempre 200).
- **Fix:** Se a Nuvemshop não é mais usada, remover a rota. Se é: validar assinatura; dedupe por (revendedora_id, pedido_id) com unique + on conflict do nothing; trocar credito por RPC atômica de incremento; sempre retornar 200 logando erro. Reaproveitar o padrão de /api/webhook/pagarme.

### ✅ Endpoint /api/sg/produtos exposto sem nenhuma autenticação — proxy aberto pro ERP SG com credenciais do servidor
- **Arquivo:** `src/app/api/sg/produtos/route.ts:18-53` · tipo: seguranca · esforço: baixo · sub: db-seguranca
- **Problema:** O GET não chama checkAdminAuth nem qualquer guarda. O middleware.ts (em src/middleware.ts) só processa /api/admin/* e páginas (matcher exclui demais /api), então /api/sg/produtos fica 100% público. Qualquer um chama ?limit=9999&filial=1 e o servidor autentica com SG_USUARIO/SG_SENHA e devolve o catálogo do ERP. Em erro (linha 50) ainda devolve url_chamada e detalhes do upstream, ajudando enumeração. Cada chamada faz um login no SG + query.
- **Fix:** Exigir checkAdminAuth(request) no topo do GET (401 se falhar) ou mover a rota pra /api/admin/sg-produtos pra herdar o middleware. Não retornar detalhes/url do upstream sem auth.

### ⚠️ Re-pagar pedido cancelado NÃO re-credita o saldo da revendedora (estado de comissão inconsistente)
- **Arquivo:** `supabase/pedidos_status_flexivel.sql:55-63 + supabase/comissoes_20d.sql:114-151` · tipo: dados · esforço: medio · sub: db-seguranca
- **Problema:** Confirmada a divergência entre os dois arquivos de trigger de pedido: pedidos_status_flexivel.sql faz ON CONFLICT DO UPDATE setando status='liberada' diretamente; comissoes_20d.sql faz ON CONFLICT DO NOTHING e cria como 'processando'. Qual está vivo depende da ordem de aplicação manual no Supabase. No cenário status_flexivel: pedido pago→cancelado (comissão 'cancelada', saldo debitado)→re-pago dispara UPDATE da comissão pra 'liberada' vindo de 'cancelada'. O trigger comissoes_sincronizar_saldo só credita em UPDATE no branch (c) que exige OLD.status='processando' (não 'cancelada'); nenhum branch trata 'cancelada'→'liberada' → não re-credita, mas UI mostra 'liberada'. Dívida invisível. Caveat: o ON CONFLICT do status_flexivel ignora a política 20d e grava direto 'liberada' (também fura a maturação).
- **Fix:** Unificar produção no trigger de comissoes_20d (DO NOTHING/processando) e adicionar branch no trigger de saldo p/ reativação. Verificar no banco qual prosrc está ativo (select prosrc from pg_proc) e remover a ambiguidade dos dois SQLs no repo.

### 🔲 Webhook InfinitePay Estratégia 2/3 sem idempotência — ativa loja e reenvia e-mails a cada reenvio do provider
- **Arquivo:** `src/app/api/webhook/infinitepay/route.ts:183-225` · tipo: bug · esforço: medio · sub: db-seguranca
- **Problema:** Confirmado: os fallbacks email_match (183-202) e phone_match (205-225) fazem UPDATE status='ativa' cru, sem checar transaction_nsu já processado e sem chamar registrar_pagamento_mensalidade. Não gravam em mensalidades_pagamentos nem estendem mensalidade_vence_em. O trigger revendedora_set_vencimento (mensalidade_auto_ativacao.sql:30) seta +30 só na 1ª ativação (quando mensalidade_vence_em is null), então renovações por esses caminhos não estendem nada → cron de cobrança não renova (fuga de receita) e reenvios do provider reativam repetidamente. Atenuante: como esses fallbacks filtram status='pendente' (linhas 189 e 212), uma loja já 'ativa' não casa de novo no mesmo caminho, limitando o spam de reativação; mas a falta de extensão de vencimento e o registro financeiro ausente são reais.
- **Fix:** Fazer email_match e phone_match chamarem registrar_pagamento_mensalidade(rev.id, paid_amount/100, 'infinitepay', tx) em vez de UPDATE cru. Herda dedup e cálculo de vencimento.

### 🔲 Tabelas notificacoes e visitas não têm migration/RLS versionada no repo — provavelmente sem RLS
- **Arquivo:** `supabase/ (nenhum arquivo cria/protege notificacoes ou visitas)` · tipo: seguranca · esforço: medio · sub: db-seguranca
- **Problema:** Confirmado que NÃO existe nenhum .sql no repo criando ou habilitando RLS em notificacoes ou visitas (grep -rl não retorna nada em supabase/). notificacoes é escrita por várias rotas (pedidoEmails.ts, webhook infinitepay) com revendedora_id e mensagens. Se foram criadas direto no painel sem 'enable row level security', ficam expostas via anon key (PostgREST), permitindo IDOR entre revendedoras. PORÉM: o finding NÃO consegue confirmar o estado real de RLS em produção — é inferência. Pode já estar com RLS habilitado via painel. Severidade rebaixada de alto pra medio porque o risco depende de uma suposição não verificada; o item concreto e indiscutível é a ausência de migration versionada.
- **Fix:** Rodar select relname, relrowsecurity from pg_class where relname in ('notificacoes','visitas') pra confirmar o estado. Adicionar supabase/notificacoes.sql e visitas.sql com create table + enable RLS + policies (notificacoes: SELECT só dono; visitas: só service_role).


## 🟡 MÉDIO (37)

### 🔲 Carrinho pode ser esvaziado silenciosamente ao adicionar item de outra loja (sem confirmação)
- **Arquivo:** `src/contexts/CarrinhoContext.tsx:77-93` · tipo: ux · esforço: medio · sub: storefront
- **Fix:** Pedir confirmação quando trocouLoja e havia itens, ou persistir carrinho por loja (mapa slug->itens).

### 🔲 Redirect do checkout usa `itens` total, não `itensCheckout` — pode comprar itens não selecionados
- **Arquivo:** `src/app/checkout/page.tsx:213-217, 412` · tipo: bug · esforço: baixo · sub: storefront
- **Fix:** Se selKeys!==null e itensFiltrados.length===0, NÃO cair em 'compra tudo' — redirecionar pra /carrinho com aviso. Só usar fallback quando selKeys===null.

### 🔲 Notificação '🎉 novo pedido' é criada na criação do pedido (aguardando_pagamento), não no pagamento confirmado
- **Arquivo:** `src/app/api/pedidos/route.ts:402-414` · tipo: ux · esforço: medio · sub: storefront
- **Fix:** Mover notificação/e-mail de 'nova venda' pro webhook Pagar.me quando status vira 'pago' (idempotente com .neq('status','pago')). Na criação, opcionalmente uma notificação neutra 'pedido iniciado'.

### 🔲 Notificação de saque inserida ANTES de confirmar débito — mas o fluxo permite notificar saque que falhou silenciosamente
- **Arquivo:** `src/app/api/revendedora/saque/route.ts:80-97` · tipo: dados · esforço: baixo · sub: dashboard
- **Fix:** Após corrigir o débito para atômico com checagem de row_count, só inserir saque/notificação/email quando o débito for confirmado. Reordenar: debitar atômico → se ok, inserir saque → notificar.

### 🔲 CPF completo da cliente exposto no painel da revendedora (PII)
- **Arquivo:** `src/app/vendas/page.tsx:47-51,338-340; src/app/api/revendedora/pedidos/route.ts:54` · tipo: seguranca · esforço: baixo · sub: dashboard
- **Fix:** Não retornar `cliente_cpf` no endpoint da revendedora, ou mascarar de verdade no server antes de enviar (ex: 123.***.***-09).

### 🔲 Salvar rastreio não atualiza status do pedido nem notifica a cliente
- **Arquivo:** `src/app/api/revendedora/pedidos/[id]/rastreio/route.ts:50-59; src/app/vendas/page.tsx:81-107` · tipo: melhoria · esforço: medio · sub: dashboard
- **Fix:** Ao salvar rastreio válido pela primeira vez, transicionar 'pago'→'enviado' (respeitando o trigger) e disparar email/notificação best-effort à cliente. Refletir no state de /vendas.

### 🔲 Dispensar pedido não cancela a ordem PIX no Pagar.me — cliente ainda pode pagar pedido 'cancelado'
- **Arquivo:** `src/app/api/revendedora/pedidos/[id]/dispensar/route.ts:51-59` · tipo: bug · esforço: medio · sub: apis-rev
- **Fix:** No dispensar, se o pedido tiver pagarme_order_id/pagbank_link, cancelar/fechar a order no Pagar.me (best-effort try/catch) antes de marcar cancelado. E no webhook, ao receber pago com status atual 'cancelado', logar/alertar admin em vez de reabrir silenciosamente (ex: notificação interna pra Gabriela).

### 🔲 GET /api/pedidos/[id] devolve PII completa do comprador sem autenticação
- **Arquivo:** `src/app/api/pedidos/[id]/route.ts:19-50` · tipo: seguranca · esforço: baixo · sub: apis-rev
- **Fix:** Retornar apenas o mínimo que a tela de confirmação usa (numero_pedido, status, itens, subtotal, frete, total, primeiro nome, dados públicos da revendedora). Remover email/telefone/endereço completo da resposta pública e expor o detalhe só nas rotas autenticadas (revendedora dona ou admin).

### 🔲 Email de confirmação ao cliente é enviado mesmo quando o link de pagamento falhou — sem como pagar
- **Arquivo:** `src/app/api/pedidos/route.ts:298-400` · tipo: ux · esforço: medio · sub: apis-rev
- **Fix:** Se o link falhar, comunicar fallback explícito de pagamento (instrução por WhatsApp) no email, ou marcar o pedido com flag pagamento_pendente_link e expor botão 'gerar pagamento' na página de aguardando. Idealmente tentar Pagar.me e PagBank em cascata antes de desistir.

### 🔲 Notificação e emails da revendedora dentro do mesmo try do email do cliente — uma falha engole as outras
- **Arquivo:** `src/app/api/pedidos/route.ts:263-429` · tipo: bug · esforço: baixo · sub: apis-rev
- **Fix:** Separar cada efeito best-effort no seu próprio try/catch (ou Promise.allSettled). A notificação interna (insert em notificacoes) deveria rodar antes e independente dos emails.

### 🔲 Pedido enviado (código de rastreio) não muda status nem notifica revendedora/cliente
- **Arquivo:** `src/app/api/revendedora/pedidos/[id]/rastreio/route.ts:50-59` · tipo: melhoria · esforço: baixo · sub: apis-rev
- **Fix:** Ao salvar um código não-vazio, transicionar o pedido para 'enviado' e chamar emailsAoMudarStatus(supabase, pedido, 'enviado') (que já existe e dispara email ao cliente + notificação no painel). Idealmente incluir o código de rastreio + link Correios no email. Limpar o código pode voltar para 'pago'.

### 🔲 Item de ajuste com amount negativo é rejeitado pelo Pagar.me e derruba o PIX
- **Arquivo:** `src/lib/pagarme.ts:131-142` · tipo: bug · esforço: medio · sub: pagamentos
- **Fix:** Tratar diff<0 sem gerar amount<=0: reduzir o unitário do item de maior amount recalculando para caber, garantindo somaItens === totalCent e nenhum item final <=0. Adicionar teste com itens que somem acima do total.

### 🔲 Webhook Pagar.me e PagBank não tratam estorno/chargeback — só pagamento
- **Arquivo:** `src/app/api/webhook/pagarme/route.ts:72-77` · tipo: dados · esforço: alto · sub: pagamentos
- **Fix:** Adicionar branches para charge.refunded/order.canceled/chargeback que movam o pedido para status terminal (ex: 'estornado') e revertam comissão/saldo via RPC idempotente. Mesmo cuidado no PagBank.

### 🔲 Split em paymentlink só aplica para cartão — PIX/débito do link vão 100% para a conta mãe
- **Arquivo:** `src/lib/pagarme.ts:326-359` · tipo: dados · esforço: medio · sub: pagamentos
- **Fix:** Remover 'pix' e 'debit_card' de accepted_payment_methods no paymentlink (forçando PIX pelo fluxo /orders que tem split via criarPixPagarme), ou migrar o checkout para POST /v5/orders.

### 🔲 Match de pedido pago (estratégia 3) no webhook InfinitePay usa só numero_pedido sem validar valor
- **Arquivo:** `src/app/api/webhook/infinitepay/route.ts:227-246` · tipo: seguranca · esforço: medio · sub: pagamentos
- **Fix:** Validar (paid_amount/100) >= pedido.total (tolerância de centavos) antes de marcar pago; tornar o token obrigatório; idealmente confirmar via verificarPagamentoInfinitePay().

### 🔲 Login cria perfil 'pendente' mesmo após pagamento, mascarando ativação e empurrando pra configurar-loja
- **Arquivo:** `src/app/auth/login/page.tsx:73-141` · tipo: bug · esforço: medio · sub: auth
- **Fix:** Trocar .single() por .maybeSingle(). Ler a resposta de confirmar-pagamento; se ativada, reconsultar status antes de rotear. Não criar perfil no login — em vez disso, se !rev mas signIn deu certo, vincular user_id via rota server (a tabela pode ter linha criada por service_role sem user_id) e reconsultar; nunca inserir 'pendente' tosco que colide com o índice único.

### 🔲 confirmar-pagamento é público e sem rate-limit: oráculo + força bruta de ativação
- **Arquivo:** `src/app/api/auth/confirmar-pagamento/route.ts:25-73` · tipo: seguranca · esforço: medio · sub: auth
- **Fix:** Rate-limit por IP+email. Padronizar respostas pra não distinguir 404/402 (mensagem genérica). Idealmente exigir sessão Supabase do próprio email (Authorization Bearer validado server-side) já que esse fluxo só é chamado de usuário logado no login.tsx.

### 🔲 POST /api/revendedoras grava lead pendente sem auth, sem captcha e sem rate-limit
- **Arquivo:** `src/app/api/revendedoras/route.ts:6-63` · tipo: seguranca · esforço: medio · sub: auth
- **Fix:** Rate-limit por IP + honeypot/captcha leve. Avaliar se este endpoint legado ainda é usado (o fluxo real virou register/landing com signUp+insert client-side); se não, remover. Instanciar supabaseAdmin() dentro do handler. Se mantido, setar user_id de algum modo ou marcar a origem.

### 🔲 Race no signUp client-side: usuário auth criado mas insert de perfil pode falhar, deixando órfão
- **Arquivo:** `src/app/auth/register/page.tsx:101-201, src/app/landing/page.tsx:205-267` · tipo: bug · esforço: alto · sub: auth
- **Fix:** Mover signUp+insert pra UMA rota server (GoTrue admin cria auth + insert; se insert falhar, deletar o auth user). No mínimo, tratar o insert-fail no client instruindo suporte/esqueci-senha e fazer status-email reconhecer auth-sem-perfil.

### 🔲 Redirect com setTimeout 2500ms para /auth/login?paid=1 perde os params reais do InfinitePay
- **Arquivo:** `src/app/auth/register/page.tsx:255-257,333-336` · tipo: bug · esforço: medio · sub: auth
- **Fix:** Não exibir 'Pagamento recebido!' só por ?paid=1 (texto deve ser 'assim que confirmarmos, sua loja ativa'). Garantir que o caminho com os params reais (a aba do redirect InfinitePay) seja onde confirmar-pagamento roda; o setTimeout artificial na aba errada não tem como carregar os params.

### 🔲 Saldo da revendedora atualizado com read-modify-write não-atômico (saque recusado e débito de mensalidade)
- **Arquivo:** `src/app/api/admin/saques/[id]/route.ts:48-58 e src/app/api/admin/mensalidades/[id]/route.ts:51-60` · tipo: dados · esforço: medio · sub: admin
- **Fix:** Criar RPC SQL atômico: `UPDATE revendedoras SET saldo_disponivel = saldo_disponivel + $valor WHERE id=$id` (com guarda `AND saldo_disponivel >= $valor` pro débito) e chamar via supabase.rpc(). Não recalcular em JS a partir de leitura anterior.

### 🔲 Email de 'pedido enviado' não inclui código de rastreio e é enviado ANTES do código ser salvo
- **Arquivo:** `src/app/api/admin/pedidos/[id]/route.ts:147,191-204 e src/lib/emailTemplates.ts:452-478` · tipo: ux · esforço: medio · sub: admin
- **Fix:** Gravar codigo_rastreio ANTES de chamar emailsAoMudarStatus, passar o código pro template e renderizar link https://rastreamento.correios.com.br/app/index.php?objeto=CODIGO. Opcional: bloquear/avisar transição pra 'enviado' sem código.

### 🔲 GET /api/admin/revendedoras retorna SELECT * incluindo KYC completo (CPF, conta bancária, nome da mãe) pro client
- **Arquivo:** `src/app/api/admin/revendedoras/route.ts:13-16` · tipo: seguranca · esforço: baixo · sub: admin
- **Fix:** Trocar select('*') por lista explícita de colunas da tela (nome, email, status, saldos, subdominio, datas). Nunca retornar pagarme_recipient_data em listagem; KYC só em endpoint dedicado e mascarado.

### 🔲 GET /api/admin/inspect-order devolve order RAW da Pagar.me com PII do cliente sem mascarar
- **Arquivo:** `src/app/api/admin/inspect-order/route.ts:19-26` · tipo: seguranca · esforço: baixo · sub: admin
- **Fix:** Mascarar document/CPF e dados de cartão antes de retornar, ou restringir a campos específicos. Reutilizar a função mask() do recebedor-test.

### 🔲 Sem rate-limit no login admin — débito conhecido, agravado por PINs curtos
- **Arquivo:** `src/app/api/admin/login/route.ts:14-21` · tipo: seguranca · esforço: medio · sub: admin
- **Fix:** Rate-limit por IP (Upstash/Redis ou tabela com janela deslizante), bloqueio após N tentativas com backoff, logar falhas no audit_log, exigir PINs longos/alfanuméricos.

### 🔲 Mensagem diária pode duplicar e-mail pra todas as revendedoras se o cron rodar 2x
- **Arquivo:** `src/app/api/cron/mensagem-diaria/route.ts:47-60` · tipo: bug · esforço: medio · sub: integracoes
- **Fix:** Adicionar flag idempotente por dia (coluna mensagem_diaria_enviada_em date filtrada com .neq na query, atualizada após envio OK) OU gravar chave 'mensagem_diaria_<YYYY-MM-DD>' em sync_estado e retornar early se já existir. Paralelizar em lotes pequenos pra não estourar 60s conforme a base cresce.

### 🔲 Frete cobrado pode divergir do exibido quando só um serviço Correios responde
- **Arquivo:** `src/lib/frete.ts:191-200` · tipo: dados · esforço: medio · sub: integracoes
- **Fix:** Se servicoEscolhido não estiver nas opções recalculadas, não cair em opcoes[0] silenciosamente: retornar erro distinto e fazer /api/pedidos responder 409 pedindo reescolha do frete com valores atuais. No mínimo logar a divergência e devolver o serviço real cobrado pro client confirmar.

### 🔲 backfillDescricoes faz N requests sequenciais à Tray dentro do mesmo request do sync — risco de timeout e sync 'meio feito'
- **Arquivo:** `src/lib/traySync.ts:224-263, src/app/api/cron/tray-sync/route.ts:6` · tipo: performance · esforço: medio · sub: integracoes
- **Fix:** Mover o update de sync_estado pra logo após o loop de upsert (gravar estado ANTES do backfill best-effort). Paralelizar com concorrência limitada usando BACKFILL_CONCURRENCY já declarado. Idealmente backfill vira cron próprio.

### 🔲 buscarTodos engole erros de página silenciosamente — sync parcial é gravado como sucesso
- **Arquivo:** `src/lib/traySync.ts:109-119` · tipo: risco · esforço: baixo · sub: integracoes
- **Fix:** Contar páginas falhadas e marcar o sync como degradado se faltou mais que X% das páginas ou se prods.length ficar muito abaixo de `total`. Logar cada página que falhou em vez de catch vazio. Gravar paginas_falhadas em sync_estado pra visibilidade.

### 🔲 Cron de mensalidades pode reenviar notificação de aviso/vencimento se rodar 2x no mesmo dia
- **Arquivo:** `src/app/api/cron/mensalidades/route.ts:53-81` · tipo: bug · esforço: baixo · sub: integracoes
- **Fix:** Antes de inserir, checar se já existe notificação com mesmo titulo/tipo pra a revendedora criada hoje, ou usar colunas aviso_5d_enviado_em/aviso_0d_enviado_em como flag idempotente (mesmo padrão lembrete_24h_enviado_em).

### 🔲 Cálculo de 'dias até vencer' depende do timezone do runtime — risco de suspender loja 1 dia cedo/tarde
- **Arquivo:** `src/app/api/cron/mensalidades/route.ts:27-51` · tipo: bug · esforço: medio · sub: integracoes
- **Fix:** Comparar datas em America/Sao_Paulo explicitamente, ou comparar apenas YYYY-MM-DD puro dos dois lados sem horário local. Documentar a premissa de fuso e testar com vencimento=hoje e=ontem perto da virada.

### 🔲 disponivelDe trata available ausente como indisponível mas available_for_purchase ausente como disponível — assimetria que some com produto
- **Arquivo:** `src/lib/traySync.ts:41-46` · tipo: dados · esforço: baixo · sub: integracoes
- **Fix:** Definir a política explicitamente (ex `String(p.available ?? '1') === '1'` se ausente=disponível) e documentar. Logar quantos produtos viraram ativo=false em cada sync pra detectar quedas anômalas.

### 🔲 Prazos de entrega são fixos nacionais (PAC 4d / SEDEX 1d) e ignoram o prazoEntrega real dos Correios
- **Arquivo:** `src/lib/frete.ts:131-134, 158-166` · tipo: ux · esforço: medio · sub: integracoes
- **Fix:** Usar o prazoEntrega real (já buscado) como base e, se quiser suavizar, aplicar piso comercial por região em vez de número único nacional. Aumentar o teto pra regiões distantes e exibir faixa min-max honesta.

### 🔲 Saque: insere row antes de debitar saldo; crash entre as duas operações deixa saque órfão sem débito
- **Arquivo:** `src/app/api/revendedora/saque/route.ts:47-89` · tipo: dados · esforço: medio · sub: notificacoes
- **Fix:** Unificar criação do saque + débito de saldo numa única RPC plpgsql transacional que valida, debita e insere atomicamente, retornando o id. Ou: debitar PRIMEIRO (com guarda de saldo) e só inserir o saque depois — assim um crash deixa, no pior caso, saldo debitado sem saque (recuperável), em vez de saque pagável sem débito.

### 🔲 Dedup de mensalidade depende de transaction_nsu que pode vir nulo — pagamento duplicado escapa do guard
- **Arquivo:** `supabase/mensalidade_auto_ativacao.sql:70-81 + src/app/api/webhook/infinitepay/route.ts:106-111` · tipo: bug · esforço: baixo · sub: db-seguranca
- **Fix:** Usar coalesce(transaction_nsu, order_nsu, invoice_slug) como p_provider_tx no webhook e tratar provider_tx nulo como no-op/erro na RPC em vez de bypass. Conferir nos payloads reais qual campo é garantido único.

### 🔲 Crons aceitam header x-vercel-cron spoofável como autenticação
- **Arquivo:** `src/app/api/cron/mensalidades/route.ts:19 (idem lembretes-cadastro, mensagem-diaria, tray-sync)` · tipo: seguranca · esforço: baixo · sub: db-seguranca
- **Fix:** Remover a aceitação do header x-vercel-cron como prova isolada e exigir CRON_SECRET (Vercel Cron permite configurar Authorization: Bearer). Manter checkAdminAuth pro disparo manual.

### 🔲 GET /api/pedidos/[id] devolve dados pessoais completos do comprador sem token de posse
- **Arquivo:** `src/app/api/pedidos/[id]/route.ts:19-50` · tipo: seguranca · esforço: baixo · sub: db-seguranca
- **Fix:** Minimizar o payload público pra numero_pedido, status, total, itens e dados da revendedora. Remover/mascarar endereco_*, cliente_telefone, cliente_email. Garantir Referrer-Policy: no-referrer na página de confirmação.


## ⚪ BAIXO (40)

### 🔲 /api/produtos/[id] usa select('*') e expõe descrição crua do fornecedor (sem scrub server-side)
- **Arquivo:** `src/app/api/produtos/[id]/route.ts:12-26` · tipo: seguranca · esforço: baixo · sub: storefront
- **Fix:** Trocar por select explícito dos campos necessários e aplicar scrub no server antes de devolver a descricao.

### 🔲 Pré-seleção de frete pode ficar em SEDEX caro após recálculo sem o cliente perceber
- **Arquivo:** `src/app/checkout/page.tsx:282-286` · tipo: ux · esforço: baixo · sub: storefront
- **Fix:** Avisar sutilmente quando o valor da opção selecionada mudar após recálculo, ou re-destacar PAC.

### 🔲 Interpolação de busca sem escape em ilike — caracteres % e _ alteram a busca
- **Arquivo:** `src/app/api/produtos/route.ts:43-45` · tipo: bug · esforço: baixo · sub: storefront
- **Fix:** Escapar curingas: busca.replace(/[\\%_]/g, c => '\\'+c) antes de montar o padrão. Opcionalmente limitar tamanho.

### 🔲 Segundo SELECT de toda a tabela em cada request pra montar a árvore de categorias
- **Arquivo:** `src/app/api/produtos/route.ts:59-87` · tipo: performance · esforço: medio · sub: storefront
- **Fix:** Cachear a árvore (unstable_cache com revalidate de minutos, ou tabela/materialized view atualizada no sync da Tray). Ou só montar a árvore quando não há filtro.

### 🔲 Tabela 'visitas' não está versionada nas migrations — falha de insert silenciosa quebra métrica invisivelmente
- **Arquivo:** `src/app/api/loja/[slug]/route.ts:50-61` · tipo: risco · esforço: baixo · sub: storefront
- **Fix:** Versionar a migration de 'visitas' em supabase/ e garantir tamanho de pagina suficiente. Considerar alerta quando a taxa de falha de insert subir.

### 🔲 Checkout: erro de frete indistinguível de 'preencha o CEP' quando o fetch falha
- **Arquivo:** `src/app/checkout/page.tsx:270-291, 719-723` · tipo: ux · esforço: baixo · sub: storefront
- **Fix:** Diferenciar: com CEP(8)+UF(2) válidos e fetch falho, mostrar 'Não conseguimos calcular o frete agora, tente novamente' com retry, em vez de 'preencha o CEP'.

### 🔲 Modal de saque pré-preenche valor e permite valores < R$1 / saque de saldo inteiro sem mínimo no server
- **Arquivo:** `src/components/dashboard/ModalSaque.tsx:19,35-39; src/app/api/revendedora/saque/route.ts:37-39` · tipo: ux · esforço: baixo · sub: dashboard
- **Fix:** Definir e validar mínimo de saque no server (ex: R$20) e refletir no client.

### 🔲 Botão 'Crédito loja' no card de saldo abre o modal mas o fluxo só funciona via WhatsApp manual
- **Arquivo:** `src/app/dashboard/page.tsx:396-411; src/components/dashboard/ModalSaque.tsx:30-33` · tipo: ux · esforço: baixo · sub: dashboard
- **Fix:** Passar prop `tipoInicial` ao ModalSaque conforme o botão. Para crédito, registrar solicitação que debite/reserve o saldo ao ser aprovada.

### 🔲 Notificação 'novo cadastro/pendente' e banners de pagamento não se limpam ao ativar; status só atualiza por polling
- **Arquivo:** `src/app/dashboard/page.tsx:81-88,587-609` · tipo: ux · esforço: baixo · sub: dashboard
- **Fix:** Ao detectar status='ativa', marcar como lidas notificações de 'cadastro_pendente'/'mensalidade' obsoletas, ou filtrá-las no carregamento. Idealmente o webhook que ativa já marca como lidas.

### 🔲 Auto-save do rascunho do recebedor faz POST a cada mudança sem tratar erro nem 401
- **Arquivo:** `src/app/perfil/recebedor/page.tsx:129-147` · tipo: bug · esforço: baixo · sub: dashboard
- **Fix:** Checar `res.ok`; em 401 redirecionar para login; em erro mostrar aviso discreto. Cancelar request anterior com AbortController.

### 🔲 Listagem de pedidos é N+1-resistente mas sem paginação — limite fixo de 200 esconde vendas antigas
- **Arquivo:** `src/app/api/revendedora/pedidos/route.ts:23; src/app/api/revendedora/financeiro/route.ts:66` · tipo: performance · esforço: medio · sub: dashboard
- **Fix:** Paginar /pedidos (cursor por created_at) e calcular totais no server sobre TODAS as comissões/pedidos. Adicionar índices em pedidos(slug_revendedora, created_at) e comissoes(slug_revendedora).

### 🔲 dispensar/route usa .single() em vez de .maybeSingle() — pode lançar e retornar 500 em vez de 404
- **Arquivo:** `src/app/api/revendedora/pedidos/[id]/dispensar/route.ts:35-43` · tipo: bug · esforço: baixo · sub: dashboard
- **Fix:** Trocar `.single()` por `.maybeSingle()` para alinhar com rastreio/route.ts e garantir 404 limpo.

### 🔲 Total ganho/vendas do perfil vem de colunas legadas (total_vendas/total_ganho) possivelmente dessincronizadas das comissões
- **Arquivo:** `src/app/perfil/page.tsx:299-301` · tipo: dados · esforço: baixo · sub: dashboard
- **Fix:** Unificar a fonte: alimentar total_vendas/total_ganho via trigger, ou no perfil consumir os totais derivados de comissões (getFinanceiro).

### 🔲 Frete pode mudar de valor entre o checkout e o insert do pedido (recálculo sem travar o quote)
- **Arquivo:** `src/app/api/pedidos/route.ts:204-215` · tipo: dados · esforço: medio · sub: apis-rev
- **Fix:** Persistir/repassar do client o frete exibido (com o servico explícito) e validar que o recálculo bate dentro de tolerância (ex.: ±R$1); se divergir, retornar 409 pedindo recarregar o frete em vez de cobrar outro valor silenciosamente.

### 🔲 Notificação de 'novo pedido' criada antes do pagamento confirmado — revendedora acha que vendeu
- **Arquivo:** `src/app/api/pedidos/route.ts:409-414` · tipo: ux · esforço: baixo · sub: apis-rev
- **Fix:** Suavizar o texto da notificação de criação para 'checkout iniciado / aguardando pagamento' (sem 'parabéns/faturar'), reservando a celebração para a notificação de pagamento confirmado (que já existe no webhook).

### 🔲 Estorno de comissão usa greatest(...,0) e mascara saldo que já foi sacado
- **Arquivo:** `supabase/comissoes_saldo.sql:46-50` · tipo: dados · esforço: medio · sub: apis-rev
- **Fix:** Para o caso residual (estorno após 20d com saldo já sacado), permitir saldo negativo ou registrar um ajuste/dívida pendente em vez de greatest()->0, e alertar o admin. Baixa prioridade dado que a carência de 20d já é a defesa principal.

### 🔲 total_vendas/total_ganho da revendedora nunca são atualizados em uma venda paga
- **Arquivo:** `src/lib/revendedoraAuth.ts:80-81 (lidas) — sem writer em supabase/ nem webhook` · tipo: dados · esforço: baixo · sub: apis-rev
- **Fix:** Incrementar total_vendas (+1) e total_ganho (+valor_comissao) no trigger de 'pago' (pedidos_apos_mudanca_status), ou parar de expor essas colunas e derivar os números de comissoes/pedidos para ter fonte única.

### 🔲 KYC reprovado deixa comissão silenciosamente em 0 (cai pra conta mãe) sem feedback acionável
- **Arquivo:** `src/app/api/pedidos/route.ts:327-357 + src/app/api/revendedora/recebedor/route.ts:177-183` · tipo: ux · esforço: medio · sub: apis-rev
- **Fix:** Expor no painel da revendedora o status real do recipient com o motivo da pendência de KYC de forma acionável, e notificar (sino/email) quando uma venda for paga mas o recipient não estiver 'active', para ela corrigir o cadastro. Reconciliar também o crédito de saldo interno com o split real para não mostrar saldo que não foi recebido.

### 🔲 Notificação in-app de cadastro/ativação não é limpa nem deduplicada
- **Arquivo:** `src/app/api/webhook/infinitepay/route.ts:120-148` · tipo: ux · esforço: medio · sub: pagamentos
- **Fix:** Garantir que provider_tx nunca seja null na chave de dedup (fallback order_nsu+amount). Ao ativar, limpar a notificação admin de 'novo cadastro pendente'. Considerar índice/checagem de existência antes do insert de notificação.

### 🔲 Revendedora não é notificada no painel quando pedido é pago
- **Arquivo:** `src/app/api/webhook/pagarme/route.ts:79-91` · tipo: melhoria · esforço: baixo · sub: pagamentos
- **Fix:** No branch de pagamento aprovado, inserir notificacao 'tipo: venda' para a revendedora (best-effort, try/catch).

### 🔲 holder_name truncado em 30 chars pode não bater com titular da conta
- **Arquivo:** `src/lib/pagarmeRecipient.ts:18-23,186` · tipo: risco · esforço: baixo · sub: pagamentos
- **Fix:** Preferir nome + último sobrenome ao invés de cortar no fim; endpoint de diagnóstico admin mostrando o holder_name efetivo; alertar no cadastro quando nome > 30 chars.

### 🔲 normalizarStatus mapeia 'registration'/'refused' sem sinalizar pendência ao painel
- **Arquivo:** `src/lib/pagarmeRecipient.ts:97-102` · tipo: ux · esforço: medio · sub: pagamentos
- **Fix:** Mostrar no painel aviso quando recipient_status != 'active'; tratar recipient.updated no webhook (já existe) para notificar quando virar active; considerar reter/registrar a comissão devida em vez de perdê-la para a conta mãe.

### 🔲 Escritas em revendedoras feitas com anon key client-side — depende inteiramente de RLS não versionada
- **Arquivo:** `src/app/auth/register/page.tsx:156-169, src/app/auth/login/page.tsx:96-113, src/app/landing/page.tsx:249-256` · tipo: seguranca · esforço: baixo · sub: auth
- **Fix:** O risco principal foi descartado pela verificação. Recomendações remanescentes (menores): (1) VERSIONAR a policy 'revendedora_own' em supabase/revendedoras_rls.sql — hoje ela existe só no banco, não no repo, então um restore/recriação de ambiente perde a proteção (débito real); (2) trocar o update de user_id por filtro em id em vez de email (clareza); (3) considerar mover escritas de campos financeiros (saldo, recipient) pra rotas server, embora a RLS já os proteja.

### 🔲 Redirect para /dashboard após reset de senha sem garantir status ativo nem onboarding
- **Arquivo:** `src/app/auth/redefinir-senha/page.tsx:60-68` · tipo: ux · esforço: baixo · sub: auth
- **Fix:** Após salvar a senha, reaproveitar a lógica de roteamento pós-auth do login (checar status e naoPersonalizou) numa função compartilhada, ou redirecionar pra /auth/login deixando ele decidir.

### 🔲 Notificação 'revendedora pendente logou' nunca é limpa nem reconciliada quando a loja ativa
- **Arquivo:** `src/app/api/auth/pendente-logou/route.ts:43-66` · tipo: melhoria · esforço: medio · sub: auth
- **Fix:** Persistir o throttle/estado em revendedoras (ex.: ultima_notif_pendente_em) em vez de memória. Trocar email por item no painel admin que some quando status='ativa'. A checagem status!=='pendente' já evita notificar contas ativas, então o problema central é duplicação por instância + falta de fechamento de loop.

### 🔲 ilike('email', x).single() pode lançar/duplicar; deveria ser match exato + maybeSingle
- **Arquivo:** `src/app/api/auth/criar-pagamento-cadastro/route.ts:29-33, status-email/route.ts:28-32, welcome-email/route.ts:29-33, src/app/api/revendedoras/route.ts:19-23` · tipo: risco · esforço: baixo · sub: auth
- **Fix:** Trocar .ilike('email', x) por .eq('email', x) em todas as rotas de lookup (o email é gravado lowercase no insert), eliminando o edge case de curinga e usando o índice. Manter maybeSingle.

### 🔲 register dispara welcome-email mas landing não — inconsistência de onboarding
- **Arquivo:** `src/app/landing/page.tsx:268-272 vs src/app/auth/register/page.tsx:205-209` · tipo: ux · esforço: baixo · sub: auth
- **Fix:** Extrair signUp+insert+welcome-email pra função/hook compartilhado usado por register e landing. No mínimo, adicionar o fetch de welcome-email no sucesso da landing.

### 🔲 validatePin compara PIN com === (não constant-time) e sem rate-limit no login admin
- **Arquivo:** `src/lib/adminAuth.ts:32-45` · tipo: seguranca · esforço: medio · sub: auth
- **Fix:** Rate-limit por IP no /admin/login e nas rotas que aceitam Bearer (controle principal). Comparação constant-time (crypto.timingSafeEqual em buffers de mesmo tamanho). PINs longos/aleatórios mitigam o timing.

### 🔲 Páginas /admin/* não têm guarda de auth server-side (layout não verifica sessão)
- **Arquivo:** `src/app/admin/layout.tsx:67-76, src/app/admin/page.tsx:74-90 e src/middleware.ts:25-35` · tipo: seguranca · esforço: medio · sub: admin
- **Fix:** Verificar sessão no layout server-side (ler cookie assinado via cookies()) e redirecionar pra /admin/login se ausente/inválido — gate central, não dependente de cada página.

### 🔲 comissoes-orfas POST reporta 'canceladas' contando ids que o filtro .neq('status','paga') pode ter pulado
- **Arquivo:** `src/app/api/admin/comissoes-orfas/route.ts:85-99` · tipo: bug · esforço: baixo · sub: admin
- **Fix:** Adicionar .select() ao update e reportar data.length real; ou re-listar após o update. Mostrar separadamente quantas foram puladas por estarem pagas.

### 🔲 Limpar/atualizar a notificação de 'novo cadastro pendente' quando a loja já está ativa
- **Arquivo:** `src/app/api/admin/pendentes/route.ts:14-19 e src/app/api/admin/ativar-revendedora/route.ts` · tipo: melhoria · esforço: medio · sub: admin
- **Fix:** No painel de pendentes, indicar 'tem pagamento de cadastro registrado mas ainda pendente' cruzando com mensalidades_pagamentos/webhook, pra a admin ver casos travados. Opcional: alerta automático.

### 🔲 debug-email POST é um relay de email aberto pelo domínio verificado (sob auth)
- **Arquivo:** `src/app/api/admin/debug-email/route.ts:27-50` · tipo: seguranca · esforço: baixo · sub: admin
- **Fix:** Remover de produção ou restringir 'to' a allowlist (@lojadeprata925.com.br) e fixar o corpo. Idealmente só pro papel master.

### 🔲 Comentário de precedência de categoria contradiz o código (slug vs category_id)
- **Arquivo:** `src/lib/traySync.ts:1-9 vs 86-93` · tipo: melhoria · esforço: baixo · sub: integracoes
- **Fix:** Corrigir o cabeçalho pra refletir que a categoria é derivada PRIMARIAMENTE do slug (path pai/sub) e só cai em category_id como fallback, alinhando com o pitfall do CLAUDE.md.

### 🔲 Token Correios cacheado em var de módulo sem singleflight — rajada de re-auth sob carga pode bloquear o cartão
- **Arquivo:** `src/lib/correios.ts:83-121` · tipo: performance · esforço: baixo · sub: integracoes
- **Fix:** Cachear a Promise de auth (singleflight): se já há auth em voo, chamadas concorrentes aguardam a mesma Promise.

### 🔲 Falha persistente do link InfinitePay no lembrete de cadastro perde a conversão silenciosamente
- **Arquivo:** `src/app/api/cron/lembretes-cadastro/route.ts:61-83` · tipo: risco · esforço: baixo · sub: integracoes
- **Fix:** Quando linkRes for null pra várias candidatas, logar/alertar (sinal de config quebrada). Considerar fallback de e-mail com instrução de pagamento que não dependa 100% do link dinâmico.

### 🔲 Revendedora/cliente não são notificadas quando o pedido é enviado (sem rastreio) — gap de operação
- **Arquivo:** `src/app/api/revendedora/pedidos/[id]/rastreio/route.ts` · tipo: melhoria · esforço: medio · sub: integracoes
- **Fix:** Ao gravar codigo_rastreio no PATCH (ou ao marcar enviado), inserir notificacao pra revendedora e disparar e-mail pra cliente com código + link de rastreio. Reaproveita email.ts/emailTemplates e a tabela notificacoes.

### 🔲 MONITOR_EMAIL_BCC com Gmail pessoal hardcoded copia comunicações de cliente por padrão (PII/LGPD)
- **Arquivo:** `src/lib/email.ts:21-24, 69-75` · tipo: seguranca · esforço: baixo · sub: integracoes
- **Fix:** Considerar exigir a env MONITOR_EMAIL_BCC explicitamente (sem default hardcoded) e desligar se ausente, documentar a finalidade e garantir que templates com CPF não copiem o BCC. Decisão da dona do negócio, não urgente.

### 🔲 comissoes-orfas: resposta reporta 'canceladas' a mais (inclui as 'paga' que foram puladas)
- **Arquivo:** `src/app/api/admin/comissoes-orfas/route.ts:84-98` · tipo: bug · esforço: baixo · sub: notificacoes
- **Fix:** Usar .select('id') no update e reportar data.length como canceladas; filtrar detalhes pelas que de fato mudaram (status != 'paga').

### 🔲 Admin pedidos: query sem limite para montar o filtro de revendedoras (full scan que cresce sem teto) + select('*') com PII
- **Arquivo:** `src/app/api/admin/pedidos/route.ts:28,116-119` · tipo: performance · esforço: medio · sub: notificacoes
- **Fix:** Derivar a lista de revendedoras do catálogo de revendedoras ativas (ou view/RPC com distinct) em vez de varrer pedidos. No select principal, restringir colunas (sem CPF/endereço completos) e expor PII só no GET de detalhe.

### 🔲 tipo de notificação 'sucesso' (e 'pedido') fora da union de tipos declarada — type drift
- **Arquivo:** `src/lib/supabase.ts:88 + src/app/api/admin/ativar-revendedora/route.ts:51 + src/app/api/webhook/infinitepay/route.ts:129` · tipo: melhoria · esforço: baixo · sub: notificacoes
- **Fix:** Atualizar a union pra incluir 'sucesso' e 'pedido' (ou padronizar os inserts). Centralizar os tipos válidos numa constante e tipar os inserts.
