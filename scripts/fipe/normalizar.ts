/**
 * Transforma os nomes da Tabela FIPE (versões técnicas, ex.: "ONIX HATCH LT 1.0 12V Flex 5p Mec.")
 * em marcas e modelos que o motorista reconhece ("Chevrolet", "Onix").
 */

export type VehicleKind = 'car' | 'motorcycle'

/** Marcas que aparecem primeiro na lista, na ordem de uso entre motoristas e entregadores. */
export const POPULAR_BRANDS: Record<VehicleKind, string[]> = {
  car: ['Chevrolet', 'Fiat', 'Volkswagen', 'Hyundai', 'Toyota', 'Renault', 'Jeep', 'Nissan', 'Honda', 'BYD', 'Citroën', 'Peugeot', 'Ford', 'Caoa Chery', 'GWM'],
  motorcycle: ['Honda', 'Yamaha', 'Haojue', 'Shineray', 'Suzuki', 'Bajaj', 'Royal Enfield', 'Dafra', 'Kawasaki', 'BMW'],
}

const BRAND_NAMES: Record<string, string> = {
  'GM - Chevrolet': 'Chevrolet',
  'VW - VolksWagen': 'Volkswagen',
  'Kia Motors': 'Kia',
  'Caoa Chery/Chery': 'Caoa Chery',
  SSANGYONG: 'SsangYong',
  CFMOTO: 'CFMoto',
  'GAS GAS': 'GasGas',
  "L'AQUILA": "L'Aquila",
  MINI: 'MINI',
}

/** Siglas de marca que ficam em maiúsculas */
const BRAND_ACRONYMS = new Set(['BMW', 'BRM', 'BRP', 'BYD', 'DFSK', 'FYM', 'GWM', 'JAC', 'JPX', 'KTM', 'MG', 'MRX', 'MV', 'MVK', 'NIU', 'RAM', 'SBM', 'SWM', 'TAC'])

/** Primeiras palavras curtas que são nomes, não siglas */
const CAR_WORDS = new Set(['AYA', 'EOS', 'FIT', 'FOX', 'GOL', 'HAN', 'JOY', 'KA', 'KA+', 'ONE', 'ORA', 'RIO', 'TAN', 'UNO', 'VAN', 'WAY', 'WEY', 'ZOE'])
const MOTO_WORDS = new Set(['APÉ', 'BEE', 'BIG', 'BIZ', 'EKO', 'FOX', 'GO', 'JET+', 'JOG', 'MAX', 'NEO', 'NEX', 'NIX', 'NOW', 'ONE', 'POP', 'RED', 'SKY', 'SUN', 'TRE', 'WAY', 'WEB', 'WIN', 'WIT', 'ZIG', 'ZIP'])

/** Modelos de carro com mais de uma palavra (ou que a FIPE escreve de outro jeito) */
const CAR_MODELS: Array<[RegExp, string]> = [
  [/^ONIX (SEDAN|SED\.|SD\.)/, 'Onix Plus'],
  [/^GRAND SIENA/, 'Grand Siena'],
  [/^GRAND CHEROKEE/, 'Grand Cherokee'],
  [/^GRAND C4/, 'Grand C4 Picasso'],
  [/^GRAND VITARA/, 'Grand Vitara'],
  [/^GRAND CARAVAN/, 'Grand Caravan'],
  [/^LIVINA GRAND/, 'Grand Livina'],
  [/^LAND CRUISER/, 'Land Cruiser'],
  [/^(NEW )?RANGE ROVER EVOQUE/, 'Range Rover Evoque'],
  [/^(NEW )?RANGE ROVER SPORT/, 'Range Rover Sport'],
  [/^(NEW )?RANGE ROVER VELAR/, 'Range Rover Velar'],
  [/^(NEW )?RANGE ROVER/, 'Range Rover'],
  [/^DEF\.?\b|^DEFENDER/, 'Defender'],
  [/^GRAND SANTA F/, 'Grand Santa Fe'],
  [/^SANTA F[EÉ]/, 'Santa Fe'],
  [/^GRAND SAVEIRO/, 'Saveiro'],
  [/^CUP[EÊ](\s|$)/, 'Coupe'],
  [/^DUCATO/, 'Ducato'],
  [/^NEW BEETLE/, 'New Beetle'],
  [/^DEL REY/, 'Del Rey'],
  [/^COROLLA CROSS/, 'Corolla Cross'],
  [/^YARIS CROSS/, 'Yaris Cross'],
  [/^HILUX SW4/, 'Hilux SW4'],
  [/^BAND\./, 'Bandeirante'],
  [/^C4 CACTUS/, 'C4 Cactus'],
  [/^C4 LOUNGE/, 'C4 Lounge'],
  [/^C4 PICASSO/, 'C4 Picasso'],
  [/^C4 PALLAS/, 'C4 Pallas'],
  [/^C3 PICASSO/, 'C3 Picasso'],
  [/^C3 AIRCROSS/, 'C3 Aircross'],
  [/^AIRCROSS ?7/, 'Aircross 7'],
  [/^DOLPHIN MINI/, 'Dolphin Mini'],
  [/^DOLPHIN PLUS/, 'Dolphin Plus'],
  [/^SONG PLUS/, 'Song Plus'],
  [/^SONG PRO/, 'Song Pro'],
  [/^SPACE ?FOX/, 'SpaceFox'],
  [/^SPACE ?CROSS/, 'SpaceCross'],
  [/^CROSS ?FOX/, 'CrossFox'],
  [/^PALIO WEEKEND/, 'Palio Weekend'],
  [/^UP!/, 'up!'],
]

/** Linhas de carro em que o número faz parte do modelo (Tiggo 5X, Haval H6, Ora 03) */
const CAR_SERIES = new Set(['ARRIZO', 'ATTO', 'HAVAL', 'ORA', 'POER', 'SEALION', 'TANK', 'TIGGO'])

/** Modelos de moto conhecidos por outro nome ou que não seguem "nome + cilindrada" */
const MOTO_MODELS: Array<[RegExp, string]> = [
  [/^YBR 125I? FACTOR/, 'Factor 125'],
  [/^YBR 150/, 'Factor 150'],
  [/^(YS|FZ)15\b|^YS 150/, 'Fazer 150'],
  [/^(YS|FZ)25\b|^YS 250/, 'Fazer 250'],
  [/^FAZER 600|^FZ6\b/, 'Fazer 600'],
  [/^XTZ 250 LANDER|^LANDER/, 'Lander 250'],
  [/^XTZ 150 CROSSER|^CROSSER/, 'Crosser 150'],
  [/^XTZ 250 TENERE/, 'Ténéré 250'],
  [/^FAT BOY/, 'Fat Boy'],
  [/^LOW RIDER/, 'Low Rider'],
  [/^PAN AMERICA/, 'Pan America'],
  [/^ROAD KING/, 'Road King'],
  [/^ROAD GLIDE/, 'Road Glide'],
  [/^STREET GLIDE/, 'Street Glide'],
  [/^STREET BOB/, 'Street Bob'],
]

/** Nomes que a regra de maiúsculas não acerta */
const SPELLING: Record<string, string> = {
  NMAX: 'NMax',
  XMAX: 'XMax',
  TMAX: 'TMax',
  'V-MAX': 'V-Max',
  BZ4X: 'bZ4X',
  I20: 'i20',
  I30: 'i30',
  I30CW: 'i30 CW',
  IX35: 'ix35',
  'PICK-UP': 'Pick-up',
  CONCOURS14: 'Concours 14',
}

const capitalize = (word: string) => word.charAt(0).toLocaleUpperCase('pt-BR') + word.slice(1).toLocaleLowerCase('pt-BR')

export function brandName(fipe: string): string {
  if (BRAND_NAMES[fipe]) return BRAND_NAMES[fipe]
  // A FIPE já escreve em maiúsculas e minúsculas: mantém
  if (fipe !== fipe.toLocaleUpperCase('pt-BR')) return fipe
  return fipe
    .split(' ')
    .map((word) => (BRAND_ACRONYMS.has(word) ? word : word.split('-').map(capitalize).join('-')))
    .join(' ')
}

/** Uma palavra do modelo: algarismos mantêm a grafia da FIPE (320i, HB20); siglas ficam em maiúsculas. */
function modelWord(word: string, kind: VehicleKind): string {
  const upper = word.toLocaleUpperCase('pt-BR')
  if (SPELLING[upper]) return SPELLING[upper]
  if (/\d/.test(word)) return word
  if ((kind === 'car' ? CAR_WORDS : MOTO_WORDS).has(upper)) return capitalize(upper)
  if (upper.replace(/[^A-ZÀ-Ú]/g, '').length <= 3) return upper
  // Hífen: partes curtas são siglas (HR-V, GT-R, GSX-R), as longas viram nome (T-Cross, X-Trail)
  const acronym = kind === 'car' ? 2 : 3
  return upper
    .split('-')
    .map((part) => (part.length <= acronym ? part : capitalize(part)))
    .join('-')
}

/** Cilindrada logo depois do nome da moto: "125/125i" → "125", "125cc" → "125", "NS160" fica. */
function engineSize(words: string[]): string | null {
  for (const word of words.slice(1, 4)) {
    const digits = word.match(/^\d{2,4}[A-Za-z]{0,2}/)
    if (digits) return digits[0].replace(/cc$/i, '')
    if (/^[A-Z]{1,3}\d{2,4}[A-Z]?$/.test(word)) return word
  }
  return null
}

/** "ONIX HATCH LT 1.0 12V Flex 5p Mec." → "Onix"; "CG 160 FAN/ FAN FLEX" → "CG 160". */
export function modelFamily(fipe: string, kind: VehicleKind): string | null {
  const clean = fipe
    .replace(/\(.*?\)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const upper = clean.toLocaleUpperCase('pt-BR')
  for (const [pattern, name] of kind === 'car' ? CAR_MODELS : MOTO_MODELS) {
    if (pattern.test(upper)) return name
  }

  const words = clean.split(' ').map((w) => w.replace(/[/,;]+$/, '')).filter(Boolean)
  // "MT-07/MT-07 ABS", "Address/AE 50": vale o que vem antes da barra
  const first = words[0]?.split('/')[0]
  if (!first) return null
  if (kind === 'car') {
    const series = words[1]
    if (CAR_SERIES.has(first.toLocaleUpperCase('pt-BR')) && series && /^[A-Za-z]?\d{1,2}[A-Za-z]?$/.test(series)) return `${modelWord(first, kind)} ${series}`
    return modelWord(first, kind)
  }

  // Moto: nome + cilindrada (ou código como NS160), olhando até 3 palavras adiante
  if (/\d/.test(first)) return modelWord(first, kind)
  const size = engineSize(words)
  return size ? `${modelWord(first, kind)} ${size}` : modelWord(first, kind)
}

const collator = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true })

export interface KindCatalog {
  popular: string[]
  brands: Record<string, string[]>
}

/** Junta as versões de cada marca em modelos únicos, em ordem alfabética. */
export function buildCatalog(kind: VehicleKind, raw: Array<{ brand: string; versions: string[] }>): KindCatalog {
  const brands = new Map<string, Map<string, string>>()
  for (const { brand, versions } of raw) {
    const name = brandName(brand)
    const models = brands.get(name) ?? new Map<string, string>()
    for (const version of versions) {
      const model = modelFamily(version, kind)
      // A mesma grafia em caixas diferentes conta uma vez só
      if (model && !models.has(model.toLocaleLowerCase('pt-BR'))) models.set(model.toLocaleLowerCase('pt-BR'), model)
    }
    if (models.size) brands.set(name, models)
  }
  const sorted = [...brands.keys()].sort(collator.compare)
  return {
    popular: POPULAR_BRANDS[kind].filter((b) => brands.has(b)),
    brands: Object.fromEntries(sorted.map((b) => [b, [...brands.get(b)!.values()].sort(collator.compare)])),
  }
}
