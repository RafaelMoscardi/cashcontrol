import { useMutation, useQuery } from '@tanstack/react-query'
import { toISODate } from '@/domain/dates'
import type { Vehicle } from '@/domain/types'
import { unwrap } from '@/lib/errors'
import { queryClient, queryKeys } from '@/lib/query-client'
import { supabase } from '@/lib/supabase'
import type { VehicleRow } from '@/types/database'
import { formToVehicleRow, type VehicleFormValues } from './schema'

const numOrNull = (v: number | string | null) => (v === null ? null : Number(v))

export function toVehicle(row: VehicleRow): Vehicle {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    powertrain: row.powertrain,
    fuelType: row.fuel_type,
    fuelKmPerUnit: numOrNull(row.fuel_km_per_unit),
    fuelPricePerUnit: numOrNull(row.fuel_price_per_unit),
    electricKmPerKwh: numOrNull(row.electric_km_per_kwh),
    electricityPricePerKwh: numOrNull(row.electricity_price_per_kwh),
    electricSharePct: numOrNull(row.electric_share_pct),
    maintenancePerKm: Number(row.maintenance_per_km),
    tiresPerKm: Number(row.tires_per_km),
    depreciationPerKm: Number(row.depreciation_per_km),
    ownership: row.ownership,
    rentAmount: Number(row.rent_amount),
    rentPeriod: row.rent_period,
    insuranceMonthly: Number(row.insurance_monthly),
    taxesYearly: Number(row.taxes_yearly),
    otherFixedMonthly: Number(row.other_fixed_monthly),
    financingMonthly: Number(row.financing_monthly),
    fixedCostsStart: row.fixed_costs_start,
    fixedCostsEnd: row.archived_at ? toISODate(new Date(row.archived_at)) : null,
    model: row.model,
    plate: row.plate,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
  }
}

async function listVehicles(): Promise<Vehicle[]> {
  const rows = unwrap(await supabase.from('vehicles').select('*').order('created_at', { ascending: true }))
  return rows.map(toVehicle)
}

async function saveVehicle({ id, values }: { id?: string; values: VehicleFormValues }): Promise<Vehicle> {
  const row = formToVehicleRow(values)
  const saved = id
    ? unwrap(await supabase.from('vehicles').update(row).eq('id', id).select().single())
    : unwrap(await supabase.from('vehicles').insert({ ...row, archived_at: null }).select().single())
  return toVehicle(saved)
}

async function setArchived({ id, archived }: { id: string; archived: boolean }): Promise<Vehicle> {
  const row = unwrap(
    await supabase
      .from('vehicles')
      .update({ archived_at: archived ? new Date().toISOString() : null })
      .eq('id', id)
      .select()
      .single(),
  )
  return toVehicle(row)
}

async function deleteVehicle(id: string): Promise<void> {
  unwrap(await supabase.from('vehicles').delete().eq('id', id))
}

const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKeys.vehicles })

export function useVehicles() {
  return useQuery({ queryKey: queryKeys.vehicles, queryFn: listVehicles })
}

export function useSaveVehicle() {
  return useMutation({ mutationFn: saveVehicle, onSettled: invalidate })
}

export function useArchiveVehicle() {
  return useMutation({ mutationFn: setArchived, onSettled: invalidate })
}

export function useDeleteVehicle() {
  return useMutation({ mutationFn: deleteVehicle, onSettled: invalidate })
}

/** Ativos primeiro, na ordem de cadastro. */
export const activeVehicles = (vehicles: ReadonlyArray<Vehicle> | undefined) => (vehicles ?? []).filter((v) => !v.archivedAt)
