/**
 * Baixa marcas e modelos da Tabela FIPE pela API gratuita parallelum.com.br.
 * Guarda cada resposta em node_modules/.cache/fipe para não repetir as ~210 consultas
 * (apague a pasta para baixar de novo).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export type Tipo = 'carros' | 'motos'

export interface MarcaFipe {
  codigo: string
  nome: string
}

const API = 'https://parallelum.com.br/fipe/api/v1'
const CACHE = join(import.meta.dirname, '..', '..', 'node_modules', '.cache', 'fipe')

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function getJson<T>(path: string, cacheFile: string): Promise<T> {
  const file = join(CACHE, cacheFile)
  if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8')) as T
  mkdirSync(CACHE, { recursive: true })
  for (let tentativa = 1; ; tentativa++) {
    const res = await fetch(`${API}${path}`)
    if (res.ok) {
      const data = (await res.json()) as T
      writeFileSync(file, JSON.stringify(data))
      await sleep(250) // gentileza com a API gratuita
      return data
    }
    if (tentativa >= 5 || (res.status !== 429 && res.status < 500)) throw new Error(`FIPE ${path}: HTTP ${res.status}`)
    await sleep(2000 * tentativa)
  }
}

export const baixarMarcas = (tipo: Tipo) => getJson<MarcaFipe[]>(`/${tipo}/marcas`, `${tipo}-marcas.json`)

export async function baixarModelos(tipo: Tipo, marca: MarcaFipe): Promise<string[]> {
  const data = await getJson<{ modelos: Array<{ nome: string }> }>(`/${tipo}/marcas/${marca.codigo}/modelos`, `${tipo}-${marca.codigo}.json`)
  return data.modelos.map((m) => m.nome)
}
