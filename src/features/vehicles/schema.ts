import { z } from 'zod'
import { startOfMonth, todayISO } from '@/domain/dates'
import { usesElectricity, usesFuel } from '@/domain/energy'
import type { Vehicle } from '@/domain/types'
import type { Database } from '@/types/database'

type VehicleInsert = Database['public']['Tables']['vehicles']['Insert']

const money = z.number().int().min(0).max(1_000_000_00, 'Valor muito alto')
const perKm = z.number().min(0, 'Não pode ser negativo').max(10, 'Mais de R$ 10/km? Confira o valor').nullable()
const optional = (n: z.ZodNumber) => n.nullable()

export const vehicleFormSchema = z
  .object({
    name: z.string().trim().min(1, 'Dê um nome, ex.: "Onix prata"').max(40, 'Use até 40 caracteres'),
    kind: z.enum(['car', 'motorcycle']),
    powertrain: z.enum(['combustion', 'hybrid', 'plugin_hybrid', 'electric']),
    fuelType: z.enum(['gasoline', 'ethanol', 'diesel', 'cng']),
    fuelKmPerUnit: optional(z.number().gt(0, 'Precisa ser maior que zero').max(200, 'Confira o consumo')),
    fuelPricePerUnit: optional(z.number().gt(0, 'Precisa ser maior que zero').max(100, 'Confira o preço')),
    electricKmPerKwh: optional(z.number().gt(0, 'Precisa ser maior que zero').max(50, 'Confira o consumo')),
    electricityPricePerKwh: optional(z.number().min(0, 'Não pode ser negativo').max(20, 'Confira o preço')),
    electricSharePct: optional(z.number().min(0, 'Entre 0 e 100').max(100, 'Entre 0 e 100')),
    maintenancePerKm: perKm,
    tiresPerKm: perKm,
    depreciationPerKm: perKm,
    ownership: z.enum(['owned', 'financed', 'rented', 'other']),
    rentCents: money,
    rentPeriod: z.enum(['week', 'month']),
    insuranceCents: money,
    taxesYearlyCents: money,
    otherFixedCents: money,
    financingCents: money,
    fixedCostsStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida'),
    model: z.string().trim().max(60, 'Use até 60 caracteres'),
    plate: z.string().trim().max(10, 'Placa muito longa'),
  })
  .superRefine((v, ctx) => {
    const need = (path: keyof typeof v, message: string) => ctx.addIssue({ code: 'custom', path: [path], message })
    if (v.kind === 'motorcycle' && (v.powertrain === 'hybrid' || v.powertrain === 'plugin_hybrid')) {
      need('powertrain', 'Moto pode ser a combustão ou elétrica')
    }
    if (usesFuel(v.powertrain)) {
      if (v.fuelKmPerUnit === null) need('fuelKmPerUnit', 'Informe o consumo médio')
      if (v.fuelPricePerUnit === null) need('fuelPricePerUnit', 'Informe o preço')
    }
    if (usesElectricity(v.powertrain)) {
      if (v.electricKmPerKwh === null) need('electricKmPerKwh', 'Informe o consumo elétrico')
      if (v.electricityPricePerKwh === null) need('electricityPricePerKwh', 'Informe o custo do kWh')
    }
    if (v.powertrain === 'plugin_hybrid' && v.electricSharePct === null) {
      need('electricSharePct', 'Quanto você roda no elétrico?')
    }
  })

export type VehicleFormValues = z.input<typeof vehicleFormSchema>

export function emptyVehicleForm(): VehicleFormValues {
  return {
    name: '',
    kind: 'car',
    powertrain: 'combustion',
    fuelType: 'gasoline',
    fuelKmPerUnit: null,
    fuelPricePerUnit: null,
    electricKmPerKwh: null,
    electricityPricePerKwh: null,
    electricSharePct: 60,
    maintenancePerKm: null,
    tiresPerKm: null,
    depreciationPerKm: null,
    ownership: 'owned',
    rentCents: 0,
    rentPeriod: 'week',
    insuranceCents: 0,
    taxesYearlyCents: 0,
    otherFixedCents: 0,
    financingCents: 0,
    fixedCostsStart: startOfMonth(todayISO()),
    model: '',
    plate: '',
  }
}

const cents = (reais: number) => Math.round(reais * 100)

export function vehicleToForm(v: Vehicle): VehicleFormValues {
  return {
    name: v.name,
    kind: v.kind,
    powertrain: v.powertrain,
    fuelType: v.fuelType ?? 'gasoline',
    fuelKmPerUnit: v.fuelKmPerUnit,
    fuelPricePerUnit: v.fuelPricePerUnit,
    electricKmPerKwh: v.electricKmPerKwh,
    electricityPricePerKwh: v.electricityPricePerKwh,
    electricSharePct: v.electricSharePct ?? 60,
    maintenancePerKm: v.maintenancePerKm || null,
    tiresPerKm: v.tiresPerKm || null,
    depreciationPerKm: v.depreciationPerKm || null,
    ownership: v.ownership,
    rentCents: cents(v.rentAmount),
    rentPeriod: v.rentPeriod,
    insuranceCents: cents(v.insuranceMonthly),
    taxesYearlyCents: cents(v.taxesYearly),
    otherFixedCents: cents(v.otherFixedMonthly),
    financingCents: cents(v.financingMonthly),
    fixedCostsStart: v.fixedCostsStart,
    model: v.model ?? '',
    plate: v.plate ?? '',
  }
}

/**
 * Valores do formulário → linha da tabela. Campos que a motorização ou a
 * situação não usam vão nulos ou zerados (o banco exige essa coerência).
 */
export function formToVehicleRow(v: VehicleFormValues): Omit<VehicleInsert, 'archived_at' | 'id'> {
  const fuel = usesFuel(v.powertrain)
  const electric = usesElectricity(v.powertrain)
  return {
    name: v.name.trim(),
    kind: v.kind,
    powertrain: v.powertrain,
    fuel_type: fuel ? v.fuelType : null,
    fuel_km_per_unit: fuel ? v.fuelKmPerUnit : null,
    fuel_price_per_unit: fuel ? v.fuelPricePerUnit : null,
    electric_km_per_kwh: electric ? v.electricKmPerKwh : null,
    electricity_price_per_kwh: electric ? v.electricityPricePerKwh : null,
    electric_share_pct: v.powertrain === 'plugin_hybrid' ? v.electricSharePct : null,
    maintenance_per_km: v.maintenancePerKm ?? 0,
    tires_per_km: v.tiresPerKm ?? 0,
    depreciation_per_km: v.ownership === 'rented' ? 0 : (v.depreciationPerKm ?? 0),
    ownership: v.ownership,
    rent_amount: v.ownership === 'rented' ? v.rentCents / 100 : 0,
    rent_period: v.rentPeriod,
    insurance_monthly: v.insuranceCents / 100,
    taxes_yearly: v.taxesYearlyCents / 100,
    other_fixed_monthly: v.otherFixedCents / 100,
    financing_monthly: v.ownership === 'financed' ? v.financingCents / 100 : 0,
    fixed_costs_start: v.fixedCostsStart,
    model: v.model.trim() || null,
    plate: v.plate.trim().toUpperCase() || null,
  }
}
