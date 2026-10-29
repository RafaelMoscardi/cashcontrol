import { BadgeCheck } from 'lucide-react'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { ConsumptionOption } from './consumption'

interface ConsumptionSuggestionsProps {
  options: ConsumptionOption[]
  /** Valor atual do campo de consumo (marca a opção usada) */
  current: number | null
  /** Ex.: "com gasolina"; não aparece nos elétricos */
  fuelLabel: string
  onPick: (value: number) => void
}

/** Consumo oficial do Inmetro para o carro escolhido: tocar preenche o campo, nada é preenchido sozinho. */
export function ConsumptionSuggestions({ options, current, fuelLabel, onPick }: ConsumptionSuggestionsProps) {
  const [first] = options
  if (!first) return null
  const electric = first.unit === 'km/kWh'
  const years = [...new Set(options.map((o) => o.year))].sort()
  const source = years.length === 1 ? `tabela ${years[0]}` : `tabelas de ${years[0]} a ${years[years.length - 1]}`

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3.5">
      <p className="flex items-center gap-1.5 text-[0.8125rem] font-medium text-secondary-foreground">
        <BadgeCheck className="size-4 shrink-0 text-link" aria-hidden="true" />
        {electric ? 'Consumo do Inmetro' : `Consumo do Inmetro na cidade, ${fuelLabel}`}
      </p>
      <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
        {options.map((option) => {
          const selected = current !== null && Math.abs(current - option.value) < 0.05
          return (
            <button
              key={option.label}
              type="button"
              aria-pressed={selected}
              onClick={() => onPick(option.value)}
              className={cn(
                'flex h-11 items-center justify-between gap-3 rounded-xl border px-3 text-left text-sm outline-none transition-[background-color,border-color,transform] duration-150 ease-snappy active:scale-[0.98] focus-visible:ring-3 focus-visible:ring-ring/50',
                selected ? 'border-primary/70 bg-primary/12' : 'border-input hover:bg-white/[0.03]',
              )}
            >
              <span className="truncate text-secondary-foreground">{option.label}</span>
              <span className="shrink-0 font-medium tabular-nums">
                {formatNumber(option.value, 1)} {option.unit}
              </span>
            </button>
          )
        })}
      </div>
      <p className="mt-2.5 text-xs text-muted-foreground text-pretty">
        {electric ? 'Medido em laboratório; no dia a dia varia com o trânsito e o ar.' : 'Com ar ligado e trânsito pesado, o consumo real costuma ser um pouco menor.'} Toque
        para usar e ajuste quando quiser. Fonte: Inmetro, {source}.
      </p>
    </div>
  )
}
