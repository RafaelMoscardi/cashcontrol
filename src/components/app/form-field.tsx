import type * as React from 'react'
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'
import { cn } from '@/lib/utils'

interface FormFieldProps {
  label: React.ReactNode
  htmlFor?: string
  description?: React.ReactNode
  error?: string
  className?: string
  children: React.ReactNode
}

/** Rótulo + campo + ajuda + erro, com os atributos de acessibilidade ligados. */
export function FormField({ label, htmlFor, description, error, className, children }: FormFieldProps) {
  return (
    <Field data-invalid={error ? true : undefined} className={cn('gap-1.5', className)}>
      <FieldLabel htmlFor={htmlFor} className="text-[0.8125rem] font-medium text-secondary-foreground">
        {label}
      </FieldLabel>
      {children}
      {description && !error && <FieldDescription className="text-[0.8125rem]">{description}</FieldDescription>}
      {error && <FieldError className="text-[0.8125rem]">{error}</FieldError>}
    </Field>
  )
}
