// Política de senha simplificada (mín 6 caracteres — mínimo aceito pelo
// Supabase Auth). Sem exigir maiúscula/minúscula/dígito/especial — UX
// menos atritada pra revendedoras pouco técnicas.
// O fluxo de recuperação por email continua seguro (token único Supabase).

export function validarSenha(senha: string): string | null {
  const s = senha || ''
  if (s.length < 6) return 'A senha deve ter pelo menos 6 caracteres.'
  return null
}
