import { z } from 'zod'
import { shiftInstants, toLocalTime } from '@/domain/dates'
import { EXPENSE_CATEGORIES } from '@/domain/expenses'
import type { ShiftFacts } from '@/domain/shift'
import type { CostSnapshot, ExpenseCategory, ISODate, Shift } from '@/domain/types'

const TIME = /^\d{2}:\d{2}$/
const moneyCents = z.number().int().min(0).max(10_000_000, 'Valor muito alto')
const meterKwh = z.number().min(0).max(9_999_999, 'Confira a leitura do medidor').nullable()

export const shiftFormSchema = z
  .object({
    vehicleId: z.string().min(1, 'Escolha o veículo'),
    workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Informe a data'),
    startTime: z.string().regex(TIME, 'Informe a hora de início'),
    endTime: z.string().regex(TIME, 'Informe a hora de fim'),
    breakMinutes: z.number().int().min(0, 'Não pode ser negativa').max(1439, 'Pausa longa demais'),
    odometerStart: z.number().min(0).max(9_999_999, 'Confira o hodômetro').nullable(),
    odometerEnd: z.number().min(0).max(9_999_999, 'Confira o hodômetro').nullable(),
    /** Elétrico: leituras do medidor (opcionais) */
    meterStartKwh: meterKwh,
    meterEndKwh: meterKwh,
    earnings: z
      .array(
        z.object({
          platformId: z.string().min(1, 'Escolha a plataforma'),
          amountCents: moneyCents,
          tipsCents: moneyCents,
          bonusCents: moneyCents,
          trips: z.number().int().min(0).max(500, 'Mais de 500? Confira').nullable(),
        }),
      )
      .min(1, 'Adicione pelo menos uma plataforma'),
    expenses: z.array(
      z.object({
        category: z.enum(EXPENSE_CATEGORIES as [ExpenseCategory, ...ExpenseCategory[]]),
        amountCents: z.number().int().min(1, 'Informe o valor').max(10_000_000, 'Valor muito alto'),
        description: z.string().trim().max(80, 'Use até 80 caracteres'),
      }),
    ),
    notes: z.string().trim().max(280, 'Use até 280 caracteres'),
  })
  .superRefine((v, ctx) => {
    if (v.odometerStart === null) ctx.addIssue({ code: 'custom', path: ['odometerStart'], message: 'Informe o km inicial' })
    if (v.odometerEnd === null) ctx.addIssue({ code: 'custom', path: ['odometerEnd'], message: 'Informe o km final' })
    if (v.odometerStart !== null && v.odometerEnd !== null) {
      if (v.odometerEnd < v.odometerStart) {
        ctx.addIssue({ code: 'custom', path: ['odometerEnd'], message: 'O km final não pode ser menor que o inicial' })
      } else if (v.odometerEnd - v.odometerStart > 2000) {
        ctx.addIssue({ code: 'custom', path: ['odometerEnd'], message: 'Mais de 2.000 km numa jornada? Confira' })
      }
    }

    // Sem o kWh final, vale a estimativa pelos km
    if (v.meterEndKwh !== null) {
      if (v.meterStartKwh === null) {
        ctx.addIssue({ code: 'custom', path: ['meterStartKwh'], message: 'Informe o kWh inicial' })
      } else if (v.meterEndKwh <= v.meterStartKwh) {
        ctx.addIssue({ code: 'custom', path: ['meterEndKwh'], message: 'O final precisa ser maior que o inicial' })
      } else if (v.meterEndKwh - v.meterStartKwh > 300) {
        ctx.addIssue({ code: 'custom', path: ['meterEndKwh'], message: 'Mais de 300 kWh numa jornada? Confira' })
      }
    }

    if (TIME.test(v.startTime) && TIME.test(v.endTime) && /^\d{4}-\d{2}-\d{2}$/.test(v.workDate)) {
      if (v.startTime === v.endTime) {
        ctx.addIssue({ code: 'custom', path: ['endTime'], message: 'Início e fim estão iguais' })
      } else {
        const { startedAt, endedAt } = shiftInstants(v.workDate, v.startTime, v.endTime)
        const minutes = (endedAt.getTime() - startedAt.getTime()) / 60_000
        if (v.breakMinutes >= minutes) {
          ctx.addIssue({ code: 'custom', path: ['breakMinutes'], message: 'A pausa é maior que a jornada' })
        }
      }
    }

    const seen = new Map<string, number>()
    v.earnings.forEach((e, i) => {
      if (!e.platformId) return
      if (seen.has(e.platformId)) {
        ctx.addIssue({ code: 'custom', path: ['earnings', i, 'platformId'], message: 'Plataforma repetida: some os valores numa linha só' })
      }
      seen.set(e.platformId, i)
    })
  })

export type ShiftFormValues = z.input<typeof shiftFormSchema>

/** Hora atual arredondada para baixo em 5 minutos: "17:40". */
function nowRounded(): string {
  const d = new Date()
  const minutes = Math.floor(d.getMinutes() / 5) * 5
  return `${String(d.getHours()).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

export function newShiftForm(input: { workDate: ISODate; vehicleId: string; platformId: string; odometerStart: number | null }): ShiftFormValues {
  const now = nowRounded()
  return {
    vehicleId: input.vehicleId,
    workDate: input.workDate,
    startTime: '08:00',
    // Quem registra depois de trabalhar costuma ter acabado agora
    endTime: now > '09:00' ? now : '18:00',
    breakMinutes: 0,
    odometerStart: input.odometerStart,
    odometerEnd: null,
    meterStartKwh: null,
    meterEndKwh: null,
    earnings: [{ platformId: input.platformId, amountCents: 0, tipsCents: 0, bonusCents: 0, trips: null }],
    expenses: [],
    notes: '',
  }
}

const toCents = (reais: number) => Math.round(reais * 100)

export function shiftToForm(shift: Shift): ShiftFormValues {
  return {
    vehicleId: shift.vehicleId,
    workDate: shift.workDate,
    startTime: toLocalTime(shift.startedAt),
    endTime: toLocalTime(shift.endedAt),
    breakMinutes: shift.breakMinutes,
    odometerStart: shift.odometerStart,
    odometerEnd: shift.odometerEnd,
    meterStartKwh: shift.params?.meterStartKwh ?? null,
    meterEndKwh: shift.params?.meterEndKwh ?? null,
    earnings: shift.earnings.map((e) => ({
      platformId: e.platformId,
      amountCents: toCents(e.amount),
      tipsCents: toCents(e.tips),
      bonusCents: toCents(e.bonus),
      trips: e.trips,
    })),
    expenses: shift.expenses.map((x) => ({ category: x.category, amountCents: toCents(x.amount), description: x.description ?? '' })),
    notes: shift.notes ?? '',
  }
}

/**
 * Nos elétricos, as leituras do medidor vão junto na foto de custos da jornada, com o gasto (final − inicial).
 * Sem o kWh final, vale a estimativa pelos km.
 */
export function withMeterReadings(snapshot: CostSnapshot, startKwh: number | null, endKwh: number | null): CostSnapshot {
  const params = snapshot.params
  if (params?.powertrain !== 'electric') return snapshot
  // Jornada salva quando o campo era só o total: sem leituras novas, o total fica como está
  if (startKwh === null && endKwh === null && params.meterStartKwh == null && params.meterEndKwh == null) return snapshot
  const measuredKwh = startKwh !== null && endKwh !== null && endKwh > startKwh ? Math.round((endKwh - startKwh) * 100) / 100 : null
  return { ...snapshot, params: { ...params, meterStartKwh: startKwh, meterEndKwh: endKwh, measuredKwh } }
}

/** Fatos para a prévia ao vivo; null enquanto faltam horário ou hodômetro válidos. */
export function toShiftFacts(v: ShiftFormValues, snapshot: CostSnapshot | null): ShiftFacts | null {
  if (!snapshot || !TIME.test(v.startTime) || !TIME.test(v.endTime) || !/^\d{4}-\d{2}-\d{2}$/.test(v.workDate)) return null
  const { startedAt, endedAt } = shiftInstants(v.workDate, v.startTime, v.endTime)
  const start = v.odometerStart ?? 0
  const end = v.odometerEnd !== null && v.odometerEnd >= start ? v.odometerEnd : start
  return {
    startedAt,
    endedAt,
    breakMinutes: Math.max(0, v.breakMinutes || 0),
    odometerStart: start,
    odometerEnd: end,
    energyCostPerKm: snapshot.energyCostPerKm,
    params: snapshot.params,
    earnings: v.earnings.map((e) => ({
      platformId: e.platformId,
      amount: e.amountCents / 100,
      tips: e.tipsCents / 100,
      bonus: e.bonusCents / 100,
      trips: e.trips,
    })),
    expenses: v.expenses.map((x) => ({ category: x.category, amount: x.amountCents / 100 })),
  }
}

/** Formulário validado + foto de custos → argumentos da função save_shift. */
export function toSavePayload(v: ShiftFormValues, snapshot: CostSnapshot, id?: string) {
  const { startedAt, endedAt } = shiftInstants(v.workDate, v.startTime, v.endTime)
  return {
    p_shift: {
      id: id ?? null,
      vehicle_id: v.vehicleId,
      work_date: v.workDate,
      started_at: startedAt.toISOString(),
      ended_at: endedAt.toISOString(),
      break_minutes: v.breakMinutes,
      odometer_start: v.odometerStart,
      odometer_end: v.odometerEnd,
      // Sem as reservas por km (saíram em 29/10/2026): save_shift grava zero nas colunas antigas
      energy_cost_per_km: snapshot.energyCostPerKm,
      cost_snapshot: snapshot.params ?? {},
      notes: v.notes.trim() || null,
    },
    p_earnings: v.earnings.map((e) => ({
      platform_id: e.platformId,
      amount: e.amountCents / 100,
      tips: e.tipsCents / 100,
      bonus: e.bonusCents / 100,
      trips: e.trips,
    })),
    p_expenses: v.expenses.map((x) => ({ category: x.category, amount: x.amountCents / 100, description: x.description.trim() || null })),
  }
}
