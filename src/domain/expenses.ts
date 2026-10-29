import type { ExpenseCategory } from './types'

/**
 * Onde cada despesa entra. A regra que impede contar duas vezes:
 *  - energy: o resultado operacional já desconta a estimativa (km × custo/km);
 *    o abastecimento pago só aparece no fluxo de caixa.
 *  - operational: entra nos dois. Inclui a manutenção: sem reserva por km,
 *    ela pesa no lucro do dia em que é paga.
 */
export type ExpenseNature = 'energy' | 'operational'

export const EXPENSE_NATURE: Record<ExpenseCategory, ExpenseNature> = {
  fuel: 'energy',
  maintenance: 'operational',
  toll: 'operational',
  parking: 'operational',
  food: 'operational',
  wash: 'operational',
  phone: 'operational',
  fees: 'operational',
  fine: 'operational',
  other: 'operational',
}

export const EXPENSE_CATEGORIES = Object.keys(EXPENSE_NATURE) as ExpenseCategory[]

export const countsInOperationalResult = (category: ExpenseCategory) => EXPENSE_NATURE[category] === 'operational'
