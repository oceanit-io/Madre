export const env = {
  baseUrl: process.env.BASE_URL || 'https://lojadeprata925.com.br',
  email: process.env.TEST_EMAIL || '',
  password: process.env.TEST_PASSWORD || '',
  adminToken: process.env.ADMIN_TOKEN || '',
  storeSlug: process.env.TEST_STORE_SLUG || '',
  allowMutating: process.env.ALLOW_MUTATING_TESTS === 'true',
}

export function requireAuth() {
  if (!env.email || !env.password) {
    throw new Error('TEST_EMAIL e TEST_PASSWORD são obrigatórios para este teste')
  }
}

export function requireSlug() {
  if (!env.storeSlug || env.storeSlug === 'slug-da-loja') {
    throw new Error('TEST_STORE_SLUG não configurado corretamente no .env.test')
  }
}

export function requireAdminToken() {
  if (!env.adminToken) {
    throw new Error('ADMIN_TOKEN é obrigatório para testes de admin')
  }
}
