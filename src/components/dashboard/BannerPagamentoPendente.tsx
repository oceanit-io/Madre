'use client'

// Banner sticky no topo de cada seção da revendedora pendente.
// Mostra clareza do que falta + botão pagar. Aparece SÓ se status === 'pendente'.
//
// Uso:
//   <BannerPagamentoPendente status={revendedora?.status} />

const LINK_PAGAMENTO = 'https://checkout.infinitepay.io/oceanit/sloPjyKw3C'

export default function BannerPagamentoPendente({ status }: { status?: string | null }) {
  if (status !== 'pendente') return null

  return (
    <div style={{
      background: '#FEF2F2',
      borderBottom: '1px solid #FCA5A5',
      padding: '14px 20px',
      position: 'sticky',
      top: 0,
      zIndex: 200,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <div style={{ fontSize: 18 }}>⚠️</div>
        <div style={{ fontFamily: 'Montserrat,sans-serif', fontSize: 13, fontWeight: 800, color: '#991B1B' }}>
          Conta aguardando ativação
        </div>
      </div>
      <div style={{ fontSize: 12, color: '#7F1D1D', lineHeight: 1.5, marginBottom: 10 }}>
        Pra começar a vender, faça o pagamento de R$ 39,90. Assim que confirmarmos, sua loja fica ativa em poucos minutos ✨
      </div>
      <a
        href={LINK_PAGAMENTO}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: 'inline-block',
          background: '#DC2626',
          color: 'white',
          fontFamily: 'Montserrat,sans-serif',
          fontSize: 12,
          fontWeight: 800,
          padding: '10px 16px',
          borderRadius: 8,
          textDecoration: 'none',
          textTransform: 'uppercase',
          letterSpacing: '0.4px',
          boxShadow: '0 2px 8px rgba(220,38,38,.3)',
        }}
      >
        💳 Pagar R$ 39,90 agora
      </a>
    </div>
  )
}
