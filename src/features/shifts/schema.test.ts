import { describe, expect, it } from 'vitest'
import type { CostSnapshot } from '@/domain/types'
import { newShiftForm, shiftFormSchema, withMeterReadings, type ShiftFormValues } from './schema'

const params = {
  vehicleName: 'Dolphin',
  powertrain: 'electric' as const,
  fuelType: null,
  fuelKmPerUnit: null,
  fuelPricePerUnit: null,
  electricKmPerKwh: 6.5,
  electricityPricePerKwh: 1.15,
  electricSharePct: null,
}

describe('leituras do medidor na jornada', () => {
  const snapshot: CostSnapshot = { energyCostPerKm: 0.17692, params }

  it('vão para a foto de custos do elétrico com o gasto (final − inicial)', () => {
    const withReadings = withMeterReadings(snapshot, 1240.5, 1276.2)
    expect(withReadings.params).toMatchObject({ meterStartKwh: 1240.5, meterEndKwh: 1276.2, measuredKwh: 35.7 })
    expect(withReadings.energyCostPerKm).toBe(0.17692)
  })

  it('sem o kWh final, guardam o inicial e voltam à estimativa', () => {
    expect(withMeterReadings(snapshot, 1240.5, null).params).toMatchObject({ meterStartKwh: 1240.5, meterEndKwh: null, measuredKwh: null })
  })

  it('apagadas na edição, tiram o gasto medido', () => {
    const saved = withMeterReadings(snapshot, 1240.5, 1276.2)
    expect(withMeterReadings(saved, null, null).params).toMatchObject({ meterStartKwh: null, meterEndKwh: null, measuredKwh: null })
  })

  it('não apagam o total de jornada salva antes das leituras', () => {
    const legacy: CostSnapshot = { ...snapshot, params: { ...params, measuredKwh: 35.7 } }
    expect(withMeterReadings(legacy, null, null)).toBe(legacy)
    expect(withMeterReadings(legacy, 1240.5, 1250).params?.measuredKwh).toBe(9.5)
  })

  it('não mexem na foto de quem não é elétrico', () => {
    const combustion: CostSnapshot = { energyCostPerKm: 0.5, params: { ...params, powertrain: 'combustion' } }
    expect(withMeterReadings(combustion, 1240.5, 1276.2)).toBe(combustion)
  })
})

describe('validação das leituras do medidor', () => {
  const base: ShiftFormValues = {
    ...newShiftForm({ workDate: '2026-10-29', vehicleId: 'v1', platformId: 'p1', odometerStart: 12_587 }),
    endTime: '18:00',
    odometerEnd: 12_774,
  }
  const issues = (meterStartKwh: number | null, meterEndKwh: number | null) => {
    const parsed = shiftFormSchema.safeParse({ ...base, meterStartKwh, meterEndKwh })
    return parsed.success ? [] : parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)
  }

  it('aceita as duas leituras, só o inicial ou nenhuma', () => {
    expect(issues(1240.5, 1276.2)).toEqual([])
    expect(issues(1240.5, null)).toEqual([])
    expect(issues(null, null)).toEqual([])
  })

  it('pede o inicial quando há o final', () => {
    expect(issues(null, 1276.2)).toEqual(['meterStartKwh: Informe o kWh inicial'])
  })

  it('recusa final menor ou igual ao inicial e gasto acima de 300 kWh', () => {
    expect(issues(1276.2, 1240.5)).toEqual(['meterEndKwh: O final precisa ser maior que o inicial'])
    expect(issues(1240.5, 1240.5)).toEqual(['meterEndKwh: O final precisa ser maior que o inicial'])
    expect(issues(1000, 1300.5)).toEqual(['meterEndKwh: Mais de 300 kWh numa jornada? Confira'])
  })
})
