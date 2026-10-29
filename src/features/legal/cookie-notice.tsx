import { Cookie } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const STORAGE_KEY = 'cashcontrol:aviso-cookies'

function alreadySeen(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

/**
 * Aviso de cookies (informativo): o app só usa armazenamento essencial, então
 * não há o que aceitar ou recusar. Aparece uma vez e some ao tocar em "Entendi".
 */
export function CookieNotice({ aboveNav = false }: { aboveNav?: boolean }) {
  const [visible, setVisible] = useState(() => !alreadySeen())
  if (!visible) return null

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, '1')
    } catch {
      // armazenamento bloqueado: o aviso volta na próxima visita, sem prejuízo
    }
    setVisible(false)
  }

  return (
    <div
      role="region"
      aria-label="Aviso de cookies"
      className={cn(
        'fixed inset-x-3 z-50 mx-auto max-w-md rounded-2xl border border-white/10 bg-popover/95 p-4 shadow-[0_18px_40px_-18px_rgb(0_0_0/0.9)] backdrop-blur-xl',
        'animate-in fade-in-0 slide-in-from-bottom-2 duration-200',
        aboveNav ? 'bottom-[calc(var(--bottom-nav-h)+var(--safe-bottom)+1.5rem)] lg:bottom-6' : 'bottom-[calc(var(--safe-bottom)+1rem)]',
      )}
    >
      <div className="flex gap-3">
        <Cookie className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
        <p className="text-sm leading-snug text-secondary-foreground">
          Usamos só o armazenamento essencial para manter você conectado. Sem anúncios nem rastreamento.{' '}
          <Link to="/cookies" className="text-foreground underline underline-offset-4">
            Saiba mais
          </Link>
        </p>
      </div>
      <div className="mt-3 flex justify-end">
        <Button size="sm" className="touch-target" onClick={dismiss}>
          Entendi
        </Button>
      </div>
    </div>
  )
}
