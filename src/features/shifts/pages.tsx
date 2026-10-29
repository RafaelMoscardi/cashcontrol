import { ChevronLeft, ChevronRight, ListChecks, Plus, Trash } from 'lucide-react'
import { useMemo } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { Amount } from '@/components/app/amount'
import { ConfirmDialog } from '@/components/app/confirm-dialog'
import { InlineLoading } from '@/components/app/loading-screen'
import { PageHeader } from '@/components/app/page-header'
import { StatTile } from '@/components/app/stat-tile'
import { Button } from '@/components/ui/button'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { addMonths, endOfMonth, startOfMonth, todayISO } from '@/domain/dates'
import { computeShift } from '@/domain/shift'
import type { CostSnapshot, Platform, Shift, Vehicle } from '@/domain/types'
import { errorMessage } from '@/lib/errors'
import {
  capitalize,
  formatDateLong,
  formatDuration,
  formatKm,
  formatMoney,
  formatMonthYear,
  formatPerHour,
  formatTime,
} from '@/lib/format'
import { cn } from '@/lib/utils'
import { usePlatforms } from '@/features/platforms/api'
import { activeVehicles, useVehicles } from '@/features/vehicles/api'
import { useDeleteShift, useSaveShift, useShift, useShiftsBetween } from './api'
import { newShiftForm, shiftToForm, type ShiftFormValues } from './schema'
import { ShiftForm } from './shift-form'

const LAST_VEHICLE_KEY = 'cashcontrol:ultimo-veiculo'

function readLastVehicle(): string | null {
  try {
    return localStorage.getItem(LAST_VEHICLE_KEY)
  } catch {
    return null
  }
}

function rememberVehicle(id: string) {
  try {
    localStorage.setItem(LAST_VEHICLE_KEY, id)
  } catch {
    // modo privado ou armazenamento bloqueado: só perde a conveniência
  }
}

/* ------------------------------------------------------------ histórico */

function ShiftCard({ shift, vehicle, platforms }: { shift: Shift; vehicle?: Vehicle; platforms: Map<string, Platform> }) {
  const r = computeShift(shift)
  return (
    <Link
      to={`/jornadas/${shift.id}`}
      className={cn(
        'group block rounded-2xl border border-white/[0.06] bg-card px-4 py-3.5 outline-none',
        'transition-[background-color,transform] duration-150 ease-snappy hover:bg-surface-2 focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.99]',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium tabular-nums">
            {formatTime(shift.startedAt)}–{formatTime(shift.endedAt)}
            <span className="font-normal text-muted-foreground"> · {formatDuration(r.workedMinutes)}</span>
          </p>
          <p className="mt-0.5 truncate text-[0.8125rem] text-muted-foreground">
            {vehicle?.name ?? 'Veículo'} · {formatKm(r.distanceKm)}
            {r.trips !== null && ` · ${r.trips} corridas`}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <Amount cents={r.profit} tone="result" className="text-[0.9375rem] font-semibold" />
          <p className="text-xs text-muted-foreground tabular-nums">{formatPerHour(r.profitPerHour)}</p>
        </div>
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {shift.earnings.map((e) => {
          const p = platforms.get(e.platformId)
          return (
            <span key={e.platformId} className="inline-flex items-center gap-1.5">
              <span className="size-2 rounded-full" style={{ backgroundColor: p?.color }} />
              {p?.name ?? 'Plataforma'} <span className="tabular-nums text-secondary-foreground">{formatMoney(Math.round((e.amount + e.tips + e.bonus) * 100))}</span>
            </span>
          )
        })}
        {r.paidExpenses > 0 && <span className="tabular-nums">despesas {formatMoney(r.paidExpenses)}</span>}
      </div>
    </Link>
  )
}

export function ShiftsPage() {
  const [params, setParams] = useSearchParams()
  const today = todayISO()
  const month = /^\d{4}-\d{2}$/.test(params.get('mes') ?? '') ? `${params.get('mes')}-01` : startOfMonth(today)
  const range = { from: month, to: endOfMonth(month) }
  const shifts = useShiftsBetween(range)
  const vehicles = useVehicles()
  const platforms = usePlatforms()

  const vehicleById = useMemo(() => new Map((vehicles.data ?? []).map((v) => [v.id, v])), [vehicles.data])
  const platformById = useMemo(() => new Map((platforms.data ?? []).map((p) => [p.id, p])), [platforms.data])
  const list = useMemo(() => shifts.data ?? [], [shifts.data])

  const totals = useMemo(() => {
    let revenue = 0
    let profit = 0
    let km = 0
    let minutes = 0
    for (const s of list) {
      const r = computeShift(s)
      revenue += r.revenue
      profit += r.profit
      km += r.distanceKm
      minutes += r.workedMinutes
    }
    return { revenue, profit, km, minutes }
  }, [list])

  const byDay = useMemo(() => {
    const groups = new Map<string, Shift[]>()
    for (const s of list) groups.set(s.workDate, [...(groups.get(s.workDate) ?? []), s])
    return [...groups.entries()]
  }, [list])

  const goTo = (offset: number) => setParams({ mes: addMonths(month, offset).slice(0, 7) }, { replace: true })
  const isCurrentMonth = month === startOfMonth(today)

  return (
    <>
      <PageHeader
        title="Jornadas"
        actions={
          <Button asChild className="hidden sm:inline-flex">
            <Link to="/jornadas/nova">
              <Plus data-icon="inline-start" />
              Registrar
            </Link>
          </Button>
        }
      />
      <div className="mb-4 flex items-center justify-between gap-2 rounded-2xl border border-white/[0.06] bg-card p-1.5">
        <Button variant="ghost" size="icon-sm" className="touch-target" onClick={() => goTo(-1)} aria-label="Mês anterior">
          <ChevronLeft className="size-5" />
        </Button>
        <p className="text-[0.9375rem] font-medium" aria-live="polite">
          {capitalize(formatMonthYear(month))}
        </p>
        <Button variant="ghost" size="icon-sm" className="touch-target" onClick={() => goTo(1)} disabled={isCurrentMonth} aria-label="Próximo mês">
          <ChevronRight className="size-5" />
        </Button>
      </div>

      <div className={cn('grid grid-cols-2 gap-2 transition-opacity sm:grid-cols-4', shifts.isPlaceholderData && 'opacity-60')}>
        <StatTile label="Faturamento" value={formatMoney(totals.revenue)} />
        <StatTile label="Lucro das jornadas" value={<Amount cents={totals.profit} tone="result" />} />
        <StatTile label="Km rodados" value={formatKm(totals.km)} />
        <StatTile label="Horas" value={formatDuration(totals.minutes)} hint={`${list.length} ${list.length === 1 ? 'jornada' : 'jornadas'}`} />
      </div>

      {shifts.isPending && <InlineLoading />}
      {shifts.error && <p className="mt-6 text-sm text-negative">{errorMessage(shifts.error)}</p>}

      {shifts.data && list.length === 0 && (
        <Empty className="mt-6 rounded-[1.375rem] border border-dashed border-white/10">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ListChecks />
            </EmptyMedia>
            <EmptyTitle>Nenhuma jornada neste mês</EmptyTitle>
            <EmptyDescription>Registre ao fim de cada dia de trabalho: leva menos de um minuto.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button asChild>
              <Link to="/jornadas/nova">Registrar jornada</Link>
            </Button>
          </EmptyContent>
        </Empty>
      )}

      <div className={cn('mt-6 flex flex-col gap-6 transition-opacity', shifts.isPlaceholderData && 'opacity-60')}>
        {byDay.map(([day, dayShifts]) => {
          const dayProfit = dayShifts.reduce((sum, s) => sum + computeShift(s).profit, 0)
          return (
            <section key={day} aria-label={formatDateLong(day)}>
              <div className="mb-2 flex items-baseline justify-between px-1">
                <h2 className="text-sm font-medium">{capitalize(formatDateLong(day))}</h2>
                <Amount cents={dayProfit} tone="result" className="text-xs" />
              </div>
              <div className="flex flex-col gap-2">
                {dayShifts.map((s) => (
                  <ShiftCard key={s.id} shift={s} vehicle={vehicleById.get(s.vehicleId)} platforms={platformById} />
                ))}
              </div>
            </section>
          )
        })}
      </div>
    </>
  )
}

/* -------------------------------------------------------- formulário */

export function ShiftFormPage() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const vehicles = useVehicles()
  const platforms = usePlatforms()
  const shift = useShift(id)
  const save = useSaveShift()
  const remove = useDeleteShift()

  if (vehicles.isPending || platforms.isPending || (id && shift.isPending)) return <InlineLoading />
  if (vehicles.error || platforms.error || shift.error) {
    return <p className="pt-10 text-sm text-negative">{errorMessage(vehicles.error ?? platforms.error ?? shift.error)}</p>
  }
  if (id && !shift.data) {
    return (
      <>
        <PageHeader title="Jornada não encontrada" backTo="/jornadas" />
        <Button asChild variant="outline">
          <Link to="/jornadas">Ver jornadas</Link>
        </Button>
      </>
    )
  }

  const original = shift.data ?? undefined
  const active = activeVehicles(vehicles.data)
  const selectableVehicles = (vehicles.data ?? []).filter((v) => !v.archivedAt || v.id === original?.vehicleId)
  const usedPlatformIds = new Set(original?.earnings.map((e) => e.platformId))
  const selectablePlatforms = (platforms.data ?? []).filter((p) => !p.archivedAt || usedPlatformIds.has(p.id))
  const activePlatforms = selectablePlatforms.filter((p) => !p.archivedAt)

  if (!original && active.length === 0) {
    return (
      <>
        <PageHeader title="Registrar jornada" backTo="/" />
        <Empty className="rounded-[1.375rem] border border-dashed border-white/10">
          <EmptyHeader>
            <EmptyTitle>Cadastre um veículo primeiro</EmptyTitle>
            <EmptyDescription>O custo por km depende do consumo e dos custos do veículo.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button asChild>
              <Link to="/veiculos/novo?voltar=/jornadas/nova">Cadastrar veículo</Link>
            </Button>
          </EmptyContent>
        </Empty>
      </>
    )
  }
  if (!original && activePlatforms.length === 0) {
    return (
      <>
        <PageHeader title="Registrar jornada" backTo="/" />
        <Empty className="rounded-[1.375rem] border border-dashed border-white/10">
          <EmptyHeader>
            <EmptyTitle>Adicione suas plataformas</EmptyTitle>
            <EmptyDescription>Uber, 99, iFood… os ganhos são lançados por plataforma.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button asChild>
              <Link to="/plataformas">Ir para plataformas</Link>
            </Button>
          </EmptyContent>
        </Empty>
      </>
    )
  }

  const lastVehicle = readLastVehicle()
  const defaultVehicle = active.find((v) => v.id === lastVehicle) ?? active[0]
  const requestedDate = params.get('data')
  const defaultValues: ShiftFormValues = original
    ? shiftToForm(original)
    : newShiftForm({
        workDate: requestedDate && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate) ? requestedDate : todayISO(),
        vehicleId: defaultVehicle?.id ?? '',
        platformId: activePlatforms[0]?.id ?? '',
        odometerStart: null,
      })

  const onSubmit = async (values: ShiftFormValues, snapshot: CostSnapshot) => {
    try {
      await save.mutateAsync({ id, values, snapshot })
      rememberVehicle(values.vehicleId)
      toast.success(original ? 'Jornada atualizada' : 'Jornada salva')
      navigate(`/jornadas?mes=${values.workDate.slice(0, 7)}`)
    } catch (e) {
      toast.error(errorMessage(e, 'Não foi possível salvar a jornada.'))
    }
  }

  const destroy = async () => {
    if (!original) return
    try {
      await remove.mutateAsync(original.id)
      toast.success('Jornada excluída')
      navigate(`/jornadas?mes=${original.workDate.slice(0, 7)}`)
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  return (
    <>
      <PageHeader
        title={original ? 'Editar jornada' : 'Registrar jornada'}
        description={original ? capitalize(formatDateLong(original.workDate)) : undefined}
        backTo={original ? `/jornadas?mes=${original.workDate.slice(0, 7)}` : '/'}
      />
      <ShiftForm
        key={original?.id ?? 'nova'}
        defaultValues={defaultValues}
        vehicles={selectableVehicles}
        platforms={selectablePlatforms}
        original={original}
        onSubmit={onSubmit}
        secondaryActions={
          original && (
            <ConfirmDialog
              trigger={
                <Button type="button" variant="ghost" className="w-full text-negative">
                  <Trash data-icon="inline-start" />
                  Excluir jornada
                </Button>
              }
              title="Excluir esta jornada?"
              description="Os ganhos e as despesas dela também serão apagados. Não dá para desfazer."
              confirmLabel="Excluir"
              destructive
              onConfirm={() => void destroy()}
            />
          )
        }
      />
    </>
  )
}
