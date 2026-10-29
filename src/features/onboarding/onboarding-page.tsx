import { Check, Plus } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { FocusLayout } from '@/app/layouts'
import { LoadingScreen } from '@/components/app/loading-screen'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import type { PlatformKind } from '@/domain/types'
import { useCreatePlatforms, usePlatforms } from '@/features/platforms/api'
import { PLATFORM_CATALOG } from '@/features/platforms/catalog'
import { firstName, useProfile, useUpdateProfile } from '@/features/profile/api'
import { activeVehicles, useSaveVehicle, useVehicles } from '@/features/vehicles/api'
import { emptyVehicleForm, type VehicleFormValues } from '@/features/vehicles/schema'
import { VehicleForm } from '@/features/vehicles/vehicle-form'
import { errorMessage } from '@/lib/errors'
import { cn } from '@/lib/utils'

function Steps({ current }: { current: 1 | 2 }) {
  return (
    <ol className="mb-6 flex items-center gap-2 text-xs text-muted-foreground" aria-label="Etapas do primeiro acesso">
      {['Plataformas', 'Veículo'].map((label, i) => {
        const step = i + 1
        const done = step < current
        return (
          <li key={label} className="flex items-center gap-2" aria-current={step === current ? 'step' : undefined}>
            {i > 0 && <span className="h-px w-6 bg-white/10" />}
            <span
              className={cn(
                'grid size-6 place-items-center rounded-full border text-[0.6875rem] font-semibold',
                step === current && 'border-primary bg-primary text-primary-foreground',
                done && 'border-primary/50 bg-primary/15 text-primary',
                step > current && 'border-white/10',
              )}
            >
              {done ? <Check className="size-3.5" /> : step}
            </span>
            <span className={cn(step === current && 'text-foreground')}>{label}</span>
          </li>
        )
      })}
    </ol>
  )
}

export function OnboardingPage() {
  const navigate = useNavigate()
  const profile = useProfile()
  const platforms = usePlatforms()
  const vehicles = useVehicles()
  const createPlatforms = useCreatePlatforms()
  const saveVehicle = useSaveVehicle()
  const updateProfile = useUpdateProfile()

  const [picked, setPicked] = useState<Set<string>>(() => new Set())
  const [custom, setCustom] = useState<Array<{ name: string; kind: PlatformKind }>>([])
  const [customName, setCustomName] = useState('')
  const [backToPlatforms, setBackToPlatforms] = useState(false)

  if (profile.isPending || platforms.isPending || vehicles.isPending) return <LoadingScreen />

  const existing = (platforms.data ?? []).filter((p) => !p.archivedAt)
  const existingNames = new Set(existing.map((p) => p.name.toLocaleLowerCase('pt-BR')))
  const step: 1 | 2 = existing.length === 0 || backToPlatforms ? 1 : 2
  const name = firstName(profile.data?.fullName)

  const finish = async () => {
    await updateProfile.mutateAsync({ onboardedAt: new Date().toISOString() })
    navigate('/', { replace: true })
  }

  const toggle = (platformName: string) =>
    setPicked((prev) => {
      const next = new Set(prev)
      if (next.has(platformName)) next.delete(platformName)
      else next.add(platformName)
      return next
    })

  const addCustom = () => {
    const trimmed = customName.trim()
    if (!trimmed) return
    const lower = trimmed.toLocaleLowerCase('pt-BR')
    const fromCatalog = PLATFORM_CATALOG.find((p) => p.name.toLocaleLowerCase('pt-BR') === lower)
    if (fromCatalog) setPicked((prev) => new Set(prev).add(fromCatalog.name))
    else if (!custom.some((c) => c.name.toLocaleLowerCase('pt-BR') === lower)) setCustom((prev) => [...prev, { name: trimmed, kind: 'other' }])
    setCustomName('')
  }

  const continueToVehicle = async () => {
    const items = [
      ...PLATFORM_CATALOG.filter((p) => picked.has(p.name)),
      ...custom,
    ].filter((p) => !existingNames.has(p.name.toLocaleLowerCase('pt-BR')))
    try {
      if (items.length) await createPlatforms.mutateAsync(items)
      setBackToPlatforms(false)
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  const onVehicle = async (values: VehicleFormValues) => {
    try {
      await saveVehicle.mutateAsync({ values })
      await finish()
      toast.success('Tudo pronto! Registre sua primeira jornada quando terminar de rodar.')
    } catch (e) {
      toast.error(errorMessage(e, 'Não foi possível salvar o veículo.'))
    }
  }

  if (step === 1) {
    const selectedCount = picked.size + custom.length + existing.length
    return (
      <FocusLayout wide>
        <Steps current={1} />
        <h1 className="text-[1.75rem] leading-tight font-semibold tracking-tight">{name ? `${name}, onde você trabalha?` : 'Onde você trabalha?'}</h1>
        <p className="mt-1.5 mb-6 text-[0.9375rem] text-muted-foreground">Escolha todas que usa. Dá para mudar depois.</p>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Plataformas">
          {existing.map((p) => (
            <span key={p.id} className="inline-flex h-11 items-center gap-2 rounded-full border border-primary/50 bg-primary/12 px-4 text-sm font-medium">
              <Check className="size-4 text-primary" />
              {p.name}
            </span>
          ))}
          {PLATFORM_CATALOG.filter((p) => !existingNames.has(p.name.toLocaleLowerCase('pt-BR'))).map((p) => {
            const on = picked.has(p.name)
            return (
              <button
                key={p.name}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(p.name)}
                className={cn(
                  'inline-flex h-11 items-center gap-2 rounded-full border px-4 text-sm font-medium outline-none select-none',
                  'transition-[background-color,border-color,color,transform] duration-150 ease-snappy active:scale-[0.96] focus-visible:ring-3 focus-visible:ring-ring/50',
                  on ? 'border-primary/60 bg-primary/15 text-foreground' : 'border-input text-muted-foreground hover:text-foreground',
                )}
              >
                {on && <Check className="size-4 text-primary" />}
                {p.name}
              </button>
            )
          })}
          {custom.map((c) => (
            <button
              key={c.name}
              type="button"
              aria-pressed
              onClick={() => setCustom((prev) => prev.filter((x) => x.name !== c.name))}
              className="inline-flex h-11 items-center gap-2 rounded-full border border-primary/60 bg-primary/15 px-4 text-sm font-medium outline-none active:scale-[0.96]"
            >
              <Check className="size-4 text-primary" />
              {c.name}
            </button>
          ))}
        </div>
        <form
          className="mt-4 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            addCustom()
          }}
        >
          <Input value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="Outra plataforma" maxLength={30} aria-label="Outra plataforma" />
          <Button type="submit" variant="outline" disabled={!customName.trim()}>
            <Plus data-icon="inline-start" />
            Incluir
          </Button>
        </form>
        <Button size="lg" className="mt-8 w-full sm:w-auto sm:min-w-56" disabled={selectedCount === 0 || createPlatforms.isPending} onClick={() => void continueToVehicle()}>
          {createPlatforms.isPending && <Spinner data-icon="inline-start" />}
          Continuar
        </Button>
      </FocusLayout>
    )
  }

  const hasVehicle = activeVehicles(vehicles.data).length > 0
  return (
    <FocusLayout wide>
      <Steps current={2} />
      <h1 className="text-[1.75rem] leading-tight font-semibold tracking-tight">Seu veículo</h1>
      <p className="mt-1.5 mb-6 text-[0.9375rem] text-muted-foreground text-pretty">
        Consumo, preço do combustível e custos do veículo. É daqui que sai o custo por km de cada jornada.{' '}
        <button type="button" className="text-primary underline-offset-4 hover:underline" onClick={() => setBackToPlatforms(true)}>
          Voltar às plataformas
        </button>
      </p>
      {hasVehicle ? (
        <Button size="lg" onClick={() => void finish()} disabled={updateProfile.isPending}>
          Concluir
        </Button>
      ) : (
        <VehicleForm defaultValues={emptyVehicleForm()} onSubmit={onVehicle} submitLabel="Concluir" />
      )}
    </FocusLayout>
  )
}
