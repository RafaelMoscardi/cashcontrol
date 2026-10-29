import { describe, expect, it } from 'vitest'
import {
  addDays,
  addMonths,
  daysBetweenInclusive,
  daysInMonth,
  daysInYear,
  eachDay,
  endOfWeek,
  presetRange,
  shiftInstants,
  startOfWeek,
  toISODate,
  toLocalTime,
  weekday,
} from './dates'

describe('datas locais', () => {
  it('aritmética de dias atravessa meses e anos', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(daysBetweenInclusive('2026-10-01', '2026-10-31')).toBe(31)
    expect(eachDay('2026-10-30', '2026-11-02')).toEqual(['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02'])
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-01')
    expect(addMonths('2026-01-15', -1)).toBe('2025-12-01')
  })

  it('meses e anos bissextos', () => {
    expect(daysInMonth('2026-02-10')).toBe(28)
    expect(daysInMonth('2028-02-10')).toBe(29)
    expect(daysInYear('2028-01-01')).toBe(366)
    expect(daysInYear('2100-01-01')).toBe(365)
    expect(daysInYear('2000-01-01')).toBe(366)
  })

  it('semana de segunda a domingo', () => {
    expect(weekday('2026-10-25')).toBe(0) // domingo
    expect(startOfWeek('2026-10-25')).toBe('2026-10-19')
    expect(endOfWeek('2026-10-19')).toBe('2026-10-25')
    expect(startOfWeek('2026-10-19')).toBe('2026-10-19')
  })

  it('períodos prontos do painel', () => {
    const today = '2026-10-25'
    expect(presetRange('today', today)).toEqual({ from: today, to: today })
    expect(presetRange('7d', today)).toEqual({ from: '2026-10-19', to: today })
    expect(presetRange('week', today)).toEqual({ from: '2026-10-19', to: '2026-10-25' })
    expect(presetRange('month', today)).toEqual({ from: '2026-10-01', to: '2026-10-31' })
    expect(presetRange('last-month', today)).toEqual({ from: '2026-09-01', to: '2026-09-30' })
    expect(presetRange('last-month', '2026-01-10')).toEqual({ from: '2025-12-01', to: '2025-12-31' })
  })

  it('horários da jornada no fuso do aparelho', () => {
    const { startedAt, endedAt } = shiftInstants('2026-10-20', '07:30', '16:45')
    expect(toISODate(startedAt)).toBe('2026-10-20')
    expect(toLocalTime(startedAt)).toBe('07:30')
    expect(toLocalTime(endedAt)).toBe('16:45')
    expect((endedAt.getTime() - startedAt.getTime()) / 60_000).toBe(555)
  })

  it('fim antes do início vira o dia seguinte', () => {
    const { endedAt } = shiftInstants('2026-10-31', '22:00', '03:00')
    expect(toISODate(endedAt)).toBe('2026-11-01')
  })

  it('recusa datas e horas malformadas', () => {
    expect(() => addDays('25/10/2026', 1)).toThrow(RangeError)
    expect(() => shiftInstants('2026-10-20', '8h', '18:00')).toThrow(RangeError)
  })
})
