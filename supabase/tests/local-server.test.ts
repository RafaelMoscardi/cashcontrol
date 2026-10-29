/* O servidor local responde ao supabase-js (o mesmo cliente do app) como o Supabase:
   autenticação, CRUD com RLS, RPC, erros e recuperação de senha. */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { startLocalSupabase, type LocalSupabase } from '../../scripts/local-supabase/server.ts'

let server: LocalSupabase

const client = () =>
  createClient(server.url, 'local-dev-key', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })

async function signUp(email: string, password = 'senha-forte-123', fullName = 'Teste'): Promise<SupabaseClient> {
  const sb = client()
  const { data, error } = await sb.auth.signUp({ email, password, options: { data: { full_name: fullName } } })
  expect(error).toBeNull()
  expect(data.session).not.toBeNull()
  return sb
}

beforeAll(async () => {
  server = await startLocalSupabase({ port: 0, quiet: true })
})

afterAll(async () => {
  await server.close()
})

describe('servidor Supabase local', () => {
  it('cadastra, cria o perfil e recusa e-mail repetido e senha errada', async () => {
    const sb = await signUp('dani@exemplo.com', 'senha-forte-123', 'Dani Lima')
    const { data: profile, error } = await sb.from('profiles').select('full_name, onboarded_at').single()
    expect(error).toBeNull()
    expect(profile).toEqual({ full_name: 'Dani Lima', onboarded_at: null })

    const again = await client().auth.signUp({ email: 'dani@exemplo.com', password: 'outra-senha-1' })
    expect(again.error?.code).toBe('user_already_exists')

    const wrong = await client().auth.signInWithPassword({ email: 'dani@exemplo.com', password: 'errada' })
    expect(wrong.error?.code).toBe('invalid_credentials')

    const ok = await client().auth.signInWithPassword({ email: 'DANI@exemplo.com', password: 'senha-forte-123' })
    expect(ok.error).toBeNull()
    expect(ok.data.user?.email).toBe('dani@exemplo.com')
  })

  it('CRUD, RPC e erros do banco chegam ao app como no PostgREST', async () => {
    const sb = await signUp('edu@exemplo.com')

    const { data: vehicle, error: vErr } = await sb
      .from('vehicles')
      .insert({ name: 'Onix', kind: 'car', powertrain: 'combustion', fuel_type: 'gasoline', fuel_km_per_unit: 12, fuel_price_per_unit: 6 })
      .select()
      .single()
    expect(vErr).toBeNull()
    expect(vehicle).toMatchObject({ name: 'Onix', fuel_km_per_unit: 12, maintenance_per_km: 0, archived_at: null })

    // Em lote, campo ausente vira null (como no PostgREST com defaultToNull): mandar linhas completas
    const partial = await sb.from('platforms').insert([{ name: 'Uber' }, { name: 'iFood', kind: 'delivery' }])
    expect(partial.error?.code).toBe('23502')
    const { data: platforms } = await sb
      .from('platforms')
      .insert([
        { name: 'Uber', kind: 'rides' },
        { name: 'iFood', kind: 'delivery' },
      ])
      .select()
    expect(platforms?.map((p) => p.name)).toEqual(['Uber', 'iFood'])
    const uber = platforms![0]!.id as string

    const shift = {
      vehicle_id: vehicle!.id,
      work_date: '2026-10-20',
      started_at: '2026-10-20T11:00:00Z',
      ended_at: '2026-10-20T21:00:00Z',
      break_minutes: 60,
      odometer_start: 1000,
      odometer_end: 1120,
      energy_cost_per_km: 0.5,
      maintenance_per_km: 0.1,
      cost_snapshot: {},
    }
    const saved = await sb.rpc('save_shift', {
      p_shift: shift,
      p_earnings: [{ platform_id: uber, amount: 300, tips: 5, trips: 18 }],
      p_expenses: [{ category: 'fuel', amount: 100 }],
    })
    expect(saved.error).toBeNull()
    expect(typeof saved.data).toBe('string')

    const list = await sb.rpc('shifts_between', { p_from: '2026-10-01', p_to: '2026-10-31' })
    expect(list.error).toBeNull()
    expect(list.data).toHaveLength(1)
    expect(list.data[0]).toMatchObject({ odometer_end: 1120, earnings: [{ amount: 300, tips: 5 }], expenses: [{ category: 'fuel', amount: 100 }] })

    const overlap = await sb.rpc('save_shift', { p_shift: { ...shift, odometer_start: 1120, odometer_end: 1150 }, p_earnings: [], p_expenses: [] })
    expect(overlap.error?.code).toBe('23P01')
    expect(overlap.error?.message).toContain('shifts_no_time_overlap')

    const last = await sb
      .from('shifts')
      .select('odometer_end')
      .eq('vehicle_id', vehicle!.id)
      .order('ended_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    expect(last.data).toEqual({ odometer_end: 1120 })

    const none = await sb.from('shifts').select('id').eq('work_date', '1999-01-01').maybeSingle()
    expect(none).toMatchObject({ data: null, error: null })

    const updated = await sb.from('vehicles').update({ fuel_price_per_unit: 6.49 }).eq('id', vehicle!.id).select().single()
    expect(updated.data?.fuel_price_per_unit).toBe(6.49)

    const badCheck = await sb.from('vehicles').update({ fuel_km_per_unit: 0 }).eq('id', vehicle!.id)
    expect(badCheck.error?.code).toBe('23514')

    const blocked = await sb.from('vehicles').delete().eq('id', vehicle!.id)
    expect(blocked.error?.code).toBe('23001')

    // outro usuário não enxerga nada
    const other = await signUp('fabi@exemplo.com')
    const theirs = await other.from('vehicles').select('*')
    expect(theirs.data).toEqual([])
    const theirShifts = await other.rpc('shifts_between', { p_from: '2026-10-01', p_to: '2026-10-31' })
    expect(theirShifts.data).toEqual([])
  })

  it('visitante sem login não acessa tabelas', async () => {
    const { error } = await client().from('vehicles').select('*')
    expect(error?.code).toBe('42501')
  })

  it('recuperação de senha: link por e-mail, sessão de recuperação e nova senha', async () => {
    await signUp('gabi@exemplo.com', 'senha-antiga-1')
    const anon = client()
    const { error } = await anon.auth.resetPasswordForEmail('gabi@exemplo.com', { redirectTo: 'http://localhost:5180/redefinir-senha' })
    expect(error).toBeNull()

    const mail = server.mailbox.find((m) => m.to === 'gabi@exemplo.com')
    expect(mail?.subject).toBe('Redefinir senha')

    const response = await fetch(mail!.link, { redirect: 'manual' })
    expect(response.status).toBe(303)
    const location = new URL(response.headers.get('location')!)
    expect(location.pathname).toBe('/redefinir-senha')
    const hash = new URLSearchParams(location.hash.slice(1))
    expect(hash.get('type')).toBe('recovery')

    const recovering = client()
    const { error: sessionError } = await recovering.auth.setSession({
      access_token: hash.get('access_token')!,
      refresh_token: hash.get('refresh_token')!,
    })
    expect(sessionError).toBeNull()
    expect((await recovering.auth.updateUser({ password: 'senha-nova-2' })).error).toBeNull()

    // o link é de uso único
    const reused = await fetch(mail!.link, { redirect: 'manual' })
    expect(reused.headers.get('location')).toContain('error_code=otp_expired')

    const login = await client().auth.signInWithPassword({ email: 'gabi@exemplo.com', password: 'senha-nova-2' })
    expect(login.error).toBeNull()
  })

  it('login com Google simulado: cria a conta na primeira vez, entra na mesma depois, e cancelar volta com erro', async () => {
    const settings = (await (await fetch(`${server.url}/auth/v1/settings`)).json()) as { external: Record<string, boolean> }
    expect(settings.external.google).toBe(true)

    const back = 'http://localhost:5180/jornadas'
    const page = await fetch(`${server.url}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(back)}`)
    expect(page.status).toBe(200)
    expect(await page.text()).toContain('Google (simulado)')

    const signIn = async (email: string) => {
      const response = await fetch(
        `${server.url}/auth/v1/__fake-google?email=${encodeURIComponent(email)}&name=Ana+Google&redirect_to=${encodeURIComponent(back)}`,
        { redirect: 'manual' },
      )
      expect(response.status).toBe(303)
      const location = new URL(response.headers.get('location')!)
      expect(location.pathname).toBe('/jornadas')
      return new URLSearchParams(location.hash.slice(1))
    }

    const first = await signIn('ana@gmail.com')
    const sb = client()
    const { data } = await sb.auth.setSession({ access_token: first.get('access_token')!, refresh_token: first.get('refresh_token')! })
    expect(data.user?.app_metadata.provider).toBe('google')
    const { data: profile } = await sb.from('profiles').select('full_name').single()
    expect(profile).toEqual({ full_name: 'Ana Google' })

    const second = await signIn('ana@gmail.com')
    const sub = (token: string) => JSON.parse(Buffer.from(token.split('.')[1]!, 'base64url').toString()).sub
    expect(sub(second.get('access_token')!)).toBe(data.user!.id)

    const cancel = await fetch(`${server.url}/auth/v1/__fake-google?cancel=1&redirect_to=${encodeURIComponent(back)}`, { redirect: 'manual' })
    expect(cancel.headers.get('location')).toContain('error=access_denied')

    const other = await fetch(`${server.url}/auth/v1/authorize?provider=github`)
    expect(other.status).toBe(400)
  })

  it('logout revoga o refresh token', async () => {
    const sb = await signUp('hugo@exemplo.com')
    const { data } = await sb.auth.getSession()
    const refreshToken = data.session!.refresh_token
    await sb.auth.signOut()
    const refreshed = await client().auth.refreshSession({ refresh_token: refreshToken })
    expect(refreshed.error).not.toBeNull()
  })
})
