import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query'
import type { DateRange } from '@/domain/dates'
import type { CostParams, CostSnapshot, Shift } from '@/domain/types'
import { unwrap } from '@/lib/errors'
import { queryClient, queryKeys } from '@/lib/query-client'
import { supabase } from '@/lib/supabase'
import type { Json, ShiftWithItemsRow } from '@/types/database'
import { toSavePayload, type ShiftFormValues } from './schema'

function toCostParams(json: Json): CostParams | null {
  if (!json || typeof json !== 'object' || Array.isArray(json) || !('powertrain' in json)) return null
  return json as unknown as CostParams
}

export function toShift(row: ShiftWithItemsRow): Shift {
  return {
    id: row.id,
    vehicleId: row.vehicle_id,
    workDate: row.work_date,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    breakMinutes: Number(row.break_minutes),
    odometerStart: Number(row.odometer_start),
    odometerEnd: Number(row.odometer_end),
    energyCostPerKm: Number(row.energy_cost_per_km),
    maintenancePerKm: Number(row.maintenance_per_km),
    tiresPerKm: Number(row.tires_per_km),
    depreciationPerKm: Number(row.depreciation_per_km),
    params: toCostParams(row.cost_snapshot),
    notes: row.notes,
    earnings: row.earnings.map((e) => ({
      platformId: e.platform_id,
      amount: Number(e.amount),
      tips: Number(e.tips),
      bonus: Number(e.bonus),
      trips: e.trips === null ? null : Number(e.trips),
    })),
    expenses: row.expenses.map((x) => ({
      id: x.id,
      category: x.category,
      amount: Number(x.amount),
      description: x.description,
      spentOn: x.spent_on,
      shiftId: x.shift_id,
      vehicleId: x.vehicle_id,
    })),
  }
}

async function listShiftsBetween({ from, to }: DateRange): Promise<Shift[]> {
  const data = unwrap(await supabase.rpc('shifts_between', { p_from: from, p_to: to }))
  return ((data ?? []) as unknown as ShiftWithItemsRow[]).map(toShift)
}

async function getShift(id: string): Promise<Shift | null> {
  const data = unwrap(await supabase.rpc('shift_detail', { p_id: id }))
  return data ? toShift(data as unknown as ShiftWithItemsRow) : null
}

async function saveShift({ id, values, snapshot }: { id?: string; values: ShiftFormValues; snapshot: CostSnapshot }): Promise<string> {
  const payload = toSavePayload(values, snapshot, id)
  return unwrap(await supabase.rpc('save_shift', payload as unknown as { p_shift: Json; p_earnings: Json; p_expenses: Json }))
}

async function deleteShift(id: string): Promise<void> {
  unwrap(await supabase.from('shifts').delete().eq('id', id))
}

async function fetchLastOdometer(vehicleId: string): Promise<number | null> {
  const row = unwrap(
    await supabase
      .from('shifts')
      .select('odometer_end')
      .eq('vehicle_id', vehicleId)
      .order('ended_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  )
  return row ? Number(row.odometer_end) : null
}

const invalidateShifts = () => queryClient.invalidateQueries({ queryKey: queryKeys.shifts })

export function useShiftsBetween(range: DateRange) {
  return useQuery({
    queryKey: queryKeys.shiftsBetween(range.from, range.to),
    queryFn: () => listShiftsBetween(range),
    // Ao trocar o período, o painel mantém o anterior esmaecido em vez de piscar
    placeholderData: keepPreviousData,
  })
}

export function useShift(id: string | undefined) {
  return useQuery({ queryKey: queryKeys.shift(id ?? ''), queryFn: () => getShift(id!), enabled: Boolean(id) })
}

export function useLastOdometer(vehicleId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.lastOdometer(vehicleId ?? ''),
    queryFn: () => fetchLastOdometer(vehicleId!),
    enabled: Boolean(vehicleId),
  })
}

export function useSaveShift() {
  return useMutation({ mutationFn: saveShift, onSuccess: invalidateShifts })
}

export function useDeleteShift() {
  return useMutation({ mutationFn: deleteShift, onSuccess: invalidateShifts })
}
