import type { FieldErrors, FieldValues } from 'react-hook-form'
import { toast } from 'sonner'

/** Primeira mensagem de erro, procurando também dentro de listas (ganhos, despesas). */
function firstMessage(errors: unknown): string | null {
  if (!errors || typeof errors !== 'object') return null
  const { message } = errors as { message?: unknown }
  if (typeof message === 'string' && message) return message
  for (const value of Object.values(errors)) {
    const found = firstMessage(value)
    if (found) return found
  }
  return null
}

/** Envio barrado pela validação: avisa em vez de ficar parado em silêncio. */
export function reportInvalid<T extends FieldValues>(errors: FieldErrors<T>) {
  const message = firstMessage(errors)
  toast.error('Confira o formulário', { description: message ?? 'Há campos com problema.' })
  if (import.meta.env.DEV) console.warn('Formulário inválido', errors)
}
