import { describe, expect, it } from 'vitest'
import type { CostSnapshot } from '@/domain/types'
import { withMeterReading } from './schema'

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

describe('kWh do medidor na jornada', () => {
  it('vão para a foto de custos do elétrico; em branco, voltam à estimativa', () => {
    const snapshot: CostSnapshot = { energyCostPerKm: 0.17692, params }
    expect(withMeterReading(snapshot, 35.7).params?.measuredKwh).toBe(35.7)
    expect(withMeterReading({ ...snapshot, params: { ...params, measuredKwh: 35.7 } }, null).params?.measuredKwh).toBeNull()
    expect(withMeterReading(snapshot, 35.7).energyCostPerKm).toBe(0.17692)
  })

  it('não mexem na foto de quem não é elétrico', () => {
    const combustion: CostSnapshot = { energyCostPerKm: 0.5, params: { ...params, powertrain: 'combustion' } }
    expect(withMeterReading(combustion, 35.7)).toBe(combustion)
  })
})
