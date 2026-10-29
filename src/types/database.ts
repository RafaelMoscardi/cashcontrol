/* Tipos das tabelas no formato do `supabase gen types`. Espelham
   supabase/migrations: ao mudar o banco, atualize aqui (ou gere com
   `npx supabase gen types typescript --project-id <id>`). */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

type Timestamps = { created_at: string }

export type ProfileRow = Timestamps & {
  id: string
  full_name: string | null
  onboarded_at: string | null
  updated_at: string
}

export type VehicleRow = Timestamps & {
  id: string
  user_id: string
  name: string
  kind: 'car' | 'motorcycle'
  powertrain: 'combustion' | 'hybrid' | 'plugin_hybrid' | 'electric'
  fuel_type: 'gasoline' | 'ethanol' | 'diesel' | 'cng' | null
  fuel_km_per_unit: number | null
  fuel_price_per_unit: number | null
  electric_km_per_kwh: number | null
  electricity_price_per_kwh: number | null
  electric_share_pct: number | null
  maintenance_per_km: number
  tires_per_km: number
  depreciation_per_km: number
  ownership: 'owned' | 'financed' | 'rented' | 'other'
  rent_amount: number
  rent_period: 'week' | 'month'
  insurance_monthly: number
  taxes_yearly: number
  other_fixed_monthly: number
  financing_monthly: number
  fixed_costs_start: string
  model: string | null
  plate: string | null
  archived_at: string | null
  updated_at: string
}

export type PlatformRow = Timestamps & {
  id: string
  user_id: string
  name: string
  kind: 'rides' | 'delivery' | 'mototaxi' | 'private' | 'other'
  color: string
  sort_order: number
  archived_at: string | null
}

export type ShiftRow = Timestamps & {
  id: string
  user_id: string
  vehicle_id: string
  work_date: string
  started_at: string
  ended_at: string
  break_minutes: number
  odometer_start: number
  odometer_end: number
  energy_cost_per_km: number
  maintenance_per_km: number
  tires_per_km: number
  depreciation_per_km: number
  cost_snapshot: Json
  notes: string | null
  updated_at: string
}

export type ShiftEarningRow = Timestamps & {
  id: string
  user_id: string
  shift_id: string
  platform_id: string
  amount: number
  tips: number
  bonus: number
  trips: number | null
  position: number
}

export type ExpenseRow = Timestamps & {
  id: string
  user_id: string
  shift_id: string | null
  vehicle_id: string | null
  spent_on: string
  category: 'fuel' | 'maintenance' | 'toll' | 'parking' | 'food' | 'wash' | 'phone' | 'fees' | 'fine' | 'other'
  amount: number
  description: string | null
  position: number
  updated_at: string
}

/** Jornada como devolvida por shifts_between / shift_detail. */
export type ShiftWithItemsRow = ShiftRow & {
  earnings: ShiftEarningRow[]
  expenses: ExpenseRow[]
}

type Generated = 'id' | 'user_id' | 'created_at' | 'updated_at'
type Insert<Row, Optional extends keyof Row = never> = Omit<Row, Generated | Optional> & Partial<Pick<Row, Optional>> & { id?: string }
type Update<Row> = Partial<Omit<Row, Generated>>

type VehicleDefaults =
  | 'fuel_type'
  | 'fuel_km_per_unit'
  | 'fuel_price_per_unit'
  | 'electric_km_per_kwh'
  | 'electricity_price_per_kwh'
  | 'electric_share_pct'
  | 'maintenance_per_km'
  | 'tires_per_km'
  | 'depreciation_per_km'
  | 'ownership'
  | 'rent_amount'
  | 'rent_period'
  | 'insurance_monthly'
  | 'taxes_yearly'
  | 'other_fixed_monthly'
  | 'financing_monthly'
  | 'fixed_costs_start'
  | 'model'
  | 'plate'
  | 'archived_at'

export type Database = {
  __InternalSupabase: { PostgrestVersion: '12.2.3' }
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow
        // O perfil nasce pelo gatilho do cadastro; o app não insere
        Insert: { id: string; full_name?: string | null }
        Update: { full_name?: string | null; onboarded_at?: string | null }
        Relationships: []
      }
      vehicles: {
        Row: VehicleRow
        Insert: Insert<VehicleRow, VehicleDefaults>
        Update: Update<VehicleRow>
        Relationships: []
      }
      platforms: {
        Row: PlatformRow
        Insert: Insert<PlatformRow, 'kind' | 'color' | 'sort_order' | 'archived_at'>
        Update: Update<PlatformRow>
        Relationships: []
      }
      shifts: {
        Row: ShiftRow
        Insert: Insert<ShiftRow, 'break_minutes' | 'maintenance_per_km' | 'tires_per_km' | 'depreciation_per_km' | 'cost_snapshot' | 'notes'>
        Update: Update<ShiftRow>
        Relationships: []
      }
      shift_earnings: {
        Row: ShiftEarningRow
        Insert: Insert<ShiftEarningRow, 'tips' | 'bonus' | 'trips' | 'position'>
        Update: Update<ShiftEarningRow>
        Relationships: []
      }
      expenses: {
        Row: ExpenseRow
        Insert: Insert<ExpenseRow, 'shift_id' | 'vehicle_id' | 'description' | 'position'>
        Update: Update<ExpenseRow>
        Relationships: []
      }
    }
    Views: { [_ in never]: never }
    Functions: {
      save_shift: {
        Args: { p_shift: Json; p_earnings?: Json; p_expenses?: Json }
        Returns: string
      }
      shifts_between: {
        Args: { p_from: string; p_to: string }
        Returns: Json
      }
      shift_detail: {
        Args: { p_id: string }
        Returns: Json
      }
    }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}
