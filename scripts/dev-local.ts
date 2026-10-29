/* Desenvolvimento sem conta no Supabase e sem Docker: sobe o Supabase local
   (PGlite + mesmas migrations) e o Vite apontando para ele.
   Uso: npm run dev:local */
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { startLocalSupabase } from './local-supabase/server.ts'

const root = fileURLToPath(new URL('../', import.meta.url))
const supabase = await startLocalSupabase({ dataDir: fileURLToPath(new URL('../.local-supabase/data', import.meta.url)) })

// Chama o binário do Vite pelo próprio Node: sem shell, funciona igual no Windows
const viteBin = fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url))
const vite = spawn(process.execPath, [viteBin, ...process.argv.slice(2)], {
  cwd: root,
  stdio: 'inherit',
  env: {
    ...process.env,
    VITE_SUPABASE_URL: supabase.url,
    VITE_SUPABASE_PUBLISHABLE_KEY: 'local-dev-publishable-key',
  },
})

const stop = async (code = 0) => {
  vite.kill()
  await supabase.close()
  process.exit(code)
}
vite.on('exit', (code) => void stop(code ?? 0))
process.on('SIGINT', () => void stop())
process.on('SIGTERM', () => void stop())
