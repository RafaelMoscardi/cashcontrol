/**
 * Lê as linhas das tabelas do PBE Veicular (Inmetro), extraídas do PDF com `pdftotext -table`.
 * Cada ano tem colunas um pouco diferentes; aqui só entra o que dá para ler com segurança:
 * consumo na cidade por combustível (km/l) e, nos elétricos, km/kWh a partir do MJ/km.
 */

export type Gearbox = 'manual' | 'automático'

export interface InmetroRow {
  year: number
  brand: string
  /** Texto depois da marca: modelo, versão e motor */
  rest: string
  /** "1.0", "1.0 Turbo", "1.8 Híbrido" ou "Elétrico" */
  engine: string
  gearbox: Gearbox | null
  gasoline?: number
  ethanol?: number
  diesel?: number
  kmPerKwh?: number
}

export interface BrandHit {
  name: string
  start: number
  end: number
}

const TRANSMISSION = /^(?:[MA]-?\d{1,2}|CVT(?:-\d{1,2})?|AT|MT|DCT(?:-\d{1,2})?|AMT|MTA|N\.A\.)$/i
const DISPLACEMENT = /^(\d\.\d)(L|T)?(?:-\d{1,2}V)?$/i
// "200TSI", "TCe", "T-GDI": o turbo às vezes só aparece no nome da versão
const TURBO = /(TURBO|TSI|\bTB\b|THP|T-?GDI|TFSI|\bTCE\b|T200|T270|T-?JET|ECOBOOST)/i
const NUMERICISH = /^(?:[\d.,]+|ND|\\|-)$/
const CONSUMPTION = /^\d{1,2}[.,]\d{1,2}$/
const ENERGY = /^[0-4][.,]\d{2}$/

const num = (token: string) => Number(token.replace(',', '.'))
const round1 = (value: number) => Math.round(value * 10) / 10

const inRange = (value: number | undefined, min: number, max: number) => value !== undefined && value >= min && value <= max

/** Uma linha da tabela → dados de consumo, ou null se não for linha de veículo ou não passar na conferência. */
export function parseRow(line: string, year: number, findBrand: (tokens: string[]) => BrandHit | null): InmetroRow | null {
  const clean = line.replace(/­/g, '-').replace(/\s+/g, ' ').trim()
  // Híbridos plug-in têm colunas próprias (modo elétrico + combustão): ficam de fora
  if (/plug|PHEV|VEHP/i.test(clean)) return null
  const tokens = clean.split(' ')
  const brand = findBrand(tokens)
  if (!brand) return null

  // O câmbio vem logo antes do ar-condicionado (S/N); "AT" no nome da versão não conta
  const t = tokens.findIndex((token, i) => i >= brand.end && TRANSMISSION.test(token) && /^[SN]$/.test(tokens[i + 1] ?? ''))
  if (t < 0) return null
  const segment = tokens.slice(brand.end, t)

  // Combustível: F, G, D ou E logo antes dos números de emissões
  let f = -1
  for (let i = t + 1; i < tokens.length - 1; i++) {
    if (/^[FGDE]$/.test(tokens[i]) && NUMERICISH.test(tokens[i + 1])) {
      f = i
      break
    }
  }
  if (f < 0) return null
  const fuelCode = tokens[f]

  const tail = tokens.slice(f + 1)
  let energyIndex = -1
  for (let i = tail.length - 1; i >= 0; i--) {
    if (ENERGY.test(tail[i]) && num(tail[i]) >= 0.2) {
      energyIndex = i
      break
    }
  }
  if (energyIndex < 0) return null
  const values = tail
    .slice(0, energyIndex)
    .filter((token) => CONSUMPTION.test(token))
    .map(num)
    .filter((value) => value >= 3)

  const transmission = tokens[t].toUpperCase()
  const row: InmetroRow = { year, brand: brand.name, rest: segment.join(' '), engine: '', gearbox: null }

  if (fuelCode === 'E') {
    const mj = num(tail[energyIndex])
    if (!inRange(mj, 0.2, 1.2)) return null
    return { ...row, engine: 'Elétrico', kmPerKwh: round1(3.6 / mj) }
  }

  let displacement: string | null = null
  let displacementIndex = -1
  segment.forEach((token, i) => {
    const match = token.match(DISPLACEMENT)
    if (match) {
      displacement = match[1]
      displacementIndex = i
    }
  })
  if (!displacement) return null
  const engineToken = segment[displacementIndex]
  const turbo = /^\d\.\dT/i.test(engineToken) || segment[displacementIndex + 1] === 'T' || TURBO.test(segment.join(' '))
  row.gearbox = transmission.startsWith('M') ? 'manual' : 'automático'

  let fuel: Pick<InmetroRow, 'gasoline' | 'ethanol' | 'diesel'>
  if (fuelCode === 'F') {
    const [ethanol, gasoline] = values.length === 6 ? [values[0], values[3]] : values.length === 4 ? [values[0], values[2]] : []
    if (!inRange(gasoline, 6, 25) || !inRange(ethanol, 4, 18)) return null
    const ratio = ethanol! / gasoline!
    if (ratio < 0.6 || ratio > 0.82) return null
    fuel = { gasoline, ethanol }
  } else {
    if (values.length !== 2 && values.length !== 3) return null
    if (fuelCode === 'G' && !inRange(values[0], 5, 30)) return null
    if (fuelCode === 'D' && !inRange(values[0], 5, 25)) return null
    fuel = fuelCode === 'G' ? { gasoline: values[0] } : { diesel: values[0] }
  }

  // Híbrido: escrito como "Híbrido", "HEV" ou "HV"; ou, sem a marcação, motor 1.5+ fazendo mais de 15,5 km/l
  const hybrid = /h[íi]brido|\bHEV\b|\bHV\b/i.test(clean) || (Number(displacement) >= 1.5 && (fuel.gasoline ?? 0) > 15.5)
  row.engine = `${displacement}${turbo ? ' Turbo' : ''}${hybrid ? ' Híbrido' : ''}`
  return { ...row, ...fuel }
}

/** Maiúsculas, sem acento e sem pontuação: "T-Cross" → "TCROSS", "Citroën" → "CITROEN". */
export const fold = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')

/**
 * Modelo da FIPE que começa o texto da linha, sempre em palavras inteiras
 * ("T CROSS" e "T-CROSS" casam com "T-Cross"); o mais longo ganha ("Onix Plus" antes de "Onix").
 */
export function matchFamily(rest: string, families: string[]): string | null {
  const words = rest
    .replace(/^(NOVO|NOVA|NEW)\s+/i, '')
    .split(/\s+/)
    .map(fold)
    .filter(Boolean)
  const starts = [1, 2, 3].filter((k) => k <= words.length).map((k) => words.slice(0, k).join(''))
  let best: string | null = null
  for (const family of families) {
    const key = fold(family)
    if (key && starts.includes(key) && (!best || key.length > fold(best).length)) best = family
  }
  return best
}
