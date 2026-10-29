import { roundRate } from './money'
import type { CostSnapshot, EnergyConfig, FuelType, Powertrain } from './types'

export const POWERTRAINS_WITH_FUEL: readonly Powertrain[] = ['combustion', 'hybrid', 'plugin_hybrid']
export const POWERTRAINS_WITH_ELECTRICITY: readonly Powertrain[] = ['electric', 'plugin_hybrid']

export const usesFuel = (p: Powertrain) => POWERTRAINS_WITH_FUEL.includes(p)
export const usesElectricity = (p: Powertrain) => POWERTRAINS_WITH_ELECTRICITY.includes(p)

/** Unidade de venda do combustível: GNV é vendido por m³. */
export const fuelUnit = (fuel: FuelType | null): 'l' | 'm³' => (fuel === 'cng' ? 'm³' : 'l')

function required(value: number | null, label: string): number {
  if (value === null || !Number.isFinite(value) || value <= 0) {
    throw new RangeError(`Configuração de energia incompleta: ${label}`)
  }
  return value
}

function fuelCostPerKm(cfg: EnergyConfig): number {
  return required(cfg.fuelPricePerUnit, 'preço do combustível') / required(cfg.fuelKmPerUnit, 'consumo de combustível')
}

function electricCostPerKm(cfg: EnergyConfig): number {
  const price = cfg.electricityPricePerKwh
  if (price === null || !Number.isFinite(price) || price < 0) {
    throw new RangeError('Configuração de energia incompleta: custo do kWh')
  }
  return price / required(cfg.electricKmPerKwh, 'consumo elétrico')
}

/**
 * Custo de energia por km (R$/km), com 5 casas: o mesmo valor que é gravado
 * na jornada, para a prévia antes de salvar bater com o resultado salvo.
 */
export function energyCostPerKm(cfg: EnergyConfig): number {
  switch (cfg.powertrain) {
    case 'combustion':
    case 'hybrid':
      return roundRate(fuelCostPerKm(cfg))
    case 'electric':
      return roundRate(electricCostPerKm(cfg))
    case 'plugin_hybrid': {
      const share = (cfg.electricSharePct ?? 0) / 100
      if (share < 0 || share > 1) throw new RangeError('Percentual elétrico deve ficar entre 0 e 100')
      const electric = share > 0 ? electricCostPerKm(cfg) : 0
      const fuel = share < 1 ? fuelCostPerKm(cfg) : 0
      return roundRate(share * electric + (1 - share) * fuel)
    }
  }
}

export interface EstimatedConsumption {
  /** litros ou m³ de combustível */
  fuel: number | null
  kwh: number | null
}

/** Quanto combustível e energia a distância consumiu, pelos parâmetros informados. */
export function estimateConsumption(cfg: EnergyConfig, distanceKm: number): EstimatedConsumption {
  const share = cfg.powertrain === 'electric' ? 1 : cfg.powertrain === 'plugin_hybrid' ? (cfg.electricSharePct ?? 0) / 100 : 0
  const fuelKm = distanceKm * (1 - share)
  const electricKm = distanceKm * share
  return {
    fuel: usesFuel(cfg.powertrain) && cfg.fuelKmPerUnit ? fuelKm / cfg.fuelKmPerUnit : null,
    kwh: usesElectricity(cfg.powertrain) && cfg.electricKmPerKwh ? electricKm / cfg.electricKmPerKwh : null,
  }
}

/** Monta a foto de custos de um veículo para gravar na jornada. */
export function buildCostSnapshot(vehicle: EnergyConfig & { name: string }): CostSnapshot {
  return {
    energyCostPerKm: energyCostPerKm(vehicle),
    params: {
      vehicleName: vehicle.name,
      powertrain: vehicle.powertrain,
      fuelType: vehicle.fuelType,
      fuelKmPerUnit: vehicle.fuelKmPerUnit,
      fuelPricePerUnit: vehicle.fuelPricePerUnit,
      electricKmPerKwh: vehicle.electricKmPerKwh,
      electricityPricePerKwh: vehicle.electricityPricePerKwh,
      electricSharePct: vehicle.electricSharePct,
    },
  }
}
