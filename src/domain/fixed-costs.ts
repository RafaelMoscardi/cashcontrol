/* Rateio diário dos custos fixos. Mensal ÷ dias do mês, semanal ÷ 7, anual ÷ dias
   do ano: um mês completo soma exatamente o valor mensal. Dias futuros não contam. */
import { daysInMonth, daysInYear, eachDay, minDate, type DateRange } from './dates'
import { roundCents, type Cents } from './money'
import type { ISODate, VehicleFixedCosts } from './types'

export type FixedCostKind = 'rent' | 'insurance' | 'taxes' | 'other'
export const FIXED_COST_KINDS: readonly FixedCostKind[] = ['rent', 'insurance', 'taxes', 'other']

export interface FixedCostsBreakdown {
  total: Cents
  byKind: Record<FixedCostKind, Cents>
  byVehicle: Record<string, Cents>
  /** Dias do período já decorridos (os que podem ter custo) */
  days: number
}

/** Quanto cada custo fixo de um veículo pesa num dia (R$, sem arredondar). */
export function dailyFixedCost(v: VehicleFixedCosts, day: ISODate): Record<FixedCostKind, number> {
  const monthDays = daysInMonth(day)
  return {
    rent: v.rentAmount > 0 ? (v.rentPeriod === 'week' ? v.rentAmount / 7 : v.rentAmount / monthDays) : 0,
    insurance: v.insuranceMonthly / monthDays,
    taxes: v.taxesYearly / daysInYear(day),
    other: v.otherFixedMonthly / monthDays,
  }
}

export const isFixedCostDay = (v: VehicleFixedCosts, day: ISODate): boolean =>
  day >= v.fixedCostsStart && (v.fixedCostsEnd === null || day <= v.fixedCostsEnd)

/** Custo fixo mensal equivalente (R$), para exibir na configuração do veículo. */
export function monthlyFixedCost(v: Pick<VehicleFixedCosts, 'rentAmount' | 'rentPeriod' | 'insuranceMonthly' | 'taxesYearly' | 'otherFixedMonthly'>): number {
  const rent = v.rentPeriod === 'week' ? (v.rentAmount * 365) / 7 / 12 : v.rentAmount
  return rent + v.insuranceMonthly + v.taxesYearly / 12 + v.otherFixedMonthly
}

export function fixedCostsForPeriod(
  vehicles: ReadonlyArray<VehicleFixedCosts & { id: string }>,
  range: DateRange,
  today: ISODate,
): FixedCostsBreakdown {
  const byKind: Record<FixedCostKind, Cents> = { rent: 0, insurance: 0, taxes: 0, other: 0 }
  const byVehicle: Record<string, Cents> = {}
  const end = minDate(range.to, today)
  const days = end < range.from ? [] : eachDay(range.from, end)

  for (const vehicle of vehicles) {
    const sums: Record<FixedCostKind, number> = { rent: 0, insurance: 0, taxes: 0, other: 0 }
    for (const day of days) {
      if (!isFixedCostDay(vehicle, day)) continue
      const daily = dailyFixedCost(vehicle, day)
      for (const kind of FIXED_COST_KINDS) sums[kind] += daily[kind]
    }
    // Arredonda uma vez por veículo e tipo: os detalhamentos somam exatamente o total
    let vehicleTotal = 0
    for (const kind of FIXED_COST_KINDS) {
      const cents = roundCents(sums[kind] * 100)
      byKind[kind] += cents
      vehicleTotal += cents
    }
    byVehicle[vehicle.id] = vehicleTotal
  }

  return {
    total: FIXED_COST_KINDS.reduce((sum, kind) => sum + byKind[kind], 0),
    byKind,
    byVehicle,
    days: days.length,
  }
}
