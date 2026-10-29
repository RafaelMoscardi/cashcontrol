import { ChevronLeft } from 'lucide-react'
import type * as React from 'react'
import { Link } from 'react-router'
import { FocusLayout } from '@/app/layouts'
import { APP_INFO } from '@/config/app'
import { formatDate } from '@/lib/format'

function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <FocusLayout wide>
      {/* ~70 caracteres por linha (em, não ch: o "0" da Geist é largo) */}
      <div className="mx-auto max-w-[30em] text-[0.9375rem] sm:text-base">
        <Link to="/" className="touch-target mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:text-foreground">
          <ChevronLeft className="size-4" />
          Voltar ao app
        </Link>
        <article className="pb-10 leading-relaxed text-secondary-foreground [&_h2]:mt-8 [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-foreground [&_li]:mt-1.5 [&_li]:text-pretty [&_p]:mt-3 [&_p]:text-pretty [&_strong]:text-foreground [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5">
          <h1 className="text-[1.75rem] leading-tight font-semibold tracking-tight text-foreground">{title}</h1>
          <p className="!mt-2 text-sm text-muted-foreground">Atualizado em {formatDate(APP_INFO.legalUpdatedAt)}</p>
          {children}
        </article>
      </div>
    </FocusLayout>
  )
}

const Contact = () => (
  <a href={`mailto:${APP_INFO.contactEmail}`} className="text-link underline-offset-4 hover:underline">
    {APP_INFO.contactEmail}
  </a>
)

export function PrivacyPage() {
  return (
    <LegalPage title="Política de Privacidade">
      <p>
        O <strong>{APP_INFO.name}</strong> ({APP_INFO.url}) é um aplicativo de planejamento e controle financeiro para motoristas de aplicativo e
        entregadores. Esta política explica quais dados pessoais tratamos, por quê e quais são os seus direitos, de acordo com a Lei Geral de
        Proteção de Dados (Lei 13.709/2018, LGPD).
      </p>
      <p>
        Responsável pelo tratamento: <strong>{APP_INFO.controller}</strong>. Contato para qualquer assunto sobre seus dados: <Contact />.
      </p>

      <h2>Dados que tratamos</h2>
      <ul>
        <li>
          <strong>Conta:</strong> nome e e-mail. Com e-mail e senha, a senha é guardada de forma criptografada pelo serviço de autenticação e nós
          não temos acesso a ela. Com o login do Google, recebemos do Google apenas nome, e-mail e foto do perfil.
        </li>
        <li>
          <strong>O que você registra:</strong> veículos (consumo, preços, custos), plataformas em que trabalha e jornadas (data, horários,
          hodômetro, ganhos e despesas).
        </li>
        <li>
          <strong>Dados técnicos:</strong> o navegador guarda localmente a sua sessão e preferências do app (como o período escolhido no painel).
          Não usamos cookies de publicidade, rastreamento nem ferramentas de análise de terceiros. Detalhes na{' '}
          <Link to="/cookies" className="text-link underline-offset-4 hover:underline">
            Política de Cookies
          </Link>
          .
        </li>
      </ul>

      <h2>Para que usamos</h2>
      <ul>
        <li>Criar e proteger a sua conta e permitir o login.</li>
        <li>Calcular e mostrar seus resultados: lucro, custo por km, fluxo de caixa e indicadores.</li>
        <li>Enviar e-mails necessários ao serviço, como confirmação de cadastro e redefinição de senha.</li>
      </ul>
      <p>
        Não vendemos, alugamos nem compartilhamos seus dados para publicidade. A base legal é a execução do contrato de uso do serviço (art. 7º, V,
        da LGPD) e, para segurança e prevenção de fraudes, o legítimo interesse (art. 7º, IX).
      </p>

      <h2>Onde os dados ficam e quem acessa</h2>
      <ul>
        <li>
          Banco de dados e autenticação: <strong>Supabase</strong>, em servidores em São Paulo (Brasil).
        </li>
        <li>
          Hospedagem do site: <strong>Cloudflare</strong>.
        </li>
        <li>
          Login com Google e envio de e-mails: <strong>Google</strong>.
        </li>
      </ul>
      <p>
        Esses fornecedores tratam os dados apenas para prestar o serviço. Cada conta só enxerga os próprios registros: o banco bloqueia o acesso de
        uma conta aos dados de outra. A comunicação é sempre criptografada (HTTPS).
      </p>
      <p>
        O uso de informações recebidas das APIs do Google segue a{' '}
        <a
          href="https://developers.google.com/terms/api-services-user-data-policy"
          target="_blank"
          rel="noreferrer"
          className="text-link underline-offset-4 hover:underline"
        >
          Política de Dados do Usuário dos Serviços de API do Google
        </a>
        , incluindo os requisitos de Uso Limitado.
      </p>

      <h2>Por quanto tempo guardamos</h2>
      <p>
        Enquanto a sua conta existir. Se você pedir a exclusão, apagamos a conta e todos os registros em até 30 dias, salvo o que a lei obrigar a
        manter.
      </p>

      <h2>Seus direitos</h2>
      <p>
        Pela LGPD (art. 18), você pode pedir a confirmação de que tratamos seus dados, acesso, correção, portabilidade, anonimização ou eliminação,
        informações sobre compartilhamento e revogar o consentimento. Basta escrever para <Contact />; respondemos em até 15 dias. Você também pode
        reclamar à Autoridade Nacional de Proteção de Dados (ANPD).
      </p>

      <h2>Menores de idade</h2>
      <p>O serviço é destinado a maiores de 18 anos.</p>

      <h2>Mudanças nesta política</h2>
      <p>Se esta política mudar de forma relevante, avisaremos no aplicativo. A data no topo indica a última atualização.</p>
    </LegalPage>
  )
}

const STORAGE_ITEMS: ReadonlyArray<{ name: string; purpose: string; duration: string }> = [
  { name: 'cashcontrol-auth', purpose: 'Mantém você conectado (sessão de login).', duration: 'Até você sair da conta' },
  { name: 'cashcontrol:periodo', purpose: 'Lembra o período escolhido no painel.', duration: 'Até você limpar os dados do navegador' },
  { name: 'cashcontrol:ultimo-veiculo', purpose: 'Sugere o último veículo usado ao registrar jornada.', duration: 'Até você limpar os dados do navegador' },
  { name: 'cashcontrol:aviso-cookies', purpose: 'Lembra que você já viu este aviso.', duration: 'Até você limpar os dados do navegador' },
  { name: 'Cache do app (service worker)', purpose: 'Guarda os arquivos do app para abrir rápido e instalar na tela inicial.', duration: 'Até a próxima versão do app' },
]

export function CookiesPage() {
  return (
    <LegalPage title="Política de Cookies">
      <p>
        O {APP_INFO.name} usa <strong>apenas armazenamento essencial</strong> no seu navegador: o necessário para você continuar conectado e para o
        app funcionar. Não usamos cookies de publicidade, de rastreamento ou de análise, nem compartilhamos esses dados com anunciantes.
      </p>
      <p>
        Em vez de cookies tradicionais, o app usa o <em>armazenamento local</em> do navegador (localStorage) e o cache do aplicativo. Como tudo é
        essencial ao serviço, não há categorias opcionais para aceitar ou recusar.
      </p>

      <h2>O que fica guardado no seu aparelho</h2>
      <div className="mt-3 overflow-x-auto rounded-xl border border-white/[0.08]">
        <table className="w-full text-left text-sm">
          <thead className="bg-white/[0.03] text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Item</th>
              <th className="px-3 py-2 font-medium">Para que serve</th>
              <th className="px-3 py-2 font-medium">Por quanto tempo</th>
            </tr>
          </thead>
          <tbody>
            {STORAGE_ITEMS.map((item) => (
              <tr key={item.name} className="border-t border-white/[0.06] align-top">
                <td className="px-3 py-2 font-mono text-xs text-foreground">{item.name}</td>
                <td className="px-3 py-2">{item.purpose}</td>
                <td className="px-3 py-2 text-muted-foreground">{item.duration}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Login com o Google</h2>
      <p>
        Se você entrar com o Google, a tela de login é do próprio Google, que usa os cookies dele no domínio google.com, conforme a política de
        privacidade do Google. O {APP_INFO.name} não recebe esses cookies.
      </p>

      <h2>Como apagar</h2>
      <p>
        Sair da conta apaga a sessão. Para apagar todo o resto, limpe os dados do site nas configurações do navegador. Se o app estiver instalado,
        desinstale-o.
      </p>

      <h2>Contato</h2>
      <p>
        Dúvidas: <Contact />. Veja também a{' '}
        <Link to="/privacidade" className="text-link underline-offset-4 hover:underline">
          Política de Privacidade
        </Link>
        .
      </p>
    </LegalPage>
  )
}

export function SecurityPage() {
  return (
    <LegalPage title="Segurança">
      <p>Seus números de trabalho são seus. Estas são as proteções do {APP_INFO.name}:</p>
      <ul>
        <li>
          <strong>Cada conta só vê os próprios dados.</strong> A regra está no próprio banco de dados (Row Level Security): mesmo com um erro no
          app, uma conta não consegue ler nem alterar registros de outra.
        </li>
        <li>
          <strong>Conexão sempre criptografada</strong> (HTTPS), com cabeçalhos de segurança que impedem o site de ser embutido em outras páginas e
          bloqueiam scripts de terceiros.
        </li>
        <li>
          <strong>Senhas protegidas:</strong> ficam criptografadas no serviço de autenticação; ninguém da equipe consegue vê-las. Exigimos pelo
          menos 8 caracteres, com letras e números.
        </li>
        <li>
          <strong>Dados no Brasil:</strong> o banco fica em servidores em São Paulo.
        </li>
        <li>
          <strong>Sem rastreadores:</strong> nada de anúncios, cookies de terceiros ou ferramentas de análise.
        </li>
        <li>
          <strong>Controle da sua conta:</strong> em <em>Mais</em>, você troca a senha e pode sair de todos os aparelhos de uma vez.
        </li>
      </ul>

      <h2>Encontrou uma falha?</h2>
      <p>
        Escreva para <Contact /> com os detalhes. Pedimos que não acesse dados de outras pessoas nem divulgue a falha antes de ela ser corrigida.
        Respondemos o mais rápido possível.
      </p>
    </LegalPage>
  )
}

export function TermsPage() {
  return (
    <LegalPage title="Termos de Uso">
      <p>
        Ao criar uma conta no <strong>{APP_INFO.name}</strong>, você concorda com estes termos. Leia também a{' '}
        <Link to="/privacidade" className="text-link underline-offset-4 hover:underline">
          Política de Privacidade
        </Link>
        .
      </p>

      <h2>O serviço</h2>
      <p>
        O {APP_INFO.name} ajuda motoristas e entregadores a registrar jornadas e acompanhar ganhos, custos e lucro. O uso é gratuito. Os cálculos são
        estimativas feitas a partir dos dados que você informa (consumo, preços, custos) e{' '}
        <strong>não substituem orientação financeira, contábil ou fiscal</strong>.
      </p>

      <h2>Sua conta</h2>
      <ul>
        <li>Você é responsável pelos dados que registra e por manter sua senha em segredo.</li>
        <li>É proibido tentar acessar dados de outras pessoas, sobrecarregar o serviço ou usá-lo para fins ilegais.</li>
        <li>Você pode encerrar sua conta a qualquer momento pedindo a exclusão pelo e-mail de contato.</li>
      </ul>

      <h2>Disponibilidade</h2>
      <p>
        Trabalhamos para manter o serviço no ar e os dados seguros, mas ele é oferecido como está, sem garantia de funcionamento ininterrupto.
        Podemos mudar ou encerrar funcionalidades; mudanças relevantes serão avisadas no aplicativo.
      </p>

      <h2>Lei aplicável</h2>
      <p>Estes termos seguem a legislação brasileira, incluindo o Código de Defesa do Consumidor.</p>

      <h2>Contato</h2>
      <p>
        Responsável: <strong>{APP_INFO.controller}</strong>. E-mail: <Contact />.
      </p>
    </LegalPage>
  )
}
