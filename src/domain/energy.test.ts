import { describe, expect, it } from 'vitest'
import { buildCostSnapshot, energyCostPerKm, estimateConsumption, fuelUnit } from './energy'
import type { EnergyConfig } from './types'

const NONE = {
  fuelType: null,
  fuelKmPerUnit: null,
  fuelPricePerUnit: null,
  electricKmPerKwh: null,
  electricityPricePerKwh: null,
  electricSharePct: null,
} as const

const combustion = (fuelType: EnergyConfig['fuelType'], km: number, price: number): EnergyConfig => ({
  ...NONE,
  powertrain: 'combustion',
  fuelType,
  fuelKmPerUnit: km,
  fuelPricePerUnit: price,
})

const electric = (kmPerKwh: number, price: number): EnergyConfig => ({
  ...NONE,
  powertrain: 'electric',
  electricKmPerKwh: kmPerKwh,
  electricityPricePerKwh: price,
})

const pluginHybrid = (share: number): EnergyConfig => ({
  powertrain: 'plugin_hybrid',
  fuelType: 'gasoline',
  fuelKmPerUnit: 14,
  fuelPricePerUnit: 6,
  electricKmPerKwh: 5,
  electricityPricePerKwh: 1,
  electricSharePct: share,
})

describe('custo de energia por km', () => {
  it('combustão: preço ÷ consumo, com 5 casas', () => {
    expect(energyCostPerKm(combustion('gasoline', 11.5, 6.29))).toBe(0.54696)
    expect(energyCostPerKm(combustion('ethanol', 8.2, 4.19))).toBe(0.51098)
    expect(energyCostPerKm(combustion('gasoline', 12, 6))).toBe(0.5)
  })

  it('GNV usa km/m³ e R$/m³', () => {
    expect(energyCostPerKm(combustion('cng', 13, 4.99))).toBe(0.38385)
    expect(fuelUnit('cng')).toBe('m³')
    expect(fuelUnit('gasoline')).toBe('l')
  })

  it('híbrido comum se comporta como combustão', () => {
    expect(energyCostPerKm({ ...combustion('gasoline', 22, 6), powertrain: 'hybrid' })).toBe(0.27273)
  })

  it('elétrico: R$/kWh ÷ km/kWh; recarga grátis custa zero', () => {
    expect(energyCostPerKm(electric(6.5, 0.95))).toBe(0.14615)
    expect(energyCostPerKm(electric(7, 0))).toBe(0)
  })

  it('híbrido plug-in mistura pelo percentual rodado no elétrico', () => {
    expect(energyCostPerKm(pluginHybrid(70))).toBe(0.26857) // 0,7 × 0,20 + 0,3 × 0,428571
    expect(energyCostPerKm(pluginHybrid(0))).toBe(0.42857)
    expect(energyCostPerKm(pluginHybrid(100))).toBe(0.2)
  })

  it('configuração incompleta é erro de programação, não zero silencioso', () => {
    expect(() => energyCostPerKm({ ...combustion('gasoline', 12, 6), fuelKmPerUnit: null })).toThrow(RangeError)
    expect(() => energyCostPerKm({ ...electric(6, 1), electricKmPerKwh: 0 })).toThrow(RangeError)
    expect(() => energyCostPerKm({ ...pluginHybrid(50), electricSharePct: 120 })).toThrow(RangeError)
  })
})

describe('consumo estimado', () => {
  it('litros, kWh ou os dois', () => {
    expect(estimateConsumption(combustion('gasoline', 12, 6), 120)).toEqual({ fuel: 10, kwh: null })
    expect(estimateConsumption(electric(6.5, 1), 130)).toEqual({ fuel: null, kwh: 20 })
    const phev = estimateConsumption(pluginHybrid(70), 100)
    expect(phev.kwh).toBeCloseTo(14, 10)
    expect(phev.fuel).toBeCloseTo(30 / 14, 10)
  })
})

describe('foto dos custos', () => {
  it('guarda o custo por km e os parâmetros usados', () => {
    const snapshot = buildCostSnapshot({ ...combustion('gasoline', 12, 6), name: 'Onix' })
    expect(snapshot.energyCostPerKm).toBe(0.5)
    expect(snapshot.params).toMatchObject({ vehicleName: 'Onix', fuelPricePerUnit: 6, fuelKmPerUnit: 12 })
  })
})
