import { describe, expect, it } from 'vitest'
import { shiftInstants } from './dates'
import { summarizePeriod, type PeriodShift } from './period'
import type { VehicleFixedCosts } from './types'

function shift(workDate: string, overrides: Partial<PeriodShift> = {}): PeriodShift {
  const { startedAt, endedAt } = shiftInstants(workDate, '08:00', '18:00')
  return {
    workDate,
    startedAt,
    endedAt,
    breakMinutes: 60,
    odometerStart: 0,
    odometerEnd: 120,
    energyCostPerKm: 0.5,
    maintenancePerKm: 0.1,
    tiresPerKm: 0,
    depreciationPerKm: 0,
    earnings: [{ platformId: 'uber', amount: 300, tips: 0, bonus: 0, trips: 18 }],
    expenses: [],
    ...overrides,
  }
}

const rentedCar: VehicleFixedCosts & { id: string } = {
  id: 'car',
  ownership: 'rented',
  rentAmount: 700,
  rentPeriod: 'week',
  insuranceMonthly: 0,
  taxesYearly: 0,
  otherFixedMonthly: 0,
  financingMonthly: 0,
  fixedCostsStart: '2026-01-01',
  fixedCostsEnd: null,
}

const WEEK = { from: '2026-10-19', to: '2026-10-25' }

describe('resumo do período', () => {
  const summary = summarizePeriod({
    shifts: [
      shift('2026-10-20', { expenses: [{ category: 'fuel', amount: 150 }] }),
      shift('2026-10-22', {
        odometerStart: 120,
        odometerEnd: 200,
        earnings: [
          { platformId: 'ifood', amount: 180, tips: 5, bonus: 0, trips: 12 },
          { platformId: 'uber', amount: 40, tips: 0, bonus: 10, trips: 2 },
        ],
        expenses: [{ category: 'toll', amount: 15 }],
      }),
      shift('2026-10-12'), // fora do período
    ],
    vehicles: [rentedCar],
    range: WEEK,
    today: '2026-10-25',
  })

  it('soma só as jornadas do período', () => {
    expect(summary.shifts).toBe(2)
    expect(summary.distanceKm).toBe(200)
    expect(summary.workedMinutes).toBe(2 * 540)
    expect(summary.trips).toBe(32)
  })

  it('separa resultado operacional do fluxo de caixa', () => {
    // receita: 300 + 185 + 50 = 535
    expect(summary.revenue).toBe(53_500)
    // energia 200 km × 0,50 = 100; reserva 200 × 0,10 = 20; pedágio 15
    expect(summary.energyCost).toBe(10_000)
    expect(summary.reserves).toBe(2_000)
    expect(summary.operationalExpenses).toBe(1_500)
    expect(summary.profitBeforeFixed).toBe(53_500 - 10_000 - 2_000 - 1_500)
    // aluguel semanal inteiro
    expect(summary.fixedCosts.total).toBe(70_000)
    expect(summary.operationalResult).toBe(40_000 - 70_000)

    // caixa: entrou a receita, saíram abastecimento e pedágio pagos
    expect(summary.cash).toEqual({
      inflow: 53_500,
      paidEnergy: 15_000,
      paidMaintenance: 0,
      paidOperational: 1_500,
      outflow: 16_500,
      net: 37_000,
    })
  })

  it('o abastecimento pago não entra no resultado operacional', () => {
    const withoutFuel = summarizePeriod({
      shifts: [shift('2026-10-20')],
      vehicles: [],
      range: WEEK,
      today: '2026-10-25',
    })
    const withFuel = summarizePeriod({
      shifts: [shift('2026-10-20', { expenses: [{ category: 'fuel', amount: 150 }] })],
      vehicles: [],
      range: WEEK,
      today: '2026-10-25',
    })
    expect(withFuel.operationalResult).toBe(withoutFuel.operationalResult)
    expect(withFuel.cash.net).toBe(withoutFuel.cash.net - 15_000)
  })

  it('série diária cobre todos os dias e soma o mesmo que o total', () => {
    expect(summary.daily.map((d) => d.date)).toEqual([
      '2026-10-19',
      '2026-10-20',
      '2026-10-21',
      '2026-10-22',
      '2026-10-23',
      '2026-10-24',
      '2026-10-25',
    ])
    expect(summary.daily.reduce((s, d) => s + d.revenue, 0)).toBe(summary.revenue)
    expect(summary.daily.reduce((s, d) => s + d.profit, 0)).toBe(summary.profitBeforeFixed)
  })

  it('receita por plataforma em ordem decrescente', () => {
    expect(summary.byPlatform).toEqual([
      { platformId: 'uber', revenue: 35_000, trips: 20 },
      { platformId: 'ifood', revenue: 18_500, trips: 12 },
    ])
  })

  it('indicadores por hora e por km', () => {
    expect(summary.revenuePerHour).toBeCloseTo(535 / 18, 6)
    expect(summary.resultPerHour).toBeCloseTo(-300 / 18, 6)
    expect(summary.revenuePerKm).toBeCloseTo(2.675, 6)
    expect(summary.totalCostPerKm).toBeCloseTo((100 + 20 + 15 + 700) / 200, 6)
  })

  it('no mês em andamento a série diária para em hoje', () => {
    const month = summarizePeriod({ shifts: [], vehicles: [], range: { from: '2026-10-01', to: '2026-10-31' }, today: '2026-10-25' })
    expect(month.daily).toHaveLength(25)
    expect(month.revenue).toBe(0)
    expect(month.revenuePerHour).toBeNull()
  })

  it('despesa avulsa segue a mesma regra das despesas de jornada', () => {
    const r = summarizePeriod({
      shifts: [shift('2026-10-20')],
      standaloneExpenses: [
        { category: 'maintenance', amount: 250, spentOn: '2026-10-21' },
        { category: 'wash', amount: 40, spentOn: '2026-10-21' },
        { category: 'parking', amount: 99, spentOn: '2026-11-02' }, // fora do período
      ],
      vehicles: [],
      range: WEEK,
      today: '2026-10-25',
    })
    expect(r.profitBeforeFixed).toBe(22_800 - 4_000)
    expect(r.cash.paidMaintenance).toBe(25_000)
    expect(r.cash.outflow).toBe(29_000)
    expect(r.daily.reduce((s, d) => s + d.profit, 0)).toBe(r.profitBeforeFixed)
  })
})
