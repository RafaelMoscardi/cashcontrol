import type { VehicleKind } from '@/domain/types'
import data from './catalogo-fipe.json'

/** Marcas e modelos da Tabela FIPE (gerado por npm run catalogo:fipe). */
interface KindCatalog {
  popular: string[]
  brands: Record<string, string[]>
}

const catalog = data as unknown as Record<VehicleKind, KindCatalog>

/** Mais usadas no topo, depois as outras em ordem alfabética. */
export function brandGroups(kind: VehicleKind) {
  const { popular, brands } = catalog[kind]
  return [
    { heading: 'Mais usadas', items: popular },
    { heading: 'Outras marcas', items: Object.keys(brands).filter((b) => !popular.includes(b)) },
  ]
}

/** Modelos da marca, ou null se a marca não está no catálogo (foi digitada). */
export const modelsOf = (kind: VehicleKind, brand: string): string[] | null => catalog[kind].brands[brand] ?? null

export const isCatalogBrand = (kind: VehicleKind, brand: string) => brand in catalog[kind].brands

export const isCatalogModel = (kind: VehicleKind, brand: string, model: string) => modelsOf(kind, brand)?.includes(model) ?? false
