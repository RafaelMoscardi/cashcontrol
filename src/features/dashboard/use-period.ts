import { useMemo } from 'react'
import { useSearchParams } from 'react-router'
import { presetRange, todayISO, type DateRange, type PeriodPreset } from '@/domain/dates'
import { summarizePeriod } from '@/domain/period'
import { useShiftsBetween } from '@/features/shifts/api'
import { useVehicles } from '@/features/vehicles/api'

export type PeriodChoice = PeriodPreset | 'custom'

/** Atalhos do trilho. "Semana" (segunda a domingo) segue o ciclo de pagamento das plataformas. */
export const PERIOD_OPTIONS: ReadonlyArray<{ value: PeriodPreset; label: string; shortLabel?: string }> = [
  { value: 'today', label: 'Hoje' },
  { value: 'week', label: 'Semana' },
  { value: 'month', label: 'Mês' },
  { value: 'last-month', label: 'Mês passado', shortLabel: 'Mês ant.' },
]

// "7d" continua válido na URL, só não aparece no trilho
const PRESETS: readonly PeriodPreset[] = ['today', '7d', 'week', 'month', 'last-month']
const isPreset = (value: string | null): value is PeriodPreset => value !== null && (PRESETS as readonly string[]).includes(value)

const STORAGE_KEY = 'cashcontrol:periodo'
const ISO = /^\d{4}-\d{2}-\d{2}$/

function storedPreset(): PeriodPreset {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return isPreset(value) ? value : 'month'
  } catch {
    return 'month'
  }
}

/** Período do painel guardado na URL (voltar/recarregar mantém o filtro). */
export function usePeriodParams() {
  const [params, setParams] = useSearchParams()
  const today = todayISO()
  const raw = params.get('periodo')
  const from = params.get('de')
  const to = params.get('ate')

  let choice: PeriodChoice
  let range: DateRange
  if (raw === 'custom' && from && to && ISO.test(from) && ISO.test(to) && from <= to) {
    choice = 'custom'
    range = { from, to }
  } else {
    const preset = isPreset(raw) ? raw : storedPreset()
    choice = preset
    range = presetRange(preset, today)
  }

  const setPreset = (preset: PeriodPreset) => {
    try {
      localStorage.setItem(STORAGE_KEY, preset)
    } catch {
      // sem armazenamento: o filtro só não fica lembrado
    }
    setParams({ periodo: preset }, { replace: true })
  }
  const setCustom = (next: DateRange) => setParams({ periodo: 'custom', de: next.from, ate: next.to }, { replace: true })

  return { choice, range, today, setPreset, setCustom }
}

export function usePeriodSummary(range: DateRange, today: string) {
  const shifts = useShiftsBetween(range)
  const vehicles = useVehicles()
  const summary = useMemo(
    () =>
      shifts.data && vehicles.data
        ? summarizePeriod({ shifts: shifts.data, vehicles: vehicles.data, range, today })
        : null,
    [shifts.data, vehicles.data, range, today],
  )
  return {
    summary,
    isPending: shifts.isPending || vehicles.isPending,
    isRefreshing: shifts.isPlaceholderData,
    error: shifts.error ?? vehicles.error,
  }
}
