/* Resultado de uma jornada. Ver docs/ARQUITETURA.md §5.3. */
import { measuredEnergyCost } from './energy'
import { countsInOperationalResult } from './expenses'
import { perKmToCents, safeDivide, sumCents, toCents, type Cents } from './money'
import type { CostParams, CostSnapshot, Expense, ExpenseCategory, ShiftEarning } from './types'

export interface ShiftFacts extends Omit<CostSnapshot, 'params'> {
  /** Parâmetros da foto de custos; nos elétricos, podem trazer os kWh do medidor */
  params?: CostParams | null
  startedAt: string | Date
  endedAt: string | Date
  breakMinutes: number
  odometerStart: number
  odometerEnd: number
  earnings: Pick<ShiftEarning, 'platformId' | 'amount' | 'tips' | 'bonus' | 'trips'>[]
  expenses: Pick<Expense, 'category' | 'amount'>[]
}

export interface ShiftResult {
  distanceKm: number
  workedMinutes: number
  /** Soma dos valores líquidos pagos pelas plataformas */
  platformNet: Cents
  tips: Cents
  bonus: Cents
  /** Receita total: líquido + gorjetas + bônus */
  revenue: Cents
  trips: number | null
  /** km × custo de energia por km; no elétrico com medidor, kWh × preço do kWh */
  energyCost: Cents
  /** Despesas que entram no resultado (todas, menos o combustível) */
  operationalExpenses: Cents
  /** Fluxo de caixa: abastecimentos e recargas pagos */
  paidEnergy: Cents
  /** Fluxo de caixa: manutenções pagas */
  paidMaintenance: Cents
  /** Fluxo de caixa: todas as despesas pagas */
  paidExpenses: Cents
  expensesByCategory: Partial<Record<ExpenseCategory, Cents>>
  /** energia + despesas operacionais */
  variableCosts: Cents
  /** Lucro da jornada (antes dos custos fixos) */
  profit: Cents
  costPerKm: number | null
  revenuePerKm: number | null
  profitPerKm: number | null
  revenuePerHour: number | null
  profitPerHour: number | null
}

export const distanceKm = (odometerStart: number, odometerEnd: number): number =>
  Math.max(0, Number((odometerEnd - odometerStart).toFixed(1)))

export function workedMinutes(startedAt: string | Date, endedAt: string | Date, breakMinutes: number): number {
  const total = Math.round((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 60_000)
  return Math.max(0, total - breakMinutes)
}

export function computeShift(f: ShiftFacts): ShiftResult {
  const km = distanceKm(f.odometerStart, f.odometerEnd)
  const minutes = workedMinutes(f.startedAt, f.endedAt, f.breakMinutes)

  const platformNet = sumCents(f.earnings.map((e) => toCents(e.amount)))
  const tips = sumCents(f.earnings.map((e) => toCents(e.tips)))
  const bonus = sumCents(f.earnings.map((e) => toCents(e.bonus)))
  const revenue = platformNet + tips + bonus
  const trips = f.earnings.some((e) => e.trips !== null) ? f.earnings.reduce((n, e) => n + (e.trips ?? 0), 0) : null

  const energyCost = measuredEnergyCost(f.params) ?? perKmToCents(km, f.energyCostPerKm)

  const expensesByCategory: Partial<Record<ExpenseCategory, Cents>> = {}
  let operationalExpenses = 0
  let paidExpenses = 0
  for (const expense of f.expenses) {
    const cents = toCents(expense.amount)
    expensesByCategory[expense.category] = (expensesByCategory[expense.category] ?? 0) + cents
    paidExpenses += cents
    if (countsInOperationalResult(expense.category)) operationalExpenses += cents
  }

  const variableCosts = energyCost + operationalExpenses
  const profit = revenue - variableCosts
  const hours = minutes / 60

  return {
    distanceKm: km,
    workedMinutes: minutes,
    platformNet,
    tips,
    bonus,
    revenue,
    trips,
    energyCost,
    operationalExpenses,
    paidEnergy: expensesByCategory.fuel ?? 0,
    paidMaintenance: expensesByCategory.maintenance ?? 0,
    paidExpenses,
    expensesByCategory,
    variableCosts,
    profit,
    costPerKm: safeDivide(variableCosts / 100, km),
    revenuePerKm: safeDivide(revenue / 100, km),
    profitPerKm: safeDivide(profit / 100, km),
    revenuePerHour: safeDivide(revenue / 100, hours),
    profitPerHour: safeDivide(profit / 100, hours),
  }
}
