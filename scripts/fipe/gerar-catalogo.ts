/**
 * Gera src/features/vehicles/catalogo-fipe.json: marcas e modelos de carros e motos da Tabela FIPE.
 * Uso: npm run catalogo:fipe (a primeira vez baixa ~210 listas; depois usa o cache em node_modules/.cache/fipe).
 * Rode de novo uma ou duas vezes por ano para pegar os modelos novos.
 */
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { baixarMarcas, baixarModelos, type Tipo } from './baixar.ts'
import { buildCatalog, type VehicleKind } from './normalizar.ts'

const TIPOS: Array<[Tipo, VehicleKind]> = [
  ['carros', 'car'],
  ['motos', 'motorcycle'],
]

const catalog: Record<string, unknown> = {}
for (const [tipo, kind] of TIPOS) {
  const raw = []
  for (const marca of await baixarMarcas(tipo)) raw.push({ brand: marca.nome, versions: await baixarModelos(tipo, marca) })
  const built = buildCatalog(kind, raw)
  catalog[kind] = built
  const models = Object.values(built.brands).reduce((sum, list) => sum + list.length, 0)
  console.log(`${tipo}: ${Object.keys(built.brands).length} marcas, ${models} modelos`)
}

const out = join(import.meta.dirname, '..', '..', 'src', 'features', 'vehicles', 'catalogo-fipe.json')
writeFileSync(out, `${JSON.stringify({ source: 'Tabela FIPE via parallelum.com.br', generatedAt: new Date().toISOString().slice(0, 10), ...catalog })}\n`)
console.log(`Gravado em ${out}`)
