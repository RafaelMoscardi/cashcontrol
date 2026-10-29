import { ChevronLeft } from 'lucide-react'
import type * as React from 'react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface PageHeaderProps {
  title: React.ReactNode
  description?: React.ReactNode
  /** Rota de volta (mostra a seta à esquerda) */
  backTo?: string
  actions?: React.ReactNode
  className?: string
}

export function PageHeader({ title, description, backTo, actions, className }: PageHeaderProps) {
  return (
    <header className={cn('flex flex-wrap items-end justify-between gap-x-4 gap-y-3 pt-[calc(var(--safe-top)+1.25rem)] pb-5 lg:pt-10', className)}>
      <div className="flex min-w-0 items-start gap-2">
        {backTo && (
          <Button asChild variant="ghost" size="icon-sm" className="touch-target -ml-2 mt-0.5 shrink-0 text-muted-foreground">
            <Link to={backTo} aria-label="Voltar">
              <ChevronLeft className="size-5" />
            </Link>
          </Button>
        )}
        <div className="min-w-0">
          <h1 className="text-[1.625rem] leading-tight font-semibold tracking-tight text-balance lg:text-3xl">{title}</h1>
          {description && <p className="mt-1 text-sm text-muted-foreground text-pretty">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  )
}
