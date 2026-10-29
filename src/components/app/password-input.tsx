import { Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'
import type * as React from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

/** Senha com botão de mostrar/ocultar (digitar no celular sem ver é sofrido). */
export function PasswordInput({ className, ...props }: Omit<React.ComponentProps<'input'>, 'type'>) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="relative">
      <Input {...props} type={visible ? 'text' : 'password'} autoCapitalize="none" autoCorrect="off" spellCheck={false} className={cn('pr-12', className)} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
        aria-pressed={visible}
        className="absolute inset-y-0 right-0 grid w-12 place-items-center rounded-r-xl text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:text-foreground"
      >
        {visible ? <EyeOff className="size-[1.125rem]" /> : <Eye className="size-[1.125rem]" />}
      </button>
    </div>
  )
}
