/* Tipos do domínio. Independentes do banco e da interface. Datas no formato
   'AAAA-MM-DD' (dia local); instantes em ISO 8601. */

export type VehicleKind = 'car' | 'motorcycle'
export type Powertrain = 'combustion' | 'hybrid' | 'plugin_hybrid' | 'electric'
export type FuelType = 'gasoline' | 'ethanol' | 'diesel' | 'cng'
export type Ownership = 'owned' | 'financed' | 'rented' | 'other'
export type RentPeriod = 'week' | 'month'
export type PlatformKind = 'rides' | 'delivery' | 'taxi' | 'mototaxi' | 'private' | 'other'

export type ExpenseCategory =
  | 'fuel'
  | 'maintenance'
  | 'toll'
  | 'parking'
  | 'food'
  | 'wash'
  | 'phone'
  | 'fees'
  | 'fine'
  | 'other'

/** Data local no formato AAAA-MM-DD. */
export type ISODate = string

export interface EnergyConfig {
  powertrain: Powertrain
  fuelType: FuelType | null
  /** km/l (ou km/m³ no GNV) */
  fuelKmPerUnit: number | null
  /** R$/l (ou R$/m³ no GNV) */
  fuelPricePerUnit: number | null
  electricKmPerKwh: number | null
  electricityPricePerKwh: number | null
  /** Híbrido plug-in: % dos km no modo elétrico */
  electricSharePct: number | null
}

export interface PerKmReserves {
  maintenancePerKm: number
  tiresPerKm: number
  depreciationPerKm: number
}

export interface VehicleFixedCosts {
  ownership: Ownership
  rentAmount: number
  rentPeriod: RentPeriod
  insuranceMonthly: number
  taxesYearly: number
  otherFixedMonthly: number
  /** Só fluxo de caixa: nunca entra no resultado operacional */
  financingMonthly: number
  fixedCostsStart: ISODate
  /** Último dia em que os custos fixos contam (dia do arquivamento) */
  fixedCostsEnd: ISODate | null
}

export interface Vehicle extends EnergyConfig, PerKmReserves, VehicleFixedCosts {
  id: string
  name: string
  kind: VehicleKind
  brand: string | null
  model: string | null
  plate: string | null
  archivedAt: string | null
  createdAt: string
}

export interface Platform {
  id: string
  name: string
  kind: PlatformKind
  color: string
  sortOrder: number
  archivedAt: string | null
}

export interface ShiftEarning {
  platformId: string
  /** Líquido recebido da plataforma (já sem a taxa da plataforma) */
  amount: number
  tips: number
  bonus: number
  trips: number | null
}

export interface Expense {
  id?: string
  category: ExpenseCategory
  amount: number
  description: string | null
  spentOn: ISODate
  shiftId: string | null
  vehicleId: string | null
}

/** Parâmetros que deram origem ao custo por km de uma jornada. */
export interface CostParams extends EnergyConfig {
  vehicleName: string
}

/** "Foto" dos custos por km gravada em cada jornada. */
export interface CostSnapshot extends PerKmReserves {
  energyCostPerKm: number
  params: CostParams | null
}

export interface Shift extends CostSnapshot {
  id: string
  vehicleId: string
  workDate: ISODate
  startedAt: string
  endedAt: string
  breakMinutes: number
  odometerStart: number
  odometerEnd: number
  notes: string | null
  earnings: ShiftEarning[]
  expenses: Expense[]
}
