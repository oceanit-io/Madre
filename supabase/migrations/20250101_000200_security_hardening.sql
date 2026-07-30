-- ============================================================
-- HARDENING DE SEGURANÇA — aplicar UMA vez.
-- Aborda achados CR-03, CR-04 e DB-01 do relatório.
--
-- 1) Funções SECURITY DEFINER: revogar EXECUTE de anon/authenticated.
--    São triggers ou funções server-side. Cliente não tem motivo pra
--    chamar direto. Revogar fecha um vetor de privilege escalation.
-- 2) Pedidos: remover policy anon_insert_pedidos com WITH CHECK true.
--    O POST /api/pedidos usa supabaseAdmin() (service_role), que
--    bypassa RLS — então a policy anon não é necessária e abre
--    brecha pra INSERT direto via PostgREST.
-- 3) Produtos: RLS estava habilitado SEM nenhuma policy → ninguém
--    lê via anon. Adicionamos policy de SELECT pública APENAS pra
--    produtos ativos com estoque > 0. Não permite UPDATE/DELETE/INSERT
--    (esses ficam restritos a service_role).
-- ============================================================

-- ----- 1. Revoke EXECUTE em funções SECURITY DEFINER --------------
revoke execute on function public.comissoes_sincronizar_saldo() from anon, authenticated;
revoke execute on function public.liberar_comissoes_maduras() from anon, authenticated;
revoke execute on function public.pedidos_apos_mudanca_status() from anon, authenticated;

-- ----- 2. Remove INSERT anônimo amplo em pedidos -----------------
-- A criação de pedido passa por /api/pedidos com supabaseAdmin (service_role),
-- que ignora RLS. Esta policy estava aberta como WITH CHECK true.
drop policy if exists anon_insert_pedidos on public.pedidos;

-- ----- 3. Policy SELECT pública de produtos (DB-01) --------------
-- Permite leitura pública APENAS de produtos ativos com estoque > 0.
-- Sem WITH CHECK (RLS for SELECT não usa with_check).
--
-- Nota: nos bancos legados, RLS já estava habilitado em produtos
-- (habilitação manual via dashboard antes deste migration). Em bancos
-- novos, precisa ligar aqui pra que a policy tenha efeito prático —
-- policy sem RLS ligado é ignorada pelo Postgres.
alter table public.produtos enable row level security;

drop policy if exists "public_select_produtos_ativos" on public.produtos;
create policy "public_select_produtos_ativos"
  on public.produtos
  for select
  to anon, authenticated
  using (ativo = true and estoque > 0);

-- ----- Verificação --------------------------------------------------
select 'fn_anon_exec_revoked' as check_,
  bool_and(not has_function_privilege('anon', oid, 'execute')) as ok
from pg_proc
where proname in ('comissoes_sincronizar_saldo','liberar_comissoes_maduras','pedidos_apos_mudanca_status')
union all
select 'anon_insert_pedidos_gone',
  not exists (select 1 from pg_policy p join pg_class c on c.oid = p.polrelid where c.relname='pedidos' and p.polname='anon_insert_pedidos')
union all
select 'public_select_produtos_exists',
  exists (select 1 from pg_policy p join pg_class c on c.oid = p.polrelid where c.relname='produtos' and p.polname='public_select_produtos_ativos');

-- ============================================================
-- AMENDMENT: Postgres concede EXECUTE pra role PUBLIC por default,
-- então o revoke acima precisa cobrir PUBLIC. Aplicado depois.
-- ============================================================
revoke execute on function public.comissoes_sincronizar_saldo() from public;
revoke execute on function public.liberar_comissoes_maduras() from public;
revoke execute on function public.pedidos_apos_mudanca_status() from public;
