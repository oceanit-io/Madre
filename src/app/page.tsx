import { redirect } from 'next/navigation'

// Raíz da app — sempre redireciona p/ a landing de captação.
export default function HomePage() {
  redirect('/landing')
}
