import { describe, expect, it } from 'vitest'
import { dailyFixedCost, fixedCostsForPeriod, monthlyFixedCost } from './fixed-costs'
import type { VehicleFixedCosts } from './types'

const vehicle = (overrides: Partial<VehicleFixedCosts & { id: string }> = {}): VehicleFixedCosts & { id: string } => ({
  id: 'v1',
  ownership: 'owned',
  rentAmount: 0,
  rentPeriod: 'week',
  insuranceMonthly: 0,
  taxesYearly: 0,
  otherFixedMonthly: 0,
  financingMonthly: 0,
  fixedCostsStart: '2026-01-01',
  fixedCostsEnd: null,
  ...overrides,
})

const OCTOBER = { from: '2026-10-01', to: '2026-10-31' }
const AFTER_OCTOBER = '2026-11-15'

describe('custos fixos', () => {
  it('um mês completo soma exatamente o valor mensal', () => {
    const rented = vehicle({ ownership: 'rented', rentAmount: 2400, rentPeriod: 'month', insuranceMonthly: 150 })
    const r = fixedCostsForPeriod([rented], OCTOBER, AFTER_OCTOBER)
    expect(r.byKind.rent).toBe(240_000)
    expect(r.byKind.insurance).toBe(15_000)
    expect(r.total).toBe(255_000)
    expect(r.days).toBe(31)
  })

  it('"este mês" conta só os dias já decorridos', () => {
    const rented = vehicle({ ownership: 'rented', rentAmount: 2400, rentPeriod: 'month' })
    const r = fixedCostsForPeriod([rented], OCTOBER, '2026-10-25')
    expect(r.total).toBe(193_548) // 2400 × 25/31 = 1935,4838…
    expect(r.days).toBe(25)
  })

  it('aluguel semanal: 7 dias somam a semana; fevereiro tem 4 semanas cravadas', () => {
    const weekly = vehicle({ ownership: 'rented', rentAmount: 650, rentPeriod: 'week' })
    expect(fixedCostsForPeriod([weekly], { from: '2026-10-19', to: '2026-10-25' }, AFTER_OCTOBER).total).toBe(65_000)
    expect(fixedCostsForPeriod([weekly], { from: '2026-02-01', to: '2026-02-28' }, '2026-03-10').total).toBe(260_000)
  })

  it('IPVA e licenciamento anuais viram custo diário pelos dias do ano', () => {
    const owned = vehicle({ taxesYearly: 2190 })
    expect(dailyFixedCost(owned, '2026-06-10').taxes).toBe(6)
    expect(fixedCostsForPeriod([owned], { from: '2026-06-10', to: '2026-06-10' }, '2026-06-10').total).toBe(600)
    expect(fixedCostsForPeriod([owned], { from: '2026-01-01', to: '2026-12-31' }, '2027-01-05').total).toBe(219_000)
  })

  it('parcela do financiamento entra nos custos fixos, como o aluguel', () => {
    const financed = vehicle({ ownership: 'financed', financingMonthly: 1500 })
    const r = fixedCostsForPeriod([financed], OCTOBER, AFTER_OCTOBER)
    expect(r.byKind.financing).toBe(150_000)
    expect(r.total).toBe(150_000)
  })

  it('conta só a partir do início dos custos e até o arquivamento', () => {
    const v = vehicle({ insuranceMonthly: 310, fixedCostsStart: '2026-10-11', fixedCostsEnd: '2026-10-20' })
    const r = fixedCostsForPeriod([v], OCTOBER, AFTER_OCTOBER)
    expect(r.total).toBe(10_000) // 10 dias × 10,00
  })

  it('soma vários veículos e os detalhamentos batem com o total', () => {
    const car = vehicle({ id: 'car', ownership: 'rented', rentAmount: 700, rentPeriod: 'week', insuranceMonthly: 99.9 })
    const moto = vehicle({ id: 'moto', insuranceMonthly: 45.5, taxesYearly: 300, otherFixedMonthly: 39.9 })
    const r = fixedCostsForPeriod([car, moto], { from: '2026-10-01', to: '2026-10-17' }, AFTER_OCTOBER)
    const byKind = r.byKind.rent + r.byKind.financing + r.byKind.insurance + r.byKind.taxes + r.byKind.other
    expect(byKind).toBe(r.total)
    expect(r.byVehicle.car! + r.byVehicle.moto!).toBe(r.total)
  })

  it('período inteiramente no futuro não tem custo', () => {
    const v = vehicle({ insuranceMonthly: 200 })
    expect(fixedCostsForPeriod([v], { from: '2026-12-01', to: '2026-12-31' }, '2026-10-25')).toMatchObject({ total: 0, days: 0 })
  })

  it('custo mensal equivalente para exibir no cadastro', () => {
    expect(
      monthlyFixedCost({ rentAmount: 650, rentPeriod: 'week', financingMonthly: 0, insuranceMonthly: 0, taxesYearly: 0, otherFixedMonthly: 0 }),
    ).toBeCloseTo(2824.4, 1)
    expect(
      monthlyFixedCost({ rentAmount: 0, rentPeriod: 'week', financingMonthly: 0, insuranceMonthly: 120, taxesYearly: 1800, otherFixedMonthly: 30 }),
    ).toBe(300)
    expect(
      monthlyFixedCost({ rentAmount: 0, rentPeriod: 'week', financingMonthly: 1500, insuranceMonthly: 120, taxesYearly: 0, otherFixedMonthly: 0 }),
    ).toBe(1620)
  })
})
