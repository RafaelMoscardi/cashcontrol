import type { FuelType, Powertrain } from '@/domain/types'
import data from './consumo-inmetro.json'

/** Consumo oficial do Inmetro (PBE Veicular), gerado por npm run consumo:inmetro. */
interface Variant {
  engine: string
  gearbox: 'manual' | 'automático' | null
  year: number
  versions: number
  gasoline?: number
  ethanol?: number
  diesel?: number
  kmPerKwh?: number
}

export interface ConsumptionOption {
  /** "1.0 Turbo · automático" */
  label: string
  value: number
  unit: 'km/l' | 'km/kWh'
  year: number
}

const table = (data as unknown as { car: Record<string, Record<string, Variant[]>> }).car

const FUEL_FIELD: Partial<Record<FuelType, 'gasoline' | 'ethanol' | 'diesel'>> = { gasoline: 'gasoline', ethanol: 'ethanol', diesel: 'diesel' }

/**
 * Até 4 sugestões de consumo para o carro escolhido: km/l na cidade com o combustível da tela,
 * ou km/kWh nos elétricos. Plug-in, GNV e modelos fora da tabela não têm sugestão.
 */
export function inmetroOptions(brand: string, model: string, powertrain: Powertrain, fuelType: FuelType): ConsumptionOption[] {
  const variants = table[brand]?.[model]
  if (!variants) return []

  if (powertrain === 'electric') {
    return variants
      .filter((v) => v.kmPerKwh !== undefined)
      .map((v) => ({ label: 'Elétrico', value: v.kmPerKwh!, unit: 'km/kWh' as const, year: v.year }))
      .slice(0, 1)
  }
  const field = FUEL_FIELD[fuelType]
  if (powertrain === 'plugin_hybrid' || !field) return []

  // Híbrido mostra só motores híbridos; combustão, os outros
  const hybrid = powertrain === 'hybrid'
  const list = variants.filter((v) => v[field] !== undefined && v.engine !== 'Elétrico' && v.engine.includes('Híbrido') === hybrid)
  // As 4 mais comuns; na tela, do menor motor ao maior, sem turbo antes do turbo e manual antes do automático
  const order = (v: Variant): [number, number, number] => [Number.parseFloat(v.engine), v.engine.includes('Turbo') ? 1 : 0, v.gearbox === 'manual' ? 0 : 1]
  return [...list]
    .sort((a, b) => b.versions - a.versions)
    .slice(0, 4)
    .sort((a, b) => {
      const [x, y] = [order(a), order(b)]
      return x[0] - y[0] || x[1] - y[1] || x[2] - y[2]
    })
    .map((v) => ({
      label: [v.engine.replace(' Híbrido', ''), v.gearbox].filter(Boolean).join(' · '),
      value: v[field]!,
      unit: 'km/l' as const,
      year: v.year,
    }))
}
