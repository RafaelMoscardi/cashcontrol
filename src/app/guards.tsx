import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router'
import { LoadingScreen } from '@/components/app/loading-screen'
import { Button } from '@/components/ui/button'
import { APP_INFO } from '@/config/app'
import { useAuth } from '@/features/auth/auth-context'
import { accountExists, ensureProfile, useProfile } from '@/features/profile/api'
import { isNotFound } from '@/lib/errors'
import { accountGoneNotice, authReturnError, noteAccountGone, supabase } from '@/lib/supabase'
import { FocusLayout } from './layouts'

const HomePage = lazy(() => import('@/features/home/home-page').then((m) => ({ default: m.HomePage })))

/** Só entra logado; senão vai para /entrar e volta depois. Em "/", quem não entrou vê a página inicial pública. */
export function RequireAuth() {
  const { session, loading, recovering } = useAuth()
  const location = useLocation()
  if (loading) return <LoadingScreen />
  if (recovering) return <Navigate to="/redefinir-senha" replace />
  if (!session) {
    // A volta de um login com erro (Google cancelado, link vencido) e a conta apagada seguem para /entrar, que explica
    if (location.pathname === '/' && !authReturnError() && !accountGoneNotice()) {
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

/** Perfil carregado antes das telas logadas. Sem perfil no banco, não fica girando: confere a conta e resolve. */
export function RequireProfile() {
  const profile = useProfile()
  const { refetch } = profile
  // Uma tentativa de recriar o perfil por vez: se não pegar, a tela explica em vez de repetir sem fim
  const healTried = useRef(false)
  const heal = useCallback(async () => {
    if (healTried.current) return false
    healTried.current = true
    const healed = await ensureProfile().then(
      () => true,
      () => false,
    )
    if (healed) void refetch()
    return healed
  }, [refetch])
  const retry = useCallback(() => {
    healTried.current = false
    void refetch()
  }, [refetch])

  if (profile.isPending) return <LoadingScreen />
  if (isNotFound(profile.error)) return <MissingProfile heal={heal} retry={retry} />
  return <Outlet />
}

/**
 * Conta sem perfil. Conta apagada: sai dela e a tela de entrar explica. Conta que existe (perfil apagado
 * à mão no painel): recria o perfil e ela recomeça pelo primeiro acesso, como nova.
 */
function MissingProfile({ heal, retry }: { heal: () => Promise<boolean>; retry: () => void }) {
  const { signOut } = useAuth()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    let active = true
    void (async () => {
      if (!(await accountExists())) {
        if (!active) return
        noteAccountGone()
        await supabase.auth.signOut({ scope: 'local' })
        return
      }
      if (await heal()) return
      if (active) setChecking(false)
    })()
    return () => {
      active = false
    }
  }, [heal])

  if (checking) return <LoadingScreen />
  return (
    <FocusLayout>
      <h1 className="text-2xl font-semibold tracking-tight">Não encontramos o seu perfil</h1>
      <p className="mt-2 text-sm text-muted-foreground text-pretty">
        Você entrou, mas os dados da sua conta não estão no servidor. Tente de novo. Se continuar, escreva para{' '}
        <a href={`mailto:${APP_INFO.contactEmail}`} className="text-link underline-offset-4 hover:underline">
          {APP_INFO.contactEmail}
        </a>
        .
      </p>
      <div className="mt-6 flex flex-wrap gap-2">
        <Button onClick={retry}>Tentar de novo</Button>
        <Button variant="outline" onClick={() => void signOut()}>
          Sair da conta
        </Button>
      </div>
    </FocusLayout>
  )
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
