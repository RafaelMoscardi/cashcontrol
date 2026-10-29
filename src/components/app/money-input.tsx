import type * as React from 'react'
import { Input } from '@/components/ui/input'
import { formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'

interface MoneyInputProps extends Omit<React.ComponentProps<'input'>, 'value' | 'onChange' | 'type' | 'defaultValue'> {
  /** Valor em centavos */
  value: number | null | undefined
  onValueChange: (cents: number) => void
  maxCents?: number
}

/**
 * Campo de dinheiro no padrão dos apps de banco: só dígitos, preenchendo da
 * direita (1 → R$ 0,01; 1234 → R$ 12,34). Sem ambiguidade de vírgula e ponto.
 */
export function MoneyInput({ value, onValueChange, maxCents = 9_999_999_99, className, onFocus, ...props }: MoneyInputProps) {
  return (
    <Input
      {...props}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      enterKeyHint="next"
      value={formatMoney(value ?? 0)}
      onChange={(event) => {
        const digits = event.target.value.replace(/\D/g, '')
        onValueChange(Math.min(Number(digits || '0'), maxCents))
      }}
      onFocus={(event) => {
        // Cursor no fim (é ali que os dígitos entram), sem desfazer uma seleção:
        // quem selecionou tudo quer digitar o valor novo por cima
        const input = event.currentTarget
        requestAnimationFrame(() => {
          if (input.selectionStart === input.selectionEnd) input.setSelectionRange(input.value.length, input.value.length)
        })
        onFocus?.(event)
      }}
      className={cn('tabular-nums', className)}
    />
  )
}
