import { ArrowRight } from 'lucide-react'
import { useEffect } from 'react'
import type * as React from 'react'
import { Link } from 'react-router'
import { Logo } from '@/components/app/logo'
import { Button } from '@/components/ui/button'
import { APP_INFO } from '@/config/app'
import { CookieNotice } from '@/features/legal/cookie-notice'
import { formatMoney, formatReais, formatSignedMoney } from '@/lib/format'

/** Jornada de exemplo, com valores ilustrativos e a mesma conta que o app faz. */
const EXAMPLE = {
  hours: 9,
  km: 210,
  platforms: [
    { name: 'Uber', cents: 24860 },
    { name: '99', cents: 12140 },
  ],
  costs: [
    { label: 'Combustível', detail: '210\u00a0km a R$\u00a00,52 por\u00a0km', cents: 10920, color: 'var(--chart-3)' },
    { label: 'Reservas', detail: 'manutenção, pneus e depreciação', cents: 3780, color: 'var(--chart-4)' },
    { label: 'Despesas da jornada', detail: 'lavagem e estacionamento', cents: 1500, color: 'var(--chart-5)' },
    { label: 'Custos fixos do dia', detail: 'seguro e IPVA', cents: 1800, color: 'var(--chart-6)' },
  ],
}

const FEATURES = [
  {
    title: 'Cada jornada registrada',
    text: 'Início, fim, pausas, km do hodômetro e quanto cada plataforma pagou, com gorjetas e bônus.',
  },
  {
    title: 'O custo por km do seu veículo',
    text: 'Carro ou moto, a combustão, híbrido ou elétrico. O custo sai do consumo e do preço que você informa.',
  },
  {
    title: 'Reserva para o desgaste',
    text: 'Manutenção, pneus e depreciação separados por km rodado, antes de a conta chegar.',
  },
  {
    title: 'Custos fixos no dia certo',
    text: 'Aluguel, seguro, IPVA e parcela divididos pelos dias de cada período.',
  },
  {
    title: 'Nada conta duas vezes',
    text: 'Abastecer entra no fluxo de caixa. O lucro já desconta o combustível pelos km rodados.',
  },
  {
    title: 'Painel por período e plataforma',
    text: 'Hoje, semana, mês ou as datas que quiser: lucro por hora, por km e quanto rendeu cada plataforma.',
  },
]

const LEGAL_LINKS = [
  { to: '/privacidade', label: 'Privacidade' },
  { to: '/termos', label: 'Termos de uso' },
  { to: '/cookies', label: 'Cookies' },
  { to: '/seguranca', label: 'Segurança' },
]

/** O recibo da jornada: do que a plataforma pagou até o lucro real. */
function ShiftReceipt() {
  const received = EXAMPLE.platforms.reduce((sum, p) => sum + p.cents, 0)
  const profit = received - EXAMPLE.costs.reduce((sum, c) => sum + c.cents, 0)
  const segments = [...EXAMPLE.costs, { label: 'Lucro real', cents: profit, color: 'var(--positive)' }]

  return (
    <figure className="rounded-[1.75rem] border border-white/[0.08] bg-card p-5 shadow-[0_32px_80px_-40px_rgb(124_58_237/0.6)] sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-semibold">Jornada de sábado</p>
          {/* \u00a0: número e unidade nunca se separam na quebra de linha */}
          <p className="mt-0.5 text-sm text-muted-foreground text-pretty">
            08:00 às 18:00, 1{'\u00a0'}h de pausa, {EXAMPLE.km}
            {'\u00a0'}km
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-white/10 px-2.5 py-1 text-xs text-muted-foreground">Exemplo</span>
      </div>

      <dl className="mt-5 flex flex-col gap-3.5 text-[0.9375rem]">
        <div className="flex items-baseline justify-between gap-4">
          <dt>
            Recebido das plataformas
            <span className="block text-[0.8125rem] text-muted-foreground">
              {EXAMPLE.platforms.map((p) => `${p.name} ${formatMoney(p.cents)}`).join(' · ')}
            </span>
          </dt>
          <dd className="font-medium tabular-nums">{formatMoney(received)}</dd>
        </div>
        {EXAMPLE.costs.map((cost) => (
          <div key={cost.label} className="flex items-baseline justify-between gap-4">
            <dt>
              <span className="mr-2 inline-block size-2 rounded-full align-middle" style={{ backgroundColor: cost.color }} />
              {cost.label}
              <span className="block pl-4 text-[0.8125rem] text-muted-foreground">{cost.detail}</span>
            </dt>
            <dd className="text-secondary-foreground tabular-nums">{formatSignedMoney(-cost.cents)}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-5 border-t border-dashed border-white/[0.14] pt-5">
        <div className="flex items-baseline justify-between gap-4">
          <p className="font-semibold">Lucro real</p>
          <p className="text-[2rem] leading-none font-semibold tracking-tight text-positive tabular-nums">{formatSignedMoney(profit)}</p>
        </div>
        {/* Uma barra, os R$ recebidos: cada pedaço é para onde o dinheiro foi */}
        <div className="mt-5 flex h-2.5 gap-[3px]" aria-hidden="true">
          {segments.map((segment, i) => (
            <span
              key={segment.label}
              className="h-full origin-left animate-grow-x rounded-full [animation-delay:var(--delay)] motion-reduce:[animation-delay:0ms]"
              style={{ flex: `${segment.cents} 1 0`, backgroundColor: segment.color, '--delay': `${250 + i * 120}ms` } as React.CSSProperties}
            />
          ))}
        </div>
        <p className="mt-3 text-sm text-muted-foreground text-pretty">
          De cada R${'\u00a0'}100 recebidos, R${'\u00a0'}{Math.round((profit / received) * 100)} ficaram com você. Deu{' '}
          {formatReais(profit / 100 / EXAMPLE.hours)} por hora e {formatReais(profit / 100 / EXAMPLE.km)} por{'\u00a0'}km.
        </p>
      </div>

      <figcaption className="mt-4 text-xs text-faint">Valores ilustrativos. No app, a conta usa o consumo, os preços e os custos do seu veículo.</figcaption>
    </figure>
  )
}

const sectionTitle = 'text-[clamp(1.75rem,3.6vw,2.5rem)] leading-tight font-semibold tracking-[-0.03em] text-balance'

/** Página inicial pública: quem não entrou vê o que o app faz (exigência do Google para a marca do login). */
export function HomePage() {
  useEffect(() => {
    const previous = document.title
    document.title = 'CashControl · Lucro real para motoristas e entregadores de aplicativo'
    return () => {
      document.title = previous
    }
  }, [])

  return (
    <div className="app-glow min-h-dvh pt-[var(--safe-top)]">
      <div className="mx-auto w-full max-w-6xl px-4 pb-[calc(var(--safe-bottom)+1rem)] sm:px-6 lg:px-8">
        <header className="flex h-[4.5rem] items-center justify-between gap-4">
          <Link to="/" aria-label="CashControl, página inicial" className="inline-flex min-h-11 items-center rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
            <Logo />
          </Link>
          <nav aria-label="Conta" className="flex items-center gap-2">
            <Button asChild variant="ghost">
              <Link to="/entrar">Entrar</Link>
            </Button>
            <Button asChild className="hidden sm:inline-flex">
              <Link to="/criar-conta">Criar conta</Link>
            </Button>
          </nav>
        </header>

        <main>
          <section className="grid items-center gap-12 pt-8 pb-16 sm:pt-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,27rem)] lg:gap-16 lg:pt-20 lg:pb-24">
            <div>
              <h1 className="text-[clamp(2.5rem,7vw,4.25rem)] leading-[1.02] font-semibold tracking-[-0.03em] text-balance">
                Rodou o dia todo. Quanto sobrou de verdade?
              </h1>
              <p className="mt-5 max-w-[34em] text-[1.0625rem] leading-relaxed text-secondary-foreground text-pretty sm:text-lg">
                O CashControl desconta do que Uber, 99, iFood e as outras plataformas pagaram o combustível ou a energia, o desgaste do
                veículo e os custos fixos. Você vê o lucro real de cada jornada, por hora e por km.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg">
                  <Link to="/criar-conta">
                    Criar conta grátis
                    <ArrowRight data-icon="inline-end" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link to="/entrar">Já tenho conta</Link>
                </Button>
              </div>
              <p className="mt-6 text-sm text-muted-foreground">Para motoristas e entregadores, de carro ou moto, a combustão, híbrido ou elétrico.</p>
            </div>
            <ShiftReceipt />
          </section>

          <section aria-labelledby="o-que-entra" className="grid gap-8 border-t border-white/[0.06] py-16 sm:py-24 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] lg:gap-16">
            <div>
              <h2 id="o-que-entra" className={sectionTitle}>
                O que entra na conta
              </h2>
              <p className="mt-3 max-w-[30em] text-muted-foreground text-pretty">
                Você cadastra o veículo uma vez e registra as jornadas. O resto, o CashControl calcula.
              </p>
            </div>
            <ul className="divide-y divide-white/[0.07] border-y border-white/[0.07]">
              {FEATURES.map((feature) => (
                <li key={feature.title} className="grid gap-1 py-5 sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] sm:gap-8">
                  <h3 className="font-semibold">{feature.title}</h3>
                  <p className="text-muted-foreground text-pretty">{feature.text}</p>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="seus-dados" className="border-t border-white/[0.06] py-16 sm:py-24">
            <h2 id="seus-dados" className={sectionTitle}>
              O que fazemos com seus dados
            </h2>
            <dl className="mt-8 grid gap-8 sm:grid-cols-3 sm:gap-10">
              <div>
                <dt className="font-semibold">Login com o Google é opcional</dt>
                <dd className="mt-1.5 text-muted-foreground text-pretty">
                  Se você usar, o Google nos passa só nome, e-mail e foto do perfil, para criar e identificar sua conta.
                </dd>
              </div>
              <div>
                <dt className="font-semibold">Só você vê seus registros</dt>
                <dd className="mt-1.5 text-muted-foreground text-pretty">Cada conta acessa apenas os próprios veículos, jornadas e valores.</dd>
              </div>
              <div>
                <dt className="font-semibold">Sem publicidade</dt>
                <dd className="mt-1.5 text-muted-foreground text-pretty">
                  Não vendemos, alugamos nem compartilhamos seus dados para anúncios, e não usamos cookies de rastreamento.
                </dd>
              </div>
            </dl>
            <p className="mt-8 text-muted-foreground">
              Detalhes na{' '}
              <Link to="/privacidade" className="text-link underline-offset-4 hover:underline">
                Política de Privacidade
              </Link>{' '}
              e nos{' '}
              <Link to="/termos" className="text-link underline-offset-4 hover:underline">
                Termos de uso
              </Link>
              .
            </p>
          </section>

          <section aria-labelledby="comece" className="flex flex-col gap-8 border-t border-white/[0.06] py-16 sm:py-24 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 id="comece" className={sectionTitle}>
                Descubra quanto sobra da próxima jornada
              </h2>
              <p className="mt-3 max-w-[30em] text-muted-foreground text-pretty">Grátis. Funciona no navegador e pode ser instalado na tela inicial do celular.</p>
            </div>
            <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link to="/criar-conta">
                  Criar conta grátis
                  <ArrowRight data-icon="inline-end" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/entrar">Entrar</Link>
              </Button>
            </div>
          </section>
        </main>

        <footer className="border-t border-white/[0.06] pt-8 pb-6 text-sm text-muted-foreground">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <Logo />
            <nav aria-label="Informações legais" className="-mx-2 flex flex-wrap">
              {LEGAL_LINKS.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className="inline-flex min-h-11 items-center rounded-lg px-2 outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
          <p className="mt-4 text-faint">
            © 2026 {APP_INFO.name}. Contato:{' '}
            <a href={`mailto:${APP_INFO.contactEmail}`} className="text-muted-foreground underline-offset-4 hover:underline">
              {APP_INFO.contactEmail}
            </a>
          </p>
        </footer>
      </div>
      <CookieNotice />
    </div>
  )
}
