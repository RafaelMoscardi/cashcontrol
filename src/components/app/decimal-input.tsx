import { useEffect, useRef, useState } from 'react'
import type * as React from 'react'
import { Input } from '@/components/ui/input'
import { parseDecimal, parseInteger, toDecimalInput } from '@/lib/parse'
import { cn } from '@/lib/utils'

interface AffixProps {
  /** Texto fixo à esquerda, ex. "R$" */
  prefix?: string
  /** Texto fixo à direita, ex. "km/l" */
  suffix?: string
}

function Affixed({ prefix, suffix, children }: AffixProps & { children: React.ReactNode }) {
  if (!prefix && !suffix) return children
  return (
    <div className="relative">
      {prefix && (
        <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-sm text-muted-foreground">
          {prefix}
        </span>
      )}
      {children}
      {suffix && (
        <span className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-sm text-muted-foreground">
          {suffix}
        </span>
      )}
    </div>
  )
}

interface DecimalInputProps
  extends AffixProps,
    Omit<React.ComponentProps<'input'>, 'value' | 'onChange' | 'type' | 'defaultValue' | 'prefix'> {
  value: number | null | undefined
  onValueChange: (value: number | null) => void
  maxFractionDigits?: number
}

/** Número decimal no padrão brasileiro; aceita vírgula ou ponto. */
export function DecimalInput({
  value,
  onValueChange,
  maxFractionDigits = 3,
  prefix,
  suffix,
  className,
  onBlur,
  ...props
}: DecimalInputProps) {
  const [text, setText] = useState(() => toDecimalInput(value, maxFractionDigits))
  const lastEmitted = useRef<number | null | undefined>(value)

  // Valor trocado por fora (reset do formulário, edição carregada)
  useEffect(() => {
    if (value !== lastEmitted.current) {
      lastEmitted.current = value
      setText(toDecimalInput(value, maxFractionDigits))
    }
  }, [value, maxFractionDigits])

  return (
    <Affixed prefix={prefix} suffix={suffix}>
      <Input
        {...props}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        enterKeyHint="next"
        value={text}
        onChange={(event) => {
          const next = event.target.value.replace(/[^\d.,]/g, '')
          setText(next)
          const parsed = parseDecimal(next)
          lastEmitted.current = parsed
          onValueChange(parsed)
        }}
        onBlur={(event) => {
          const parsed = parseDecimal(text)
          if (parsed !== null) setText(toDecimalInput(parsed, maxFractionDigits))
          onBlur?.(event)
        }}
        className={cn('tabular-nums', prefix && 'pl-10', suffix && 'pr-16', className)}
      />
    </Affixed>
  )
}

interface IntegerInputProps
  extends AffixProps,
    Omit<React.ComponentProps<'input'>, 'value' | 'onChange' | 'type' | 'defaultValue' | 'prefix'> {
  value: number | null | undefined
  onValueChange: (value: number | null) => void
  /** Separador de milhar na exibição (hodômetro) */
  grouped?: boolean
}

const grouping = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 })

/** Inteiro só com dígitos (hodômetro, minutos, corridas). */
export function IntegerInput({ value, onValueChange, grouped = false, prefix, suffix, className, ...props }: IntegerInputProps) {
  const display = value === null || value === undefined ? '' : grouped ? grouping.format(value) : String(value)
  return (
    <Affixed prefix={prefix} suffix={suffix}>
      <Input
        {...props}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        enterKeyHint="next"
        value={display}
        onChange={(event) => onValueChange(parseInteger(event.target.value))}
        className={cn('tabular-nums', prefix && 'pl-10', suffix && 'pr-14', className)}
      />
    </Affixed>
  )
}
