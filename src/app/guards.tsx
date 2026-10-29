import { Navigate, Outlet, useLocation } from 'react-router'
import { LoadingScreen } from '@/components/app/loading-screen'
import { useAuth } from '@/features/auth/auth-context'
import { useProfile } from '@/features/profile/api'

/** Só entra logado; senão vai para /entrar e volta depois. */
export function RequireAuth() {
  const { session, loading, recovering } = useAuth()
  const location = useLocation()
  if (loading) return <LoadingScreen />
  if (recovering) return <Navigate to="/redefinir-senha" replace />
  if (!session) {
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
