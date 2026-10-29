import { useState } from 'react'
import { Spinner } from '@/components/ui/spinner'
import { errorMessage } from '@/lib/errors'
import { supabase } from '@/lib/supabase'
import { useAuthProviders } from './providers'

/** Logo "G" oficial, sem alterações (diretrizes de marca do Google). */
export function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.43.34-2.09V7.07H2.18A11 11 0 0 0 1 12c0 1.78.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  )
}

/** "Continuar com o Google" + divisor. Reserva o espaço enquanto confere se o Google está ativo. */
export function GoogleSignIn({ next, onError }: { next?: string | null; onError: (message: string) => void }) {
  const providers = useAuthProviders()
  const [pending, setPending] = useState(false)

  if (providers.isPending) return <div className="mb-5 h-[5.25rem]" aria-hidden="true" />
  if (!providers.data?.google) return null

  const start = async () => {
    setPending(true)
    const path = next && next.startsWith('/') && !next.startsWith('//') ? next : '/'
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}${path}` },
    })
    // Sem erro, o navegador já está indo para o Google
    if (error) {
      setPending(false)
      onError(errorMessage(error, 'Não foi possível abrir o login do Google. Tente de novo.'))
    }
  }

  return (
    <div className="mb-5 flex flex-col gap-5">
      <button
        type="button"
        onClick={() => void start()}
        disabled={pending}
        className="flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-[#8e918f] bg-[#131314] text-[0.9375rem] font-medium text-[#e3e3e3] outline-none select-none transition-[background-color,transform] duration-150 ease-snappy hover:bg-[#1f1f22] focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.98] disabled:opacity-70"
      >
        {pending ? <Spinner className="size-5" /> : <GoogleIcon className="size-5" />}
        Continuar com o Google
      </button>
      <div className="flex items-center gap-3 text-xs text-muted-foreground" aria-hidden="true">
        <span className="h-px flex-1 bg-white/10" />
        ou com e-mail
        <span className="h-px flex-1 bg-white/10" />
      </div>
    </div>
  )
}
