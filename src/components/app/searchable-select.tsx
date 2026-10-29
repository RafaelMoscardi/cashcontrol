import { ChevronDown, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useMediaQuery } from '@/hooks/use-media-query'
import { cn } from '@/lib/utils'

export interface SearchableSelectGroup {
  heading?: string
  items: string[]
}

interface SearchableSelectProps {
  id?: string
  value: string
  onValueChange: (value: string) => void
  groups: SearchableSelectGroup[]
  /** Título da lista (no celular aparece no topo da gaveta) */
  title: string
  placeholder: string
  searchPlaceholder: string
  disabled?: boolean
  invalid?: boolean
  /** Opção fixa no fim da lista, ex.: "Não achei meu modelo" */
  extraAction?: { label: string; icon: LucideIcon; onSelect: () => void }
}

const fold = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase('pt-BR')

/** Busca sem acento e sem diferença de maiúsculas; quem começa com o termo vem antes. */
function filter(value: string, search: string, keywords?: string[]) {
  const label = fold(keywords?.[0] ?? value)
  const term = fold(search.trim())
  if (!term) return 1
  if (label.startsWith(term)) return 1
  return label.includes(term) ? 0.5 : 0
}

/**
 * Campo que abre uma lista com busca: gaveta de baixo no celular, painel colado ao campo no desktop.
 * Para listas longas (marcas e modelos da FIPE), onde um select comum não dá conta.
 */
export function SearchableSelect({
  id,
  value,
  onValueChange,
  groups,
  title,
  placeholder,
  searchPlaceholder,
  disabled,
  invalid,
  extraAction,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false)
  const desktop = useMediaQuery('(min-width: 640px)')

  const choose = (next: string) => {
    onValueChange(next)
    setOpen(false)
  }

  const trigger = (
    <button
      id={id}
      type="button"
      disabled={disabled}
      aria-invalid={invalid || undefined}
      aria-haspopup="dialog"
      aria-expanded={open}
      className={cn(
        'flex h-11 w-full items-center justify-between gap-2 rounded-xl border border-input bg-input/30 pr-3 pl-3.5 text-left text-base outline-none transition-colors md:text-sm',
        'hover:bg-input/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50',
        'aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20',
      )}
    >
      <span className={cn('truncate', !value && 'text-muted-foreground')}>{value || placeholder}</span>
      <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    </button>
  )

  const list = (
    // Sem foco automático no celular: o teclado cobriria metade da lista das mais usadas
    <Command filter={filter} className="bg-transparent">
      <CommandInput placeholder={searchPlaceholder} autoFocus={desktop} />
      <CommandList className={cn(desktop ? 'max-h-72' : 'max-h-none flex-1')}>
        <CommandEmpty>Nada encontrado com esse nome.</CommandEmpty>
        {groups.map(
          (group, i) =>
            group.items.length > 0 && (
              <CommandGroup key={group.heading ?? i} heading={group.heading}>
                {group.items.map((item) => (
                  <CommandItem
                    key={item}
                    value={item}
                    keywords={[item]}
                    data-checked={item === value}
                    onSelect={() => choose(item)}
                    // No toque o primeiro item não parece pré-escolhido; o destaque fica só para o teclado
                    className="pointer-coarse:py-3 pointer-coarse:data-selected:bg-transparent pointer-coarse:active:bg-muted"
                  >
                    {item}
                  </CommandItem>
                ))}
              </CommandGroup>
            ),
        )}
        {extraAction && (
          <CommandGroup forceMount>
            <CommandItem
              forceMount
              value={`__extra:${extraAction.label}`}
              className="text-link"
              onSelect={() => {
                setOpen(false)
                extraAction.onSelect()
              }}
            >
              <extraAction.icon aria-hidden="true" />
              {extraAction.label}
            </CommandItem>
          </CommandGroup>
        )}
      </CommandList>
    </Command>
  )

  if (desktop) {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>{trigger}</PopoverTrigger>
        <PopoverContent align="start" className="w-(--radix-popover-trigger-width) min-w-64 p-1">
          {list}
        </PopoverContent>
      </Popover>
    )
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>{trigger}</DrawerTrigger>
      <DrawerContent className="h-[80dvh]">
        <DrawerHeader className="pb-2">
          <DrawerTitle>{title}</DrawerTitle>
        </DrawerHeader>
        <div className="flex min-h-0 flex-1 flex-col px-2 pb-[calc(var(--safe-bottom)+0.5rem)]">{list}</div>
      </DrawerContent>
    </Drawer>
  )
}
