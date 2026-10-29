/// <reference types="vite/client" />

/** Versão do package.json, injetada no build (vite.config.ts) */
declare const __APP_VERSION__: string

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  /** Chave pública do projeto (publishable, sb_publishable_…) */
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string
  /** Nome antigo da chave pública (anon), aceito por compatibilidade */
  readonly VITE_SUPABASE_ANON_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
