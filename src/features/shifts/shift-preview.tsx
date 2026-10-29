import type * as React from 'react'
import { Amount } from '@/components/app/amount'
import { estimateConsumption, fuelUnit } from '@/domain/energy'
import type { ShiftResult } from '@/domain/shift'
import type { CostParams } from '@/domain/types'
import { formatDuration, formatKm, formatMoney, formatNumber, formatPerHour, formatPerKm } from '@/lib/format'
import { cn } from '@/lib/utils'

interface ShiftPreviewProps {
  result: ShiftResult | null
  params: CostParams | null
  className?: string
}

function Row({ label, value, muted, strong }: { label: string; value: React.ReactNode; muted?: boolean; strong?: boolean }) {
  return (
    <div className={cn('flex items-baseline justify-between gap-3 py-1.5 text-sm', strong && 'border-t border-white/[0.06] pt-2.5 font-semibold')}>
      <span className={cn(muted ? 'text-muted-foreground' : 'text-secondary-foreground', strong && 'text-foreground')}>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  )
}

/** Resultado da jornada calculado ao vivo, com as mesmas fórmulas do painel. */
export function ShiftPreview({ result, params, className }: ShiftPreviewProps) {
  if (!result) {
    return (
      <section className={cn('rounded-[1.375rem] border border-dashed border-white/10 p-5 text-sm text-muted-foreground', className)}>
        Preencha horário, veículo e hodômetro para ver o resultado.
      </section>
    )
  }

  const consumption = params ? estimateConsumption(params, result.distanceKm) : null
  const energyLabel =
    consumption?.fuel != null && consumption.kwh != null
      ? `Energia estimada (${formatNumber(consumption.fuel, 1)} ${fuelUnit(params?.fuelType ?? null)} + ${formatNumber(consumption.kwh, 1)} kWh)`
      : consumption?.kwh != null
        ? `Energia estimada (${formatNumber(consumption.kwh, 1)} kWh)`
        : consumption?.fuel != null
          ? `Combustível estimado (${formatNumber(consumption.fuel, 1)} ${fuelUnit(params?.fuelType ?? null)})`
          : 'Energia estimada'
  const extras = result.tips + result.bonus
  const cash = result.revenue - result.paidExpenses

  return (
    <section
      aria-live="polite"
      className={cn(
        'overflow-hidden rounded-[1.375rem] border border-primary/20 bg-gradient-to-b from-primary/[0.09] to-card p-5',
        className,
      )}
    >
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Lucro da jornada</p>
      <p className="mt-1 text-[2rem] leading-none font-semibold tracking-tight">
        <Amount cents={result.profit} tone="result" />
      </p>
      <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
        <span>
          <span className="font-medium text-foreground tabular-nums">{formatPerHour(result.profitPerHour)}</span> de lucro
        </span>
        <span>
          custo <span className="font-medium text-foreground tabular-nums">{formatPerKm(result.costPerKm)}</span>
        </span>
      </p>

      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        {[
          ['Km', formatKm(result.distanceKm)],
          ['Horas', formatDuration(result.workedMinutes)],
          ['Corridas', result.trips === null ? '—' : String(result.trips)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl bg-black/20 px-2 py-2">
            <div className="text-[0.6875rem] text-muted-foreground">{label}</div>
            <div className="truncate text-sm font-medium tabular-nums">{value}</div>
          </div>
        ))}
      </div>

      <div className="mt-4">
        <Row label="Recebido das plataformas" value={formatMoney(result.platformNet)} />
        {extras > 0 && <Row label="Gorjetas e bônus" value={formatMoney(extras)} />}
        <Row label={energyLabel} value={`−${formatMoney(result.energyCost)}`} muted />
        <Row label="Reservas (manutenção, pneus, depreciação)" value={`−${formatMoney(result.reserves)}`} muted />
        {result.operationalExpenses > 0 && <Row label="Despesas da jornada" value={`−${formatMoney(result.operationalExpenses)}`} muted />}
        <Row label="Lucro da jornada" value={<Amount cents={result.profit} tone="result" />} strong />
      </div>

      {result.paidExpenses > 0 && (
        <div className="mt-3 rounded-xl bg-black/20 px-3.5 py-3 text-[0.8125rem] text-muted-foreground">
          <div className="flex justify-between gap-3">
            <span>Caixa da jornada (recebido − pago)</span>
            <Amount cents={cash} tone="result" className="font-medium" />
          </div>
          {(result.paidEnergy > 0 || result.paidMaintenance > 0) && (
            <p className="mt-1.5 leading-snug">
              Abastecimento e manutenção pagos saem do caixa, mas não do lucro: ele já desconta a estimativa por km.
            </p>
          )}
        </div>
      )}
    </section>
  )
}
