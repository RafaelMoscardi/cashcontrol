import type { ExpenseCategory } from './types'

/**
 * Onde cada despesa entra. A regra que impede contar duas vezes:
 *  - energy: o resultado operacional já desconta a estimativa (km × custo/km);
 *    o abastecimento pago só aparece no fluxo de caixa.
 *  - maintenance: o resultado operacional já desconta a reserva por km;
 *    a manutenção paga só aparece no fluxo de caixa (e consome a reserva).
 *  - operational: entra nos dois.
 */
export type ExpenseNature = 'energy' | 'maintenance' | 'operational'

export const EXPENSE_NATURE: Record<ExpenseCategory, ExpenseNature> = {
  fuel: 'energy',
  maintenance: 'maintenance',
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
