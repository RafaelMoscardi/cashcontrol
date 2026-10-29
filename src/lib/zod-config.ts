import { z } from 'zod'

// Sem compilação com `new Function`: a CSP do site (script-src 'self') bloqueia eval.
// Precisa rodar antes de qualquer schema ser criado, por isso é o primeiro import do main.tsx.
z.config({ jitless: true })
