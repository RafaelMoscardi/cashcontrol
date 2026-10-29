import { z } from 'zod'

const email = z.string().trim().min(1, 'Informe seu e-mail').email('E-mail inválido')

const password = z
  .string()
  .min(8, 'Use pelo menos 8 caracteres')
  .max(72, 'Use no máximo 72 caracteres')
  .regex(/[A-Za-z]/, 'Inclua pelo menos uma letra')
  .regex(/\d/, 'Inclua pelo menos um número')

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Informe sua senha'),
})

export const signupSchema = z.object({
  fullName: z.string().trim().min(2, 'Como podemos te chamar?').max(80, 'Nome muito longo'),
  email,
  password,
})

export const forgotSchema = z.object({ email })

export const resetSchema = z
  .object({ password, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { message: 'As senhas não conferem', path: ['confirm'] })

export type LoginValues = z.infer<typeof loginSchema>
export type SignupValues = z.infer<typeof signupSchema>
export type ForgotValues = z.infer<typeof forgotSchema>
export type ResetValues = z.infer<typeof resetSchema>
