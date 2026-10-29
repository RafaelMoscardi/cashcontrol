import type { PlatformKind } from '@/domain/types'

export const PLATFORM_KIND_LABEL: Record<PlatformKind, string> = {
  rides: 'Corridas',
  delivery: 'Entregas',
  mototaxi: 'Mototáxi',
  private: 'Particular',
  other: 'Outro',
}

/** Sugestões do primeiro acesso. O usuário pode criar qualquer outra. */
export const PLATFORM_CATALOG: ReadonlyArray<{ name: string; kind: PlatformKind }> = [
  { name: 'Uber', kind: 'rides' },
  { name: '99', kind: 'rides' },
  { name: 'inDrive', kind: 'rides' },
  { name: 'iFood', kind: 'delivery' },
  { name: 'Rappi', kind: 'delivery' },
  { name: 'Lalamove', kind: 'delivery' },
  { name: 'Loggi', kind: 'delivery' },
  { name: 'Uber Moto', kind: 'mototaxi' },
  { name: '99Moto', kind: 'mototaxi' },
  { name: 'Mototáxi', kind: 'mototaxi' },
  { name: 'Particular', kind: 'private' },
]

/**
 * Cores das séries, em ordem fixa (validadas para daltonismo sobre o cartão
 * escuro). A cor segue a plataforma para sempre; da 7ª em diante, cinza neutro.
 */
export const PLATFORM_COLORS = ['#8b5cf6', '#199e70', '#d95926', '#3987e5', '#d55181', '#c98500'] as const
export const NEUTRAL_PLATFORM_COLOR = '#7c7a8c'

export function nextPlatformColors(used: ReadonlyArray<string>, count: number): string[] {
  const free = PLATFORM_COLORS.filter((c) => !used.includes(c))
  return Array.from({ length: count }, (_, i) => free[i] ?? NEUTRAL_PLATFORM_COLOR)
}
