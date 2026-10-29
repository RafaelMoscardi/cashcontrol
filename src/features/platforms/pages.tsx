import { Archive, ArchiveRestore, Check, Pencil, Plus, X } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { InlineLoading } from '@/components/app/loading-screen'
import { PageHeader } from '@/components/app/page-header'
import { SectionCard } from '@/components/app/section-card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Platform, PlatformKind } from '@/domain/types'
import { errorMessage } from '@/lib/errors'
import { cn } from '@/lib/utils'
import { useCreatePlatforms, usePlatforms, useUpdatePlatform } from './api'
import { PLATFORM_CATALOG, PLATFORM_KIND_LABEL } from './catalog'

const KINDS = Object.keys(PLATFORM_KIND_LABEL) as PlatformKind[]

function PlatformRow({ platform }: { platform: Platform }) {
  const update = useUpdatePlatform()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(platform.name)

  const save = async (patch: { name?: string; kind?: PlatformKind; archived?: boolean }) => {
    try {
      await update.mutateAsync({ id: platform.id, ...patch })
      if (patch.archived !== undefined) toast.success(patch.archived ? `${platform.name} arquivada` : `${platform.name} reativada`)
      setEditing(false)
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  return (
    <li className={cn('flex items-center gap-3 py-3', platform.archivedAt && 'opacity-60')}>
      <span className="size-3 shrink-0 rounded-full ring-2 ring-white/10" style={{ backgroundColor: platform.color }} />
      {editing ? (
        <form
          className="flex min-w-0 flex-1 items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (name.trim()) void save({ name })
          }}
        >
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={30} aria-label="Nome da plataforma" className="h-10" autoFocus />
          <Button type="submit" size="icon-sm" aria-label="Salvar nome" disabled={!name.trim() || update.isPending}>
            <Check />
          </Button>
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Cancelar" onClick={() => setEditing(false)}>
            <X />
          </Button>
        </form>
      ) : (
        <>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{platform.name}</p>
          </div>
          <Select value={platform.kind} onValueChange={(kind) => void save({ kind: kind as PlatformKind })} disabled={!!platform.archivedAt}>
            <SelectTrigger size="sm" className="w-32 text-xs" aria-label={`Tipo de ${platform.name}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {KINDS.map((k) => (
                <SelectItem key={k} value={k}>
                  {PLATFORM_KIND_LABEL[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!platform.archivedAt && (
            <Button variant="ghost" size="icon-sm" aria-label={`Renomear ${platform.name}`} onClick={() => setEditing(true)}>
              <Pencil />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={platform.archivedAt ? `Reativar ${platform.name}` : `Arquivar ${platform.name}`}
            onClick={() => void save({ archived: !platform.archivedAt })}
            disabled={update.isPending}
          >
            {platform.archivedAt ? <ArchiveRestore /> : <Archive />}
          </Button>
        </>
      )}
    </li>
  )
}

export function PlatformsPage() {
  const { data, isPending, error } = usePlatforms()
  const create = useCreatePlatforms()
  const [name, setName] = useState('')
  const [kind, setKind] = useState<PlatformKind>('rides')

  const active = (data ?? []).filter((p) => !p.archivedAt)
  const archived = (data ?? []).filter((p) => p.archivedAt)
  const names = new Set(active.map((p) => p.name.toLocaleLowerCase('pt-BR')))
  const suggestions = PLATFORM_CATALOG.filter((p) => !names.has(p.name.toLocaleLowerCase('pt-BR')))

  const add = async (items: { name: string; kind: PlatformKind }[]) => {
    try {
      await create.mutateAsync(items)
      toast.success(items.length === 1 ? `${items[0]!.name} adicionada` : 'Plataformas adicionadas')
      setName('')
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  return (
    <>
      <PageHeader title="Plataformas" description="Onde você trabalha. Os ganhos de cada jornada são lançados por plataforma." backTo="/mais" />
      {isPending && <InlineLoading />}
      {error && <p className="text-sm text-negative">{errorMessage(error)}</p>}
      {data && (
        <div className="flex flex-col gap-4">
          <SectionCard title="Suas plataformas">
            {active.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma plataforma ativa. Adicione abaixo.</p>
            ) : (
              <ul className="-my-3 divide-y divide-white/[0.06]">
                {active.map((p) => (
                  <PlatformRow key={p.id} platform={p} />
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard title="Adicionar">
            <form
              className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_10rem_auto]"
              onSubmit={(e) => {
                e.preventDefault()
                if (name.trim()) void add([{ name, kind }])
              }}
            >
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome, ex.: Lalamove" maxLength={30} aria-label="Nome da nova plataforma" />
              <Select value={kind} onValueChange={(v) => setKind(v as PlatformKind)}>
                <SelectTrigger className="w-full" aria-label="Tipo da nova plataforma">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {KINDS.map((k) => (
                    <SelectItem key={k} value={k}>
                      {PLATFORM_KIND_LABEL[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="submit" disabled={!name.trim() || create.isPending}>
                <Plus data-icon="inline-start" />
                Adicionar
              </Button>
            </form>
            {suggestions.length > 0 && (
              <div className="mt-4">
                <p className="mb-2 text-xs text-muted-foreground">Sugestões</p>
                <div className="flex flex-wrap gap-2">
                  {suggestions.map((s) => (
                    <button
                      key={s.name}
                      type="button"
                      onClick={() => void add([s])}
                      className="h-9 rounded-full border border-input px-3.5 text-sm text-muted-foreground outline-none transition-[background-color,color,transform] duration-150 ease-snappy hover:bg-white/[0.04] hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.96]"
                    >
                      + {s.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </SectionCard>

          {archived.length > 0 && (
            <SectionCard title="Arquivadas" description="Continuam nas jornadas antigas; não aparecem nas novas.">
              <ul className="-my-3 divide-y divide-white/[0.06]">
                {archived.map((p) => (
                  <PlatformRow key={p.id} platform={p} />
                ))}
              </ul>
            </SectionCard>
          )}
        </div>
      )}
    </>
  )
}
