import { zodResolver } from '@hookform/resolvers/zod'
import {
  Car,
  Check,
  ChevronRight,
  CircleQuestionMark,
  Cookie,
  Download,
  FileText,
  KeyRound,
  LogOut,
  MonitorSmartphone,
  Share,
  ShieldCheck,
  Store,
  User,
} from 'lucide-react'
import { useState } from 'react'
import type * as React from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/app/confirm-dialog'
import { FormField } from '@/components/app/form-field'
import { PageHeader } from '@/components/app/page-header'
import { PasswordInput } from '@/components/app/password-input'
import { SectionCard } from '@/components/app/section-card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { useInstallPrompt } from '@/app/install-prompt'
import { useAuth } from '@/features/auth/auth-context'
import { resetSchema, type ResetValues } from '@/features/auth/schemas'
import { useProfile, useUpdateProfile } from '@/features/profile/api'
import { errorMessage } from '@/lib/errors'
import { supabase } from '@/lib/supabase'

function NavRow({ to, icon: Icon, label, description }: { to: string; icon: React.ComponentType<{ className?: string }>; label: string; description: string }) {
  return (
    <Link
      to={to}
      className="group flex items-center gap-3 rounded-xl px-1 py-3 outline-none transition-colors hover:bg-white/[0.02] focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/[0.05] text-muted-foreground">
        <Icon className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{label}</span>
        <span className="block text-[0.8125rem] text-pretty text-muted-foreground">{description}</span>
      </span>
      <ChevronRight className="size-5 text-faint transition-transform group-hover:translate-x-0.5" />
    </Link>
  )
}

function InstallCard() {
  const install = useInstallPrompt()
  if (install.installed) {
    return (
      <SectionCard title="App instalado" icon={Check}>
        <p className="text-sm text-muted-foreground">O CashControl já está na sua tela inicial.</p>
      </SectionCard>
    )
  }
  return (
    <SectionCard title="Instalar o app" description="Abre direto da tela inicial, em tela cheia, como um app da loja." icon={Download}>
      {install.canPrompt ? (
        <Button onClick={() => void install.prompt()}>
          <Download data-icon="inline-start" />
          Instalar
        </Button>
      ) : install.needsManualIOS ? (
        <p className="text-sm text-muted-foreground">
          No Safari, toque em <Share className="inline size-4 align-text-bottom text-foreground" aria-label="Compartilhar" /> e depois em{' '}
          <strong className="text-foreground">Adicionar à Tela de Início</strong>.
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">No menu do navegador, escolha “Instalar app” ou “Adicionar à tela inicial”.</p>
      )}
    </SectionCard>
  )
}

function SecurityCard() {
  const [changing, setChanging] = useState(false)
  const { register, handleSubmit, reset, formState } = useForm<ResetValues>({
    resolver: zodResolver(resetSchema),
    defaultValues: { password: '', confirm: '' },
  })

  const changePassword = handleSubmit(async ({ password }) => {
    const { error } = await supabase.auth.updateUser({ password })
    if (error) return void toast.error(errorMessage(error))
    toast.success('Senha alterada')
    reset()
    setChanging(false)
  })

  const signOutEverywhere = async () => {
    const { error } = await supabase.auth.signOut({ scope: 'global' })
    if (error) toast.error(errorMessage(error))
    else toast.success('Você saiu de todos os aparelhos')
  }

  return (
    <SectionCard title="Segurança da conta" icon={ShieldCheck}>
      {changing ? (
        <form onSubmit={changePassword} noValidate className="flex flex-col gap-3">
          <FormField label="Nova senha" htmlFor="new-password" description="Pelo menos 8 caracteres, com letras e números." error={formState.errors.password?.message}>
            <PasswordInput id="new-password" autoComplete="new-password" aria-invalid={!!formState.errors.password} {...register('password')} />
          </FormField>
          <FormField label="Repita a nova senha" htmlFor="confirm-password" error={formState.errors.confirm?.message}>
            <PasswordInput id="confirm-password" autoComplete="new-password" aria-invalid={!!formState.errors.confirm} {...register('confirm')} />
          </FormField>
          <div className="flex gap-2">
            <Button type="submit" disabled={formState.isSubmitting}>
              {formState.isSubmitting && <Spinner data-icon="inline-start" />}
              Salvar senha
            </Button>
            <Button type="button" variant="ghost" onClick={() => setChanging(false)}>
              Cancelar
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="outline" onClick={() => setChanging(true)}>
            <KeyRound data-icon="inline-start" />
            Trocar senha
          </Button>
          <ConfirmDialog
            trigger={
              <Button variant="outline">
                <MonitorSmartphone data-icon="inline-start" />
                Sair de todos os aparelhos
              </Button>
            }
            title="Sair de todos os aparelhos?"
            description="Você vai precisar entrar de novo em todos os celulares e computadores, inclusive neste. Use se perdeu um aparelho ou suspeita que alguém entrou na sua conta."
            confirmLabel="Sair de todos"
            onConfirm={() => void signOutEverywhere()}
          />
        </div>
      )}
      <p className="mt-3 text-xs text-muted-foreground">Entrou com o Google? Trocar senha cria uma senha para entrar também por e-mail.</p>
    </SectionCard>
  )
}

function ProfileCard() {
  const { user } = useAuth()
  const profile = useProfile()
  const update = useUpdateProfile()
  const [name, setName] = useState<string | null>(null)
  const value = name ?? profile.data?.fullName ?? ''
  const changed = name !== null && name.trim() !== (profile.data?.fullName ?? '')

  return (
    <SectionCard title="Conta" icon={User}>
      <form
        className="flex flex-col gap-3 sm:flex-row sm:items-end"
        onSubmit={async (e) => {
          e.preventDefault()
          if (!changed || !value.trim()) return
          try {
            await update.mutateAsync({ fullName: value.trim() })
            setName(null)
            toast.success('Nome atualizado')
          } catch (err) {
            toast.error(errorMessage(err))
          }
        }}
      >
        <label className="flex flex-1 flex-col gap-1.5 text-[0.8125rem] font-medium text-secondary-foreground">
          Nome
          <Input value={value} onChange={(e) => setName(e.target.value)} maxLength={80} autoComplete="name" />
        </label>
        <Button type="submit" variant="outline" disabled={!changed || update.isPending}>
          Salvar
        </Button>
      </form>
      <p className="mt-3 text-sm text-muted-foreground">
        E-mail: <span className="text-foreground">{user?.email}</span>
      </p>
    </SectionCard>
  )
}

export function MorePage() {
  const { signOut } = useAuth()
  return (
    <>
      <PageHeader title="Mais" />
      <div className="flex flex-col gap-4 lg:max-w-2xl">
        <ProfileCard />
        <SectionCard>
          <NavRow to="/veiculos" icon={Car} label="Veículos" description="Consumo e custos fixos" />
          <div className="mx-1 h-px bg-white/[0.06]" />
          <NavRow to="/plataformas" icon={Store} label="Plataformas" description="Uber, 99, iFood e outras" />
        </SectionCard>
        <SecurityCard />
        <InstallCard />
        <SectionCard title="Como o lucro é calculado" icon={CircleQuestionMark}>
          <ul className="flex max-w-[30em] flex-col gap-2.5 text-sm text-pretty text-muted-foreground">
            <li>
              <strong className="text-foreground">Ganhos:</strong> o valor líquido que a plataforma pagou. A taxa dela nunca é descontada de novo.
            </li>
            <li>
              <strong className="text-foreground">Combustível:</strong> estimado pelos km rodados. O abastecimento pago aparece no fluxo de caixa, sem contar duas vezes. No
              elétrico, dá para informar os kWh do medidor na jornada.
            </li>
            <li>
              <strong className="text-foreground">Despesas:</strong> pedágio, manutenção, alimentação e as outras saem do lucro do dia em que você lança.
            </li>
            <li>
              <strong className="text-foreground">Custos fixos:</strong> aluguel, parcela, seguro e IPVA divididos pelos dias do período.
            </li>
            <li>
              <strong className="text-foreground">Lucro real</strong> = ganhos − combustível − despesas − custos fixos.
            </li>
          </ul>
        </SectionCard>
        <SectionCard>
          <NavRow to="/privacidade" icon={ShieldCheck} label="Política de Privacidade" description="Quais dados guardamos e seus direitos (LGPD)" />
          <div className="mx-1 h-px bg-white/[0.06]" />
          <NavRow to="/termos" icon={FileText} label="Termos de uso" description="Regras de uso do CashControl" />
          <div className="mx-1 h-px bg-white/[0.06]" />
          <NavRow to="/cookies" icon={Cookie} label="Cookies" description="Só o essencial para manter você conectado" />
          <div className="mx-1 h-px bg-white/[0.06]" />
          <NavRow to="/seguranca" icon={ShieldCheck} label="Segurança" description="Como protegemos seus dados" />
        </SectionCard>
        <Button variant="outline" size="lg" className="text-negative" onClick={() => void signOut()}>
          <LogOut data-icon="inline-start" />
          Sair da conta
        </Button>
        <p className="pb-2 text-center text-xs text-faint">CashControl {__APP_VERSION__}</p>
      </div>
    </>
  )
}
