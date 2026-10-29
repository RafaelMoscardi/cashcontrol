import { ToggleGroup as ToggleGroupPrimitive } from 'radix-ui'
import { cn } from '@/lib/utils'

interface SegmentedControlProps<T extends string> {
  value: T
  onValueChange: (value: T) => void
  /** shortLabel: versão curta usada em telas estreitas */
  options: ReadonlyArray<{ value: T; label: string; shortLabel?: string }>
  'aria-label': string
  className?: string
  size?: 'sm' | 'default'
}

/** Seleção única em trilho (períodos, semana/mês). Rola na horizontal se faltar espaço. */
export function SegmentedControl<T extends string>({
  value,
  onValueChange,
  options,
  className,
  size = 'default',
  ...aria
}: SegmentedControlProps<T>) {
  return (
    <ToggleGroupPrimitive.Root
      type="single"
      value={value}
      onValueChange={(v) => v && onValueChange(v as T)}
      className={cn(
        'flex w-full max-w-full gap-1 overflow-x-auto overflow-y-hidden rounded-2xl border border-white/6 bg-white/[0.03] p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        className,
      )}
      {...aria}
    >
      {options.map((option) => (
        <ToggleGroupPrimitive.Item
          key={option.value}
          value={option.value}
          className={cn(
            'touch-target flex-1 shrink-0 rounded-xl px-3 font-medium whitespace-nowrap text-muted-foreground outline-none lg:px-4',
            'transition-[background-color,color,transform] duration-150 ease-snappy active:scale-[0.97]',
            'hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50',
            'data-[state=on]:bg-primary-strong data-[state=on]:text-primary-foreground data-[state=on]:shadow-[0_6px_16px_-8px_rgb(139_92_246/0.9)]',
            size === 'sm' ? 'h-8 text-xs' : 'h-9 text-[0.8125rem]',
          )}
        >
          {option.shortLabel ? (
            <>
              <span className="sm:hidden">{option.shortLabel}</span>
              <span className="hidden sm:inline">{option.label}</span>
            </>
          ) : (
            option.label
          )}
        </ToggleGroupPrimitive.Item>
      ))}
    </ToggleGroupPrimitive.Root>
  )
}
