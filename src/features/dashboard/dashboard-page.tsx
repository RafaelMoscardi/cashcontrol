import { CalendarDays, Clock, Gauge, PiggyBank, Plus, Route, TrendingUp } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Amount } from '@/components/app/amount'
import { InlineLoading } from '@/components/app/loading-screen'
import { SectionCard } from '@/components/app/section-card'
import { SegmentedControl } from '@/components/app/segmented-control'
import { StatTile } from '@/components/app/stat-tile'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { DateRange, PeriodPreset } from '@/domain/dates'
import type { PeriodSummary } from '@/domain/period'
import { usePlatforms } from '@/features/platforms/api'
import { firstName, useProfile } from '@/features/profile/api'
import { errorMessage } from '@/lib/errors'
import {
  capitalize,
  formatDate,
  formatDateLong,
  formatDuration,
  formatKm,
  formatMoney,
  formatPerHour,
  formatPerKm,
} from '@/lib/format'
import { cn } from '@/lib/utils'
import { CostChart, DailyChart, PlatformChart } from './charts'
import { PERIOD_OPTIONS, usePeriodParams, usePeriodSummary } from './use-period'

function CustomRange({ range, onApply, active }: { range: DateRange; onApply: (r: DateRange) => void; active: boolean }) {
  const [open, setOpen] = useState(false)
  const [from, setFrom] = useState(range.from)
  const [to, setTo] = useState(range.to)
  const valid = Boolean(from && to && from <= to)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={active ? 'default' : 'outline'}
          className="h-11 min-w-11 shrink-0 rounded-2xl px-3"
          aria-label={active ? `Período de ${formatDate(range.from)} a ${formatDate(range.to)}` : 'Escolher datas'}
        >
          <CalendarDays />
          {active ? (
            <span className="text-[0.8125rem] tabular-nums">
              {formatDate(range.from).slice(0, 5)}–{formatDate(range.to).slice(0, 5)}
            </span>
          ) : (
            <span className="hidden text-[0.8125rem] sm:inline">Escolher datas</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 rounded-2xl">
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            if (!valid) return
            onApply({ from, to })
            setOpen(false)
          }}
        >
          <label className="flex flex-col gap-1.5 text-[0.8125rem] text-muted-foreground">
            De
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} max={to || undefined} />
          </label>
          <label className="flex flex-col gap-1.5 text-[0.8125rem] text-muted-foreground">
            Até
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} min={from || undefined} />
          </label>
          <Button type="submit" disabled={!valid}>
            Aplicar
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  )
}

function Line({ label, value, sub, strong, minus }: { label: string; value: number; sub?: string; strong?: boolean; minus?: boolean }) {
  return (
    <div className={cn('flex items-baseline justify-between gap-3 py-2 text-sm', strong && 'border-t border-white/[0.06] pt-3')}>
      <span className="min-w-0">
        <span className={cn(strong ? 'font-semibold text-foreground' : 'text-secondary-foreground')}>{label}</span>
        {sub && <span className="block text-xs text-muted-foreground">{sub}</span>}
      </span>
      {strong ? (
        <Amount cents={value} tone="result" className="shrink-0 font-semibold" />
      ) : (
        <span className="shrink-0 tabular-nums text-secondary-foreground">
          {minus && value > 0 ? '−' : ''}
          {formatMoney(value)}
        </span>
      )}
    </div>
  )
}

function OperationalCard({ s }: { s: PeriodSummary }) {
  const extras = [s.tips > 0 && `gorjetas ${formatMoney(s.tips)}`, s.bonus > 0 && `bônus ${formatMoney(s.bonus)}`].filter(Boolean).join(' · ')
  return (
    <SectionCard
      title="Resultado operacional"
      description="Quanto a operação gerou, já descontados o combustível, as despesas e os custos fixos."
      icon={TrendingUp}
    >
      <Line label="Faturamento" value={s.revenue} sub={extras ? `plataformas ${formatMoney(s.platformNet)} · ${extras}` : undefined} />
      <Line label="Combustível e energia (estimados pelos km)" value={s.energyCost} minus />
      <Line label="Despesas operacionais" value={s.operationalExpenses} minus sub="Pedágio, manutenção, alimentação…" />
      <Line label="Lucro das jornadas" value={s.profitBeforeFixed} strong />
      <Line
        label="Custos fixos"
        value={s.fixedCosts.total}
        minus
        sub={`Aluguel, parcela, seguro, IPVA… proporcionais a ${s.fixedCosts.days} ${s.fixedCosts.days === 1 ? 'dia' : 'dias'}`}
      />
      <Line label="Lucro real" value={s.operationalResult} strong />
    </SectionCard>
  )
}

function CashCard({ s }: { s: PeriodSummary }) {
  return (
    <SectionCard title="Fluxo de caixa" description="Dinheiro que entrou e saiu de fato no período." icon={PiggyBank}>
      <Line label="Entradas" value={s.cash.inflow} />
      <Line label="Abastecimentos e recargas pagos" value={s.cash.paidEnergy} minus />
      <Line label="Manutenções pagas" value={s.cash.paidMaintenance} minus />
      <Line label="Outras despesas pagas" value={s.cash.paidOperational} minus />
      <Line label="Saldo do período" value={s.cash.net} strong />
      <p className="mt-3 text-xs text-faint">Pagamentos de aluguel, seguro e parcelas ainda não são lançados no caixa.</p>
    </SectionCard>
  )
}

export function DashboardPage() {
  const { choice, range, today, setPreset, setCustom } = usePeriodParams()
  const { summary, isPending, isRefreshing, error } = usePeriodSummary(range, today)
  const platforms = usePlatforms()
  const profile = useProfile()
  const platformById = useMemo(() => new Map((platforms.data ?? []).map((p) => [p.id, p])), [platforms.data])
  const name = firstName(profile.data?.fullName)

  const costItems = summary
    ? [
        { label: 'Combustível e energia', cents: summary.energyCost, hint: 'estimado' },
        { label: 'Despesas operacionais', cents: summary.operationalExpenses },
        { label: 'Custos fixos', cents: summary.fixedCosts.total, hint: `${summary.fixedCosts.days} d` },
      ]
        .filter((i) => i.cents > 0)
        .sort((a, b) => b.cents - a.cents)
    : []

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-3 pt-[calc(var(--safe-top)+1.25rem)] pb-4 lg:pt-10">
        <div>
          <h1 className="text-[1.625rem] leading-tight font-semibold tracking-tight lg:text-3xl">{name ? `Olá, ${name}` : 'Seu painel'}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{capitalize(formatDateLong(today))}</p>
        </div>
      </header>

      <div className="mb-5 flex items-center gap-2">
        <SegmentedControl<PeriodPreset>
          aria-label="Período"
          value={choice === 'custom' || choice === '7d' ? ('' as PeriodPreset) : choice}
          onValueChange={setPreset}
          options={PERIOD_OPTIONS}
          className="min-w-0 flex-1 lg:w-auto lg:flex-none"
        />
        <CustomRange range={range} onApply={setCustom} active={choice === 'custom'} />
      </div>

      {isPending && <InlineLoading />}
      {error && <p className="text-sm text-negative">{errorMessage(error)}</p>}

      {summary && (
        <div className={cn('flex flex-col gap-4 transition-opacity duration-200', isRefreshing && 'opacity-60')}>
          <section
            aria-label="Lucro real do período"
            className="relative overflow-hidden rounded-[1.75rem] border border-primary/25 bg-gradient-to-br from-[#2a1b54] via-[#17132a] to-card p-5 sm:p-6"
          >
            <div className="pointer-events-none absolute -top-24 -right-16 size-64 rounded-full bg-primary/25 blur-3xl" aria-hidden="true" />
            <p className="relative text-sm text-secondary-foreground">
              Lucro real · {formatDate(range.from).slice(0, 5)}
              {range.to !== range.from && ` – ${formatDate(range.to).slice(0, 5)}`}
            </p>
            <p className="relative mt-1 text-[2.75rem] leading-none font-semibold tracking-tight sm:text-5xl">
              <Amount cents={summary.operationalResult} tone="result" />
            </p>
            <div className="relative mt-4 flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
              <span>
                <span className="text-muted-foreground">Faturamento </span>
                <span className="font-medium tabular-nums">{formatMoney(summary.revenue)}</span>
              </span>
              <span>
                <span className="text-muted-foreground">Custos </span>
                <span className="font-medium tabular-nums">{formatMoney(summary.revenue - summary.operationalResult)}</span>
              </span>
              <span>
                <span className="text-muted-foreground">Por hora </span>
                <span className="font-medium tabular-nums">{formatPerHour(summary.resultPerHour)}</span>
              </span>
            </div>
          </section>

          {summary.shifts === 0 ? (
            <section className="rounded-[1.375rem] border border-dashed border-white/10 p-6 text-center">
              <h2 className="font-semibold">Nenhuma jornada neste período</h2>
              <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
                {summary.fixedCosts.total > 0
                  ? `Os custos fixos continuam correndo: ${formatMoney(summary.fixedCosts.total)} até agora.`
                  : 'Registre uma jornada para ver faturamento, custos e lucro.'}
              </p>
              <Button asChild className="mt-4">
                <Link to="/jornadas/nova">
                  <Plus data-icon="inline-start" />
                  Registrar jornada
                </Link>
              </Button>
            </section>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                <StatTile icon={Clock} label="Ganho por hora" value={formatPerHour(summary.revenuePerHour)} hint={`${formatDuration(summary.workedMinutes)} trabalhadas`} />
                <StatTile icon={Gauge} label="Custo por km" value={formatPerKm(summary.totalCostPerKm)} hint={`ganho ${formatPerKm(summary.revenuePerKm)}`} />
                <StatTile icon={Route} label="Km rodados" value={formatKm(summary.distanceKm)} hint={`${summary.shifts} ${summary.shifts === 1 ? 'jornada' : 'jornadas'}`} />
                <StatTile
                  icon={TrendingUp}
                  label="Lucro por km"
                  value={formatPerKm(summary.resultPerKm)}
                  hint={summary.trips ? `${summary.trips} corridas` : 'corridas não informadas'}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <OperationalCard s={summary} />
                <CashCard s={summary} />
              </div>

              {summary.daily.length > 1 && <DailyChart points={summary.daily} />}

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <PlatformChart slices={summary.byPlatform} platforms={platformById} total={summary.revenue} />
                {costItems.length > 0 && <CostChart items={costItems} revenue={summary.revenue} />}
              </div>
            </>
          )}
        </div>
      )}
    </>
  )
}
