import { Spinner } from '@/components/ui/spinner'
import { LogoMark } from './logo'

export function LoadingScreen({ label = 'Carregando' }: { label?: string }) {
  return (
    <div className="app-glow grid min-h-dvh place-items-center" role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-4">
        <LogoMark className="size-14" />
        <Spinner className="size-5 text-muted-foreground" />
        <span className="sr-only">{label}</span>
      </div>
    </div>
  )
}

/** Carregamento dentro de uma tela já montada. */
export function InlineLoading({ label = 'Carregando' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground" role="status">
      <Spinner className="size-4" />
      {label}
    </div>
  )
}
