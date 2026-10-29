/* Banco PostgreSQL embutido (PGlite) com as migrations do projeto aplicadas.
   Compartilhado entre os testes do banco e o servidor local. */
import { readdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { PGlite, type Transaction } from '@electric-sql/pglite'
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist'

const MIGRATIONS_DIR = fileURLToPath(new URL('../../supabase/migrations/', import.meta.url))
const BOOTSTRAP_FILE = fileURLToPath(new URL('./bootstrap.sql', import.meta.url))

export type Claims = { sub: string; role: 'authenticated'; email?: string } | { role: 'anon' }

/** Abre (ou cria) o banco e aplica as migrations pendentes. Sem dataDir, fica só na memória. */
export async function openDatabase(dataDir?: string): Promise<PGlite> {
  const db = await PGlite.create({ dataDir, extensions: { btree_gist } })

  const { rows } = await db.query<{ ready: boolean }>(
    `select to_regclass('supabase_migrations.schema_migrations') is not null as ready`,
  )
  if (!rows[0]?.ready) await db.exec(await readFile(BOOTSTRAP_FILE, 'utf8'))

  const applied = new Set(
    (await db.query<{ version: string }>('select version from supabase_migrations.schema_migrations')).rows.map(
      (r) => r.version,
    ),
  )
  const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith('.sql')).sort()
  for (const file of files) {
    const [version = file, ...rest] = file.replace(/\.sql$/, '').split('_')
    if (applied.has(version)) continue
    const sql = await readFile(MIGRATIONS_DIR + file, 'utf8')
    await db.transaction(async (tx) => {
      await tx.exec(sql)
      await tx.query('insert into supabase_migrations.schema_migrations (version, name) values ($1, $2)', [
        version,
        rest.join('_'),
      ])
    })
  }
  return db
}

/** Executa como um usuário do app: mesmo papel e claims que o PostgREST usaria. */
export function withClaims<T>(db: PGlite, claims: Claims, fn: (tx: Transaction) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.exec(`set local role ${claims.role === 'anon' ? 'anon' : 'authenticated'}`)
    await tx.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify(claims)])
    return fn(tx)
  })
}
