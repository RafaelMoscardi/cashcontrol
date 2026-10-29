import { zodResolver } from '@hookform/resolvers/zod'
import { BatteryCharging, Bike, Car, CarFront, Fuel, Gauge, Leaf, PlugZap, Wallet, Wrench } from 'lucide-react'
import type * as React from 'react'
import { Controller, useForm, useWatch, type Control } from 'react-hook-form'
import { ChoiceCards, type Choice } from '@/components/app/choice-cards'
import { DecimalInput, IntegerInput } from '@/components/app/decimal-input'
import { FormField } from '@/components/app/form-field'
import { MoneyInput } from '@/components/app/money-input'
import { SectionCard } from '@/components/app/section-card'
import { SegmentedControl } from '@/components/app/segmented-control'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { energyCostPerKm, fuelUnit, usesElectricity, usesFuel } from '@/domain/energy'
import { monthlyFixedCost } from '@/domain/fixed-costs'
import type { FuelType, Ownership, Powertrain, VehicleKind } from '@/domain/types'
import { formatReais } from '@/lib/format'
import { reportInvalid } from '@/lib/form-errors'
import { FUEL_LABEL, OWNERSHIP_LABEL, POWERTRAIN_DESCRIPTION, POWERTRAIN_LABEL } from './labels'
import { vehicleFormSchema, type VehicleFormValues } from './schema'

const KIND_CHOICES: Choice<VehicleKind>[] = [
  { value: 'car', label: 'Carro', icon: Car },
  { value: 'motorcycle', label: 'Moto', icon: Bike },
]

const POWERTRAIN_ICON: Record<Powertrain, React.ComponentType<{ className?: string }>> = {
  combustion: Fuel,
  hybrid: Leaf,
  plugin_hybrid: PlugZap,
  electric: BatteryCharging,
}

const powertrainChoices = (kind: VehicleKind): Choice<Powertrain>[] =>
  (kind === 'motorcycle' ? (['combustion', 'electric'] as const) : (['combustion', 'hybrid', 'plugin_hybrid', 'electric'] as const)).map(
    (value) => ({
      value,
      label: kind === 'motorcycle' && value === 'electric' ? 'Elétrica' : POWERTRAIN_LABEL[value],
      description: POWERTRAIN_DESCRIPTION[value],
      icon: POWERTRAIN_ICON[value],
    }),
  )

const OWNERSHIP_CHOICES: Choice<Ownership>[] = (['owned', 'financed', 'rented', 'other'] as const).map((value) => ({
  value,
  label: OWNERSHIP_LABEL[value],
}))

const fuelsFor = (kind: VehicleKind): FuelType[] => (kind === 'motorcycle' ? ['gasoline', 'ethanol'] : ['gasoline', 'ethanol', 'diesel', 'cng'])

interface VehicleFormProps {
  defaultValues: VehicleFormValues
  onSubmit: (values: VehicleFormValues) => Promise<void>
  submitLabel: string
  /** Botões extras ao lado de salvar (arquivar, excluir) */
  secondaryActions?: React.ReactNode
}

export function VehicleForm({ defaultValues, onSubmit, submitLabel, secondaryActions }: VehicleFormProps) {
  const { control, register, handleSubmit, setValue, getValues, formState } = useForm<VehicleFormValues>({
    resolver: zodResolver(vehicleFormSchema),
    defaultValues,
    mode: 'onTouched',
  })
  const errors = formState.errors
  const values = useWatch({ control }) as VehicleFormValues
  const { kind, powertrain, fuelType, ownership } = values
  const unit = fuelUnit(fuelType)

  let energyPerKm: number | null = null
  try {
    energyPerKm = energyCostPerKm({
      powertrain,
      fuelType: usesFuel(powertrain) ? fuelType : null,
      fuelKmPerUnit: values.fuelKmPerUnit,
      fuelPricePerUnit: values.fuelPricePerUnit,
      electricKmPerKwh: values.electricKmPerKwh,
      electricityPricePerKwh: values.electricityPricePerKwh,
      electricSharePct: values.electricSharePct,
    })
  } catch {
    energyPerKm = null
  }
  const reservesPerKm = (values.maintenancePerKm ?? 0) + (values.tiresPerKm ?? 0) + (ownership === 'rented' ? 0 : (values.depreciationPerKm ?? 0))
  const monthly = monthlyFixedCost({
    rentAmount: ownership === 'rented' ? values.rentCents / 100 : 0,
    rentPeriod: values.rentPeriod,
    insuranceMonthly: values.insuranceCents / 100,
    taxesYearly: values.taxesYearlyCents / 100,
    otherFixedMonthly: values.otherFixedCents / 100,
  })

  const changeKind = (next: VehicleKind) => {
    setValue('kind', next, { shouldDirty: true })
    if (next === 'motorcycle') {
      const current = getValues('powertrain')
      if (current === 'hybrid' || current === 'plugin_hybrid') setValue('powertrain', 'combustion', { shouldDirty: true })
      if (!fuelsFor('motorcycle').includes(getValues('fuelType'))) setValue('fuelType', 'gasoline', { shouldDirty: true })
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit, reportInvalid)} noValidate className="flex flex-col gap-4">
      <SectionCard title="Veículo" icon={CarFront}>
        <div className="flex flex-col gap-4">
          <FormField label="Nome" htmlFor="name" description="Como você chama o veículo no dia a dia." error={errors.name?.message}>
            <Input id="name" placeholder="Ex.: Onix prata" autoComplete="off" aria-invalid={!!errors.name} {...register('name')} />
          </FormField>
          <FormField label="Tipo">
            <ChoiceCards aria-label="Tipo de veículo" value={kind} onValueChange={changeKind} choices={KIND_CHOICES} />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Modelo (opcional)" htmlFor="model" error={errors.model?.message}>
              <Input id="model" placeholder="Ex.: Chevrolet Onix 1.0" autoComplete="off" {...register('model')} />
            </FormField>
            <FormField label="Placa (opcional)" htmlFor="plate" error={errors.plate?.message}>
              <Input id="plate" placeholder="ABC1D23" autoCapitalize="characters" autoComplete="off" className="uppercase" {...register('plate')} />
            </FormField>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Consumo e energia"
        description="Com isso calculamos o combustível ou a energia de cada jornada pelos km rodados."
        icon={Gauge}
      >
        <div className="flex flex-col gap-4">
          <Controller
            control={control}
            name="powertrain"
            render={({ field }) => (
              <FormField label="Motorização" error={errors.powertrain?.message}>
                <ChoiceCards
                  aria-label="Motorização"
                  value={field.value}
                  onValueChange={field.onChange}
                  choices={powertrainChoices(kind)}
                  columns={kind === 'motorcycle' ? 2 : 4}
                />
              </FormField>
            )}
          />

          {usesFuel(powertrain) && (
            <div className="grid gap-4 sm:grid-cols-3">
              <Controller
                control={control}
                name="fuelType"
                render={({ field }) => (
                  <FormField label="Combustível" htmlFor="fuelType">
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="fuelType" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {fuelsFor(kind).map((f) => (
                          <SelectItem key={f} value={f}>
                            {FUEL_LABEL[f]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormField>
                )}
              />
              <Controller
                control={control}
                name="fuelKmPerUnit"
                render={({ field }) => (
                  <FormField label="Consumo médio" htmlFor="fuelKmPerUnit" error={errors.fuelKmPerUnit?.message}>
                    <DecimalInput
                      id="fuelKmPerUnit"
                      value={field.value}
                      onValueChange={field.onChange}
                      onBlur={field.onBlur}
                      suffix={`km/${unit}`}
                      placeholder={kind === 'motorcycle' ? '35' : '11,5'}
                      maxFractionDigits={2}
                      aria-invalid={!!errors.fuelKmPerUnit}
                    />
                  </FormField>
                )}
              />
              <Controller
                control={control}
                name="fuelPricePerUnit"
                render={({ field }) => (
                  <FormField label={`Preço do ${unit === 'm³' ? 'm³' : 'litro'}`} htmlFor="fuelPricePerUnit" error={errors.fuelPricePerUnit?.message}>
                    <DecimalInput
                      id="fuelPricePerUnit"
                      value={field.value}
                      onValueChange={field.onChange}
                      onBlur={field.onBlur}
                      prefix="R$"
                      suffix={`/${unit}`}
                      placeholder="6,29"
                      maxFractionDigits={3}
                      aria-invalid={!!errors.fuelPricePerUnit}
                    />
                  </FormField>
                )}
              />
            </div>
          )}

          {usesElectricity(powertrain) && (
            <div className="grid gap-4 sm:grid-cols-3">
              <Controller
                control={control}
                name="electricKmPerKwh"
                render={({ field }) => (
                  <FormField label="Consumo elétrico" htmlFor="electricKmPerKwh" error={errors.electricKmPerKwh?.message}>
                    <DecimalInput
                      id="electricKmPerKwh"
                      value={field.value}
                      onValueChange={field.onChange}
                      onBlur={field.onBlur}
                      suffix="km/kWh"
                      placeholder={kind === 'motorcycle' ? '25' : '6,5'}
                      maxFractionDigits={2}
                      aria-invalid={!!errors.electricKmPerKwh}
                    />
                  </FormField>
                )}
              />
              <Controller
                control={control}
                name="electricityPricePerKwh"
                render={({ field }) => (
                  <FormField
                    label="Custo médio do kWh"
                    htmlFor="electricityPricePerKwh"
                    description="Média entre casa e eletroposto."
                    error={errors.electricityPricePerKwh?.message}
                  >
                    <DecimalInput
                      id="electricityPricePerKwh"
                      value={field.value}
                      onValueChange={field.onChange}
                      onBlur={field.onBlur}
                      prefix="R$"
                      suffix="/kWh"
                      placeholder="0,95"
                      maxFractionDigits={3}
                      aria-invalid={!!errors.electricityPricePerKwh}
                    />
                  </FormField>
                )}
              />
              {powertrain === 'plugin_hybrid' && (
                <Controller
                  control={control}
                  name="electricSharePct"
                  render={({ field }) => (
                    <FormField
                      label="Km rodados no elétrico"
                      htmlFor="electricSharePct"
                      description="O resto é no motor a combustão."
                      error={errors.electricSharePct?.message}
                    >
                      <IntegerInput
                        id="electricSharePct"
                        value={field.value}
                        onValueChange={(v) => field.onChange(v === null ? null : Math.min(v, 100))}
                        onBlur={field.onBlur}
                        suffix="%"
                        aria-invalid={!!errors.electricSharePct}
                      />
                    </FormField>
                  )}
                />
              )}
            </div>
          )}

          <ResultLine label="Custo de energia" value={energyPerKm === null ? 'preencha consumo e preço' : `${formatReais(energyPerKm, 4)}/km`} />
        </div>
      </SectionCard>

      <SectionCard
        title="Reservas por km"
        description="Quanto separar a cada km para o desgaste. Entra no lucro real; quando você paga a manutenção, o dinheiro sai daqui."
        icon={Wrench}
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <PerKmField
            control={control}
            name="maintenancePerKm"
            label="Manutenção"
            description="Revisões, óleo, freios. Ex.: R$ 900 a cada 10.000 km = R$ 0,09."
            error={errors.maintenancePerKm?.message}
          />
          <PerKmField
            control={control}
            name="tiresPerKm"
            label="Pneus"
            description="Ex.: jogo de R$ 1.600 que dura 40.000 km = R$ 0,04."
            error={errors.tiresPerKm?.message}
          />
          {ownership !== 'rented' && (
            <PerKmField
              control={control}
              name="depreciationPerKm"
              label="Depreciação"
              description="Quanto o veículo perde de valor por km. Ex.: R$ 12.000 em 100.000 km = R$ 0,12."
              error={errors.depreciationPerKm?.message}
            />
          )}
        </div>
        <ResultLine className="mt-4" label="Reserva total" value={`${formatReais(reservesPerKm, 4)}/km`} />
      </SectionCard>

      <SectionCard
        title="Custos fixos"
        description="Valores que você paga trabalhando ou não. Entram no lucro real divididos pelos dias."
        icon={Wallet}
      >
        <div className="flex flex-col gap-4">
          <Controller
            control={control}
            name="ownership"
            render={({ field }) => (
              <FormField label="Situação do veículo">
                <ChoiceCards aria-label="Situação do veículo" value={field.value} onValueChange={field.onChange} choices={OWNERSHIP_CHOICES} columns={4} />
              </FormField>
            )}
          />

          {ownership === 'rented' && (
            <div className="grid gap-4 sm:grid-cols-2">
              <MoneyField control={control} name="rentCents" label="Aluguel" error={errors.rentCents?.message} />
              <Controller
                control={control}
                name="rentPeriod"
                render={({ field }) => (
                  <FormField label="Cobrança">
                    <SegmentedControl
                      aria-label="Período do aluguel"
                      value={field.value}
                      onValueChange={field.onChange}
                      options={[
                        { value: 'week', label: 'Por semana' },
                        { value: 'month', label: 'Por mês' },
                      ]}
                      className="h-11 items-center"
                    />
                  </FormField>
                )}
              />
            </div>
          )}

          {ownership === 'financed' && (
            <MoneyField
              control={control}
              name="financingCents"
              label="Parcela do financiamento (por mês)"
              description="Só entra no fluxo de caixa: no lucro real, o desgaste do veículo já está na depreciação."
              error={errors.financingCents?.message}
            />
          )}

          <div className="grid gap-4 sm:grid-cols-3">
            <MoneyField control={control} name="insuranceCents" label="Seguro (por mês)" error={errors.insuranceCents?.message} />
            <MoneyField control={control} name="taxesYearlyCents" label="IPVA + licenciamento (por ano)" error={errors.taxesYearlyCents?.message} />
            <MoneyField
              control={control}
              name="otherFixedCents"
              label="Outros fixos (por mês)"
              description="Rastreador, estacionamento mensal…"
              error={errors.otherFixedCents?.message}
            />
          </div>

          <FormField
            label="Contar custos fixos a partir de"
            htmlFor="fixedCostsStart"
            description="Normalmente o dia em que começou a trabalhar com este veículo."
            error={errors.fixedCostsStart?.message}
          >
            <Input id="fixedCostsStart" type="date" className="w-full sm:w-56" {...register('fixedCostsStart')} />
          </FormField>

          <ResultLine label="Custos fixos" value={`${formatReais(monthly)}/mês · ${formatReais(monthly / 30.4167)}/dia`} />
        </div>
      </SectionCard>

      <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2">{secondaryActions}</div>
        <Button type="submit" size="lg" disabled={formState.isSubmitting} className="w-full sm:w-auto sm:min-w-48">
          {formState.isSubmitting && <Spinner data-icon="inline-start" />}
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}

function ResultLine({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={`flex items-center justify-between gap-3 rounded-xl bg-primary/8 px-3.5 py-2.5 text-sm ${className ?? ''}`}>
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  )
}

type PerKmName = 'maintenancePerKm' | 'tiresPerKm' | 'depreciationPerKm'
type MoneyName = 'rentCents' | 'insuranceCents' | 'taxesYearlyCents' | 'otherFixedCents' | 'financingCents'

function PerKmField(props: {
  control: Control<VehicleFormValues>
  name: PerKmName
  label: string
  description: string
  error?: string
}) {
  return (
    <Controller
      control={props.control}
      name={props.name}
      render={({ field }) => (
        <FormField label={props.label} htmlFor={props.name} description={props.description} error={props.error}>
          <DecimalInput
            id={props.name}
            value={field.value}
            onValueChange={field.onChange}
            onBlur={field.onBlur}
            prefix="R$"
            suffix="/km"
            placeholder="0,00"
            maxFractionDigits={4}
            aria-invalid={!!props.error}
          />
        </FormField>
      )}
    />
  )
}

function MoneyField(props: {
  control: Control<VehicleFormValues>
  name: MoneyName
  label: string
  description?: string
  error?: string
}) {
  return (
    <Controller
      control={props.control}
      name={props.name}
      render={({ field }) => (
        <FormField label={props.label} htmlFor={props.name} description={props.description} error={props.error}>
          <MoneyInput id={props.name} value={field.value} onValueChange={field.onChange} onBlur={field.onBlur} aria-invalid={!!props.error} />
        </FormField>
      )}
    />
  )
}
