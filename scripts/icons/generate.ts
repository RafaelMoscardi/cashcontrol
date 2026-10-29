/* Gera os ícones PNG do PWA a partir dos SVGs da marca.
   Uso: npm run icons */
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = fileURLToPath(new URL('../../', import.meta.url))
const publicDir = `${root}public/`

const rounded = await readFile(`${publicDir}favicon.svg`)
const fullBleed = await readFile(fileURLToPath(new URL('./maskable.svg', import.meta.url)))

const outputs: Array<{ file: string; size: number; source: Buffer }> = [
  { file: 'pwa-64x64.png', size: 64, source: rounded },
  { file: 'pwa-192x192.png', size: 192, source: rounded },
  { file: 'pwa-512x512.png', size: 512, source: rounded },
  // Android recorta o maskable; iOS arredonda o apple-touch-icon sozinho (não pode ter transparência)
  { file: 'maskable-icon-512x512.png', size: 512, source: fullBleed },
  { file: 'apple-touch-icon-180x180.png', size: 180, source: fullBleed },
]

for (const { file, size, source } of outputs) {
  await sharp(source, { density: 384 }).resize(size, size).png({ compressionLevel: 9 }).toFile(`${publicDir}${file}`)
  console.log(`public/${file} (${size}×${size})`)
}
