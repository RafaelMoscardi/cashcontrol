import { RadioGroup as RadioGroupPrimitive } from 'radix-ui'
import type * as React from 'react'
import { cn } from '@/lib/utils'

export interface Choice<T extends string> {
  value: T
  label: string
  description?: string
  icon?: React.ComponentType<{ className?: string }>
}

interface ChoiceCardsProps<T extends string> {
  value: T
  onValueChange: (value: T) => void
  choices: ReadonlyArray<Choice<T>>
  columns?: 2 | 3 | 4
  'aria-label'?: string
  className?: string
}

/** Grupo de opções em cartões (rádio acessível: setas, Tab, leitor de tela). */
export function ChoiceCards<T extends string>({ value, onValueChange, choices, columns = 2, className, ...aria }: ChoiceCardsProps<T>) {
  return (
    <RadioGroupPrimitive.Root
      value={value}
      onValueChange={(v) => onValueChange(v as T)}
      className={cn(
        'grid gap-2',
        columns === 2 && 'grid-cols-2',
        columns === 3 && 'grid-cols-3',
        columns === 4 && 'grid-cols-2 sm:grid-cols-4',
        className,
      )}
      {...aria}
    >
      {choices.map(({ value: optionValue, label, description, icon: Icon }) => (
        <RadioGroupPrimitive.Item
          key={optionValue}
          value={optionValue}
          className={cn(
            'group relative flex min-h-14 flex-col items-start gap-1 rounded-xl border border-input bg-input/20 px-3.5 py-3 text-left outline-none',
            'transition-[transform,background-color,border-color,box-shadow] duration-150 ease-snappy active:scale-[0.98]',
            'hover:bg-input/40 focus-visible:ring-3 focus-visible:ring-ring/50',
            'data-[state=checked]:border-primary/70 data-[state=checked]:bg-primary/12 data-[state=checked]:shadow-[inset_0_0_0_1px_rgb(139_92_246/0.35)]',
          )}
        >
          <span className="flex items-center gap-2 text-sm font-medium">
            {Icon && <Icon className="size-4.5 text-muted-foreground transition-colors group-data-[state=checked]:text-primary" />}
            {label}
          </span>
          {description && <span className="text-xs leading-snug text-muted-foreground">{description}</span>}
        </RadioGroupPrimitive.Item>
      ))}
    </RadioGroupPrimitive.Root>
  )
}
