/* Datas locais 'AAAA-MM-DD' calculadas em UTC: sem surpresa de horário de verão. */
import type { ISODate } from './types'

const DAY_MS = 86_400_000
const pad = (n: number) => String(n).padStart(2, '0')

function parts(iso: ISODate): [number, number, number] {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) throw new RangeError(`Data inválida: ${iso}`)
  return [Number(m[1]), Number(m[2]), Number(m[3])]
}

/** Data no calendário do aparelho → 'AAAA-MM-DD'. */
export const toISODate = (date: Date): ISODate =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

export const todayISO = (): ISODate => toISODate(new Date())

/** Dias desde 01/01/1970. */
export function dayNumber(iso: ISODate): number {
  const [y, m, d] = parts(iso)
  return Date.UTC(y, m - 1, d) / DAY_MS
}

export function fromDayNumber(n: number): ISODate {
  const dt = new Date(n * DAY_MS)
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`
}

export const addDays = (iso: ISODate, days: number): ISODate => fromDayNumber(dayNumber(iso) + days)

export const daysBetweenInclusive = (from: ISODate, to: ISODate): number => dayNumber(to) - dayNumber(from) + 1

export function eachDay(from: ISODate, to: ISODate): ISODate[] {
  const days: ISODate[] = []
  for (let n = dayNumber(from), end = dayNumber(to); n <= end; n++) days.push(fromDayNumber(n))
  return days
}

/** Datas ISO comparam como texto. */
export const minDate = (a: ISODate, b: ISODate): ISODate => (a <= b ? a : b)
export const maxDate = (a: ISODate, b: ISODate): ISODate => (a >= b ? a : b)

export function daysInMonth(iso: ISODate): number {
  const [y, m] = parts(iso)
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

export function daysInYear(iso: ISODate): number {
  const [y] = parts(iso)
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 366 : 365
}

export function startOfMonth(iso: ISODate): ISODate {
  const [y, m] = parts(iso)
  return `${y}-${pad(m)}-01`
}

export function endOfMonth(iso: ISODate): ISODate {
  const [y, m] = parts(iso)
  return `${y}-${pad(m)}-${pad(daysInMonth(iso))}`
}

/** Primeiro dia do mês deslocado em n meses. */
export function addMonths(iso: ISODate, months: number): ISODate {
  const [y, m] = parts(iso)
  const dt = new Date(Date.UTC(y, m - 1 + months, 1))
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-01`
}

/** 0 = domingo … 6 = sábado. */
export function weekday(iso: ISODate): number {
  const [y, m, d] = parts(iso)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

/** Semana de trabalho de segunda a domingo (o ciclo semanal das plataformas). */
export const startOfWeek = (iso: ISODate): ISODate => addDays(iso, weekday(iso) === 0 ? -6 : 1 - weekday(iso))
export const endOfWeek = (iso: ISODate): ISODate => addDays(startOfWeek(iso), 6)

export interface DateRange {
  from: ISODate
  to: ISODate
}

export type PeriodPreset = 'today' | '7d' | 'week' | 'month' | 'last-month'

export function presetRange(preset: PeriodPreset, today: ISODate): DateRange {
  switch (preset) {
    case 'today':
      return { from: today, to: today }
    case '7d':
      return { from: addDays(today, -6), to: today }
    case 'week':
      return { from: startOfWeek(today), to: endOfWeek(today) }
    case 'month':
      return { from: startOfMonth(today), to: endOfMonth(today) }
    case 'last-month': {
      const lastDayPrev = addDays(startOfMonth(today), -1)
      return { from: startOfMonth(lastDayPrev), to: lastDayPrev }
    }
  }
}

/** Data + hora 'HH:mm' no fuso do aparelho → instante. */
export function localDateTime(date: ISODate, time: string): Date {
  const [y, m, d] = parts(date)
  const match = /^(\d{1,2}):(\d{2})$/.exec(time)
  if (!match) throw new RangeError(`Hora inválida: ${time}`)
  return new Date(y, m - 1, d, Number(match[1]), Number(match[2]), 0, 0)
}

/** Início e fim da jornada; fim igual ou antes do início significa que virou o dia. */
export function shiftInstants(date: ISODate, startTime: string, endTime: string): { startedAt: Date; endedAt: Date } {
  const startedAt = localDateTime(date, startTime)
  let endedAt = localDateTime(date, endTime)
  if (endedAt.getTime() <= startedAt.getTime()) endedAt = localDateTime(addDays(date, 1), endTime)
  return { startedAt, endedAt }
}

/** Instante → 'HH:mm' no fuso do aparelho. */
export function toLocalTime(instant: string | Date): string {
  const dt = typeof instant === 'string' ? new Date(instant) : instant
  return `${pad(dt.getHours())}:${pad(dt.getMinutes())}`
}
