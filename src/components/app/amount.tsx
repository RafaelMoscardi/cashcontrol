import { formatMoney, formatSignedMoney } from '@/lib/format'
import { cn } from '@/lib/utils'

interface AmountProps {
  cents: number
  /** "result": verde se positivo, vermelho se negativo, com sinal */
  tone?: 'neutral' | 'result'
  className?: string
}

/** Valor em dinheiro. Resultado sempre leva sinal: a cor nunca é a única pista. */
export function Amount({ cents, tone = 'neutral', className }: AmountProps) {
  if (tone === 'neutral') return <span className={cn('tabular-nums', className)}>{formatMoney(cents)}</span>
  return (
    <span
      className={cn(
        'tabular-nums',
        cents > 0 && 'text-positive',
        cents < 0 && 'text-negative',
        cents === 0 && 'text-muted-foreground',
        className,
      )}
    >
      {formatSignedMoney(cents)}
    </span>
  )
}
