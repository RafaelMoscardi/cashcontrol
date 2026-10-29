import { describe, expect, it } from 'vitest'
import { fromCents, perKmToCents, roundCents, roundRate, safeDivide, sumCents, toCents } from './money'

describe('centavos', () => {
  it('converte reais em centavos sem erro de ponto flutuante', () => {
    expect(toCents(19.99)).toBe(1999)
    expect(toCents(0.1 + 0.2)).toBe(30)
    expect(toCents(1234.56)).toBe(123456)
    expect(fromCents(123456)).toBe(1234.56)
  })

  it('arredonda meio centavo para longe do zero, mesmo com ruído binário', () => {
    expect(roundCents(5469.499999999999)).toBe(5470)
    expect(roundCents(0.5)).toBe(1)
    expect(roundCents(-0.5)).toBe(-1)
    expect(roundCents(-0.4)).toBe(0)
    expect(Object.is(roundCents(-0.4), -0)).toBe(false)
  })

  it('multiplica km por taxa direto em centavos', () => {
    expect(perKmToCents(120, 0.5)).toBe(6000)
    expect(perKmToCents(87.3, 0.54696)).toBe(4775) // 47,749608 → 47,75
    expect(perKmToCents(0, 0.9)).toBe(0)
  })

  it('soma, divide e arredonda taxas', () => {
    expect(sumCents([1999, 1, 30])).toBe(2030)
    expect(safeDivide(10, 0)).toBeNull()
    expect(safeDivide(10, 4)).toBe(2.5)
    expect(roundRate(6.29 / 11.5)).toBe(0.54696)
    expect(roundRate(0.1 + 0.2, 4)).toBe(0.3)
  })

  it('recusa valores não finitos', () => {
    expect(() => roundCents(Number.NaN)).toThrow(RangeError)
    expect(() => roundCents(Number.POSITIVE_INFINITY)).toThrow(RangeError)
  })
})
