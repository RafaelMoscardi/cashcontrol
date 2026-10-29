import { Archive, ArchiveRestore, Bike, Car, ChevronRight, Plus, Trash } from 'lucide-react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/app/confirm-dialog'
import { InlineLoading } from '@/components/app/loading-screen'
import { PageHeader } from '@/components/app/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { energyCostPerKm, fuelUnit, reservesPerKm, usesFuel } from '@/domain/energy'
import { monthlyFixedCost } from '@/domain/fixed-costs'
import type { Vehicle } from '@/domain/types'
import { errorMessage } from '@/lib/errors'
import { formatNumber, formatReais } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useArchiveVehicle, useDeleteVehicle, useSaveVehicle, useVehicles } from './api'
import { FUEL_LABEL, OWNERSHIP_LABEL, POWERTRAIN_LABEL } from './labels'
import { emptyVehicleForm, vehicleToForm, type VehicleFormValues } from './schema'
import { VehicleForm } from './vehicle-form'

// \u00a0: número e unidade nunca se separam, e a linha só quebra depois do "·" e do "+"
function energyLabel(v: Vehicle): string {
  if (v.powertrain === 'electric') return `${formatNumber(v.electricKmPerKwh ?? 0, 1)}\u00a0km/kWh`
  const fuel = `${FUEL_LABEL[v.fuelType ?? 'gasoline']}\u00a0· ${formatNumber(v.fuelKmPerUnit ?? 0, 1)}\u00a0km/${fuelUnit(v.fuelType)}`
  return v.powertrain === 'plugin_hybrid' ? `${fuel}\u00a0+ ${formatNumber(v.electricKmPerKwh ?? 0, 1)}\u00a0km/kWh` : fuel
}

function VehicleCard({ vehicle }: { vehicle: Vehicle }) {
  const Icon = vehicle.kind === 'motorcycle' ? Bike : Car
  const variable = energyCostPerKm(vehicle) + reservesPerKm(vehicle)
  const monthly = monthlyFixedCost(vehicle)
  return (
    <Link
      to={`/veiculos/${vehicle.id}`}
      className={cn(
        'group flex items-center gap-4 rounded-[1.375rem] border border-white/[0.06] bg-card p-4 outline-none',
        'transition-[background-color,transform] duration-150 ease-snappy hover:bg-surface-2 focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.99]',
        vehicle.archivedAt && 'opacity-60',
      )}
    >
      <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary/12 text-primary">
        <Icon className="size-6" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="min-w-0 truncate font-semibold">{vehicle.name}</h2>
          <Badge variant="secondary" className="rounded-md">
            {vehicle.kind === 'motorcycle' && vehicle.powertrain === 'electric' ? 'Elétrica' : POWERTRAIN_LABEL[vehicle.powertrain]}
          </Badge>
          {vehicle.archivedAt && <Badge variant="outline">Arquivado</Badge>}
        </div>
        {/* Quebra em vez de cortar: no celular estreito o corte escondia o consumo */}
        <p className="mt-0.5 text-sm text-pretty wrap-break-word text-muted-foreground">
          {[
            [vehicle.brand, vehicle.model].filter(Boolean).join(' '),
            vehicle.plate,
            usesFuel(vehicle.powertrain) || vehicle.powertrain === 'electric' ? energyLabel(vehicle) : null,
          ]
            .filter(Boolean)
            .join('\u00a0· ')}
        </p>
        <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <span>
            <span className="text-muted-foreground">Custo variável </span>
            <span className="font-medium tabular-nums">{formatReais(variable, 2)}/km</span>
          </span>
          <span>
            <span className="text-muted-foreground">Fixos </span>
            <span className="font-medium tabular-nums">{formatReais(monthly)}/mês</span>
          </span>
          <span className="text-muted-foreground">{OWNERSHIP_LABEL[vehicle.ownership]}</span>
        </p>
      </div>
      <ChevronRight className="size-5 shrink-0 text-faint transition-transform group-hover:translate-x-0.5" />
    </Link>
  )
}

export function VehiclesPage() {
  const { data: vehicles, isPending, error } = useVehicles()
  const active = (vehicles ?? []).filter((v) => !v.archivedAt)
  const archived = (vehicles ?? []).filter((v) => v.archivedAt)

  return (
    <>
      <PageHeader
        title="Veículos"
        description="Consumo, reservas e custos fixos usados no cálculo do lucro."
        actions={
          <Button asChild>
            <Link to="/veiculos/novo">
              <Plus data-icon="inline-start" />
              Novo
            </Link>
          </Button>
        }
      />
      {isPending && <InlineLoading />}
      {error && <p className="text-sm text-negative">{errorMessage(error)}</p>}
      {vehicles && active.length === 0 && (
        <Empty className="rounded-[1.375rem] border border-dashed border-white/10">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Car />
            </EmptyMedia>
            <EmptyTitle>Nenhum veículo ativo</EmptyTitle>
            <EmptyDescription>Cadastre o carro ou a moto com que você trabalha para calcular o custo por km.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button asChild>
              <Link to="/veiculos/novo">Cadastrar veículo</Link>
            </Button>
          </EmptyContent>
        </Empty>
      )}
      {/* grid-cols-1: sem coluna definida, o card cresce até caber a linha inteira e vaza da tela */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {active.map((v) => (
          <VehicleCard key={v.id} vehicle={v} />
        ))}
      </div>
      {archived.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">Arquivados</h2>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {archived.map((v) => (
              <VehicleCard key={v.id} vehicle={v} />
            ))}
          </div>
        </section>
      )}
    </>
  )
}

export function VehicleFormPage() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { data: vehicles, isPending } = useVehicles()
  const save = useSaveVehicle()
  const archive = useArchiveVehicle()
  const remove = useDeleteVehicle()
  const vehicle = id ? vehicles?.find((v) => v.id === id) : undefined
  const back = params.get('voltar')
  const done = back && back.startsWith('/') && !back.startsWith('//') ? back : '/veiculos'

  if (id && isPending) return <InlineLoading />
  if (id && !vehicle) {
    return (
      <>
        <PageHeader title="Veículo não encontrado" backTo="/veiculos" />
        <Button asChild variant="outline">
          <Link to="/veiculos">Ver veículos</Link>
        </Button>
      </>
    )
  }

  const onSubmit = async (values: VehicleFormValues) => {
    try {
      await save.mutateAsync({ id, values })
      toast.success(id ? 'Veículo atualizado' : 'Veículo cadastrado')
      navigate(done)
    } catch (e) {
      toast.error(errorMessage(e, 'Não foi possível salvar o veículo.'))
    }
  }

  const toggleArchive = async () => {
    if (!vehicle) return
    try {
      await archive.mutateAsync({ id: vehicle.id, archived: !vehicle.archivedAt })
      toast.success(vehicle.archivedAt ? 'Veículo reativado' : 'Veículo arquivado. As jornadas antigas continuam no histórico.')
      navigate('/veiculos')
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  const destroy = async () => {
    if (!vehicle) return
    try {
      await remove.mutateAsync(vehicle.id)
      toast.success('Veículo excluído')
      navigate('/veiculos')
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  return (
    <>
      <PageHeader
        title={vehicle ? vehicle.name : 'Novo veículo'}
        description={vehicle ? 'Mudanças valem para as próximas jornadas; as já registradas guardam os custos da época.' : undefined}
        backTo={done}
      />
      <VehicleForm
        key={vehicle?.id ?? 'novo'}
        defaultValues={vehicle ? vehicleToForm(vehicle) : emptyVehicleForm()}
        onSubmit={onSubmit}
        submitLabel={vehicle ? 'Salvar alterações' : 'Cadastrar veículo'}
        secondaryActions={
          vehicle && (
            <>
              <Button type="button" variant="outline" onClick={() => void toggleArchive()} disabled={archive.isPending}>
                {vehicle.archivedAt ? <ArchiveRestore data-icon="inline-start" /> : <Archive data-icon="inline-start" />}
                {vehicle.archivedAt ? 'Reativar' : 'Arquivar'}
              </Button>
              <ConfirmDialog
                trigger={
                  <Button type="button" variant="ghost" className="text-negative">
                    <Trash data-icon="inline-start" />
                    Excluir
                  </Button>
                }
                title="Excluir veículo?"
                description="Só é possível excluir um veículo sem jornadas. Se ele já tem histórico, arquive."
                confirmLabel="Excluir"
                destructive
                onConfirm={() => void destroy()}
              />
            </>
          )
        }
      />
    </>
  )
}
