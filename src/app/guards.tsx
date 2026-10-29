import { lazy, Suspense } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router'
import { LoadingScreen } from '@/components/app/loading-screen'
import { useAuth } from '@/features/auth/auth-context'
import { useProfile } from '@/features/profile/api'
import { authReturnError } from '@/lib/supabase'

const HomePage = lazy(() => import('@/features/home/home-page').then((m) => ({ default: m.HomePage })))

/** Só entra logado; senão vai para /entrar e volta depois. Em "/", quem não entrou vê a página inicial pública. */
export function RequireAuth() {
  const { session, loading, recovering } = useAuth()
  const location = useLocation()
  if (loading) return <LoadingScreen />
  if (recovering) return <Navigate to="/redefinir-senha" replace />
  if (!session) {
    // A volta de um login com erro (Google cancelado, link vencido) segue para /entrar, que explica o erro
    if (location.pathname === '/' && !authReturnError()) {
      return (
        <Suspense fallback={<LoadingScreen />}>
          <HomePage />
        </Suspense>
      )
    }
    const next = location.pathname === '/' ? '' : `?next=${encodeURIComponent(location.pathname + location.search)}`
    return <Navigate to={`/entrar${next}`} replace />
  }
  return <Outlet />
}

/** Quem não concluiu o primeiro acesso (plataformas + veículo) vai para /bem-vindo. */
export function RequireOnboarding() {
  const profile = useProfile()
  if (profile.isPending) return <LoadingScreen />
  if (profile.data && !profile.data.onboardedAt) return <Navigate to="/bem-vindo" replace />
  return <Outlet />
}

/** Telas de login e cadastro: quem já está logado segue para o app. */
export function PublicOnly() {
  const { session, loading, recovering } = useAuth()
  const location = useLocation()
  if (loading) return <LoadingScreen />
  if (recovering) return <Navigate to="/redefinir-senha" replace />
  if (session) {
    const next = new URLSearchParams(location.search).get('next')
    return <Navigate to={next && next.startsWith('/') && !next.startsWith('//') ? next : '/'} replace />
  }
  return <Outlet />
}
