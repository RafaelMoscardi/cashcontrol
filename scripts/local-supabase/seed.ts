/* Conta de demonstração no Supabase LOCAL: 3 semanas de jornadas realistas.
   Uso (com `npm run dev:local` rodando): npm run seed:local
   Nunca aponte isto para o Supabase de produção. */
import { createClient } from '@supabase/supabase-js'

const URL = process.env.LOCAL_SUPABASE_URL ?? 'http://127.0.0.1:54321'
if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(URL)) throw new Error('O seed só roda contra o Supabase local.')

const EMAIL = 'demo@cashcontrol.local'
const PASSWORD = 'Demo12345'

const sb = createClient(URL, 'local-dev-publishable-key', { auth: { persistSession: false } })

let { error } = await sb.auth.signInWithPassword({ email: EMAIL, password: PASSWORD })
if (error) {
  ;({ error } = await sb.auth.signUp({ email: EMAIL, password: PASSWORD, options: { data: { full_name: 'Demo Motorista' } } }))
  if (error) throw error
}

const { data: existing } = await sb.from('shifts').select('id').limit(1)
if (existing?.length) {
  console.log(`A conta ${EMAIL} já tem dados. Apague .local-supabase/ para recomeçar.`)
  process.exit(0)
}

const { data: platforms, error: pErr } = await sb
  .from('platforms')
  .insert([
    { name: 'Uber', kind: 'rides', color: '#8b5cf6', sort_order: 0, archived_at: null },
    { name: '99', kind: 'rides', color: '#199e70', sort_order: 1, archived_at: null },
    { name: 'iFood', kind: 'delivery', color: '#d95926', sort_order: 2, archived_at: null },
  ])
  .select()
if (pErr || !platforms) throw pErr

const today = new Date()
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 21)

const { data: vehicle, error: vErr } = await sb
  .from('vehicles')
  .insert({
    name: 'Onix prata',
    kind: 'car',
    powertrain: 'combustion',
    fuel_type: 'gasoline',
    fuel_km_per_unit: 12.5,
    fuel_price_per_unit: 6.29,
    maintenance_per_km: 0.09,
    tires_per_km: 0.04,
    ownership: 'rented',
    rent_amount: 650,
    rent_period: 'week',
    other_fixed_monthly: 49.9,
    fixed_costs_start: iso(start),
    archived_at: null,
  })
  .select()
  .single()
if (vErr || !vehicle) throw vErr

// Gerador determinístico: os mesmos dados toda vez
let seed = 42
const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
const between = (min: number, max: number) => min + rand() * (max - min)

let odometer = 58_340
let created = 0
for (let i = 0; i <= 21; i++) {
  const day = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
  if (day.getDay() === 0 && rand() < 0.7) continue // folga na maioria dos domingos
  const startHour = Math.round(between(6, 10))
  const hours = Math.round(between(7, 11))
  const startedAt = new Date(day.getFullYear(), day.getMonth(), day.getDate(), startHour, Math.round(between(0, 3)) * 15)
  const endedAt = new Date(startedAt.getTime() + hours * 3_600_000)
  const km = Math.round(between(15, 21) * hours)
  const uber = Math.round(between(26, 36) * hours * 0.62 * 100) / 100
  const nineNine = Math.round(between(22, 32) * hours * 0.25 * 100) / 100
  const ifood = rand() < 0.4 ? Math.round(between(30, 70) * 100) / 100 : 0
  const earnings = [
    { platform_id: platforms[0]!.id, amount: uber, tips: rand() < 0.3 ? 5 : 0, bonus: rand() < 0.2 ? 25 : 0, trips: Math.round(hours * 1.6) },
    { platform_id: platforms[1]!.id, amount: nineNine, tips: 0, bonus: 0, trips: Math.round(hours * 0.7) },
    ...(ifood ? [{ platform_id: platforms[2]!.id, amount: ifood, tips: 0, bonus: 0, trips: Math.round(ifood / 9) }] : []),
  ]
  const expenses = [
    ...(i % 3 === 0 ? [{ category: 'fuel', amount: Math.round(between(120, 200)), description: 'Posto' }] : []),
    ...(rand() < 0.5 ? [{ category: 'food', amount: Math.round(between(18, 35) * 100) / 100, description: 'Almoço' }] : []),
    ...(rand() < 0.25 ? [{ category: 'parking', amount: 12, description: null }] : []),
  ]
  const { error: sErr } = await sb.rpc('save_shift', {
    p_shift: {
      vehicle_id: vehicle.id,
      work_date: iso(day),
      started_at: startedAt.toISOString(),
      ended_at: endedAt.toISOString(),
      break_minutes: hours >= 8 ? 60 : 30,
      odometer_start: odometer,
      odometer_end: odometer + km,
      energy_cost_per_km: Math.round((6.29 / 12.5) * 1e5) / 1e5,
      maintenance_per_km: 0.09,
      tires_per_km: 0.04,
      depreciation_per_km: 0,
      cost_snapshot: { vehicleName: 'Onix prata', powertrain: 'combustion', fuelType: 'gasoline', fuelKmPerUnit: 12.5, fuelPricePerUnit: 6.29, electricKmPerKwh: null, electricityPricePerKwh: null, electricSharePct: null },
      notes: null,
    },
    p_earnings: earnings,
    p_expenses: expenses,
  })
  if (sErr) throw sErr
  odometer += km + Math.round(between(5, 25)) // km pessoais entre jornadas
  created++
}

await sb.from('profiles').update({ onboarded_at: new Date().toISOString() }).neq('id', '00000000-0000-0000-0000-000000000000')
console.log(`Conta ${EMAIL} criada com ${created} jornadas. Senha em scripts/local-supabase/README.md.`)
