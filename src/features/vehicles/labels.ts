import type { FuelType, Ownership, Powertrain, RentPeriod, VehicleKind } from '@/domain/types'

export const KIND_LABEL: Record<VehicleKind, string> = { car: 'Carro', motorcycle: 'Moto' }

export const POWERTRAIN_LABEL: Record<Powertrain, string> = {
  combustion: 'Combustão',
  hybrid: 'Híbrido',
  plugin_hybrid: 'Híbrido plug-in',
  electric: 'Elétrico',
}

export const POWERTRAIN_DESCRIPTION: Record<Powertrain, string> = {
  combustion: 'Gasolina, etanol, diesel ou GNV',
  hybrid: 'Recarrega sozinho, abastece no posto',
  plugin_hybrid: 'Carrega na tomada e abastece',
  electric: '100% bateria',
}

export const FUEL_LABEL: Record<FuelType, string> = {
  gasoline: 'Gasolina',
  ethanol: 'Etanol',
  diesel: 'Diesel',
  cng: 'GNV',
}

export const OWNERSHIP_LABEL: Record<Ownership, string> = {
  owned: 'Próprio',
  financed: 'Financiado',
  rented: 'Alugado',
  other: 'Outro',
}

export const RENT_PERIOD_LABEL: Record<RentPeriod, string> = { week: 'Por semana', month: 'Por mês' }
