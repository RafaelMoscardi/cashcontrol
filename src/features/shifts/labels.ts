import { Coffee, Droplets, Fuel, Landmark, Receipt, ShieldAlert, Smartphone, SquareParking, Ticket, Wrench } from 'lucide-react'
import type { ComponentType } from 'react'
import type { ExpenseCategory } from '@/domain/types'

export const EXPENSE_LABEL: Record<ExpenseCategory, string> = {
  fuel: 'Combustível / recarga',
  maintenance: 'Manutenção',
  toll: 'Pedágio',
  parking: 'Estacionamento',
  food: 'Alimentação',
  wash: 'Lavagem',
  phone: 'Celular / internet',
  fees: 'Taxas (saque, maquininha)',
  fine: 'Multa',
  other: 'Outros',
}

export const EXPENSE_ICON: Record<ExpenseCategory, ComponentType<{ className?: string }>> = {
  fuel: Fuel,
  maintenance: Wrench,
  toll: Ticket,
  parking: SquareParking,
  food: Coffee,
  wash: Droplets,
  phone: Smartphone,
  fees: Landmark,
  fine: ShieldAlert,
  other: Receipt,
}

/** Explica, no formulário, por que a despesa não reduz o lucro. */
export const EXPENSE_NOTE: Partial<Record<ExpenseCategory, string>> = {
  fuel: 'Entra no caixa. O lucro já desconta o combustível estimado pelos km.',
}
