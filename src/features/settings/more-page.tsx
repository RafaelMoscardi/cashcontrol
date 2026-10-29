import { Car, Check, ChevronRight, CircleQuestionMark, Download, LogOut, Share, Store, User } from 'lucide-react'
import { useState } from 'react'
import type * as React from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { PageHeader } from '@/components/app/page-header'
import { SectionCard } from '@/components/app/section-card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useInstallPrompt } from '@/app/install-prompt'
import { useAuth } from '@/features/auth/auth-context'
import { useProfile, useUpdateProfile } from '@/features/profile/api'
import { errorMessage } from '@/lib/errors'

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
        <span className="block truncate text-[0.8125rem] text-muted-foreground">{description}</span>
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
      <div className="flex flex-col gap-4">
        <ProfileCard />
        <SectionCard>
          <NavRow to="/veiculos" icon={Car} label="Veículos" description="Consumo, reservas por km e custos fixos" />
          <div className="mx-1 h-px bg-white/[0.06]" />
          <NavRow to="/plataformas" icon={Store} label="Plataformas" description="Uber, 99, iFood e outras" />
        </SectionCard>
        <InstallCard />
        <SectionCard title="Como o lucro é calculado" icon={CircleQuestionMark}>
          <ul className="flex flex-col gap-2.5 text-sm text-muted-foreground">
            <li>
              <strong className="text-foreground">Ganhos:</strong> o valor líquido que a plataforma pagou. A taxa dela nunca é descontada de novo.
            </li>
            <li>
              <strong className="text-foreground">Combustível e desgaste:</strong> estimados pelos km rodados. Abastecimentos e manutenções pagos aparecem no fluxo de caixa, sem
              contar duas vezes.
            </li>
            <li>
              <strong className="text-foreground">Custos fixos:</strong> aluguel, seguro e IPVA divididos pelos dias do período.
            </li>
            <li>
              <strong className="text-foreground">Lucro real</strong> = ganhos − combustível − reservas − despesas − custos fixos.
            </li>
          </ul>
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
