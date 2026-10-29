/* Gráficos do painel (Recharts via components/ui/chart).
   Regras da skill de dataviz: barras finas (≤ 24 px) com ponta arredondada só
   no lado do dado, grade em linha fina sólida, legenda com 2+ séries, texto
   nunca na cor da série, tooltip com o valor em destaque e tabela alternativa. */
import { Table2 } from 'lucide-react'
import { useState } from 'react'
import type * as React from 'react'
import { Bar, BarChart, CartesianGrid, Cell, LabelList, XAxis, YAxis } from 'recharts'
import { ChartContainer, ChartTooltip, type ChartConfig } from '@/components/ui/chart'
import { Button } from '@/components/ui/button'
import type { DailyPoint, PlatformSlice } from '@/domain/period'
import type { Platform } from '@/domain/types'
import { formatDayMonth, formatDuration, formatKm, formatMoney, formatMoneyCompact, formatPercent, formatWeekdayShort } from '@/lib/format'
import { cn } from '@/lib/utils'

/** Retângulo com cantos de 4 px só na ponta do dado (acima ou abaixo de zero). */
function DataEndBar(props: { x?: number; y?: number; width?: number; height?: number; fill?: string; value?: number | number[] }) {
  const { x = 0, y = 0, width = 0, fill } = props
  let { height = 0 } = props
  if (!width || !height) return null
  const value = Array.isArray(props.value) ? (props.value[1] ?? 0) - (props.value[0] ?? 0) : (props.value ?? 0)
  // Recharts entrega altura negativa para valores abaixo de zero em algumas versões
  let top = y
  if (height < 0) {
    top = y + height
    height = -height
  }
  const r = Math.min(4, width / 2, height)
  const path =
    value >= 0
      ? `M${x},${top + height} V${top + r} Q${x},${top} ${x + r},${top} H${x + width - r} Q${x + width},${top} ${x + width},${top + r} V${top + height} Z`
      : `M${x},${top} V${top + height - r} Q${x},${top + height} ${x + r},${top + height} H${x + width - r} Q${x + width},${top + height} ${x + width},${top + height - r} V${top} Z`
  return <path d={path} fill={fill} />
}

interface TooltipRow {
  label: string
  value: string
  color: string
}

function TooltipCard({ title, rows }: { title: string; rows: TooltipRow[] }) {
  return (
    <div className="min-w-40 rounded-xl border border-white/10 bg-popover px-3 py-2.5 text-xs shadow-xl">
      <p className="mb-1.5 text-muted-foreground">{title}</p>
      <div className="flex flex-col gap-1">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center gap-2">
            <span className="h-0.5 w-3 rounded-full" style={{ backgroundColor: row.color }} />
            <span className="font-semibold text-foreground tabular-nums">{row.value}</span>
            <span className="text-muted-foreground">{row.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function ChartCard({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string
  description?: string
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn('rounded-[1.375rem] border border-white/[0.06] bg-card p-4 sm:p-5', className)}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[0.9375rem] font-semibold tracking-tight">{title}</h2>
          {description && <p className="mt-0.5 text-[0.8125rem] text-muted-foreground">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

function Legend({ items }: { items: Array<{ label: string; color: string }> }) {
  return (
    <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {items.map((item) => (
        <span key={item.label} className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-[3px]" style={{ backgroundColor: item.color }} />
          {item.label}
        </span>
      ))}
    </div>
  )
}

const DAILY_CONFIG = {
  revenue: { label: 'Faturamento', color: 'var(--chart-1)' },
  profit: { label: 'Lucro das jornadas', color: 'var(--chart-2)' },
} satisfies ChartConfig

/** Rótulo do eixo em duas linhas (dia da semana sobre o dia), estreito o bastante para 7 dias no celular. */
function DayTick(props: { x?: number; y?: number; payload?: { value: string }; many?: boolean }) {
  const { x = 0, y = 0, payload, many } = props
  if (!payload) return null
  const [weekday, day] = payload.value.split('|')
  return (
    <text x={x} y={y + 4} textAnchor="middle" className="fill-muted-foreground text-[11px]">
      {!many && <tspan x={x} dy="0.71em">{weekday}</tspan>}
      <tspan x={x} dy={many ? '0.71em' : '1.25em'} className={many ? undefined : 'fill-secondary-foreground'}>
        {day}
      </tspan>
    </text>
  )
}

export function DailyChart({ points }: { points: DailyPoint[] }) {
  const [asTable, setAsTable] = useState(false)
  const many = points.length > 10
  const data = points.map((p) => ({
    ...p,
    label: `${formatWeekdayShort(p.date)}|${formatDayMonth(p.date).slice(0, 2)}`,
    revenueReais: p.revenue / 100,
    profitReais: p.profit / 100,
  }))

  return (
    <ChartCard
      title="Faturamento e lucro por dia"
      description="Lucro antes dos custos fixos."
      action={
        <Button variant="ghost" size="sm" onClick={() => setAsTable((v) => !v)} aria-pressed={asTable}>
          <Table2 data-icon="inline-start" />
          {asTable ? 'Gráfico' : 'Tabela'}
        </Button>
      }
    >
      {asTable ? (
        <div className="max-h-80 overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-card text-left text-xs text-muted-foreground">
              <tr>
                <th className="py-2 font-medium">Dia</th>
                <th className="py-2 text-right font-medium">Faturamento</th>
                <th className="py-2 text-right font-medium">Lucro</th>
                <th className="hidden py-2 text-right font-medium sm:table-cell">Km</th>
                <th className="hidden py-2 text-right font-medium sm:table-cell">Horas</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {points.map((p) => (
                <tr key={p.date} className="border-t border-white/[0.05]">
                  <td className="py-2">
                    {formatWeekdayShort(p.date)} {formatDayMonth(p.date)}
                  </td>
                  <td className="py-2 text-right">{formatMoney(p.revenue)}</td>
                  <td className={cn('py-2 text-right', p.profit < 0 && 'text-negative')}>{formatMoney(p.profit)}</td>
                  <td className="hidden py-2 text-right sm:table-cell">{p.shifts ? formatKm(p.distanceKm) : '—'}</td>
                  <td className="hidden py-2 text-right sm:table-cell">{p.shifts ? formatDuration(p.workedMinutes) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <>
          <Legend
            items={[
              { label: 'Faturamento', color: 'var(--chart-1)' },
              { label: 'Lucro das jornadas', color: 'var(--chart-2)' },
            ]}
          />
          <ChartContainer config={DAILY_CONFIG} className="aspect-auto h-60 w-full">
            <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 4 }} barGap={2} barCategoryGap={many ? '18%' : '28%'}>
              <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={{ stroke: 'var(--chart-axis)' }}
                tick={<DayTick many={many} />}
                height={many ? 24 : 36}
                interval={many ? 'preserveStartEnd' : 0}
                minTickGap={6}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={56}
                tickFormatter={(v: number) => formatMoneyCompact(v * 100)}
                tickCount={5}
              />
              <ChartTooltip
                cursor={{ fill: 'rgb(255 255 255 / 0.04)' }}
                content={({ active, payload }) => {
                  const point = active && payload?.[0] ? (payload[0].payload as (typeof data)[number]) : null
                  if (!point) return null
                  return (
                    <TooltipCard
                      title={`${formatWeekdayShort(point.date)}, ${formatDayMonth(point.date)}${point.shifts ? ` · ${formatKm(point.distanceKm)}` : ' · sem jornada'}`}
                      rows={[
                        { label: 'faturamento', value: formatMoney(point.revenue), color: 'var(--chart-1)' },
                        { label: 'lucro', value: formatMoney(point.profit), color: 'var(--chart-2)' },
                      ]}
                    />
                  )
                }}
              />
              <Bar dataKey="revenueReais" fill="var(--color-revenue)" maxBarSize={24} shape={DataEndBar} isAnimationActive={false} />
              <Bar dataKey="profitReais" fill="var(--color-profit)" maxBarSize={24} shape={DataEndBar} isAnimationActive={false} />
            </BarChart>
          </ChartContainer>
        </>
      )}
    </ChartCard>
  )
}

export function PlatformChart({ slices, platforms, total }: { slices: PlatformSlice[]; platforms: Map<string, Platform>; total: number }) {
  // Até 5 plataformas com cor própria; o resto vira "Outras"
  const top = slices.slice(0, 5)
  const rest = slices.slice(5)
  const rows = [
    ...top.map((s) => ({
      key: s.platformId,
      name: platforms.get(s.platformId)?.name ?? 'Plataforma',
      color: platforms.get(s.platformId)?.color ?? 'var(--chart-1)',
      revenue: s.revenue,
      trips: s.trips,
    })),
    ...(rest.length
      ? [{ key: 'outras', name: 'Outras', color: '#7c7a8c', revenue: rest.reduce((n, s) => n + s.revenue, 0), trips: null as number | null }]
      : []),
  ].map((r) => ({ ...r, reais: r.revenue / 100, share: total > 0 ? r.revenue / total : 0 }))

  if (rows.length < 2) {
    const only = rows[0]
    return (
      <ChartCard title="Faturamento por plataforma">
        <p className="flex items-center gap-2 text-sm">
          <span className="size-2.5 rounded-full" style={{ backgroundColor: only?.color }} />
          <span className="font-medium">{only?.name ?? '—'}</span>
          <span className="text-muted-foreground">100% do faturamento · {formatMoney(only?.revenue ?? 0)}</span>
        </p>
      </ChartCard>
    )
  }

  return (
    <ChartCard title="Faturamento por plataforma">
      <ChartContainer config={{ reais: { label: 'Faturamento' } }} className="aspect-auto w-full" style={{ height: rows.length * 44 + 8 }}>
        <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 128, bottom: 0, left: 0 }} barCategoryGap="30%">
          <XAxis type="number" hide domain={[0, 'dataMax']} />
          <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} width={72} tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }} />
          <ChartTooltip
            cursor={{ fill: 'rgb(255 255 255 / 0.04)' }}
            content={({ active, payload }) => {
              const row = active && payload?.[0] ? (payload[0].payload as (typeof rows)[number]) : null
              if (!row) return null
              return (
                <TooltipCard
                  title={row.name}
                  rows={[
                    { label: `${formatPercent(row.share)} do total`, value: formatMoney(row.revenue), color: row.color },
                    ...(row.trips ? [{ label: 'corridas', value: String(row.trips), color: row.color }] : []),
                  ]}
                />
              )
            }}
          />
          <Bar dataKey="reais" maxBarSize={20} shape={HorizontalDataEndBar} isAnimationActive={false}>
            {rows.map((r) => (
              <Cell key={r.key} fill={r.color} />
            ))}
            <LabelList
              dataKey="key"
              content={(label) => {
                // Texto numa linha só (o rótulo padrão do Recharts quebra linha quando falta espaço)
                const row = rows.find((r) => r.key === label.value)
                const x = Number(label.x ?? 0) + Number(label.width ?? 0) + 8
                const y = Number(label.y ?? 0) + Number(label.height ?? 0) / 2
                if (!row) return null
                return (
                  <text x={x} y={y} dominantBaseline="central" className="fill-foreground text-xs tabular-nums">
                    {formatMoney(row.revenue)}
                    <tspan className="fill-muted-foreground"> · {formatPercent(row.share)}</tspan>
                  </text>
                )
              }}
            />
          </Bar>
        </BarChart>
      </ChartContainer>
    </ChartCard>
  )
}

/** Barra horizontal: ponta arredondada à direita, base reta no eixo. */
function HorizontalDataEndBar(props: { x?: number; y?: number; width?: number; height?: number; fill?: string }) {
  const { x = 0, y = 0, width = 0, height = 0, fill } = props
  if (width <= 0 || height <= 0) return null
  const r = Math.min(4, height / 2, width)
  return <path d={`M${x},${y} H${x + width - r} Q${x + width},${y} ${x + width},${y + r} V${y + height - r} Q${x + width},${y + height} ${x + width - r},${y + height} H${x} Z`} fill={fill} />
}

export function CostChart({ items, revenue }: { items: Array<{ label: string; cents: number; hint?: string }>; revenue: number }) {
  const max = Math.max(...items.map((i) => i.cents), 1)
  return (
    <ChartCard title="Para onde foi o dinheiro" description="Custos do período e quanto do faturamento cada um levou.">
      <ul className="flex flex-col gap-3">
        {items.map((item) => (
          <li key={item.label}>
            <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate text-secondary-foreground">
                {item.label}
                {item.hint && <span className="text-muted-foreground"> · {item.hint}</span>}
              </span>
              <span className="shrink-0 tabular-nums">
                {formatMoney(item.cents)}
                <span className="ml-1.5 text-xs text-muted-foreground">{revenue > 0 ? formatPercent(item.cents / revenue) : '—'}</span>
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/[0.05]" aria-hidden="true">
              <div className="h-full rounded-r-[4px] bg-[var(--chart-3)]" style={{ width: `${(item.cents / max) * 100}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </ChartCard>
  )
}
