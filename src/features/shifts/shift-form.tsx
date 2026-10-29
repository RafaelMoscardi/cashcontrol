import { zodResolver } from '@hookform/resolvers/zod'
import { CalendarClock, ChevronDown, Gauge, Plus, Receipt, RefreshCw, Trash, Wallet, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type * as React from 'react'
import { Controller, useFieldArray, useForm, useWatch, type Control, type UseFormRegister } from 'react-hook-form'
import { IntegerInput } from '@/components/app/decimal-input'
import { FormField } from '@/components/app/form-field'
import { MoneyInput } from '@/components/app/money-input'
import { SectionCard } from '@/components/app/section-card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { buildCostSnapshot } from '@/domain/energy'
import { EXPENSE_CATEGORIES } from '@/domain/expenses'
import { computeShift } from '@/domain/shift'
import type { CostSnapshot, Platform, Shift, Vehicle } from '@/domain/types'
import { formatReais } from '@/lib/format'
import { reportInvalid } from '@/lib/form-errors'
import { cn } from '@/lib/utils'
import { useLastOdometer } from './api'
import { EXPENSE_ICON, EXPENSE_LABEL, EXPENSE_NOTE } from './labels'
import { shiftFormSchema, toShiftFacts, type ShiftFormValues } from './schema'
import { ShiftPreview } from './shift-preview'

const BREAK_PRESETS = [0, 15, 30, 60]

interface ShiftFormProps {
  defaultValues: ShiftFormValues
  vehicles: Vehicle[]
  platforms: Platform[]
  /** Jornada original, na edição */
  original?: Shift
  onSubmit: (values: ShiftFormValues, snapshot: CostSnapshot) => Promise<void>
  secondaryActions?: React.ReactNode
}

function snapshotOf(shift: Shift): CostSnapshot {
  return {
    energyCostPerKm: shift.energyCostPerKm,
    maintenancePerKm: shift.maintenancePerKm,
    tiresPerKm: shift.tiresPerKm,
    depreciationPerKm: shift.depreciationPerKm,
    params: shift.params,
  }
}

function safeSnapshot(vehicle: Vehicle | undefined): CostSnapshot | null {
  if (!vehicle) return null
  try {
    return buildCostSnapshot(vehicle)
  } catch {
    return null
  }
}

export function ShiftForm({ defaultValues, vehicles, platforms, original, onSubmit, secondaryActions }: ShiftFormProps) {
  const { control, register, handleSubmit, setValue, getFieldState, formState } = useForm<ShiftFormValues>({
    resolver: zodResolver(shiftFormSchema),
    defaultValues,
    mode: 'onTouched',
  })
  const errors = formState.errors
  const values = useWatch({ control }) as ShiftFormValues
  const earnings = useFieldArray({ control, name: 'earnings' })
  const expenses = useFieldArray({ control, name: 'expenses' })
  const [useCurrentCosts, setUseCurrentCosts] = useState(false)

  const vehicle = vehicles.find((v) => v.id === values.vehicleId)
  const keepsOriginal = Boolean(original && !useCurrentCosts && original.vehicleId === values.vehicleId)
  const snapshot = useMemo(
    () => (keepsOriginal && original ? snapshotOf(original) : safeSnapshot(vehicle)),
    [keepsOriginal, original, vehicle],
  )
  const current = safeSnapshot(vehicle)
  const result = useMemo(() => {
    const facts = toShiftFacts(values, snapshot)
    return facts ? computeShift(facts) : null
  }, [values, snapshot])

  // Nova jornada: hodômetro inicial = onde a última jornada deste veículo terminou
  const lastOdometer = useLastOdometer(original ? undefined : values.vehicleId)
  useEffect(() => {
    if (original || lastOdometer.data === undefined || lastOdometer.data === null) return
    if (!getFieldState('odometerStart').isDirty) setValue('odometerStart', lastOdometer.data)
  }, [original, lastOdometer.data, getFieldState, setValue])

  const usedPlatforms = new Set(values.earnings.map((e) => e.platformId))
  const nextPlatform = platforms.find((p) => !p.archivedAt && !usedPlatforms.has(p.id))
  const snapshotChanged =
    keepsOriginal && current && snapshot && Math.abs(current.energyCostPerKm + current.maintenancePerKm + current.tiresPerKm + current.depreciationPerKm - (snapshot.energyCostPerKm + snapshot.maintenancePerKm + snapshot.tiresPerKm + snapshot.depreciationPerKm)) > 0.00001

  const submit = handleSubmit(async (valid) => {
    if (!snapshot) return
    await onSubmit(valid as ShiftFormValues, snapshot)
  }, reportInvalid)

  return (
    <form onSubmit={submit} noValidate className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="flex min-w-0 flex-col gap-4">
        <SectionCard title="Quando" icon={CalendarClock}>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <FormField label="Data" htmlFor="workDate" error={errors.workDate?.message} className="col-span-2 sm:col-span-1">
              <Input id="workDate" type="date" aria-invalid={!!errors.workDate} {...register('workDate')} />
            </FormField>
            <FormField label="Início" htmlFor="startTime" error={errors.startTime?.message}>
              <Input id="startTime" type="time" aria-invalid={!!errors.startTime} {...register('startTime')} />
            </FormField>
            <FormField label="Fim" htmlFor="endTime" error={errors.endTime?.message}>
              <Input id="endTime" type="time" aria-invalid={!!errors.endTime} {...register('endTime')} />
            </FormField>
          </div>
          <Controller
            control={control}
            name="breakMinutes"
            render={({ field }) => (
              <FormField
                label="Pausas"
                htmlFor="breakMinutes"
                description="Almoço e paradas longas não contam como hora trabalhada."
                error={errors.breakMinutes?.message}
                className="mt-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  {BREAK_PRESETS.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => field.onChange(m)}
                      aria-pressed={field.value === m}
                      className={cn(
                        'touch-target h-9 rounded-full border px-3.5 text-sm font-medium outline-none transition-[background-color,border-color,color,transform] duration-150 ease-snappy active:scale-[0.96]',
                        'focus-visible:ring-3 focus-visible:ring-ring/50',
                        field.value === m ? 'border-primary/70 bg-primary/15 text-foreground' : 'border-input text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {m === 0 ? 'Sem pausa' : `${m} min`}
                    </button>
                  ))}
                  <IntegerInput
                    id="breakMinutes"
                    value={field.value}
                    onValueChange={(v) => field.onChange(v ?? 0)}
                    onBlur={field.onBlur}
                    suffix="min"
                    className="h-9 w-28 rounded-full"
                    aria-label="Minutos de pausa"
                    aria-invalid={!!errors.breakMinutes}
                  />
                </div>
              </FormField>
            )}
          />
        </SectionCard>

        <SectionCard title="Veículo e hodômetro" icon={Gauge}>
          <div className="flex flex-col gap-4">
            <Controller
              control={control}
              name="vehicleId"
              render={({ field }) => (
                <FormField label="Veículo" htmlFor="vehicleId" error={errors.vehicleId?.message}>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="vehicleId" className="w-full" aria-invalid={!!errors.vehicleId}>
                      <SelectValue placeholder="Escolha o veículo" />
                    </SelectTrigger>
                    <SelectContent>
                      {vehicles.map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.name}
                          {v.archivedAt ? ' (arquivado)' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <Controller
                control={control}
                name="odometerStart"
                render={({ field }) => (
                  <FormField
                    label="Km inicial"
                    htmlFor="odometerStart"
                    description={!original && lastOdometer.data != null ? 'Onde a última jornada terminou.' : undefined}
                    error={errors.odometerStart?.message}
                  >
                    <IntegerInput
                      id="odometerStart"
                      grouped
                      value={field.value}
                      onValueChange={field.onChange}
                      onBlur={field.onBlur}
                      placeholder="45.000"
                      aria-invalid={!!errors.odometerStart}
                    />
                  </FormField>
                )}
              />
              <Controller
                control={control}
                name="odometerEnd"
                render={({ field }) => (
                  <FormField label="Km final" htmlFor="odometerEnd" error={errors.odometerEnd?.message}>
                    <IntegerInput
                      id="odometerEnd"
                      grouped
                      value={field.value}
                      onValueChange={field.onChange}
                      onBlur={field.onBlur}
                      placeholder="45.120"
                      aria-invalid={!!errors.odometerEnd}
                    />
                  </FormField>
                )}
              />
            </div>
            {original && (
              <div className="rounded-xl bg-white/[0.03] px-3.5 py-3 text-[0.8125rem] text-muted-foreground">
                {keepsOriginal ? (
                  <>
                    Custos da época do registro: <span className="text-foreground tabular-nums">{formatReais(snapshot?.energyCostPerKm ?? 0, 4)}/km</span> de energia.
                    {snapshotChanged && (
                      <Button type="button" variant="link" size="sm" className="touch-target h-auto px-0 pl-1" onClick={() => setUseCurrentCosts(true)}>
                        <RefreshCw data-icon="inline-start" />
                        Usar a configuração atual do veículo
                      </Button>
                    )}
                  </>
                ) : (
                  <>Usando a configuração atual do veículo ({formatReais(snapshot?.energyCostPerKm ?? 0, 4)}/km de energia).</>
                )}
              </div>
            )}
            {!snapshot && vehicle && (
              <p className="text-sm text-negative">Complete o consumo e o preço do combustível no cadastro do veículo.</p>
            )}
          </div>
        </SectionCard>

        <SectionCard
          title="Ganhos"
          description="Use o valor que a plataforma pagou a você, já sem a taxa dela (o que aparece como “ganhos” no app)."
          icon={Wallet}
        >
          <div className="flex flex-col gap-3">
            {earnings.fields.map((row, index) => (
              <EarningRow
                key={row.id}
                index={index}
                control={control}
                platforms={platforms}
                usedPlatforms={usedPlatforms}
                errors={errors.earnings?.[index]}
                canRemove={earnings.fields.length > 1}
                onRemove={() => earnings.remove(index)}
              />
            ))}
            {errors.earnings?.root?.message && <p className="text-sm text-negative">{errors.earnings.root.message}</p>}
            {nextPlatform && (
              <Button
                type="button"
                variant="outline"
                className="self-start"
                onClick={() => earnings.append({ platformId: nextPlatform.id, amountCents: 0, tipsCents: 0, bonusCents: 0, trips: null })}
              >
                <Plus data-icon="inline-start" />
                Adicionar plataforma
              </Button>
            )}
          </div>
        </SectionCard>

        <SectionCard
          title="Despesas da jornada"
          description="Pedágio, estacionamento, lanche, abastecimento… Opcional."
          icon={Receipt}
        >
          <div className="flex flex-col gap-3">
            {expenses.fields.map((row, index) => (
              <ExpenseRow
                key={row.id}
                index={index}
                control={control}
                register={register}
                category={values.expenses[index]?.category}
                errors={errors.expenses?.[index]}
                onRemove={() => expenses.remove(index)}
              />
            ))}
            <Button
              type="button"
              variant="outline"
              className="self-start"
              onClick={() => expenses.append({ category: 'toll', amountCents: 0, description: '' })}
            >
              <Plus data-icon="inline-start" />
              Adicionar despesa
            </Button>
          </div>
        </SectionCard>

        <SectionCard title="Observações">
          <Textarea
            aria-label="Observações"
            placeholder="Ex.: chuva, evento no estádio, dinâmica alta à noite"
            maxLength={280}
            className="min-h-20 rounded-xl px-3.5"
            {...register('notes')}
          />
          {errors.notes?.message && <p className="mt-1.5 text-sm text-negative">{errors.notes.message}</p>}
        </SectionCard>
      </div>

      <div className="flex flex-col gap-4 lg:sticky lg:top-6">
        <ShiftPreview result={result} params={snapshot?.params ?? null} />
        <Button type="submit" size="lg" disabled={formState.isSubmitting || !snapshot} className="w-full">
          {formState.isSubmitting && <Spinner data-icon="inline-start" />}
          {original ? 'Salvar alterações' : 'Salvar jornada'}
        </Button>
        {secondaryActions}
      </div>
    </form>
  )
}

type FormControl = Control<ShiftFormValues>
type FormRegister = UseFormRegister<ShiftFormValues>

interface EarningRowProps {
  index: number
  control: FormControl
  platforms: Platform[]
  usedPlatforms: Set<string>
  errors?: { platformId?: { message?: string }; amountCents?: { message?: string }; trips?: { message?: string } }
  canRemove: boolean
  onRemove: () => void
}

function EarningRow({ index, control, platforms, usedPlatforms, errors, canRemove, onRemove }: EarningRowProps) {
  const row = useWatch({ control, name: `earnings.${index}` })
  const [open, setOpen] = useState(() => Boolean(row && (row.tipsCents || row.bonusCents || row.trips)))
  const platform = platforms.find((p) => p.id === row?.platformId)

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3">
      <div className="flex items-start gap-2">
        <div className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2">
          <Controller
            control={control}
            name={`earnings.${index}.platformId`}
            render={({ field }) => (
              <FormField label="Plataforma" htmlFor={`earning-${index}-platform`} error={errors?.platformId?.message}>
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id={`earning-${index}-platform`} className="w-full" aria-invalid={!!errors?.platformId}>
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: platform?.color ?? 'transparent' }} />
                      <SelectValue placeholder="Escolha" />
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    {platforms
                      .filter((p) => !p.archivedAt || p.id === field.value)
                      .map((p) => (
                        <SelectItem key={p.id} value={p.id} disabled={p.id !== field.value && usedPlatforms.has(p.id)}>
                          {p.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </FormField>
            )}
          />
          <Controller
            control={control}
            name={`earnings.${index}.amountCents`}
            render={({ field }) => (
              <FormField label="Valor recebido" htmlFor={`earning-${index}-amount`} error={errors?.amountCents?.message}>
                <MoneyInput id={`earning-${index}-amount`} value={field.value} onValueChange={field.onChange} onBlur={field.onBlur} />
              </FormField>
            )}
          />
        </div>
        {canRemove && (
          <Button type="button" variant="ghost" size="icon-sm" className="touch-target mt-6 shrink-0 text-muted-foreground" onClick={onRemove} aria-label="Remover plataforma">
            <X />
          </Button>
        )}
      </div>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="-mb-2 flex min-h-11 items-center gap-1 rounded-md text-[0.8125rem] text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <ChevronDown className={cn('size-4 transition-transform duration-200 ease-snappy', open && 'rotate-180')} />
        Gorjetas, bônus e corridas
      </button>
      {open && (
        <div className="mt-3 grid grid-cols-3 gap-2">
          <Controller
            control={control}
            name={`earnings.${index}.tipsCents`}
            render={({ field }) => (
              <FormField label="Gorjetas" htmlFor={`earning-${index}-tips`}>
                <MoneyInput id={`earning-${index}-tips`} value={field.value} onValueChange={field.onChange} onBlur={field.onBlur} />
              </FormField>
            )}
          />
          <Controller
            control={control}
            name={`earnings.${index}.bonusCents`}
            render={({ field }) => (
              <FormField label="Bônus" htmlFor={`earning-${index}-bonus`}>
                <MoneyInput id={`earning-${index}-bonus`} value={field.value} onValueChange={field.onChange} onBlur={field.onBlur} />
              </FormField>
            )}
          />
          <Controller
            control={control}
            name={`earnings.${index}.trips`}
            render={({ field }) => (
              <FormField label="Corridas" htmlFor={`earning-${index}-trips`} error={errors?.trips?.message}>
                <IntegerInput id={`earning-${index}-trips`} value={field.value} onValueChange={field.onChange} onBlur={field.onBlur} placeholder="0" />
              </FormField>
            )}
          />
        </div>
      )}
    </div>
  )
}

interface ExpenseRowProps {
  index: number
  control: FormControl
  register: FormRegister
  category: ShiftFormValues['expenses'][number]['category'] | undefined
  errors?: { amountCents?: { message?: string }; description?: { message?: string } }
  onRemove: () => void
}

function ExpenseRow({ index, control, register, category, errors, onRemove }: ExpenseRowProps) {
  const note = category ? EXPENSE_NOTE[category] : undefined
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3">
      <div className="flex items-end gap-2">
        <Controller
          control={control}
          name={`expenses.${index}.category`}
          render={({ field }) => (
            <FormField label="Categoria" htmlFor={`expense-${index}-category`} className="min-w-0 flex-1">
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id={`expense-${index}-category`} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map((c) => {
                    const Icon = EXPENSE_ICON[c]
                    return (
                      <SelectItem key={c} value={c}>
                        <Icon className="size-4 text-muted-foreground" />
                        {EXPENSE_LABEL[c]}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </FormField>
          )}
        />
        <Button type="button" variant="ghost" size="icon" className="shrink-0 text-muted-foreground" onClick={onRemove} aria-label="Remover despesa">
          <Trash />
        </Button>
      </div>
      <div className="mt-2 grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)] gap-2">
        <Controller
          control={control}
          name={`expenses.${index}.amountCents`}
          render={({ field }) => (
            <FormField label="Valor" htmlFor={`expense-${index}-amount`} error={errors?.amountCents?.message}>
              <MoneyInput id={`expense-${index}-amount`} value={field.value} onValueChange={field.onChange} onBlur={field.onBlur} aria-invalid={!!errors?.amountCents} />
            </FormField>
          )}
        />
        <FormField label="Descrição (opcional)" htmlFor={`expense-${index}-description`} error={errors?.description?.message}>
          <Input id={`expense-${index}-description`} placeholder="Ex.: posto da BR" maxLength={80} {...register(`expenses.${index}.description`)} />
        </FormField>
      </div>
      {note && <p className="mt-2 text-[0.8125rem] leading-snug text-muted-foreground">{note}</p>}
    </div>
  )
}
