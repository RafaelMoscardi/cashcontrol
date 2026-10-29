/* Leitura de números digitados no padrão brasileiro. */

/**
 * "1.234,56" → 1234.56 · "11,5" → 11.5 · "11.5" → 11.5 · "R$ 6,29" → 6.29.
 * Com vírgula, o ponto é separador de milhar; sem vírgula, o ponto é decimal
 * (teclados de celular costumam ter só o ponto). Texto inválido → null.
 */
export function parseDecimal(input: string): number | null {
  let text = input.replace(/R\$|\s| /g, '')
  if (text === '') return null
  if (text.includes(',')) text = text.replace(/\./g, '').replace(',', '.')
  if (!/^-?\d*\.?\d+$/.test(text) && !/^-?\d+\.$/.test(text)) return null
  const value = Number(text)
  return Number.isFinite(value) ? value : null
}

/** Número → texto para edição: 11.5 → "11,5" (sem separador de milhar). */
export function toDecimalInput(value: number | null | undefined, maximumFractionDigits = 3): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return ''
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits, useGrouping: false }).format(value)
}

/** Só os dígitos: "45.678 km" → 45678. Vazio → null. */
export function parseInteger(input: string): number | null {
  const digits = input.replace(/\D/g, '')
  return digits === '' ? null : Number(digits)
}
