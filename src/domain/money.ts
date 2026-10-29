/* Dinheiro em centavos inteiros. Arredondamento meio-para-longe-do-zero,
   depois de limpar o ruído de ponto flutuante (ex.: 5469,4999999 → 5469,5 → 5470). */

export type Cents = number

/** Arredonda um valor já expresso em centavos (pode ter fração). */
export function roundCents(value: number): Cents {
  if (!Number.isFinite(value)) throw new RangeError(`Valor inválido: ${value}`)
  const clean = Number(value.toPrecision(12))
  const rounded = Math.sign(clean) * Math.round(Math.abs(clean))
  return rounded === 0 ? 0 : rounded
}

/** R$ → centavos. */
export const toCents = (reais: number): Cents => roundCents(reais * 100)

/** Centavos → R$. */
export const fromCents = (cents: Cents): number => cents / 100

/** km × taxa (R$/km) → centavos. */
export const perKmToCents = (km: number, ratePerKm: number): Cents => roundCents(km * ratePerKm * 100)

/** Soma uma lista de centavos (inteiros, sem perda). */
export const sumCents = (values: Iterable<Cents>): Cents => {
  let total = 0
  for (const v of values) total += v
  return total
}

/** Divide com segurança: null quando o divisor é zero. */
export const safeDivide = (numerator: number, denominator: number): number | null =>
  denominator > 0 ? numerator / denominator : null

/** Arredonda uma taxa (R$/km etc.) para n casas, sem ruído de ponto flutuante. */
export function roundRate(value: number, decimals = 5): number {
  const factor = 10 ** decimals
  const clean = Number((value * factor).toPrecision(12))
  return Math.round(clean) / factor
}
