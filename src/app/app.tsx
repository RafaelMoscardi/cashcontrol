import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router/dom'
import { LogoMark } from '@/components/app/logo'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AuthProvider } from '@/features/auth/auth-provider'
import { queryClient } from '@/lib/query-client'
import { isSupabaseConfigured } from '@/lib/supabase'
import { router } from './router'

/** Sem as variáveis do Supabase o app não tem onde guardar dados: explica como configurar. */
function MissingConfig() {
  return (
    <div className="app-glow grid min-h-dvh place-items-center px-6">
      <div className="max-w-md">
        <LogoMark className="mb-6 size-12" />
        <h1 className="text-2xl font-semibold tracking-tight">Falta configurar o Supabase</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Crie o arquivo <code className="rounded bg-white/10 px-1.5 py-0.5 text-foreground">.env.local</code> com{' '}
          <code className="text-foreground">VITE_SUPABASE_URL</code> e <code className="text-foreground">VITE_SUPABASE_PUBLISHABLE_KEY</code> (veja{' '}
          <code className="text-foreground">.env.example</code>) e reinicie o servidor. Para testar sem conta no Supabase, rode{' '}
          <code className="text-foreground">npm run dev:local</code>.
        </p>
      </div>
    </div>
  )
}

export function App() {
  if (!isSupabaseConfigured) return <MissingConfig />
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider delayDuration={300}>
          <RouterProvider router={router} />
          {/* offset vale só a partir de 600 px; no celular é o mobileOffset que tira o aviso de cima da barra de status */}
          <Toaster
            position="top-center"
            offset={{ top: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}
            mobileOffset={{ top: 'calc(env(safe-area-inset-top, 0px) + 10px)' }}
          />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}
