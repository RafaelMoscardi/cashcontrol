import { describe, expect, it } from 'vitest'
import { shiftInstants } from './dates'
import { computeShift, distanceKm, workedMinutes, type ShiftFacts } from './shift'

const { startedAt, endedAt } = shiftInstants('2026-10-20', '08:00', '18:00')

// Exemplo dos critérios de aceitação da etapa 1
const BASE: ShiftFacts = {
  startedAt,
  endedAt,
  breakMinutes: 60,
  odometerStart: 45_000,
  odometerEnd: 45_120,
  energyCostPerKm: 0.5, // 12 km/l a R$ 6,00
  maintenancePerKm: 0.1,
  tiresPerKm: 0,
  depreciationPerKm: 0,
  earnings: [{ platformId: 'uber', amount: 300, tips: 0, bonus: 0, trips: 18 }],
  expenses: [],
}

describe('jornada', () => {
  it('calcula km, horas, custos, lucro, ganho por hora e custo por km', () => {
    const r = computeShift(BASE)
    expect(r.distanceKm).toBe(120)
    expect(r.workedMinutes).toBe(540)
    expect(r.revenue).toBe(30_000)
    expect(r.energyCost).toBe(6_000)
    expect(r.maintenanceReserve).toBe(1_200)
    expect(r.reserves).toBe(1_200)
    expect(r.variableCosts).toBe(7_200)
    expect(r.profit).toBe(22_800)
    expect(r.profitPerHour).toBeCloseTo(25.3333, 4)
    expect(r.revenuePerHour).toBeCloseTo(33.3333, 4)
    expect(r.costPerKm).toBeCloseTo(0.6, 10)
    expect(r.revenuePerKm).toBeCloseTo(2.5, 10)
    expect(r.profitPerKm).toBeCloseTo(1.9, 10)
    expect(r.trips).toBe(18)
  })

  it('abastecimento pago vai para o caixa e nunca soma com a estimativa de combustível', () => {
    const r = computeShift({ ...BASE, expenses: [{ category: 'fuel', amount: 100 }] })
    expect(r.profit).toBe(22_800)
    expect(r.operationalExpenses).toBe(0)
    expect(r.paidEnergy).toBe(10_000)
    expect(r.paidExpenses).toBe(10_000)
  })

  it('manutenção paga sai da reserva por km, não do lucro', () => {
    const r = computeShift({ ...BASE, expenses: [{ category: 'maintenance', amount: 250 }] })
    expect(r.profit).toBe(22_800)
    expect(r.paidMaintenance).toBe(25_000)
    expect(r.paidExpenses).toBe(25_000)
  })

  it('pedágio, estacionamento e alimentação reduzem o lucro e o caixa uma vez cada', () => {
    const r = computeShift({
      ...BASE,
      expenses: [
        { category: 'toll', amount: 12.4 },
        { category: 'parking', amount: 8 },
        { category: 'food', amount: 25.5 },
      ],
    })
    expect(r.operationalExpenses).toBe(4_590)
    expect(r.paidExpenses).toBe(4_590)
    expect(r.profit).toBe(22_800 - 4_590)
    expect(r.expensesByCategory).toEqual({ toll: 1_240, parking: 800, food: 2_550 })
  })

  it('cada categoria entra em um lugar só no resultado operacional', () => {
    const all = computeShift({
      ...BASE,
      expenses: [
        { category: 'fuel', amount: 80 },
        { category: 'maintenance', amount: 120 },
        { category: 'toll', amount: 10 },
        { category: 'parking', amount: 10 },
        { category: 'food', amount: 10 },
        { category: 'wash', amount: 10 },
        { category: 'phone', amount: 10 },
        { category: 'fees', amount: 10 },
        { category: 'fine', amount: 10 },
        { category: 'other', amount: 10 },
      ],
    })
    expect(all.operationalExpenses).toBe(8 * 1_000)
    expect(all.paidExpenses).toBe(8_000 + 20_000)
    expect(all.profit).toBe(all.revenue - all.energyCost - all.reserves - all.operationalExpenses)
  })

  it('gorjetas e bônus são receita; a taxa da plataforma nunca é descontada de novo', () => {
    const r = computeShift({
      ...BASE,
      earnings: [
        { platformId: 'uber', amount: 250, tips: 12, bonus: 30, trips: 14 },
        { platformId: '99', amount: 50, tips: 0, bonus: 0, trips: null },
      ],
    })
    expect(r.platformNet).toBe(30_000)
    expect(r.tips).toBe(1_200)
    expect(r.bonus).toBe(3_000)
    expect(r.revenue).toBe(34_200)
    expect(r.profit).toBe(34_200 - 7_200)
    expect(r.trips).toBe(14)
  })

  it('reservas de pneus e depreciação somam à de manutenção, cada uma arredondada', () => {
    const r = computeShift({ ...BASE, odometerEnd: 45_087.3, maintenancePerKm: 0.12, tiresPerKm: 0.035, depreciationPerKm: 0.0825 })
    expect(r.distanceKm).toBe(87.3)
    expect(r.maintenanceReserve).toBe(1_048) // 10,476
    expect(r.tiresReserve).toBe(306) // 3,0555
    expect(r.depreciationReserve).toBe(720) // 7,20225
    expect(r.reserves).toBe(1_048 + 306 + 720)
  })

  it('jornada que vira a meia-noite conta as horas certas', () => {
    const night = shiftInstants('2026-10-20', '20:00', '02:00')
    expect(workedMinutes(night.startedAt, night.endedAt, 30)).toBe(330)
    expect(night.endedAt.getDate()).toBe(21)
  })

  it('sem km, as métricas por km ficam vazias em vez de dividir por zero', () => {
    const r = computeShift({ ...BASE, odometerEnd: 45_000 })
    expect(r.distanceKm).toBe(0)
    expect(r.costPerKm).toBeNull()
    expect(r.revenuePerKm).toBeNull()
    expect(r.energyCost).toBe(0)
  })

  it('valores quebrados somam certo em centavos', () => {
    const r = computeShift({
      ...BASE,
      earnings: [
        { platformId: 'a', amount: 0.1, tips: 0, bonus: 0, trips: null },
        { platformId: 'b', amount: 0.2, tips: 0, bonus: 0, trips: null },
      ],
    })
    expect(r.revenue).toBe(30)
    expect(r.trips).toBeNull()
  })

  it('distância nunca fica negativa e mantém uma casa decimal', () => {
    expect(distanceKm(100, 99)).toBe(0)
    expect(distanceKm(1000.1, 1000.3)).toBe(0.2)
  })
})
