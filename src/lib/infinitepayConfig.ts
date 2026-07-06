// Liga/desliga o link de pagamento DINÂMICO (order_nsu=cad_<id>), que ativa
// a loja sozinho pelo webhook.
//
// DESLIGADO temporariamente (16/06/2026): o InfinitePay confirmou uma FALHA
// TÉCNICA no checkout via API — o pagamento dá "Algo deu errado" em todos os
// métodos (Pix, cartão, Apple Pay), apesar da criação do link funcionar. O
// link ESTÁTICO do painel funciona, então usamos ele enquanto o time técnico
// do InfinitePay investiga. Nesse modo a ativação volta a ser manual.
//
// Quando o InfinitePay corrigir: voltar pra `true` e redeployar. Toda a
// infra de auto-ativação (webhook + RPC) já está pronta e volta a funcionar.
export const INFINITEPAY_LINK_DINAMICO = false
