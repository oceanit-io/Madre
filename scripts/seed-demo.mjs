#!/usr/bin/env node
/**
 * seed-demo.mjs — Popula os bancos dos clientes demo (velour e aurea)
 * com produtos fictícios para apresentação em feira.
 *
 * Uso:
 *   node scripts/seed-demo.mjs velour    # só Velour Parfums
 *   node scripts/seed-demo.mjs aurea     # só Áurea Joias
 *   node scripts/seed-demo.mjs           # ambos
 *
 * Não requer vars de ambiente — usa as credenciais locais em _local/creds/.
 */

import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dir = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dir, '..')

function lerCreds(slug) {
  const p = resolve(ROOT, '_local', 'creds', slug, 'credenciais.json')
  return JSON.parse(readFileSync(p, 'utf-8'))
}

async function upsertProdutos(supabaseUrl, serviceKey, produtos) {
  const url = `${supabaseUrl}/rest/v1/produtos`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify(produtos),
  })
  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`HTTP ${res.status}: ${txt}`)
  }
  return await res.json()
}

// ─── Produtos: Velour Parfums ────────────────────────────────────────────────

const VELOUR_PRODUTOS = [
  {
    sku: 'VEL-001',
    nome: 'Eau de Velours Rouge',
    descricao: 'Fragrância luxuosa com notas de rosa, patchouli e sândalo. 50 ml. Ideal para noites especiais.',
    categoria: 'Eau de Parfum',
    preco: 189.90,
    preco_promo: 149.90,
    peso_g: 280,
    estoque: 15,
    fotos: ['https://images.unsplash.com/photo-1541643600914-78b084683702?w=600'],
    marca: 'Velour',
    destaque: true,
    lancamento: false,
    ativo: true,
    altura_cm: 12,
    largura_cm: 4,
    comprimento_cm: 4,
  },
  {
    sku: 'VEL-002',
    nome: 'Nuit de Minuit',
    descricao: 'Perfume masculino com âmbar, cedro e especiarias orientais. 100 ml. Sofisticação para o dia a dia.',
    categoria: 'Eau de Parfum',
    preco: 229.90,
    preco_promo: null,
    peso_g: 350,
    estoque: 10,
    fotos: ['https://images.unsplash.com/photo-1523293182086-7651a899d37f?w=600'],
    marca: 'Velour',
    destaque: true,
    lancamento: false,
    ativo: true,
    altura_cm: 14,
    largura_cm: 5,
    comprimento_cm: 5,
  },
  {
    sku: 'VEL-003',
    nome: 'Blanche Vanille',
    descricao: 'Fragrância delicada e feminina com baunilha, jasmim e almíscar branco. 50 ml.',
    categoria: 'Eau de Toilette',
    preco: 139.90,
    preco_promo: 109.90,
    peso_g: 220,
    estoque: 20,
    fotos: ['https://images.unsplash.com/photo-1595535873420-a599195b3f4a?w=600'],
    marca: 'Velour',
    destaque: false,
    lancamento: true,
    ativo: true,
    altura_cm: 10,
    largura_cm: 4,
    comprimento_cm: 4,
  },
  {
    sku: 'VEL-004',
    nome: 'Oud Imperial',
    descricao: 'Perfume árabe unissex com madeira de oud, rosas e âmbar. 75 ml. Presença marcante.',
    categoria: 'Eau de Parfum',
    preco: 299.90,
    preco_promo: null,
    peso_g: 400,
    estoque: 8,
    fotos: ['https://images.unsplash.com/photo-1590736969955-71cc94901144?w=600'],
    marca: 'Velour',
    destaque: true,
    lancamento: false,
    ativo: true,
    altura_cm: 16,
    largura_cm: 5,
    comprimento_cm: 5,
  },
  {
    sku: 'VEL-005',
    nome: 'Citrus Fresco',
    descricao: 'Colônia refrescante com bergamota, limão siciliano e ervas aromáticas. 100 ml.',
    categoria: 'Eau de Cologne',
    preco: 99.90,
    preco_promo: 79.90,
    peso_g: 310,
    estoque: 25,
    fotos: ['https://images.unsplash.com/photo-1587017539504-67cfbddac569?w=600'],
    marca: 'Velour',
    destaque: false,
    lancamento: false,
    ativo: true,
    altura_cm: 14,
    largura_cm: 5,
    comprimento_cm: 5,
  },
  {
    sku: 'VEL-006',
    nome: 'Fleur Sauvage',
    descricao: 'Eau de parfum floral selvagem com íris, violeta e almíscar. 30 ml. Perfeito para presente.',
    categoria: 'Eau de Parfum',
    preco: 119.90,
    preco_promo: null,
    peso_g: 180,
    estoque: 18,
    fotos: ['https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?w=600'],
    marca: 'Velour',
    destaque: false,
    lancamento: true,
    ativo: true,
    altura_cm: 9,
    largura_cm: 3,
    comprimento_cm: 3,
  },
  {
    sku: 'VEL-007',
    nome: 'Soir de Paris',
    descricao: 'Clássico feminino inspirado nos jardins de Paris. Rosas, lírio do vale e baunilha. 75 ml.',
    categoria: 'Eau de Parfum',
    preco: 199.90,
    preco_promo: 169.90,
    peso_g: 290,
    estoque: 12,
    fotos: ['https://images.unsplash.com/photo-1534073737927-85f1ebff1f5d?w=600'],
    marca: 'Velour',
    destaque: true,
    lancamento: false,
    ativo: true,
    altura_cm: 13,
    largura_cm: 4,
    comprimento_cm: 4,
  },
  {
    sku: 'VEL-008',
    nome: 'Terra & Madeira',
    descricao: 'Masculino amadeirado com vetiver, cedro e pimenta negra. 100 ml. Para o homem moderno.',
    categoria: 'Eau de Toilette',
    preco: 159.90,
    preco_promo: null,
    peso_g: 340,
    estoque: 14,
    fotos: ['https://images.unsplash.com/photo-1563170352-36f00e7597a5?w=600'],
    marca: 'Velour',
    destaque: false,
    lancamento: false,
    ativo: true,
    altura_cm: 14,
    largura_cm: 5,
    comprimento_cm: 5,
  },
  {
    sku: 'VEL-009',
    nome: 'Aqua Marina',
    descricao: 'Fragrância aquática unissex com notas marinhas, algas e cedro branco. 100 ml.',
    categoria: 'Eau de Cologne',
    preco: 129.90,
    preco_promo: 99.90,
    peso_g: 320,
    estoque: 22,
    fotos: ['https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?w=600'],
    marca: 'Velour',
    destaque: false,
    lancamento: false,
    ativo: true,
    altura_cm: 14,
    largura_cm: 5,
    comprimento_cm: 5,
  },
  {
    sku: 'VEL-010',
    nome: 'Kit Presente Trio Velour',
    descricao: 'Kit com 3 miniaturas exclusivas (15 ml cada): Eau de Velours Rouge, Nuit de Minuit e Blanche Vanille. Embalagem gift.',
    categoria: 'Kits e Presentes',
    preco: 149.90,
    preco_promo: 129.90,
    peso_g: 250,
    estoque: 6,
    fotos: ['https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?w=600'],
    marca: 'Velour',
    destaque: true,
    lancamento: true,
    ativo: true,
    altura_cm: 8,
    largura_cm: 15,
    comprimento_cm: 10,
  },
]

// ─── Produtos: Áurea Joias Folheadas ────────────────────────────────────────

const AUREA_PRODUTOS = [
  {
    sku: 'AUR-001',
    nome: 'Colar Lua Crescente Folheado a Ouro 18K',
    descricao: 'Colar delicado com pingente de lua crescente. Folheado a ouro 18K. Corrente de 45 cm ajustável. Anti-alérgico.',
    categoria: 'Colares',
    preco: 89.90,
    preco_promo: 69.90,
    peso_g: 12,
    estoque: 30,
    fotos: ['https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=600'],
    marca: 'Áurea',
    destaque: true,
    lancamento: false,
    ativo: true,
    altura_cm: 2,
    largura_cm: 10,
    comprimento_cm: 10,
  },
  {
    sku: 'AUR-002',
    nome: 'Brinco Argola Média Folheado Ouro',
    descricao: 'Argola lisa de 3 cm de diâmetro, folheada a ouro 18K. Fecho de pressão. Leve e confortável para o dia a dia.',
    categoria: 'Brincos',
    preco: 59.90,
    preco_promo: null,
    peso_g: 8,
    estoque: 50,
    fotos: ['https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=600'],
    marca: 'Áurea',
    destaque: true,
    lancamento: false,
    ativo: true,
    altura_cm: 1,
    largura_cm: 5,
    comprimento_cm: 5,
  },
  {
    sku: 'AUR-003',
    nome: 'Pulseira Berloque Coração Folheada Ouro',
    descricao: 'Pulseira rígida com berloque de coração. Folheada a ouro 18K. Tamanho único ajustável. Ideal para presentes.',
    categoria: 'Pulseiras',
    preco: 79.90,
    preco_promo: 64.90,
    peso_g: 18,
    estoque: 25,
    fotos: ['https://images.unsplash.com/photo-1573408301185-9519f94cb70c?w=600'],
    marca: 'Áurea',
    destaque: true,
    lancamento: false,
    ativo: true,
    altura_cm: 1,
    largura_cm: 7,
    comprimento_cm: 7,
  },
  {
    sku: 'AUR-004',
    nome: 'Anel Solitário Zircônia Folheado Ouro',
    descricao: 'Anel com pedra de zircônia branca em garra. Folheado a ouro 18K. Disponível nos tamanhos 15 ao 20.',
    categoria: 'Anéis',
    preco: 69.90,
    preco_promo: null,
    peso_g: 5,
    estoque: 40,
    fotos: ['https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=600'],
    marca: 'Áurea',
    destaque: false,
    lancamento: false,
    ativo: true,
    altura_cm: 1,
    largura_cm: 3,
    comprimento_cm: 3,
  },
  {
    sku: 'AUR-005',
    nome: 'Conjunto Colar + Brinco Pérola Sintética',
    descricao: 'Conjunto de colar e brinco com pérola sintética branca. Folheado a ouro 18K. Elegância clássica para ocasiões especiais.',
    categoria: 'Conjuntos',
    preco: 129.90,
    preco_promo: 99.90,
    peso_g: 22,
    estoque: 15,
    fotos: ['https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=600'],
    marca: 'Áurea',
    destaque: true,
    lancamento: false,
    ativo: true,
    altura_cm: 3,
    largura_cm: 10,
    comprimento_cm: 10,
  },
  {
    sku: 'AUR-006',
    nome: 'Tornozeleira Estrela Folheada Ouro',
    descricao: 'Tornozeleira fina com pingente de estrela. Folheada a ouro 18K. 25 cm ajustável com extensor.',
    categoria: 'Tornozeleiras',
    preco: 55.90,
    preco_promo: null,
    peso_g: 6,
    estoque: 35,
    fotos: ['https://images.unsplash.com/photo-1630018548696-da1e3c3a9f5f?w=600'],
    marca: 'Áurea',
    destaque: false,
    lancamento: true,
    ativo: true,
    altura_cm: 1,
    largura_cm: 10,
    comprimento_cm: 10,
  },
  {
    sku: 'AUR-007',
    nome: 'Choker Pedra Natural Quartzo Rosa',
    descricao: 'Choker com pedra de quartzo rosa natural. Folheado a ouro 18K. Comprimento: 38 cm. Energia e delicadeza.',
    categoria: 'Colares',
    preco: 95.90,
    preco_promo: 79.90,
    peso_g: 15,
    estoque: 20,
    fotos: ['https://images.unsplash.com/photo-1506630448388-4e683c67ddb0?w=600'],
    marca: 'Áurea',
    destaque: true,
    lancamento: true,
    ativo: true,
    altura_cm: 2,
    largura_cm: 8,
    comprimento_cm: 8,
  },
  {
    sku: 'AUR-008',
    nome: 'Brinco Ear Cuff Folheado Ouro',
    descricao: 'Ear cuff sem furo com design de folha. Folheado a ouro 18K. Moderno e versátil. Peça única.',
    categoria: 'Brincos',
    preco: 49.90,
    preco_promo: 39.90,
    peso_g: 4,
    estoque: 45,
    fotos: ['https://images.unsplash.com/photo-1630019852942-f89202989a59?w=600'],
    marca: 'Áurea',
    destaque: false,
    lancamento: true,
    ativo: true,
    altura_cm: 1,
    largura_cm: 3,
    comprimento_cm: 3,
  },
  {
    sku: 'AUR-009',
    nome: 'Bracelete Rígido Liso Folheado Ouro',
    descricao: 'Bracelete rígido abertura em C. Folheado a ouro 18K. Acabamento espelhado. Tamanho único.',
    categoria: 'Pulseiras',
    preco: 85.90,
    preco_promo: null,
    peso_g: 20,
    estoque: 18,
    fotos: ['https://images.unsplash.com/photo-1618580747834-6f25a5c8d7f7?w=600'],
    marca: 'Áurea',
    destaque: false,
    lancamento: false,
    ativo: true,
    altura_cm: 1,
    largura_cm: 7,
    comprimento_cm: 7,
  },
  {
    sku: 'AUR-010',
    nome: 'Colar Olho Grego Proteção',
    descricao: 'Colar com pingente olho grego esmaltado azul. Folheado a ouro 18K. Corrente 42 cm. Amuleto de proteção.',
    categoria: 'Colares',
    preco: 75.90,
    preco_promo: 59.90,
    peso_g: 10,
    estoque: 28,
    fotos: ['https://images.unsplash.com/photo-1617038260897-41a1f14a8ca0?w=600'],
    marca: 'Áurea',
    destaque: true,
    lancamento: false,
    ativo: true,
    altura_cm: 2,
    largura_cm: 8,
    comprimento_cm: 8,
  },
  {
    sku: 'AUR-011',
    nome: 'Anel Serpente Folheado Ouro',
    descricao: 'Anel ajustável em formato de serpente enrolada. Folheado a ouro 18K. Peça única e marcante.',
    categoria: 'Anéis',
    preco: 79.90,
    preco_promo: null,
    peso_g: 7,
    estoque: 22,
    fotos: ['https://images.unsplash.com/photo-1526750583163-3111dfcb2a13?w=600'],
    marca: 'Áurea',
    destaque: false,
    lancamento: true,
    ativo: true,
    altura_cm: 1,
    largura_cm: 3,
    comprimento_cm: 3,
  },
  {
    sku: 'AUR-012',
    nome: 'Kit Presente Joias Folheadas — 3 Peças',
    descricao: 'Kit com colar lua, brinco argola e pulseira berloque. Tudo folheado a ouro 18K. Embalagem presente inclusa. Ideal para datas especiais.',
    categoria: 'Kits e Presentes',
    preco: 179.90,
    preco_promo: 149.90,
    peso_g: 40,
    estoque: 10,
    fotos: ['https://images.unsplash.com/photo-1535632788826-78ca9d09d2a2?w=600'],
    marca: 'Áurea',
    destaque: true,
    lancamento: true,
    ativo: true,
    altura_cm: 5,
    largura_cm: 15,
    comprimento_cm: 10,
  },
]

// ─── Runner ─────────────────────────────────────────────────────────────────

const CLIENTES = {
  velour: { creds: () => lerCreds('velour'), produtos: VELOUR_PRODUTOS, nome: 'Velour Parfums' },
  aurea:  { creds: () => lerCreds('aurea'),  produtos: AUREA_PRODUTOS,  nome: 'Áurea Joias' },
}

const alvo = process.argv[2]
const rodando = alvo ? [alvo] : Object.keys(CLIENTES)

for (const slug of rodando) {
  const conf = CLIENTES[slug]
  if (!conf) {
    console.error(`❌ Cliente desconhecido: ${slug}. Use: velour | aurea`)
    process.exit(1)
  }

  const { supabaseUrl, supabaseServiceRoleKey } = conf.creds()
  console.log(`\n▶ Seedando ${conf.nome} (${slug})…`)
  console.log(`  URL: ${supabaseUrl}`)
  console.log(`  ${conf.produtos.length} produtos`)

  try {
    const result = await upsertProdutos(supabaseUrl, supabaseServiceRoleKey, conf.produtos)
    console.log(`  ✅ ${Array.isArray(result) ? result.length : '?'} produto(s) inseridos/atualizados`)
  } catch (err) {
    console.error(`  ❌ Erro: ${err.message}`)
    process.exit(1)
  }
}

console.log('\n✅ Seed concluído.')
