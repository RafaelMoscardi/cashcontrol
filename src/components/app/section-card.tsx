import type * as React from 'react'
import { cn } from '@/lib/utils'

interface SectionCardProps extends Omit<React.ComponentProps<'section'>, 'title'> {
  title?: React.ReactNode
  description?: React.ReactNode
  icon?: React.ComponentType<{ className?: string }>
  action?: React.ReactNode
}

/** Cartão grafite com título: agrupa campos de formulário e blocos do painel. */
export function SectionCard({ title, description, icon: Icon, action, className, children, ...props }: SectionCardProps) {
  return (
    <section
      className={cn(
        'rounded-[1.375rem] border border-white/[0.06] bg-card p-4 shadow-[0_1px_0_rgb(255_255_255/0.03)_inset] sm:p-5',
        className,
      )}
      {...props}
    >
      {(title || action) && (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-2.5">
            {Icon && (
              <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-primary/12 text-primary">
                <Icon className="size-4" />
              </span>
            )}
            <div className="min-w-0">
              {title && <h2 className="text-[0.9375rem] font-semibold tracking-tight">{title}</h2>}
              {description && <p className="mt-0.5 text-[0.8125rem] leading-snug text-muted-foreground text-pretty">{description}</p>}
            </div>
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  )
}
