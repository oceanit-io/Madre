'use client'
import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

export type ItemCarrinho = {
  id: string
  sku: string
  nome: string
  preco: number
  foto: string
  quantidade: number
  slugRevendedora: string
  // Variação Tray (opcional): tamanho/cor + referência (EAN/modelo) que a
  // revendedora precisa pra montar o pedido. Sem variação ficam undefined.
  variantId?: string
  variacao?: string   // ex: "Tamanho da Corrente: 60cm"
  ref?: string        // EAN ou modelo da variação
}

// Chave única no carrinho: produto + variação (se houver). Assim dois
// tamanhos do mesmo produto são linhas distintas.
export function chaveItem(i: { id: string; variantId?: string }): string {
  return i.variantId ? `${i.id}::${i.variantId}` : i.id
}

type CarrinhoContextType = {
  itens: ItemCarrinho[]
  adicionar: (item: Omit<ItemCarrinho, 'quantidade'>) => void
  remover: (id: string) => void
  alterarQuantidade: (id: string, quantidade: number) => void
  limpar: () => void
  totalItens: number
  subtotal: number
  toastVisivel: boolean
  toastMsg: string
}

const CarrinhoContext = createContext<CarrinhoContextType | undefined>(undefined)

const STORAGE_KEY = 'prata15_carrinho'

export function CarrinhoProvider({ children }: { children: ReactNode }) {
  const [itens, setItens] = useState<ItemCarrinho[]>([])
  const [carregado, setCarregado] = useState(false)
  const [toastVisivel, setToastVisivel] = useState(false)
  const [toastMsg, setToastMsg] = useState('Adicionado ao carrinho')

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed)) {
          setItens(parsed)
        }
      }
    } catch (e) {
      console.error('Erro ao carregar carrinho:', e)
    }
    setCarregado(true)
  }, [])

  useEffect(() => {
    if (!carregado) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(itens))
    } catch (e) {
      console.error('Erro ao salvar carrinho:', e)
    }
  }, [itens, carregado])

  function adicionar(item: Omit<ItemCarrinho, 'quantidade'>) {
    // Um carrinho = uma loja. Cada revendedora tem recebedor e split próprios,
    // então um pedido não pode misturar lojas. O checkout atribui o pedido pelo
    // slug dos itens; se o carrinho tivesse itens de lojas diferentes, a venda
    // iria pra revendedora errada. Por isso, ao adicionar item de outra loja,
    // o carrinho é reiniciado.
    const trocouLoja =
      itens.length > 0 && itens[0].slugRevendedora !== item.slugRevendedora
    const chave = chaveItem(item)
    setItens(prev => {
      const base =
        prev.length > 0 && prev[0].slugRevendedora !== item.slugRevendedora
          ? []
          : prev
      const existente = base.find(i => chaveItem(i) === chave)
      if (existente) {
        return base.map(i =>
          chaveItem(i) === chave ? { ...i, quantidade: i.quantidade + 1 } : i
        )
      }
      return [...base, { ...item, quantidade: 1 }]
    })
    setToastMsg(trocouLoja ? 'Carrinho atualizado para esta loja' : 'Adicionado ao carrinho')
    setToastVisivel(true)
    setTimeout(() => setToastVisivel(false), 2500)
  }

  function remover(id: string) {
    setItens(prev => prev.filter(i => chaveItem(i) !== id))
  }

  function alterarQuantidade(id: string, quantidade: number) {
    if (quantidade <= 0) {
      remover(id)
      return
    }
    setItens(prev =>
      prev.map(i => (chaveItem(i) === id ? { ...i, quantidade } : i))
    )
  }

  function limpar() {
    setItens([])
  }

  const totalItens = itens.reduce((acc, i) => acc + i.quantidade, 0)
  const subtotal = itens.reduce((acc, i) => acc + i.preco * i.quantidade, 0)

  return (
    <CarrinhoContext.Provider
      value={{
        itens,
        adicionar,
        remover,
        alterarQuantidade,
        limpar,
        totalItens,
        subtotal,
        toastVisivel,
        toastMsg,
      }}
    >
      {children}
    </CarrinhoContext.Provider>
  )
}

export function useCarrinho() {
  const ctx = useContext(CarrinhoContext)
  if (!ctx) {
    throw new Error('useCarrinho deve ser usado dentro de CarrinhoProvider')
  }
  return ctx
}