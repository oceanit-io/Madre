// Mensagens motivacionais pra revendedora. Uma por dia, igual pra todo mundo
// (escolhida pelo dia em Brasília), usada no card do dashboard E no e-mail das
// 7h. Curtas, calorosas, sem travessão. Editar à vontade.

export const MENSAGENS_MOTIVACIONAIS: string[] = [
  'Bom dia! ☀️ Toda venda começa com um post. Mostra tua prata hoje e deixa o brilho falar. 💎',
  'Quem aparece, vende. Posta uma peça agora, nem que seja uma só. ✨',
  'Tua loja tá aberta 24h. Compartilha o link num grupo hoje e deixa o pedido chegar. 🚀',
  'Constância vence talento. 1 post por dia e em um mês tu não te reconhece. 💪',
  'Cada "vou pensar" é um "quase". Responde rápido e fecha a venda. ⚡',
  'Hoje alguém vai comprar prata. Que seja na tua loja. Bora postar! 💖',
  'Não precisa de mil seguidores. Precisa de uma cliente feliz que indica outra. 🌟',
  'Manda o link pra 3 pessoas hoje. Venda é matemática: quanto mais mostra, mais vende. 📲',
  'Prata 925 com 50% off se vende sozinha. Só falta tu mostrar pra ela ver. 💎',
  'Sexta é dia de fechar. Posta uma oferta com prazo e cria urgência. ⏰',
  'A cliente compra de quem confia. Mostra teu rosto, tua prata, tua história. 💕',
  'Um story por dia mantém a loja viva no feed das pessoas. Bora! 📸',
  'Não desanima na primeira semana. As melhores vendedoras quase desistiram antes de estourar. 🔥',
  'Tua próxima venda pode estar a um WhatsApp de distância. Manda a mensagem. 💬',
  'Posta hoje, vende hoje. Simples assim. Tu consegue! ✨',
  'Mostra a peça sendo usada. Lifestyle vende sem parecer que tá vendendo. 💎',
  'Cliente satisfeita é propaganda gratuita. Caprica no atendimento e ela volta. 🤝',
  'Segunda é pra começar com tudo. Define uma meta pequena e bate ela hoje. 🎯',
  'O brilho da prata combina com o teu. Vai com confiança que a venda vem. 👑',
  'Combo vende mais que peça solta. Oferece 3 por um precinho especial. 🎁',
  'Hoje é um ótimo dia pra faturar. Abre o WhatsApp e fala com tuas clientes. 💸',
  'A loja é tua, o catálogo é nosso, o lucro é teu. Só falta mostrar! 🚀',
  'Responde em 10 minutos e tua chance de vender triplica. Fica de olho! ⚡',
  'Cada peça tem uma cliente certa. Posta variado que tu acha ela. 💖',
  'Tu não precisa ser a melhor. Só precisa começar e não parar. ✨',
  'Indicação vale ouro. Oferece um descontinho pra quem trouxer uma amiga. 💞',
  'Bom dia, vendedora! Hoje o objetivo é simples: aparecer e oferecer. 💎',
  'A venda mais difícil é a que tu não tenta. Manda a oferta hoje! 🔥',
  'Posta a prova social: print de cliente feliz vira venda nova. 🌟',
  'Acredita no teu negócio. Quem brilha por dentro, vende por fora. 💫',
]

// Mensagem do dia (igual pra todas no mesmo dia, base Brasília UTC-3).
export function mensagemDoDia(d: Date = new Date()): string {
  const brt = new Date(d.getTime() - 3 * 3600 * 1000)
  const epochDay = Math.floor(
    Date.UTC(brt.getUTCFullYear(), brt.getUTCMonth(), brt.getUTCDate()) / 86400000
  )
  const n = MENSAGENS_MOTIVACIONAIS.length
  const idx = ((epochDay % n) + n) % n
  return MENSAGENS_MOTIVACIONAIS[idx]
}
