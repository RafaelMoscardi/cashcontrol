/**
 * Gera src/features/vehicles/consumo-inmetro.json: consumo oficial na cidade por modelo da FIPE,
 * motor e câmbio, a partir das tabelas do PBE Veicular (Inmetro) de 2018 a 2026.
 * Uso: npm run consumo:inmetro. Precisa do pdftotext (xpdf ou poppler) no PATH;
 * os PDFs ficam em node_modules/.cache/inmetro. Quando sair a tabela do ano novo, acrescente em TABELAS.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fold, matchFamily, parseRow, type BrandHit, type InmetroRow } from './ler-tabela.ts'

const BASE =
  'https://www.gov.br/inmetro/pt-br/assuntos/regulamentacao/avaliacao-da-conformidade/programa-brasileiro-de-etiquetagem/tabelas-de-eficiencia-energetica/veiculos-automotivos-pbe-veicular'
const TABELAS: Record<number, string> = {
  2026: 'mascara-pbev-2026_19_jan-rev01.pdf',
  2025: 'mascara-pbev-2025-mar-11.pdf',
  2024: 'pbe-veicular-2024-1.pdf',
  2023: 'pbe-veicular-2023.pdf',
  2022: 'pbe-veicular-2022.pdf',
  2021: 'veiculos-leves-2021',
  2020: 'veiculos-leves-2020',
  2019: 'veiculos-leves-2019',
  2018: 'veiculos-leves-2018',
}

const ROOT = join(import.meta.dirname, '..', '..')
const CACHE = join(ROOT, 'node_modules', '.cache', 'inmetro')
const catalog = JSON.parse(readFileSync(join(ROOT, 'src', 'features', 'vehicles', 'catalogo-fipe.json'), 'utf8')) as {
  car: { brands: Record<string, string[]> }
}

// Marcas como o Inmetro escreve → como estão no catálogo da FIPE
const ALIASES: Record<string, string> = {
  GM: 'Chevrolet',
  VW: 'Volkswagen',
  CHERY: 'Caoa Chery',
  CAOACHERY: 'Caoa Chery',
  MERCEDES: 'Mercedes-Benz',
  KIAMOTORS: 'Kia',
  GREATWALL: 'GWM',
}

// Modelos que o Inmetro chama de outro jeito
const MODEL_ALIASES: Array<[brand: string, pattern: RegExp, model: string]> = [
  ['Chevrolet', /^(ONIX|PRISMA) JOY\b/i, 'Joy'],
  ['Toyota', /^SW4\b/i, 'Hilux SW4'],
  ['Ford', /^KA(\+| SEDAN)/i, 'Ka+'],
  ['Land Rover', /^(RANGE ROVER )?VELAR\b/i, 'Range Rover Velar'],
  ['Land Rover', /^(RANGE ROVER )?EVOQUE\b/i, 'Range Rover Evoque'],
]
const brandByKey = new Map<string, string>(Object.keys(catalog.car.brands).map((b) => [fold(b), b]))
for (const [key, name] of Object.entries(ALIASES)) brandByKey.set(key, name)

function findBrand(tokens: string[]): BrandHit | null {
  // A marca vem logo depois da categoria (no máximo 4 palavras)
  for (let i = 0; i < Math.min(tokens.length, 6); i++) {
    for (const size of [2, 1]) {
      const name = brandByKey.get(fold(tokens.slice(i, i + size).join(' ')))
      if (name && fold(tokens[i]).length > 1) return { name, start: i, end: i + size }
    }
  }
  return null
}

async function tableText(year: number): Promise<string> {
  mkdirSync(CACHE, { recursive: true })
  const pdf = join(CACHE, `pbev-${year}.pdf`)
  if (!existsSync(pdf)) {
    const res = await fetch(`${BASE}/${TABELAS[year]}/@@download/file`)
    if (!res.ok) throw new Error(`Inmetro ${year}: HTTP ${res.status}`)
    writeFileSync(pdf, Buffer.from(await res.arrayBuffer()))
  }
  try {
    return execFileSync('pdftotext', ['-table', '-enc', 'UTF-8', pdf, '-'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  } catch {
    throw new Error('pdftotext não encontrado. Instale o xpdf ou o poppler e rode de novo.')
  }
}

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return Math.round((sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2) * 10) / 10
}

type Fuel = 'gasoline' | 'ethanol' | 'diesel' | 'kmPerKwh'
const FUELS: Fuel[] = ['gasoline', 'ethanol', 'diesel', 'kmPerKwh']

const groups = new Map<string, { brand: string; model: string; engine: string; gearbox: InmetroRow['gearbox']; byYear: Map<number, InmetroRow[]> }>()
const unmatched = new Map<string, number>()

for (const year of Object.keys(TABELAS).map(Number).sort((a, b) => b - a)) {
  let parsed = 0
  let matched = 0
  for (const line of (await tableText(year)).split(/\r?\n/)) {
    const row = parseRow(line, year, findBrand)
    if (!row) continue
    parsed++
    const families = catalog.car.brands[row.brand] ?? []
    const alias = MODEL_ALIASES.find(([brand, pattern, model]) => brand === row.brand && pattern.test(row.rest) && families.includes(model))
    const model = alias ? alias[2] : matchFamily(row.rest, families)
    if (!model) {
      const key = `${row.brand} ${row.rest.split(' ').slice(0, 2).join(' ')}`
      unmatched.set(key, (unmatched.get(key) ?? 0) + 1)
      continue
    }
    matched++
    const key = [row.brand, model, row.engine, row.gearbox].join('|')
    const group = groups.get(key) ?? { brand: row.brand, model, engine: row.engine, gearbox: row.gearbox, byYear: new Map() }
    group.byYear.set(year, [...(group.byYear.get(year) ?? []), row])
    groups.set(key, group)
  }
  console.log(`${year}: ${parsed} versões lidas, ${matched} ligadas a modelos da FIPE`)
}

// Para cada motor + câmbio de cada modelo: a tabela mais recente em que aparece
const car: Record<string, Record<string, Array<Record<string, unknown>>>> = {}
for (const group of groups.values()) {
  const year = Math.max(...group.byYear.keys())
  const rows = group.byYear.get(year)!
  const entry: Record<string, unknown> = { engine: group.engine, gearbox: group.gearbox, year, versions: rows.length }
  for (const fuel of FUELS) {
    const values = rows.map((r) => r[fuel]).filter((v): v is number => v !== undefined)
    if (values.length) entry[fuel] = median(values)
  }
  ;((car[group.brand] ??= {})[group.model] ??= []).push(entry)
}

type Entry = Record<string, unknown> & { engine: string; gearbox: string | null; year: number; gasoline?: number; ethanol?: number }

/**
 * Algumas tabelas não marcam o turbo (o T-Cross 1.0 de 2020 aparece só como "1.0").
 * O motor "sem turbo" sai quando é de uma tabela mais antiga com consumo parecido,
 * ou da mesma tabela com consumo igual. O HB20 1.0 e o 1.0 Turbo continuam separados.
 */
function dropUnmarkedTurbo(list: Entry[]): Entry[] {
  return list.filter((plain) => {
    if (plain.engine.includes('Turbo') || plain.engine === 'Elétrico') return true
    const turbo = list.find((e) => e.gearbox === plain.gearbox && e.engine === plain.engine.replace(/^(\d\.\d)/, '$1 Turbo'))
    if (!turbo) return true
    const diff = Math.max(Math.abs((plain.gasoline ?? 0) - (turbo.gasoline ?? 0)), Math.abs((plain.ethanol ?? 0) - (turbo.ethanol ?? 0)))
    return !((plain.year < turbo.year && diff <= 0.5) || (plain.year === turbo.year && diff <= 0.2))
  })
}

const ENGINE_ORDER = (engine: string) => (engine === 'Elétrico' ? 99 : Number.parseFloat(engine))
let variants = 0
for (const models of Object.values(car)) {
  for (const [model, list] of Object.entries(models)) {
    // Até 6 variações por modelo, as mais vendidas em versões; na tela, do menor motor ao maior
    models[model] = dropUnmarkedTurbo(list as Entry[])
      .sort((a, b) => (b.versions as number) - (a.versions as number))
      .slice(0, 6)
      .sort((a, b) => ENGINE_ORDER(a.engine as string) - ENGINE_ORDER(b.engine as string) || String(a.gearbox).localeCompare(String(b.gearbox)))
    variants += models[model].length
  }
}

const out = join(ROOT, 'src', 'features', 'vehicles', 'consumo-inmetro.json')
writeFileSync(out, `${JSON.stringify({ source: 'Inmetro, PBE Veicular', car })}\n`)
const models = Object.values(car).reduce((sum, m) => sum + Object.keys(m).length, 0)
console.log(`${Object.keys(car).length} marcas, ${models} modelos, ${variants} variações de motor e câmbio → ${out}`)
console.log(
  'Sem modelo na FIPE (mais frequentes):',
  [...unmatched.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 25)
    .map(([k, n]) => `${k} (${n})`)
    .join('; '),
)
