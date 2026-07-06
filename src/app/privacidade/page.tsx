'use client'
import Link from 'next/link'
import { LogoP15 } from '@/components/LogoP15'
import { brand } from '@/lib/brand'

// Política de Privacidade — white-label (marca vem de brand)
//
// Conformidade: LGPD (Lei 13.709/2018). Texto redigido em pt-BR claro,
// sem juridiquês desnecessário. Toda revendedora vê via /privacidade
// (link no footer das páginas principais).
//
// Atualizada: junho/2026. Próxima revisão recomendada: anual ou quando
// houver mudança material no tratamento de dados.

export default function PrivacidadePage() {
  const emailPriv = `privacidade@${brand.dominio}`
  return (
    <div style={{ minHeight: '100vh', background: '#fff8fb', fontFamily: '-apple-system,"Inter",system-ui,sans-serif' }}>
      <header style={{ background: 'white', borderBottom: '1px solid #ffd6e6', padding: '18px 20px', textAlign: 'center' }}>
        <LogoP15 altura={32} centro />
      </header>

      <main style={{ maxWidth: 760, margin: '0 auto', padding: '40px 22px 64px' }}>
        <Link href="/landing" style={{ color: '#777', fontSize: 13, textDecoration: 'none' }}>← Voltar</Link>

        <h1 style={{ fontFamily: 'Montserrat,sans-serif', fontSize: 30, fontWeight: 900, color: '#1D1D1D', marginTop: 16, marginBottom: 8, letterSpacing: -.5 }}>
          Política de Privacidade
        </h1>
        <p style={{ fontSize: 13, color: '#777', marginBottom: 32 }}>
          Última atualização: 14 de junho de 2026 · Conforme Lei Geral de Proteção de Dados (Lei 13.709/2018)
        </p>

        <Secao titulo="1. Quem somos">
          <p>
            <strong>{brand.nome}</strong> é uma plataforma de e-commerce multitenant operada por
            <strong> {brand.operadora}</strong>, que permite a revendedoras criar e gerenciar suas próprias
            lojas online com catálogo de joias em prata 925.
          </p>
          <p style={{ marginTop: 8 }}>
            <strong>Contato sobre privacidade:</strong> <a href={`mailto:${emailPriv}`} style={{ color: '#ff7db4', fontWeight: 600 }}>{emailPriv}</a>
          </p>
        </Secao>

        <Secao titulo="2. Que dados coletamos">
          <p>Coletamos só o necessário pra operar a plataforma:</p>
          <ul style={{ paddingLeft: 22, marginTop: 8 }}>
            <li><strong>Dados da revendedora:</strong> nome, e-mail, WhatsApp, cidade, estado, dados bancários (pra split de comissão).</li>
            <li><strong>Dados da cliente final:</strong> nome, e-mail, telefone, endereço (pra entrega), CPF (pra emissão de nota fiscal).</li>
            <li><strong>Dados de pagamento:</strong> processados diretamente pelos parceiros PagBank e Pagar.me. <strong>Não armazenamos dados de cartão de crédito.</strong></li>
            <li><strong>Dados de navegação:</strong> tipo de dispositivo (mobile/desktop), página visitada, site de origem (Instagram, WhatsApp, etc), sessão anônima. <strong>Não coletamos IP nem User-Agent completo.</strong></li>
          </ul>
        </Secao>

        <Secao titulo="3. Pra que usamos os dados">
          <ul style={{ paddingLeft: 22 }}>
            <li><strong>Operar tua loja:</strong> criar conta, processar pedidos, dar suporte.</li>
            <li><strong>Calcular comissões:</strong> 30% das vendas vão pra revendedora; resto pra {brand.fornecedor} (fornecedora) e {brand.nome}.</li>
            <li><strong>Comunicação essencial:</strong> avisos sobre pedidos, pagamentos, atualizações da plataforma.</li>
            <li><strong>Melhorar a plataforma:</strong> entender quais lojas vendem mais, quais peças são populares, sem expor identidade individual.</li>
          </ul>
          <p style={{ marginTop: 12, padding: 12, background: '#FEF3C7', borderRadius: 8, fontSize: 13, color: '#92400E' }}>
            <strong>O que não fazemos:</strong> não vendemos teus dados pra terceiros, não usamos pra publicidade direcionada de outras empresas, não fazemos perfilamento comportamental além do mínimo operacional.
          </p>
        </Secao>

        <Secao titulo="4. Com quem compartilhamos">
          <p>Apenas com prestadores estritamente necessários:</p>
          <ul style={{ paddingLeft: 22, marginTop: 8 }}>
            <li><strong>PagBank/PagSeguro:</strong> processamento de pagamentos.</li>
            <li><strong>Pagar.me:</strong> split de comissões e gestão financeira.</li>
            <li><strong>Correios:</strong> envio das encomendas (precisa do endereço completo).</li>
            <li><strong>Supabase:</strong> banco de dados hospedado em São Paulo, criptografia em repouso e em trânsito.</li>
            <li><strong>Vercel:</strong> hospedagem da aplicação web.</li>
            <li><strong>Resend:</strong> envio de e-mails transacionais.</li>
          </ul>
          <p style={{ marginTop: 8 }}>
            Todos esses prestadores têm suas próprias políticas de privacidade conformes com LGPD e/ou GDPR.
          </p>
        </Secao>

        <Secao titulo="5. Por quanto tempo guardamos">
          <ul style={{ paddingLeft: 22 }}>
            <li><strong>Conta ativa:</strong> enquanto tu usar a plataforma.</li>
            <li><strong>Conta arquivada/suspensa:</strong> até 5 anos (obrigação legal fiscal).</li>
            <li><strong>Dados de pedido pago:</strong> 5 anos (Código de Defesa do Consumidor + Receita Federal).</li>
            <li><strong>Dados de navegação anônimos:</strong> 90 dias.</li>
            <li><strong>Após exclusão solicitada:</strong> dados pessoais removidos em até 30 dias; histórico financeiro anonimizado mas preservado pra fins fiscais.</li>
          </ul>
        </Secao>

        <Secao titulo="6. Teus direitos (LGPD Art. 18)">
          <p>Tu tem direito a:</p>
          <ul style={{ paddingLeft: 22, marginTop: 8 }}>
            <li><strong>Acesso:</strong> saber quais dados temos sobre ti.</li>
            <li><strong>Correção:</strong> corrigir dados desatualizados ou incorretos (já dá pra fazer em <Link href="/perfil" style={{ color: '#ff7db4', fontWeight: 600 }}>/perfil</Link>).</li>
            <li><strong>Exclusão:</strong> pedir pra apagar teus dados (exceto os que somos obrigados a guardar por lei fiscal).</li>
            <li><strong>Portabilidade:</strong> pedir teus dados em formato CSV/JSON.</li>
            <li><strong>Revogação de consentimento:</strong> a qualquer momento.</li>
            <li><strong>Reclamação à ANPD:</strong> autoridade nacional, <a href="https://www.gov.br/anpd" target="_blank" rel="noopener noreferrer" style={{ color: '#ff7db4' }}>gov.br/anpd</a>.</li>
          </ul>
          <p style={{ marginTop: 12 }}>
            Pra exercer qualquer um desses direitos: manda email pra <a href={`mailto:${emailPriv}`} style={{ color: '#ff7db4', fontWeight: 600 }}>{emailPriv}</a> com teu CPF ou email cadastrado. Respondemos em até 15 dias úteis.
          </p>
        </Secao>

        <Secao titulo="7. Cookies e tracking">
          <p>Usamos cookies pra:</p>
          <ul style={{ paddingLeft: 22, marginTop: 8 }}>
            <li><strong>Essenciais:</strong> manter sessão de login (sem consentimento, obrigatórios pro funcionamento).</li>
            <li><strong>Analytics anônimo:</strong> contar visitas e entender tráfego (com consentimento — banner aparece na primeira visita).</li>
          </ul>
          <p style={{ marginTop: 8 }}>
            Tu pode revogar o consentimento de analytics a qualquer momento limpando os cookies do site no teu navegador.
          </p>
        </Secao>

        <Secao titulo="8. Segurança">
          <p>Tomamos medidas pra proteger teus dados:</p>
          <ul style={{ paddingLeft: 22, marginTop: 8 }}>
            <li>Comunicação criptografada (HTTPS em todas as páginas).</li>
            <li>Senhas com proteção HIBP (verificação anti-vazamento).</li>
            <li>Banco de dados com criptografia em repouso (Supabase Pro).</li>
            <li>Acesso restrito por papéis (RLS no banco).</li>
            <li>Backups diários por 7 dias.</li>
          </ul>
          <p style={{ marginTop: 8 }}>
            Em caso de incidente de segurança com risco aos teus dados, comunicaremos ti e a ANPD em até 72h (LGPD Art. 48).
          </p>
        </Secao>

        <Secao titulo="9. Alterações desta política">
          <p>
            Esta política pode ser atualizada periodicamente. Mudanças materiais serão comunicadas
            por e-mail e/ou no painel da revendedora. A versão atual sempre fica disponível em
            <Link href="/privacidade" style={{ color: '#ff7db4', fontWeight: 600 }}> {brand.dominio}/privacidade</Link>.
          </p>
        </Secao>

        <Secao titulo="10. Contato">
          <p>Dúvidas, solicitações ou reclamações sobre privacidade:</p>
          <p style={{ marginTop: 8 }}>
            📧 <strong>{emailPriv}</strong><br />
            📱 WhatsApp suporte: <strong>(11) 97542-7321</strong>
          </p>
        </Secao>

        <div style={{ marginTop: 40, padding: 16, background: '#fff', border: '1px solid #ffd6e6', borderRadius: 12, textAlign: 'center', fontSize: 12, color: '#777' }}>
          Política de Privacidade · {brand.nome} · v1.0
        </div>
      </main>
    </div>
  )
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 28, fontSize: 14, color: '#1D1D1D', lineHeight: 1.7 }}>
      <h2 style={{ fontFamily: 'Montserrat,sans-serif', fontSize: 17, fontWeight: 800, color: '#1D1D1D', marginBottom: 10, letterSpacing: -.2 }}>
        {titulo}
      </h2>
      {children}
    </section>
  )
}
