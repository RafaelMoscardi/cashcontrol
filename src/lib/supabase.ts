import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY

/** Falta configuração: o app mostra uma tela explicando como resolver. */
export const isSupabaseConfigured = Boolean(url && key)

/**
 * Parâmetros do link de e-mail (recuperação de senha, confirmação), lidos antes
 * de o cliente do Supabase consumir e limpar o hash da URL.
 */
export const initialAuthLink = (() => {
  if (typeof window === 'undefined') return { type: null, errorCode: null, errorDescription: null }
  const params = new URLSearchParams(window.location.hash.slice(1))
  return {
    type: params.get('type'),
    errorCode: params.get('error_code'),
    errorDescription: params.get('error_description'),
  }
})()

export const supabase = createClient<Database>(url ?? 'http://localhost', key ?? 'missing-key', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // implicit: o link de recuperação funciona mesmo aberto em outro navegador
    // (ex.: e-mail aberto no Safari, app instalado como PWA)
    flowType: 'implicit',
    storageKey: 'cashcontrol-auth',
  },
})
