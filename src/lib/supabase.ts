import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // Fluxo IMPLÍCITO (token no hash da URL) em vez de PKCE.
      // Motivo: o PKCE precisa do code_verifier guardado no MESMO navegador
      // que pediu o reset. Como as revendedoras abrem o e-mail no app do
      // Gmail/Instagram (navegador in-app diferente), o code_verifier some e
      // o link de redefinir senha dava "link expirado". Implícito não precisa
      // do verifier, então o link funciona em qualquer navegador.
      // Seguro aqui: o middleware NÃO faz auth por cookie no server (auth é
      // toda client-side), então não quebra sessão/login.
      auth: {
        flowType: 'implicit',
        detectSessionInUrl: true,
        persistSession: true,
        autoRefreshToken: true,
      },
    }
  )
}

export type Revendedora = {
  id: string
  user_id: string
  nome: string
  nome_loja: string | null
  email: string
  whatsapp: string
  cidade: string
  estado: string
  foto_url: string | null
  bio: string | null
  subdominio: string
  status: 'pendente' | 'ativa' | 'suspensa'
  saldo_disponivel: number
  saldo_processando: number
  total_ganho: number
  total_vendas: number
  asaas_customer_id: string | null
  criado_em: string
  atualizado_em: string
  mensalidade_vence_em?: string | null
  mensalidade_isento?: boolean
  // Personalização da loja (todos opcionais — null antes da
  // revendedora mexer em /configurar-loja).
  cor_tema?: string | null
  fonte?: string | null
  cor_fundo?: string | null
  // Cadastro como recebedor no Pagar.me (pra receber split de pagamentos
  // direto na conta dela). null até preencher /perfil/recebedor.
  pagarme_recipient_id?: string | null
  pagarme_recipient_status?: string | null
}

export type Venda = {
  id: string
  revendedora_id: string
  pedido_id: string
  cliente_nome: string
  produto_nome: string
  produto_foto: string | null
  valor_total: number
  valor_comissao: number
  status: 'processando' | 'pago' | 'cancelado' | 'pendente'
  criado_em: string
}

export type Saque = {
  id: string
  revendedora_id: string
  tipo: 'pix' | 'credito_loja'
  valor: number
  chave_pix: string | null
  status: 'solicitado' | 'processando' | 'pago' | 'recusado'
  criado_em: string
  pago_em: string | null
}

export type Notificacao = {
  id: string
  revendedora_id: string
  titulo: string
  mensagem: string
  tipo: 'info' | 'venda' | 'saque' | 'aviso'
  lida: boolean
  criado_em: string
}
