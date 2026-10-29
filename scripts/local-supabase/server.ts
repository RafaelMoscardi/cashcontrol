/* Supabase local para desenvolvimento e testes, sem Docker e sem conta.
 *
 * Roda as migrations de supabase/migrations num PostgreSQL embutido (PGlite) e
 * expõe o subconjunto da API do Supabase que o app usa:
 *   /auth/v1  cadastro, login, refresh, usuário, logout, recuperação de senha
 *   /rest/v1  tabelas (select, insert, update, delete com filtros simples) e RPC
 * Cada requisição roda com o mesmo papel e claims que o PostgREST usaria, então
 * o RLS das migrations vale aqui do mesmo jeito.
 *
 * E-mails (recuperação de senha, confirmação) não são enviados: aparecem no
 * terminal e em http://127.0.0.1:54321/__dev/mailbox.
 *
 * Uso: npm run local-supabase   (ou npm run dev:local, que sobe o Vite junto)
 */
import { createHmac, randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { fileURLToPath } from 'node:url'
import type { PGlite, Transaction } from '@electric-sql/pglite'
import { openDatabase, withClaims, type Claims } from './db.ts'

const PORT = Number(process.env.LOCAL_SUPABASE_PORT ?? 54321)
const BASE_URL = `http://127.0.0.1:${PORT}`
// Endereço real depois do listen (nos testes a porta é aleatória)
let publicUrl = BASE_URL
const DATA_DIR =
  process.env.LOCAL_SUPABASE_DATA ?? fileURLToPath(new URL('../../.local-supabase/data', import.meta.url))
const JWT_SECRET = process.env.LOCAL_SUPABASE_JWT_SECRET ?? 'cashcontrol-local-dev-secret-not-for-production'
const CONFIRM_EMAIL = process.env.LOCAL_SUPABASE_CONFIRM_EMAIL === '1'
const ACCESS_TTL_SECONDS = 3600
const MIN_PASSWORD = 6

type Json = null | boolean | number | string | Json[] | { [key: string]: Json }
type HttpError = { status: number; body: Record<string, Json> }

interface UserRow {
  id: string
  email: string
  encrypted_password: string | null
  email_confirmed_at: string | null
  last_sign_in_at: string | null
  raw_app_meta_data: Record<string, Json>
  raw_user_meta_data: Record<string, Json>
  created_at: string
  updated_at: string
}

const mailbox: Array<{ to: string; subject: string; link: string; at: string }> = []

/* ---------------------------------------------------------------- utilidades */

const httpError = (status: number, body: Record<string, Json>): HttpError => ({ status, body })
const authError = (status: number, errorCode: string, msg: string) => httpError(status, { code: status, error_code: errorCode, msg })

const isHttpError = (e: unknown): e is HttpError =>
  typeof e === 'object' && e !== null && 'status' in e && 'body' in e

const base64url = (input: Buffer | string) => Buffer.from(input).toString('base64url')

function signJwt(payload: Record<string, Json>): string {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = base64url(JSON.stringify(payload))
  const signature = createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url')
  return `${header}.${body}.${signature}`
}

function verifyJwt(token: string): Record<string, Json> | null {
  const [header, body, signature] = token.split('.')
  if (!header || !body || !signature) return null
  const expected = createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url')
  const a = Buffer.from(signature)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as Record<string, Json>
  if (typeof payload.exp !== 'number' || payload.exp < Date.now() / 1000) return null
  return payload
}

function hashPassword(password: string): string {
  const salt = randomBytes(16)
  return `scrypt$${salt.toString('base64')}$${scryptSync(password, salt, 32).toString('base64')}`
}

function checkPassword(password: string, stored: string | null): boolean {
  if (!stored) return false
  const [, salt, hash] = stored.split('$')
  if (!salt || !hash) return false
  const expected = Buffer.from(hash, 'base64')
  const actual = scryptSync(password, Buffer.from(salt, 'base64'), expected.length)
  return timingSafeEqual(actual, expected)
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(chunk as Buffer)
  const raw = Buffer.concat(chunks).toString('utf8')
  if (!raw) return undefined
  try {
    return JSON.parse(raw)
  } catch {
    throw httpError(400, { code: 'PGRST102', message: 'Corpo da requisição não é JSON válido', details: null, hint: null })
  }
}

function send(res: ServerResponse, status: number, body?: unknown, headers: Record<string, string> = {}) {
  res.writeHead(status, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Expose-Headers': 'Content-Range, Location',
    ...(body === undefined ? {} : { 'Content-Type': 'application/json; charset=utf-8' }),
    ...headers,
  })
  // Sempre JSON: um RPC que devolve uuid responde "…" com aspas, como o PostgREST
  res.end(body === undefined ? undefined : JSON.stringify(body))
}

// PGlite é uma sessão só: uma requisição de banco por vez
let queue: Promise<unknown> = Promise.resolve()
function serialized<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn)
  queue = run.catch(() => undefined)
  return run
}

/* --------------------------------------------------------------------- auth */

function userJson(u: UserRow): Record<string, Json> {
  return {
    id: u.id,
    aud: 'authenticated',
    role: 'authenticated',
    email: u.email,
    email_confirmed_at: u.email_confirmed_at,
    phone: '',
    confirmed_at: u.email_confirmed_at,
    last_sign_in_at: u.last_sign_in_at,
    app_metadata: u.raw_app_meta_data,
    user_metadata: u.raw_user_meta_data,
    identities: [],
    created_at: u.created_at,
    updated_at: u.updated_at,
    is_anonymous: false,
  }
}

async function createSession(db: PGlite | Transaction, user: UserRow): Promise<Record<string, Json>> {
  const now = Math.floor(Date.now() / 1000)
  const sessionId = randomUUID()
  const refreshToken = randomBytes(24).toString('base64url')
  await db.query('insert into auth.local_refresh_tokens (token, user_id, session_id) values ($1, $2, $3)', [
    refreshToken,
    user.id,
    sessionId,
  ])
  const accessToken = signJwt({
    aud: 'authenticated',
    exp: now + ACCESS_TTL_SECONDS,
    iat: now,
    iss: `${publicUrl}/auth/v1`,
    sub: user.id,
    email: user.email,
    phone: '',
    app_metadata: user.raw_app_meta_data,
    user_metadata: user.raw_user_meta_data,
    role: 'authenticated',
    aal: 'aal1',
    amr: [{ method: 'password', timestamp: now }],
    session_id: sessionId,
    is_anonymous: false,
  })
  return {
    access_token: accessToken,
    token_type: 'bearer',
    expires_in: ACCESS_TTL_SECONDS,
    expires_at: now + ACCESS_TTL_SECONDS,
    refresh_token: refreshToken,
    user: userJson(user),
  }
}

const findUserByEmail = async (db: PGlite | Transaction, email: string) =>
  (await db.query<UserRow>('select * from auth.users where lower(email) = lower($1)', [email])).rows[0]

const findUserById = async (db: PGlite | Transaction, id: string) =>
  (await db.query<UserRow>('select * from auth.users where id = $1', [id])).rows[0]

function requireUserClaims(req: IncomingMessage): Record<string, Json> {
  const token = /^Bearer (.+)$/i.exec(req.headers.authorization ?? '')?.[1]
  const claims = token ? verifyJwt(token) : null
  if (!claims || claims.role !== 'authenticated') {
    throw authError(401, 'bad_jwt', 'invalid JWT: unable to parse or verify signature, token is expired')
  }
  return claims
}

async function sendEmailLink(db: PGlite | Transaction, user: UserRow, kind: 'signup' | 'recovery', redirectTo: string | null) {
  const token = randomBytes(20).toString('hex')
  await db.query('insert into auth.local_email_links (token, user_id, kind, email, redirect_to) values ($1, $2, $3, $4, $5)', [
    token,
    user.id,
    kind,
    user.email,
    redirectTo,
  ])
  const link = `${publicUrl}/auth/v1/verify?token=${token}&type=${kind}${redirectTo ? `&redirect_to=${encodeURIComponent(redirectTo)}` : ''}`
  const subject = kind === 'recovery' ? 'Redefinir senha' : 'Confirme seu e-mail'
  mailbox.unshift({ to: user.email, subject, link, at: new Date().toISOString() })
  mailbox.length = Math.min(mailbox.length, 50)
  console.log(`\n✉  ${subject} → ${user.email}\n   ${link}\n`)
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

async function handleAuth(req: IncomingMessage, res: ServerResponse, url: URL, db: PGlite) {
  const path = url.pathname.replace(/^\/auth\/v1/, '')
  const redirectTo = url.searchParams.get('redirect_to')

  if (req.method === 'GET' && path === '/settings') {
    return send(res, 200, { external: { email: true, google: true }, disable_signup: false, mailer_autoconfirm: !CONFIRM_EMAIL })
  }

  // Login com Google simulado: tela própria em vez do Google, mesmo retorno (tokens no hash)
  if (req.method === 'GET' && path === '/authorize') {
    if (url.searchParams.get('provider') !== 'google') {
      throw authError(400, 'validation_failed', 'Unsupported provider: provider is not enabled')
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    return res.end(fakeGooglePage(redirectTo ?? 'http://localhost:5180/'))
  }

  if (req.method === 'GET' && path === '/__fake-google') {
    const target = redirectTo ?? 'http://localhost:5180/'
    if (url.searchParams.get('cancel')) {
      const hash = new URLSearchParams({ error: 'access_denied', error_code: 'access_denied', error_description: 'The user denied access' })
      return send(res, 303, undefined, { Location: `${target}#${hash}` })
    }
    const email = (url.searchParams.get('email') ?? '').trim().toLowerCase()
    const name = (url.searchParams.get('name') ?? '').trim() || email.split('@')[0] || 'Google'
    if (!EMAIL_RE.test(email)) throw authError(400, 'validation_failed', 'Unable to validate email address: invalid format')
    const session = await serialized(() =>
      db.transaction(async (tx) => {
        let user = await findUserByEmail(tx, email)
        if (user) {
          // Mesmo e-mail de uma conta com senha: o Supabase liga as identidades
          const { rows } = await tx.query<UserRow>(
            `update auth.users set last_sign_in_at = now(),
               raw_app_meta_data = jsonb_set(raw_app_meta_data, '{providers}',
                 (select to_jsonb(array(select distinct p from jsonb_array_elements_text(coalesce(raw_app_meta_data -> 'providers', '[]')) p union select 'google'))))
             where id = $1 returning *`,
            [user.id],
          )
          user = rows[0]!
        } else {
          const { rows } = await tx.query<UserRow>(
            `insert into auth.users (email, email_confirmed_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data)
             values ($1, now(), now(), $2::jsonb, $3::jsonb) returning *`,
            [
              email,
              JSON.stringify({ provider: 'google', providers: ['google'] }),
              JSON.stringify({ full_name: name, name, email, email_verified: true, iss: 'https://accounts.google.com' }),
            ],
          )
          user = rows[0]!
        }
        return createSession(tx, user)
      }),
    )
    const hash = new URLSearchParams({
      access_token: String(session.access_token),
      expires_at: String(session.expires_at),
      expires_in: String(session.expires_in),
      provider_token: 'local-fake-google-token',
      refresh_token: String(session.refresh_token),
      token_type: 'bearer',
    })
    return send(res, 303, undefined, { Location: `${target}#${hash}` })
  }

  if (req.method === 'POST' && path === '/signup') {
    const body = ((await readBody(req)) ?? {}) as { email?: string; password?: string; data?: Record<string, Json> }
    const email = (body.email ?? '').trim().toLowerCase()
    if (!EMAIL_RE.test(email)) throw authError(400, 'validation_failed', 'Unable to validate email address: invalid format')
    if (!body.password || body.password.length < MIN_PASSWORD) {
      throw authError(422, 'weak_password', `Password should be at least ${MIN_PASSWORD} characters.`)
    }
    const result = await serialized(() =>
      db.transaction(async (tx) => {
        if (await findUserByEmail(tx, email)) throw authError(422, 'user_already_exists', 'User already registered')
        const { rows } = await tx.query<UserRow>(
          `insert into auth.users (email, encrypted_password, raw_user_meta_data, email_confirmed_at, last_sign_in_at)
           values ($1, $2, $3::jsonb, $4, $4) returning *`,
          [email, hashPassword(body.password!), JSON.stringify(body.data ?? {}), CONFIRM_EMAIL ? null : new Date().toISOString()],
        )
        const user = rows[0]!
        if (CONFIRM_EMAIL) {
          await sendEmailLink(tx, user, 'signup', redirectTo)
          return { ...userJson(user), confirmation_sent_at: new Date().toISOString() }
        }
        return createSession(tx, user)
      }),
    )
    return send(res, 200, result)
  }

  if (req.method === 'POST' && path === '/token') {
    const grant = url.searchParams.get('grant_type')
    const body = ((await readBody(req)) ?? {}) as { email?: string; password?: string; refresh_token?: string }
    if (grant === 'password') {
      const session = await serialized(async () => {
        const user = await findUserByEmail(db, (body.email ?? '').trim())
        if (!user || !checkPassword(body.password ?? '', user.encrypted_password)) {
          throw authError(400, 'invalid_credentials', 'Invalid login credentials')
        }
        if (!user.email_confirmed_at) throw authError(400, 'email_not_confirmed', 'Email not confirmed')
        await db.query('update auth.users set last_sign_in_at = now() where id = $1', [user.id])
        return createSession(db, user)
      })
      return send(res, 200, session)
    }
    if (grant === 'refresh_token') {
      const session = await serialized(async () => {
        const { rows } = await db.query<{ user_id: string }>(
          'update auth.local_refresh_tokens set revoked = true where token = $1 and not revoked returning user_id',
          [body.refresh_token ?? ''],
        )
        const user = rows[0] ? await findUserById(db, rows[0].user_id) : undefined
        if (!user) throw authError(400, 'refresh_token_not_found', 'Invalid Refresh Token: Refresh Token Not Found')
        return createSession(db, user)
      })
      return send(res, 200, session)
    }
    throw authError(400, 'validation_failed', `Unsupported grant_type: ${grant}`)
  }

  if (path === '/user' && (req.method === 'GET' || req.method === 'PUT')) {
    const claims = requireUserClaims(req)
    const userId = String(claims.sub)
    if (req.method === 'GET') {
      const user = await serialized(() => findUserById(db, userId))
      if (!user) throw authError(404, 'user_not_found', 'User from sub claim in JWT does not exist')
      return send(res, 200, userJson(user))
    }
    const body = ((await readBody(req)) ?? {}) as { password?: string; data?: Record<string, Json> }
    if (body.password !== undefined && body.password.length < MIN_PASSWORD) {
      throw authError(422, 'weak_password', `Password should be at least ${MIN_PASSWORD} characters.`)
    }
    const user = await serialized(async () => {
      const current = await findUserById(db, userId)
      if (!current) throw authError(404, 'user_not_found', 'User not found')
      if (body.password !== undefined && checkPassword(body.password, current.encrypted_password)) {
        throw authError(422, 'same_password', 'New password should be different from the old password.')
      }
      const { rows } = await db.query<UserRow>(
        `update auth.users set
           encrypted_password = coalesce($2, encrypted_password),
           raw_user_meta_data = raw_user_meta_data || coalesce($3::jsonb, '{}'::jsonb),
           updated_at = now()
         where id = $1 returning *`,
        [userId, body.password ? hashPassword(body.password) : null, body.data ? JSON.stringify(body.data) : null],
      )
      return rows[0]!
    })
    return send(res, 200, userJson(user))
  }

  if (req.method === 'POST' && path === '/logout') {
    const claims = requireUserClaims(req)
    const scope = url.searchParams.get('scope') ?? 'global'
    await serialized(() =>
      scope === 'global'
        ? db.query('update auth.local_refresh_tokens set revoked = true where user_id = $1', [claims.sub])
        : db.query('update auth.local_refresh_tokens set revoked = true where session_id = $1', [claims.session_id]),
    )
    return send(res, 204)
  }

  if (req.method === 'POST' && path === '/recover') {
    const body = ((await readBody(req)) ?? {}) as { email?: string }
    await serialized(async () => {
      const user = await findUserByEmail(db, (body.email ?? '').trim())
      // Igual ao Supabase: responde 200 mesmo sem conta, para não revelar quais e-mails existem
      if (user) await sendEmailLink(db, user, 'recovery', redirectTo)
    })
    return send(res, 200, {})
  }

  if (req.method === 'GET' && path === '/verify') {
    const token = url.searchParams.get('token') ?? ''
    const type = url.searchParams.get('type') ?? ''
    const target = redirectTo ?? 'http://localhost:5180/'
    const outcome = await serialized(() =>
      db.transaction(async (tx) => {
        const { rows } = await tx.query<{ user_id: string; created_at: string }>(
          `update auth.local_email_links set used_at = now()
           where token = $1 and kind = $2 and used_at is null and created_at > now() - interval '1 hour'
           returning user_id, created_at`,
          [token, type],
        )
        if (!rows[0]) return null
        if (type === 'signup') await tx.query('update auth.users set email_confirmed_at = now() where id = $1', [rows[0].user_id])
        const user = await findUserById(tx, rows[0].user_id)
        return user ? createSession(tx, user) : null
      }),
    )
    if (!outcome) {
      const hash = new URLSearchParams({
        error: 'access_denied',
        error_code: 'otp_expired',
        error_description: 'Email link is invalid or has expired',
      })
      return send(res, 303, undefined, { Location: `${target}#${hash}` })
    }
    const hash = new URLSearchParams({
      access_token: String(outcome.access_token),
      expires_at: String(outcome.expires_at),
      expires_in: String(outcome.expires_in),
      refresh_token: String(outcome.refresh_token),
      token_type: 'bearer',
      type,
    })
    return send(res, 303, undefined, { Location: `${target}#${hash}` })
  }

  throw authError(404, 'not_found', `Rota de auth não implementada no servidor local: ${req.method} ${path}`)
}

/* --------------------------------------------------------------------- rest */

const IDENT = /^[a-z_][a-z0-9_]*$/

function ident(name: string): string {
  if (!IDENT.test(name)) {
    throw httpError(400, { code: 'PGRST100', message: `Identificador não suportado no servidor local: ${name}`, details: null, hint: null })
  }
  return name
}

function parseSelect(select: string | null): string {
  if (!select || select === '*') return '*'
  if (/[()!:]/.test(select)) {
    throw httpError(400, {
      code: 'PGRST100',
      message: 'O servidor local não implementa recursos aninhados nem aliases no select; use uma função RPC.',
      details: select,
      hint: null,
    })
  }
  return select.split(',').map((c) => ident(c.trim())).join(', ')
}

function parseOrder(order: string | null): string {
  if (!order) return ''
  const parts = order.split(',').map((term) => {
    const [col = '', ...mods] = term.split('.')
    const dir = mods.includes('desc') ? 'desc' : 'asc'
    const nulls = mods.includes('nullsfirst') ? ' nulls first' : mods.includes('nullslast') ? ' nulls last' : ''
    return `t.${ident(col)} ${dir}${nulls}`
  })
  return `order by ${parts.join(', ')}`
}

const RESERVED = new Set(['select', 'order', 'limit', 'offset', 'columns', 'on_conflict'])
const OPERATORS: Record<string, string> = { eq: '=', neq: '<>', gt: '>', gte: '>=', lt: '<', lte: '<=', like: 'like', ilike: 'ilike' }

function parseFilters(params: URLSearchParams, values: unknown[]): string {
  const clauses: string[] = []
  for (const [key, raw] of params) {
    if (RESERVED.has(key)) continue
    const col = `t.${ident(key)}`
    const dot = raw.indexOf('.')
    const op = raw.slice(0, dot)
    const value = raw.slice(dot + 1)
    if (op in OPERATORS) {
      values.push(op === 'like' || op === 'ilike' ? value.replaceAll('*', '%') : value)
      clauses.push(`${col} ${OPERATORS[op]} $${values.length}`)
    } else if (op === 'is') {
      if (!['null', 'true', 'false'].includes(value)) throw httpError(400, { code: 'PGRST100', message: `is.${value} inválido`, details: null, hint: null })
      clauses.push(`${col} is ${value}`)
    } else if (op === 'in') {
      const items = value.replace(/^\(|\)$/g, '').split(',').map((v) => v.trim().replace(/^"|"$/g, ''))
      const placeholders = items.map((item) => {
        values.push(item)
        return `$${values.length}`
      })
      clauses.push(placeholders.length ? `${col} in (${placeholders.join(', ')})` : 'false')
    } else {
      throw httpError(400, { code: 'PGRST100', message: `Operador não suportado no servidor local: ${op}`, details: raw, hint: null })
    }
  }
  return clauses.length ? `where ${clauses.join(' and ')}` : ''
}

const STATUS_BY_SQLSTATE: Record<string, number> = {
  '23503': 409,
  '23505': 409,
  '23001': 409,
  '42501': 403,
  '42883': 404,
  '42P01': 404,
  P0002: 404,
}

function dbError(e: unknown, role: Claims['role']): HttpError {
  const err = e as { code?: string; message?: string; detail?: string; hint?: string }
  const code = err.code ?? 'XX000'
  let status = STATUS_BY_SQLSTATE[code] ?? (code.startsWith('22') || code.startsWith('23') || code === 'P0001' ? 400 : 500)
  if (code === '42501' && role === 'anon') status = 401
  return httpError(status, { code, message: err.message ?? 'Erro no banco', details: err.detail ?? null, hint: err.hint ?? null })
}

function claimsFrom(req: IncomingMessage): Claims {
  const token = /^Bearer (.+)$/i.exec(req.headers.authorization ?? '')?.[1]
  if (!token || !token.includes('.')) return { role: 'anon' }
  const payload = verifyJwt(token)
  if (!payload) throw httpError(401, { code: 'PGRST303', message: 'JWT expired', details: null, hint: null })
  if (payload.role !== 'authenticated') return { role: 'anon' }
  return { role: 'authenticated', sub: String(payload.sub), email: String(payload.email ?? '') }
}

async function handleRest(req: IncomingMessage, res: ServerResponse, url: URL, db: PGlite) {
  const claims = claimsFrom(req)
  const segments = url.pathname.replace(/^\/rest\/v1\/?/, '').split('/').filter(Boolean)
  const prefer = String(req.headers.prefer ?? '')
  const wantsObject = String(req.headers.accept ?? '').includes('application/vnd.pgrst.object+json')
  const returnRepresentation = prefer.includes('return=representation')
  const wantsCount = prefer.includes('count=exact')

  const run = (sql: string, values: unknown[], countSql?: string) =>
    serialized(() =>
      withClaims(db, claims, async (tx) => {
        const { rows } = await tx.query<{ body: Json }>(sql, values)
        const count = countSql ? ((await tx.query<{ n: number }>(countSql, values)).rows[0]?.n ?? 0) : null
        return { body: rows[0]?.body ?? null, count }
      }),
    ).catch((e: unknown) => {
      throw isHttpError(e) ? e : dbError(e, claims.role)
    })

  const respondRows = (rows: Json[], status: number, count: number | null) => {
    const range = rows.length ? `0-${rows.length - 1}/${count ?? '*'}` : `*/${count ?? '*'}`
    if (wantsObject) {
      if (rows.length !== 1) {
        return send(res, 406, {
          code: 'PGRST116',
          message: 'Cannot coerce the result to a single JSON object',
          details: `The result contains ${rows.length} rows`,
          hint: null,
        })
      }
      return send(res, status, rows[0], { 'Content-Range': range })
    }
    return send(res, status, rows, { 'Content-Range': range })
  }

  // RPC -----------------------------------------------------------------
  if (segments[0] === 'rpc' && segments[1]) {
    const fn = ident(segments[1])
    const args = (req.method === 'GET' ? Object.fromEntries(url.searchParams) : ((await readBody(req)) ?? {})) as Record<string, unknown>
    const names = Object.keys(args).map(ident)
    const values = names.map((name) => {
      const v = args[name]
      return v !== null && typeof v === 'object' ? JSON.stringify(v) : v
    })
    const call = `public.${fn}(${names.map((n, i) => `${n} => $${i + 1}`).join(', ')})`
    const { body } = await run(`select to_json(${call}) as body`, values)
    return send(res, 200, body)
  }

  // Tabelas -----------------------------------------------------------------
  const table = ident(segments[0] ?? '')
  const params = url.searchParams
  const select = parseSelect(params.get('select'))
  const values: unknown[] = []

  if (req.method === 'GET' || req.method === 'HEAD') {
    const where = parseFilters(params, values)
    const limit = params.get('limit') ? `limit ${Number.parseInt(params.get('limit')!, 10)}` : ''
    const offset = params.get('offset') ? `offset ${Number.parseInt(params.get('offset')!, 10)}` : ''
    const sql = `select coalesce(json_agg(t), '[]'::json) as body from (select ${select === '*' ? 't.*' : select} from public.${table} as t ${where} ${parseOrder(params.get('order'))} ${limit} ${offset}) t`
    const countSql = wantsCount ? `select count(*)::int as n from public.${table} as t ${where}` : undefined
    const { body, count } = await run(sql, values, countSql)
    return respondRows((body as Json[]) ?? [], 200, count)
  }

  if (req.method === 'POST') {
    const payload = await readBody(req)
    const rows = (Array.isArray(payload) ? payload : [payload]) as Record<string, unknown>[]
    const columns = [...new Set(rows.flatMap((r) => Object.keys(r ?? {})))].map(ident)
    values.push(JSON.stringify(rows))
    const sql = `with ins as (
        insert into public.${table} (${columns.join(', ')})
        select ${columns.join(', ')} from json_populate_recordset(null::public.${table}, $1::json)
        returning *
      ) select coalesce(json_agg(t), '[]'::json) as body from (select ${select === '*' ? '*' : select} from ins) t`
    const { body } = await run(sql, values)
    if (!returnRepresentation) return send(res, 201)
    return respondRows((body as Json[]) ?? [], 201, null)
  }

  if (req.method === 'PATCH') {
    const payload = ((await readBody(req)) ?? {}) as Record<string, unknown>
    const columns = Object.keys(payload).map(ident)
    if (!columns.length) throw httpError(400, { code: 'PGRST102', message: 'Nada para atualizar', details: null, hint: null })
    values.push(JSON.stringify(payload))
    const where = parseFilters(params, values)
    const sql = `with upd as (
        update public.${table} as t set ${columns.map((c) => `${c} = r.${c}`).join(', ')}
        from json_populate_record(null::public.${table}, $1::json) as r
        ${where}
        returning t.*
      ) select coalesce(json_agg(u), '[]'::json) as body from (select ${select === '*' ? '*' : select} from upd) u`
    const { body } = await run(sql, values)
    if (!returnRepresentation) return send(res, 204)
    return respondRows((body as Json[]) ?? [], 200, null)
  }

  if (req.method === 'DELETE') {
    const where = parseFilters(params, values)
    const sql = `with del as (delete from public.${table} as t ${where} returning t.*)
      select coalesce(json_agg(d), '[]'::json) as body from (select ${select === '*' ? '*' : select} from del) d`
    const { body } = await run(sql, values)
    if (!returnRepresentation) return send(res, 204)
    return respondRows((body as Json[]) ?? [], 200, null)
  }

  throw httpError(405, { code: 'PGRST117', message: `Método não suportado: ${req.method}`, details: null, hint: null })
}

/* ---------------------------------------------------- páginas de desenvolvimento */

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

function fakeGooglePage(redirectTo: string): string {
  return `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Google (simulado)</title>
<style>body{font:15px/1.5 system-ui,sans-serif;background:#0b0a10;color:#f4f3f8;margin:0;display:grid;place-items:center;min-height:100vh}form{background:#14131b;border:1px solid #ffffff14;border-radius:20px;padding:28px;width:min(360px,90vw)}h1{font-size:20px;margin:0 0 4px}p{color:#a09db0;margin:0 0 18px;font-size:13px}label{display:block;font-size:13px;margin:12px 0 6px}input{width:100%;box-sizing:border-box;height:44px;border-radius:12px;border:1px solid #ffffff1f;background:#1d1c27;color:inherit;padding:0 12px;font-size:16px}.row{display:flex;gap:8px;margin-top:20px}button{flex:1;height:44px;border-radius:12px;border:0;font-size:15px;cursor:pointer}.ok{background:#8b5cf6;color:#fff}.no{background:#24212f;color:#f4f3f8}</style>
<form action="/auth/v1/__fake-google" method="get">
<h1>Google (simulado)</h1><p>Servidor local de desenvolvimento: nenhuma conta Google de verdade é usada.</p>
<input type="hidden" name="redirect_to" value="${esc(redirectTo)}">
<label for="name">Nome</label><input id="name" name="name" value="Motorista Google">
<label for="email">E-mail</label><input id="email" name="email" type="email" value="google@cashcontrol.local">
<div class="row"><button class="no" name="cancel" value="1">Cancelar</button><button class="ok" type="submit">Continuar</button></div>
</form></html>`
}

function mailboxPage(): string {
  const items = mailbox
    .map(
      (m) => `<li><b>${esc(m.subject)}</b> → ${esc(m.to)} <small>${esc(new Date(m.at).toLocaleString('pt-BR'))}</small><br><a href="${esc(m.link)}">${esc(m.link)}</a></li>`,
    )
    .join('')
  return `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Caixa de e-mails local</title>
<style>body{font:15px/1.5 system-ui,sans-serif;background:#0b0a10;color:#f4f3f8;margin:0;padding:24px}a{color:#a78bfa;word-break:break-all}li{margin:0 0 16px;padding:12px 14px;background:#14131b;border-radius:12px;list-style:none}ul{padding:0}small{color:#a09db0}</style>
<h1>Caixa de e-mails (servidor local)</h1><p>E-mails que o Supabase enviaria. Os links valem por 1 hora e uma vez só.</p><ul>${items || '<li>Nenhum e-mail ainda.</li>'}</ul></html>`
}

/* -------------------------------------------------------------------- server */

export interface LocalSupabase {
  url: string
  mailbox: typeof mailbox
  close: () => Promise<void>
}

/** Sobe o servidor. Sem dataDir o banco fica só na memória (testes). */
export async function startLocalSupabase(options: { port?: number; dataDir?: string; quiet?: boolean } = {}): Promise<LocalSupabase> {
  if (options.dataDir) mkdirSync(options.dataDir, { recursive: true })
  const db = await openDatabase(options.dataDir)
  const log = options.quiet ? () => undefined : console.log

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', BASE_URL)
    try {
      if (req.method === 'OPTIONS') {
        return send(res, 204, undefined, {
          'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': String(req.headers['access-control-request-headers'] ?? '*'),
          'Access-Control-Max-Age': '86400',
        })
      }
      if (url.pathname.startsWith('/auth/v1')) return await handleAuth(req, res, url, db)
      if (url.pathname.startsWith('/rest/v1')) return await handleRest(req, res, url, db)
      if (url.pathname === '/__dev/mailbox') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        return res.end(mailboxPage())
      }
      if (url.pathname === '/__dev/mailbox.json') return send(res, 200, mailbox)
      if (url.pathname === '/' || url.pathname === '/health') return send(res, 200, { ok: true, service: 'cashcontrol-local-supabase' })
      return send(res, 404, { message: 'Não encontrado' })
    } catch (e) {
      if (isHttpError(e)) return send(res, e.status, e.body)
      console.error(e)
      return send(res, 500, { code: 'XX000', message: e instanceof Error ? e.message : String(e), details: null, hint: null })
    }
  })

  await new Promise<void>((resolve) => server.listen(options.port ?? PORT, '127.0.0.1', resolve))
  const address = server.address()
  const url = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : PORT}`
  publicUrl = url
  log(`Supabase local em ${url} (dados em ${options.dataDir ?? 'memória'})`)
  log(`Caixa de e-mails: ${url}/__dev/mailbox${CONFIRM_EMAIL ? '  · confirmação de e-mail ligada' : ''}`)

  return {
    url,
    mailbox,
    close: async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()))
      await db.close()
    },
  }
}

// Executado direto (npm run local-supabase): sobe com dados persistidos em .local-supabase/
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const instance = await startLocalSupabase({ dataDir: DATA_DIR })
  const shutdown = async () => {
    await instance.close()
    process.exit(0)
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}
