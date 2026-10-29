import type * as React from 'react'
import { cn } from '@/lib/utils'

interface StatTileProps {
  label: string
  value: React.ReactNode
  hint?: React.ReactNode
  icon?: React.ComponentType<{ className?: string }>
  className?: string
}

/** Indicador: rótulo, valor (algarismos proporcionais) e complemento. */
export function StatTile({ label, value, hint, icon: Icon, className }: StatTileProps) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-1 rounded-2xl border border-white/[0.06] bg-card px-3.5 py-3', className)}>
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {Icon && <Icon className="size-3.5 shrink-0" />}
        <span className="truncate">{label}</span>
      </span>
      <span className="truncate text-lg leading-tight font-semibold tracking-tight">{value}</span>
      {hint && <span className="truncate text-xs text-faint">{hint}</span>}
    </div>
  )
}
