import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY

/** Falta configuração: o app mostra uma tela explicando como resolver. */
export const isSupabaseConfigured = Boolean(url && key)

export const supabaseUrl = url ?? 'http://localhost'
export const supabaseKey = key ?? 'missing-key'

/**
 * Parâmetros de retorno do Supabase (link de e-mail, volta do login com Google),
 * lidos antes de o cliente consumir e limpar a URL. Erros podem vir no hash ou na query.
 */
export const initialAuthLink = (() => {
  if (typeof window === 'undefined') return { type: null, errorCode: null, errorDescription: null }
  const hash = new URLSearchParams(window.location.hash.slice(1))
  const query = new URLSearchParams(window.location.search)
  const pick = (name: string) => hash.get(name) ?? query.get(name)
  return {
    type: pick('type'),
    errorCode: pick('error_code') ?? pick('error'),
    errorDescription: pick('error_description'),
  }
})()

let authLinkErrorDismissed = false

/** Erro da volta de um login (ex.: cancelou no Google). Some depois que a tela de login sai. */
export function authReturnError(): string | null {
  if (authLinkErrorDismissed || initialAuthLink.type === 'recovery' || !initialAuthLink.errorCode) return null
  return initialAuthLink.errorCode
}

export function dismissAuthReturnError() {
  authLinkErrorDismissed = true
}

let accountGone = false

/** A conta da sessão guardada foi apagada: o app sai dela e a tela de entrar explica por quê. */
export function noteAccountGone() {
  accountGone = true
}

export const accountGoneNotice = () => accountGone

export function dismissAccountGoneNotice() {
  accountGone = false
}

export const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
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
