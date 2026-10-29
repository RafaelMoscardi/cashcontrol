/* Formatação brasileira (Intl pt-BR). Dinheiro chega em centavos. */
import type { ISODate } from '@/domain/types'

const LOCALE = 'pt-BR'

const brl = new Intl.NumberFormat(LOCALE, { style: 'currency', currency: 'BRL' })
const brlSigned = new Intl.NumberFormat(LOCALE, { style: 'currency', currency: 'BRL', signDisplay: 'exceptZero' })
const brlCompact = new Intl.NumberFormat(LOCALE, {
  style: 'currency',
  currency: 'BRL',
  notation: 'compact',
  maximumFractionDigits: 1,
})

export const formatMoney = (cents: number) => brl.format(cents / 100)

/** "+R$ 10,00" / "-R$ 10,00" (zero sem sinal). */
export const formatSignedMoney = (cents: number) => brlSigned.format(cents / 100)

/** Para eixos de gráfico: "R$ 1,2 mil". */
export const formatMoneyCompact = (cents: number) => brlCompact.format(cents / 100)

/** Valor em reais (não centavos), ex. taxas: "R$ 0,55". */
export const formatReais = (reais: number, maximumFractionDigits = 2) =>
  new Intl.NumberFormat(LOCALE, {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits,
  }).format(reais)

export const formatNumber = (value: number, maximumFractionDigits = 1, minimumFractionDigits = 0) =>
  new Intl.NumberFormat(LOCALE, { maximumFractionDigits, minimumFractionDigits }).format(value)

export const formatKm = (km: number) => `${formatNumber(km, 1)} km`

export const formatPerKm = (reais: number | null) => (reais === null ? '—' : `${formatReais(reais)}/km`)

export const formatPerHour = (reais: number | null) => (reais === null ? '—' : `${formatReais(reais)}/h`)

export const formatPercent = (ratio: number, maximumFractionDigits = 0) =>
  new Intl.NumberFormat(LOCALE, { style: 'percent', maximumFractionDigits }).format(ratio)

/** 540 → "9 h"; 555 → "9 h 15 min"; 45 → "45 min". */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  if (h === 0) return `${m} min`
  return m === 0 ? `${h} h` : `${h} h ${m} min`
}

const parseISODate = (iso: ISODate) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y!, m! - 1, d!)
}

const dateShort = new Intl.DateTimeFormat(LOCALE, { day: '2-digit', month: '2-digit', year: 'numeric' })
const dateDayMonth = new Intl.DateTimeFormat(LOCALE, { day: '2-digit', month: '2-digit' })
const dateLong = new Intl.DateTimeFormat(LOCALE, { weekday: 'long', day: 'numeric', month: 'long' })
const weekdayShort = new Intl.DateTimeFormat(LOCALE, { weekday: 'short' })
const monthYear = new Intl.DateTimeFormat(LOCALE, { month: 'long', year: 'numeric' })
const time = new Intl.DateTimeFormat(LOCALE, { hour: '2-digit', minute: '2-digit' })

/** "25/10/2026" */
export const formatDate = (iso: ISODate) => dateShort.format(parseISODate(iso))

/** "25/10" */
export const formatDayMonth = (iso: ISODate) => dateDayMonth.format(parseISODate(iso))

/** "domingo, 25 de outubro" */
export const formatDateLong = (iso: ISODate) => dateLong.format(parseISODate(iso))

/** "dom." → "dom" */
export const formatWeekdayShort = (iso: ISODate) => weekdayShort.format(parseISODate(iso)).replace('.', '')

/** "outubro de 2026" */
export const formatMonthYear = (iso: ISODate) => monthYear.format(parseISODate(iso))

/** Instante → "14:30" no fuso do aparelho. */
export const formatTime = (instant: string | Date) => time.format(typeof instant === 'string' ? new Date(instant) : instant)

/** Primeira letra maiúscula (Intl devolve meses e dias em minúsculas). */
export const capitalize = (text: string) => text.charAt(0).toLocaleUpperCase(LOCALE) + text.slice(1)
