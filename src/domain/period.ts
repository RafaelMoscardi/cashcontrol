/* Resumo de um período: resultado operacional separado do fluxo de caixa.
   Ver docs/ARQUITETURA.md §5.4. */
import { eachDay, maxDate, minDate, type DateRange } from './dates'
import { countsInOperationalResult } from './expenses'
import { fixedCostsForPeriod, type FixedCostsBreakdown } from './fixed-costs'
import { safeDivide, toCents, type Cents } from './money'
import { computeShift, type ShiftFacts } from './shift'
import type { Expense, ExpenseCategory, ISODate, VehicleFixedCosts } from './types'

export interface PeriodShift extends ShiftFacts {
  workDate: ISODate
}

export interface DailyPoint {
  date: ISODate
  revenue: Cents
  /** Lucro das jornadas do dia (antes dos custos fixos) */
  profit: Cents
  distanceKm: number
  workedMinutes: number
  shifts: number
}

export interface PlatformSlice {
  platformId: string
  revenue: Cents
  trips: number | null
}

export interface CashFlow {
  /** Entradas: tudo que as plataformas pagaram + gorjetas + bônus */
  inflow: Cents
  paidEnergy: Cents
  paidMaintenance: Cents
  paidOperational: Cents
  outflow: Cents
  net: Cents
}

export interface PeriodSummary {
  range: DateRange
  shifts: number
  workedMinutes: number
  distanceKm: number
  trips: number | null
  revenue: Cents
  platformNet: Cents
  tips: Cents
  bonus: Cents
  energyCost: Cents
  operationalExpenses: Cents
  expensesByCategory: Partial<Record<ExpenseCategory, Cents>>
  /** Lucro antes dos custos fixos: Σ lucro das jornadas − despesas operacionais avulsas */
  profitBeforeFixed: Cents
  fixedCosts: FixedCostsBreakdown
  /** Lucro real: lucro antes dos fixos − custos fixos do período */
  operationalResult: Cents
  cash: CashFlow
  revenuePerHour: number | null
  resultPerHour: number | null
  revenuePerKm: number | null
  /** Custo total por km, incluindo os fixos */
  totalCostPerKm: number | null
  resultPerKm: number | null
  daily: DailyPoint[]
  byPlatform: PlatformSlice[]
}

export interface PeriodInput {
  shifts: ReadonlyArray<PeriodShift>
  /** Despesas fora de jornada (etapa 3) */
  standaloneExpenses?: ReadonlyArray<Pick<Expense, 'category' | 'amount' | 'spentOn'>>
  vehicles: ReadonlyArray<VehicleFixedCosts & { id: string }>
  range: DateRange
  today: ISODate
}

const inRange = (day: ISODate, range: DateRange) => day >= range.from && day <= range.to

export function summarizePeriod({ shifts, standaloneExpenses = [], vehicles, range, today }: PeriodInput): PeriodSummary {
  const selected = shifts.filter((s) => inRange(s.workDate, range))

  // Eixo diário até hoje (ou até a última jornada, se houver alguma lançada adiante)
  const lastShiftDay = selected.reduce<ISODate | null>((last, s) => (last === null ? s.workDate : maxDate(last, s.workDate)), null)
  let lastDay = minDate(range.to, today)
  if (lastShiftDay !== null) lastDay = maxDate(lastDay, lastShiftDay)
  const daily = new Map<ISODate, DailyPoint>(
    (lastDay < range.from ? [] : eachDay(range.from, lastDay)).map((date) => [
      date,
      { date, revenue: 0, profit: 0, distanceKm: 0, workedMinutes: 0, shifts: 0 },
    ]),
  )

  const platforms = new Map<string, PlatformSlice>()
  const expensesByCategory: Partial<Record<ExpenseCategory, Cents>> = {}
  let workedMinutes = 0
  let distanceKm = 0
  let tripsTotal = 0
  let tripsKnown = false
  let platformNet = 0
  let tips = 0
  let bonus = 0
  let energyCost = 0
  let operationalExpenses = 0
  let profitBeforeFixed = 0
  let paidEnergy = 0
  let paidMaintenance = 0
  let paidAll = 0

  for (const shift of selected) {
    const r = computeShift(shift)
    workedMinutes += r.workedMinutes
    distanceKm += r.distanceKm
    if (r.trips !== null) {
      tripsKnown = true
      tripsTotal += r.trips
    }
    platformNet += r.platformNet
    tips += r.tips
    bonus += r.bonus
    energyCost += r.energyCost
    operationalExpenses += r.operationalExpenses
    profitBeforeFixed += r.profit
    paidEnergy += r.paidEnergy
    paidMaintenance += r.paidMaintenance
    paidAll += r.paidExpenses
    for (const [category, cents] of Object.entries(r.expensesByCategory) as [ExpenseCategory, Cents][]) {
      expensesByCategory[category] = (expensesByCategory[category] ?? 0) + cents
    }

    const day = daily.get(shift.workDate)
    if (day) {
      day.revenue += r.revenue
      day.profit += r.profit
      day.distanceKm = Number((day.distanceKm + r.distanceKm).toFixed(1))
      day.workedMinutes += r.workedMinutes
      day.shifts += 1
    }

    for (const earning of shift.earnings) {
      const slice = platforms.get(earning.platformId) ?? { platformId: earning.platformId, revenue: 0, trips: null }
      slice.revenue += toCents(earning.amount) + toCents(earning.tips) + toCents(earning.bonus)
      if (earning.trips !== null) slice.trips = (slice.trips ?? 0) + earning.trips
      platforms.set(earning.platformId, slice)
    }
  }

  // Despesas avulsas: mesma regra das despesas de jornada
  for (const expense of standaloneExpenses) {
    if (!inRange(expense.spentOn, range)) continue
    const cents = toCents(expense.amount)
    expensesByCategory[expense.category] = (expensesByCategory[expense.category] ?? 0) + cents
    paidAll += cents
    if (expense.category === 'fuel') paidEnergy += cents
    else if (expense.category === 'maintenance') paidMaintenance += cents
    if (countsInOperationalResult(expense.category)) {
      operationalExpenses += cents
      profitBeforeFixed -= cents
      const day = daily.get(expense.spentOn)
      if (day) day.profit -= cents
    }
  }

  distanceKm = Number(distanceKm.toFixed(1))
  const revenue = platformNet + tips + bonus
  const fixedCosts = fixedCostsForPeriod(vehicles, range, today)
  const operationalResult = profitBeforeFixed - fixedCosts.total
  const hours = workedMinutes / 60

  return {
    range,
    shifts: selected.length,
    workedMinutes,
    distanceKm,
    trips: tripsKnown ? tripsTotal : null,
    revenue,
    platformNet,
    tips,
    bonus,
    energyCost,
    operationalExpenses,
    expensesByCategory,
    profitBeforeFixed,
    fixedCosts,
    operationalResult,
    cash: {
      inflow: revenue,
      paidEnergy,
      paidMaintenance,
      paidOperational: paidAll - paidEnergy - paidMaintenance,
      outflow: paidAll,
      net: revenue - paidAll,
    },
    revenuePerHour: safeDivide(revenue / 100, hours),
    resultPerHour: safeDivide(operationalResult / 100, hours),
    revenuePerKm: safeDivide(revenue / 100, distanceKm),
    totalCostPerKm: safeDivide((energyCost + operationalExpenses + fixedCosts.total) / 100, distanceKm),
    resultPerKm: safeDivide(operationalResult / 100, distanceKm),
    daily: [...daily.values()],
    byPlatform: [...platforms.values()].sort((a, b) => b.revenue - a.revenue),
  }
}
