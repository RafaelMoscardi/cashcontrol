import { zodResolver } from '@hookform/resolvers/zod'
import { CircleAlert, MailCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import type * as React from 'react'
import { useForm } from 'react-hook-form'
import { Link, useLocation, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { FormField } from '@/components/app/form-field'
import { LoadingScreen } from '@/components/app/loading-screen'
import { PasswordInput } from '@/components/app/password-input'
import { FocusLayout } from '@/app/layouts'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { errorMessage } from '@/lib/errors'
import {
  accountGoneNotice,
  authReturnError,
  dismissAccountGoneNotice,
  dismissAuthReturnError,
  initialAuthLink,
  supabase,
} from '@/lib/supabase'
import { useAuth } from './auth-context'
import { GoogleSignIn } from './google'
import {
  forgotSchema,
  loginSchema,
  resetSchema,
  signupSchema,
  type ForgotValues,
  type LoginValues,
  type ResetValues,
  type SignupValues,
} from './schemas'

function AuthHeading({ title, subtitle }: { title: string; subtitle: React.ReactNode }) {
  return (
    <div className="mb-7">
      <h1 className="text-[1.75rem] leading-tight font-semibold tracking-tight">{title}</h1>
      <p className="mt-1.5 text-[0.9375rem] text-muted-foreground text-pretty">{subtitle}</p>
    </div>
  )
}

function FormAlert({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <Alert variant="destructive" className="border-destructive/30 bg-destructive/10">
      <CircleAlert />
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  )
}

const LEGAL_LINKS = [
  { to: '/privacidade', label: 'Privacidade' },
  { to: '/termos', label: 'Termos de uso' },
  { to: '/cookies', label: 'Cookies' },
  { to: '/seguranca', label: 'Segurança' },
]

function LegalLinks() {
  return (
    <nav aria-label="Informações legais" className="mt-6 flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs text-faint">
      {LEGAL_LINKS.map((link) => (
        <Link key={link.to} to={link.to} className="underline-offset-4 hover:text-muted-foreground hover:underline">
          {link.label}
        </Link>
      ))}
    </nav>
  )
}

function SubmitButton({ pending, children }: { pending: boolean; children: React.ReactNode }) {
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {pending && <Spinner data-icon="inline-start" />}
      {children}
    </Button>
  )
}

const emailInputProps = {
  type: 'email',
  inputMode: 'email',
  autoComplete: 'email',
  autoCapitalize: 'none',
  autoCorrect: 'off',
  spellCheck: false,
} as const

/** Volta de um login com erro (cancelou no Google, link de e-mail vencido). */
function authReturnMessage(code: string | null): string | null {
  if (!code) return null
  if (code === 'otp_expired') return errorMessage({ code })
  if (code === 'access_denied') return 'Login cancelado. Tente de novo quando quiser.'
  return 'Não foi possível concluir o login. Tente de novo.'
}

export function LoginPage() {
  const location = useLocation()
  const next = new URLSearchParams(location.search).get('next')
  const [error, setError] = useState<string | null>(() =>
    accountGoneNotice() ? 'Essa conta não existe mais. Crie uma conta nova ou entre com o Google.' : authReturnMessage(authReturnError()),
  )
  useEffect(
    () => () => {
      dismissAuthReturnError()
      dismissAccountGoneNotice()
    },
    [],
  )
  const { register, handleSubmit, formState } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  const onSubmit = handleSubmit(async (values) => {
    setError(null)
    const { error: authError } = await supabase.auth.signInWithPassword(values)
    if (authError) setError(errorMessage(authError))
  })

  return (
    <FocusLayout>
      <AuthHeading title="Entrar" subtitle="Seu lucro real, jornada por jornada." />
      <GoogleSignIn next={next} onError={setError} />
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <FormField label="E-mail" htmlFor="email" error={formState.errors.email?.message}>
          <Input id="email" {...emailInputProps} aria-invalid={!!formState.errors.email} {...register('email')} />
        </FormField>
        <FormField label="Senha" htmlFor="password" error={formState.errors.password?.message}>
          <PasswordInput id="password" autoComplete="current-password" aria-invalid={!!formState.errors.password} {...register('password')} />
        </FormField>
        <Link to="/recuperar-senha" className="-mt-1 self-end text-sm text-link underline-offset-4 hover:underline">
          Esqueci minha senha
        </Link>
        <FormAlert message={error} />
        <SubmitButton pending={formState.isSubmitting}>Entrar</SubmitButton>
      </form>
      <p className="mt-8 text-center text-sm text-muted-foreground">
        Ainda não tem conta?{' '}
        <Link to="/criar-conta" className="font-medium text-foreground underline-offset-4 hover:underline">
          Criar conta grátis
        </Link>
      </p>
      <LegalLinks />
    </FocusLayout>
  )
}

export function SignupPage() {
  const [error, setError] = useState<string | null>(null)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const { register, handleSubmit, formState } = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { fullName: '', email: '', password: '' },
  })

  const onSubmit = handleSubmit(async ({ fullName, email, password }) => {
    setError(null)
    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName }, emailRedirectTo: `${window.location.origin}/` },
    })
    if (authError) return setError(errorMessage(authError))
    // Com confirmação de e-mail ligada, o Supabase não revela se o e-mail já existe: devolve usuário sem identidades
    if (data.user && data.user.identities?.length === 0) return setError(errorMessage({ code: 'user_already_exists' }))
    if (!data.session) setSentTo(email)
  })

  if (sentTo) {
    return (
      <FocusLayout>
        <div className="mb-5 grid size-12 place-items-center rounded-2xl bg-primary/14 text-primary">
          <MailCheck className="size-6" />
        </div>
        <AuthHeading
          title="Confirme seu e-mail"
          subtitle={
            <>
              Enviamos um link para <strong className="text-foreground">{sentTo}</strong>. Abra no celular ou no computador para ativar a conta.
            </>
          }
        />
        <p className="text-sm text-muted-foreground">Não chegou? Veja a caixa de spam ou aguarde alguns minutos.</p>
        <Button asChild variant="outline" className="mt-6 w-full">
          <Link to="/entrar">Voltar para o login</Link>
        </Button>
      </FocusLayout>
    )
  }

  return (
    <FocusLayout>
      <AuthHeading title="Criar conta" subtitle="Grátis. Leva um minuto e seus dados ficam só com você." />
      <GoogleSignIn onError={setError} />
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <FormField label="Seu nome" htmlFor="fullName" error={formState.errors.fullName?.message}>
          <Input id="fullName" autoComplete="name" autoCapitalize="words" enterKeyHint="next" aria-invalid={!!formState.errors.fullName} {...register('fullName')} />
        </FormField>
        <FormField label="E-mail" htmlFor="email" error={formState.errors.email?.message}>
          <Input id="email" {...emailInputProps} aria-invalid={!!formState.errors.email} {...register('email')} />
        </FormField>
        <FormField
          label="Senha"
          htmlFor="password"
          description="Pelo menos 8 caracteres, com letras e números."
          error={formState.errors.password?.message}
        >
          <PasswordInput id="password" autoComplete="new-password" aria-invalid={!!formState.errors.password} {...register('password')} />
        </FormField>
        <FormAlert message={error} />
        <SubmitButton pending={formState.isSubmitting}>Criar conta</SubmitButton>
        <p className="text-center text-xs leading-relaxed text-muted-foreground text-pretty">
          Ao criar a conta, você concorda com os{' '}
          <Link to="/termos" className="text-foreground underline underline-offset-4">
            Termos de uso
          </Link>{' '}
          e a{' '}
          <Link to="/privacidade" className="text-foreground underline underline-offset-4">
            Política de Privacidade
          </Link>
          .
        </p>
      </form>
      <p className="mt-8 text-center text-sm text-muted-foreground">
        Já tem conta?{' '}
        <Link to="/entrar" className="font-medium text-foreground underline-offset-4 hover:underline">
          Entrar
        </Link>
      </p>
    </FocusLayout>
  )
}

export function ForgotPasswordPage() {
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const { register, handleSubmit, formState } = useForm<ForgotValues>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: '' },
  })

  const onSubmit = handleSubmit(async ({ email }) => {
    setError(null)
    const { error: authError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    })
    if (authError) return setError(errorMessage(authError))
    setSent(true)
  })

  return (
    <FocusLayout>
      <AuthHeading
        title="Recuperar senha"
        subtitle={sent ? 'Se houver uma conta com esse e-mail, o link para criar uma nova senha já está a caminho.' : 'Enviamos um link para você criar uma nova senha.'}
      />
      {sent ? (
        <Button asChild variant="outline" className="w-full">
          <Link to="/entrar">Voltar para o login</Link>
        </Button>
      ) : (
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          <FormField label="E-mail da conta" htmlFor="email" error={formState.errors.email?.message}>
            <Input id="email" {...emailInputProps} aria-invalid={!!formState.errors.email} {...register('email')} />
          </FormField>
          <FormAlert message={error} />
          <SubmitButton pending={formState.isSubmitting}>Enviar link</SubmitButton>
          <Link to="/entrar" className="text-center text-sm text-muted-foreground underline-offset-4 hover:underline">
            Lembrei a senha
          </Link>
        </form>
      )}
    </FocusLayout>
  )
}

export function ResetPasswordPage() {
  const { session, loading, finishRecovery } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const { register, handleSubmit, formState } = useForm<ResetValues>({
    resolver: zodResolver(resetSchema),
    defaultValues: { password: '', confirm: '' },
  })

  const onSubmit = handleSubmit(async ({ password }) => {
    setError(null)
    const { error: authError } = await supabase.auth.updateUser({ password })
    if (authError) return setError(errorMessage(authError))
    finishRecovery()
    toast.success('Senha alterada')
    navigate('/', { replace: true })
  })

  if (loading) return <LoadingScreen />

  if (initialAuthLink.errorCode || !session) {
    return (
      <FocusLayout>
        <AuthHeading
          title="Link inválido"
          subtitle={
            initialAuthLink.errorCode
              ? 'Este link expirou ou já foi usado. Peça um novo para redefinir a senha.'
              : 'Abra o link que enviamos por e-mail para criar uma nova senha.'
          }
        />
        <Button asChild className="w-full">
          <Link to="/recuperar-senha">Pedir novo link</Link>
        </Button>
      </FocusLayout>
    )
  }

  return (
    <FocusLayout>
      <AuthHeading title="Nova senha" subtitle={`Conta ${session.user.email ?? ''}`} />
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <FormField label="Nova senha" htmlFor="password" description="Pelo menos 8 caracteres, com letras e números." error={formState.errors.password?.message}>
          <PasswordInput id="password" autoComplete="new-password" aria-invalid={!!formState.errors.password} {...register('password')} />
        </FormField>
        <FormField label="Repita a nova senha" htmlFor="confirm" error={formState.errors.confirm?.message}>
          <PasswordInput id="confirm" autoComplete="new-password" aria-invalid={!!formState.errors.confirm} {...register('confirm')} />
        </FormField>
        <FormAlert message={error} />
        <SubmitButton pending={formState.isSubmitting}>Salvar nova senha</SubmitButton>
      </form>
    </FocusLayout>
  )
}
