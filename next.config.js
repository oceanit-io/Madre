/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['pratade15reais.com.br', 'your-supabase-project.supabase.co'],
  },
  // TypeScript valida no build. Bug de tipo bloqueia deploy = bom.
  typescript: {
    ignoreBuildErrors: false,
  },
  // Lint NÃO bloqueia build (warnings bobos não devem travar deploy).
  // Pra checar manualmente: `npx next lint`.
  eslint: {
    ignoreDuringBuilds: true,
  },
}

module.exports = nextConfig