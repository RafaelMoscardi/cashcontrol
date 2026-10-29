/* Testes do banco: migrations, RLS, restrições e função save_shift.
   Rodam num PostgreSQL embutido (PGlite) com o mesmo SQL que vai para o Supabase. */
import type { PGlite, Transaction } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { openDatabase, withClaims } from '../../scripts/local-supabase/db.ts'

let db: PGlite
let alice: string
let bob: string

const CAR = {
  name: 'Onix',
  kind: 'car',
  powertrain: 'combustion',
  fuel_type: 'gasoline',
  fuel_km_per_unit: 12,
  fuel_price_per_unit: 6,
}

async function createUser(email: string, fullName?: string): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    'insert into auth.users (email, raw_user_meta_data) values ($1, $2::jsonb) returning id',
    [email, JSON.stringify(fullName ? { full_name: fullName } : {})],
  )
  return rows[0]!.id
}

const as = <T>(userId: string, fn: (tx: Transaction) => Promise<T>) =>
  withClaims(db, { sub: userId, role: 'authenticated' }, fn)

async function insertRow(tx: Transaction, table: string, values: Record<string, unknown>): Promise<string> {
  const cols = Object.keys(values)
  const { rows } = await tx.query<{ id: string }>(
    `insert into public.${table} (${cols.join(', ')}) values (${cols.map((_, i) => `$${i + 1}`).join(', ')}) returning id`,
    Object.values(values),
  )
  return rows[0]!.id
}

const insertVehicle = (tx: Transaction, overrides: Record<string, unknown> = {}) =>
  insertRow(tx, 'vehicles', { ...CAR, ...overrides })

const insertPlatform = (tx: Transaction, name: string) => insertRow(tx, 'platforms', { name })

function shiftPayload(vehicleId: string, overrides: Record<string, unknown> = {}) {
  return {
    vehicle_id: vehicleId,
    work_date: '2026-10-20',
    started_at: '2026-10-20T11:00:00Z',
    ended_at: '2026-10-20T21:00:00Z',
    break_minutes: 60,
    odometer_start: 10000,
    odometer_end: 10120,
    energy_cost_per_km: 0.5,
    maintenance_per_km: 0.1,
    cost_snapshot: { powertrain: 'combustion', fuel_price_per_unit: 6, fuel_km_per_unit: 12 },
    ...overrides,
  }
}

async function saveShift(
  tx: Transaction,
  shift: Record<string, unknown>,
  earnings: Record<string, unknown>[] = [],
  expenses: Record<string, unknown>[] = [],
): Promise<string> {
  const { rows } = await tx.query<{ id: string }>(
    'select public.save_shift($1::jsonb, $2::jsonb, $3::jsonb) as id',
    [JSON.stringify(shift), JSON.stringify(earnings), JSON.stringify(expenses)],
  )
  return rows[0]!.id
}

beforeAll(async () => {
  db = await openDatabase()
  alice = await createUser('alice@exemplo.com', 'Alice Souza')
  bob = await createUser('bob@exemplo.com')
})

afterAll(async () => {
  await db.close()
})

describe('cadastro', () => {
  it('cria o perfil automaticamente com o nome informado', async () => {
    const profile = await as(alice, async (tx) => (await tx.query('select full_name, onboarded_at from public.profiles')).rows)
    expect(profile).toEqual([{ full_name: 'Alice Souza', onboarded_at: null }])
  })

  it('não deixa criar nem apagar perfil pelo app', async () => {
    await expect(
      as(alice, (tx) => tx.query('insert into public.profiles (id) values ($1)', [alice])),
    ).rejects.toMatchObject({ code: '42501' })
    await expect(as(alice, (tx) => tx.query('delete from public.profiles'))).rejects.toMatchObject({ code: '42501' })
  })
})

describe('isolamento entre usuários (RLS)', () => {
  it('um usuário não vê, altera nem apaga dados de outro', async () => {
    const vehicleId = await as(alice, (tx) => insertVehicle(tx))

    const seen = await as(bob, async (tx) => (await tx.query('select id from public.vehicles')).rows)
    expect(seen).toEqual([])

    const updated = await as(bob, (tx) => tx.query(`update public.vehicles set name = 'roubado' where id = $1`, [vehicleId]))
    expect(updated.affectedRows).toBe(0)

    const deleted = await as(bob, (tx) => tx.query('delete from public.vehicles where id = $1', [vehicleId]))
    expect(deleted.affectedRows).toBe(0)

    const stillThere = await as(alice, async (tx) => (await tx.query<{ name: string }>('select name from public.vehicles where id = $1', [vehicleId])).rows)
    expect(stillThere).toEqual([{ name: 'Onix' }])
  })

  it('não deixa gravar linha em nome de outro usuário', async () => {
    await expect(as(bob, (tx) => insertVehicle(tx, { user_id: alice }))).rejects.toMatchObject({ code: '42501' })
  })

  it('não deixa ligar uma jornada ao veículo de outro usuário, mesmo sabendo o id', async () => {
    const aliceVehicle = await as(alice, (tx) => insertVehicle(tx, { name: 'Carro da Alice' }))
    await expect(
      as(bob, (tx) => saveShift(tx, shiftPayload(aliceVehicle, { work_date: '2026-09-01', started_at: '2026-09-01T10:00:00Z', ended_at: '2026-09-01T12:00:00Z' }))),
    ).rejects.toMatchObject({ code: '23503' })
  })

  it('não deixa usar a plataforma de outro usuário', async () => {
    const alicePlatform = await as(alice, (tx) => insertPlatform(tx, 'Uber'))
    const bobVehicle = await as(bob, (tx) => insertVehicle(tx, { name: 'Moto do Bob', kind: 'motorcycle', fuel_km_per_unit: 35 }))
    await expect(
      as(bob, (tx) =>
        saveShift(tx, shiftPayload(bobVehicle, { odometer_start: 0, odometer_end: 50 }), [{ platform_id: alicePlatform, amount: 100 }]),
      ),
    ).rejects.toMatchObject({ code: '23503' })
    // a transação inteira foi desfeita: nenhuma jornada órfã ficou para trás
    const orphan = await as(bob, async (tx) => (await tx.query('select id from public.shifts')).rows)
    expect(orphan).toEqual([])
  })

  it('visitante sem login não lê nada', async () => {
    await expect(
      withClaims(db, { role: 'anon' }, (tx) => tx.query('select * from public.vehicles')),
    ).rejects.toMatchObject({ code: '42501' })
    await expect(
      withClaims(db, { role: 'anon' }, (tx) => tx.query(`select public.shifts_between('2026-01-01', '2026-12-31')`)),
    ).rejects.toMatchObject({ code: '42501' })
  })
})

describe('veículos', () => {
  it('exige a configuração de energia certa para cada motorização', async () => {
    // elétrico sem km/kWh
    await expect(
      as(alice, (tx) => insertVehicle(tx, { powertrain: 'electric', fuel_type: null, fuel_km_per_unit: null, fuel_price_per_unit: null })),
    ).rejects.toMatchObject({ code: '23514' })
    // elétrico completo
    await expect(
      as(alice, (tx) =>
        insertVehicle(tx, {
          name: 'Dolphin',
          powertrain: 'electric',
          fuel_type: null,
          fuel_km_per_unit: null,
          fuel_price_per_unit: null,
          electric_km_per_kwh: 6.5,
          electricity_price_per_kwh: 0.95,
        }),
      ),
    ).resolves.toBeTypeOf('string')
    // plug-in sem percentual elétrico
    await expect(
      as(alice, (tx) => insertVehicle(tx, { powertrain: 'plugin_hybrid', electric_km_per_kwh: 5, electricity_price_per_kwh: 1 })),
    ).rejects.toMatchObject({ code: '23514' })
  })

  it('guarda marca e modelo; marca vazia ou longa demais é recusada', async () => {
    const id = await as(alice, (tx) => insertVehicle(tx, { brand: 'Chevrolet', model: 'Onix Plus' }))
    const { rows } = await db.query<{ brand: string; model: string }>('select brand, model from public.vehicles where id = $1', [id])
    expect(rows[0]).toEqual({ brand: 'Chevrolet', model: 'Onix Plus' })
    await expect(as(alice, (tx) => insertVehicle(tx, { brand: '   ' }))).rejects.toMatchObject({ code: '23514' })
    await expect(as(alice, (tx) => insertVehicle(tx, { brand: 'x'.repeat(41) }))).rejects.toMatchObject({ code: '23514' })
  })

  it('moto só pode ser a combustão ou elétrica', async () => {
    await expect(as(alice, (tx) => insertVehicle(tx, { kind: 'motorcycle', powertrain: 'hybrid' }))).rejects.toMatchObject({
      code: '23514',
    })
  })

  it('recusa consumo zero, preço negativo e aluguel em veículo próprio', async () => {
    await expect(as(alice, (tx) => insertVehicle(tx, { fuel_km_per_unit: 0 }))).rejects.toMatchObject({ code: '23514' })
    await expect(as(alice, (tx) => insertVehicle(tx, { fuel_price_per_unit: -1 }))).rejects.toMatchObject({ code: '23514' })
    await expect(as(alice, (tx) => insertVehicle(tx, { ownership: 'owned', rent_amount: 500 }))).rejects.toMatchObject({
      code: '23514',
    })
    await expect(
      as(alice, (tx) => insertVehicle(tx, { ownership: 'rented', rent_amount: 650, depreciation_per_km: 0.1 })),
    ).rejects.toMatchObject({ code: '23514' })
  })
})

describe('jornadas', () => {
  let carol: string
  let vehicle: string
  let uber: string
  let ifood: string

  beforeAll(async () => {
    carol = await createUser('carol@exemplo.com', 'Carol')
    vehicle = await as(carol, (tx) => insertVehicle(tx))
    uber = await as(carol, (tx) => insertPlatform(tx, 'Uber'))
    ifood = await as(carol, (tx) => insertPlatform(tx, 'iFood'))
  })

  it('grava jornada, ganhos e despesas juntos; a despesa herda data e veículo', async () => {
    const id = await as(carol, (tx) =>
      saveShift(
        tx,
        shiftPayload(vehicle),
        [
          { platform_id: uber, amount: 250, tips: 10, bonus: 15, trips: 14 },
          { platform_id: ifood, amount: 25 },
        ],
        [{ category: 'fuel', amount: 100, description: 'Posto' }],
      ),
    )

    const detail = await as(carol, async (tx) => (await tx.query<{ d: Record<string, any> }>('select public.shift_detail($1) as d', [id])).rows[0]!.d)
    expect(detail.earnings).toHaveLength(2)
    expect(detail.earnings[0]).toMatchObject({ amount: 250, tips: 10, bonus: 15, trips: 14 })
    expect(detail.expenses).toHaveLength(1)
    expect(detail.expenses[0]).toMatchObject({ category: 'fuel', amount: 100, spent_on: '2026-10-20', vehicle_id: vehicle })
    expect(detail).toMatchObject({ odometer_start: 10000, odometer_end: 10120, energy_cost_per_km: 0.5, break_minutes: 60 })
  })

  it('recusa jornada com horário sobreposto', async () => {
    await expect(
      as(carol, (tx) =>
        saveShift(tx, shiftPayload(vehicle, { started_at: '2026-10-20T20:00:00Z', ended_at: '2026-10-20T23:00:00Z', odometer_start: 10120, odometer_end: 10150 })),
      ),
    ).rejects.toMatchObject({ code: '23P01', constraint: 'shifts_no_time_overlap' })
  })

  it('recusa hodômetro sobreposto no mesmo veículo, mas aceita jornadas encostadas', async () => {
    await expect(
      as(carol, (tx) =>
        saveShift(tx, shiftPayload(vehicle, { work_date: '2026-10-21', started_at: '2026-10-21T11:00:00Z', ended_at: '2026-10-21T15:00:00Z', odometer_start: 10100, odometer_end: 10200 })),
      ),
    ).rejects.toMatchObject({ code: '23P01', constraint: 'shifts_no_odometer_overlap' })

    await expect(
      as(carol, (tx) =>
        saveShift(tx, shiftPayload(vehicle, { work_date: '2026-10-21', started_at: '2026-10-21T11:00:00Z', ended_at: '2026-10-21T15:00:00Z', odometer_start: 10120, odometer_end: 10200 })),
      ),
    ).resolves.toBeTypeOf('string')
  })

  it('a mesma plataforma não entra duas vezes na jornada, e nada fica gravado pela metade', async () => {
    const before = await as(carol, async (tx) => (await tx.query('select count(*)::int as n from public.shifts')).rows[0])
    await expect(
      as(carol, (tx) =>
        saveShift(
          tx,
          shiftPayload(vehicle, { work_date: '2026-10-22', started_at: '2026-10-22T11:00:00Z', ended_at: '2026-10-22T15:00:00Z', odometer_start: 10200, odometer_end: 10250 }),
          [
            { platform_id: uber, amount: 100 },
            { platform_id: uber, amount: 100 },
          ],
        ),
      ),
    ).rejects.toMatchObject({ code: '23505' })
    const after = await as(carol, async (tx) => (await tx.query('select count(*)::int as n from public.shifts')).rows[0])
    expect(after).toEqual(before)
  })

  it('edição substitui ganhos e despesas e move a data das despesas junto', async () => {
    const id = await as(carol, (tx) =>
      saveShift(
        tx,
        shiftPayload(vehicle, { work_date: '2026-10-23', started_at: '2026-10-23T11:00:00Z', ended_at: '2026-10-23T15:00:00Z', odometer_start: 10300, odometer_end: 10350 }),
        [{ platform_id: uber, amount: 90 }],
        [{ category: 'toll', amount: 12.4 }],
      ),
    )
    await as(carol, (tx) =>
      saveShift(
        tx,
        shiftPayload(vehicle, { id, work_date: '2026-10-24', started_at: '2026-10-24T11:00:00Z', ended_at: '2026-10-24T15:00:00Z', odometer_start: 10300, odometer_end: 10360 }),
        [{ platform_id: ifood, amount: 120 }],
        [
          { category: 'parking', amount: 8 },
          { category: 'food', amount: 22.5 },
        ],
      ),
    )
    const detail = await as(carol, async (tx) => (await tx.query<{ d: Record<string, any> }>('select public.shift_detail($1) as d', [id])).rows[0]!.d)
    expect(detail.work_date).toBe('2026-10-24')
    expect(detail.earnings.map((e: any) => [e.platform_id, e.amount])).toEqual([[ifood, 120]])
    expect(detail.expenses.map((e: any) => [e.category, e.amount, e.spent_on])).toEqual([
      ['parking', 8, '2026-10-24'],
      ['food', 22.5, '2026-10-24'],
    ])
  })

  it('shifts_between devolve só as jornadas do usuário, no intervalo, mais recentes primeiro', async () => {
    const list = await as(carol, async (tx) => (await tx.query<{ j: any[] }>(`select public.shifts_between('2026-10-20', '2026-10-24') as j`)).rows[0]!.j)
    expect(list.map((s) => s.work_date)).toEqual(['2026-10-24', '2026-10-21', '2026-10-20'])
    const forBob = await as(bob, async (tx) => (await tx.query<{ j: any[] }>(`select public.shifts_between('2026-10-20', '2026-10-24') as j`)).rows[0]!.j)
    expect(forBob).toEqual([])
  })

  it('não apaga veículo com jornadas; apagar a jornada leva ganhos e despesas junto', async () => {
    // ON DELETE RESTRICT: 23001 (restrict_violation)
    await expect(as(carol, (tx) => tx.query('delete from public.vehicles where id = $1', [vehicle]))).rejects.toMatchObject({
      code: '23001',
    })
    const [shift] = await as(carol, async (tx) => (await tx.query<{ id: string }>(`select id from public.shifts where work_date = '2026-10-20'`)).rows)
    await as(carol, (tx) => tx.query('delete from public.shifts where id = $1', [shift!.id]))
    const leftovers = await as(carol, async (tx) => ({
      earnings: (await tx.query('select 1 from public.shift_earnings where shift_id = $1', [shift!.id])).rows.length,
      expenses: (await tx.query('select 1 from public.expenses where shift_id = $1', [shift!.id])).rows.length,
    }))
    expect(leftovers).toEqual({ earnings: 0, expenses: 0 })
  })

  it('recusa horários e hodômetros impossíveis', async () => {
    const base = { work_date: '2026-10-25', started_at: '2026-10-25T11:00:00Z', ended_at: '2026-10-25T12:00:00Z', odometer_start: 20000, odometer_end: 20010 }
    await expect(as(carol, (tx) => saveShift(tx, shiftPayload(vehicle, { ...base, ended_at: '2026-10-25T10:00:00Z' })))).rejects.toMatchObject({ code: '23514' })
    await expect(as(carol, (tx) => saveShift(tx, shiftPayload(vehicle, { ...base, break_minutes: 60 })))).rejects.toMatchObject({ code: '23514' })
    await expect(as(carol, (tx) => saveShift(tx, shiftPayload(vehicle, { ...base, odometer_end: 19990 })))).rejects.toMatchObject({ code: '23514' })
    await expect(as(carol, (tx) => saveShift(tx, shiftPayload(vehicle, { ...base, ended_at: '2026-10-26T12:00:00Z' })))).rejects.toMatchObject({ code: '23514' })
  })
})
