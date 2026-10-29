# CashControl: arquitetura

Documento de referência da primeira versão. Descreve camadas, pastas, modelo de dados, regras financeiras, navegação e design system. As etapas de entrega e os critérios de aceitação estão em [ETAPAS.md](ETAPAS.md); execução local e publicação, em [PUBLICACAO.md](PUBLICACAO.md).

## 1. Visão geral

```
 Navegador / PWA instalado (React 19 + Vite 8)
 ┌──────────────────────────────────────────────────────────────┐
 │ Telas (src/features/*/pages)                                 │
 │   ↓ usam                                                     │
 │ Componentes (src/components/ui = shadcn, src/components/app) │
 │   ↓ leem/gravam por                                          │
 │ Hooks de dados (TanStack Query)  →  API da feature (api.ts)  │
 │   ↓ calculam com                          ↓ fala com         │
 │ Domínio puro (src/domain): fórmulas,   Supabase JS           │
 │ datas, dinheiro. Sem React, sem rede.  (auth + PostgREST)    │
 └──────────────────────────────────────────────┬───────────────┘
                                                │ HTTPS
 Supabase (plano gratuito)                      ▼
 ┌──────────────────────────────────────────────────────────────┐
 │ Auth (e-mail e senha)   PostgreSQL + RLS por usuário          │
 │ Função save_shift (gravação atômica da jornada)               │
 └──────────────────────────────────────────────────────────────┘
 Hospedagem: Cloudflare Pages (arquivos estáticos + service worker)
```

Princípios:

1. **Fórmulas em um lugar só.** Todo cálculo financeiro mora em `src/domain` (TypeScript puro, com testes). O banco guarda fatos (o que aconteceu e os parâmetros vigentes na época), nunca resultados calculados que possam divergir.
2. **O banco protege os dados.** RLS isola cada usuário, chaves estrangeiras compostas impedem referência a dados de outra conta, `CHECK` e restrições de exclusão impedem lançamentos impossíveis ou duplicados.
3. **Sem mocks no produto.** O app sempre fala com um Supabase de verdade. Para desenvolver sem conta e sem Docker existe o servidor local (`scripts/local-supabase`), que roda as mesmas migrations num PostgreSQL embutido (PGlite) e expõe a mesma API que o app usa. Ele é ferramenta de desenvolvimento e teste, não entra no build.
4. **Mobile primeiro.** Tudo é desenhado para 360 px de largura com uma mão; o desktop ganha barra lateral e grades mais largas.

## 2. Stack

| Camada | Escolha | Por quê |
| --- | --- | --- |
| UI | React 19, TypeScript 6, Vite 8 | Obrigatórios; build rápido e estático |
| Estilo | Tailwind CSS 4 + shadcn/ui (Radix, preset Nova) | Componentes acessíveis que ficam no repositório |
| Gráficos | Recharts 3 (via `components/ui/chart`) | Obrigatório; tema pelos tokens CSS |
| Rotas | React Router 8 (modo biblioteca) | Rotas aninhadas e guardas simples |
| Dados remotos | TanStack Query 5 | Cache, estados de carregamento e invalidação |
| Formulários | React Hook Form + Zod 4 | Validação tipada, mensagens em português |
| Backend | Supabase (Auth + PostgreSQL) | Obrigatório; plano gratuito |
| PWA | vite-plugin-pwa (Workbox) | Instalação e cache do app shell |
| Testes | Vitest + PGlite | Fórmulas e banco (migrations, RLS) sem Docker |
| Lint | oxlint | Padrão do template atual do Vite |
| Hospedagem | Cloudflare Pages | Gratuito, CDN, deploy por Git |

## 3. Estrutura de pastas

```
cashcontrol/
├─ docs/                      arquitetura, etapas, publicação
├─ public/                    ícones, _headers (Cloudflare)
├─ scripts/
│  ├─ dev-local.ts            sobe servidor local + Vite juntos
│  └─ local-supabase/         Supabase local de desenvolvimento (PGlite)
├─ supabase/
│  ├─ migrations/             SQL versionado (fonte da verdade do banco)
│  └─ tests/                  testes do banco: schema, RLS, função save_shift
└─ src/
   ├─ app/                    providers, rotas, layouts, guardas
   ├─ components/
   │  ├─ ui/                  shadcn/ui (gerado, editável)
   │  └─ app/                 componentes do produto (MoneyInput, StatCard…)
   ├─ domain/                 regras de negócio puras + testes
   │  ├─ money.ts             centavos, arredondamento
   │  ├─ energy.ts            custo de energia por km (combustão, elétrico, híbridos)
   │  ├─ fixed-costs.ts       rateio diário de custos fixos
   │  ├─ shift.ts             resultado de uma jornada
   │  ├─ period.ts            resumo de período (operacional × caixa)
   │  └─ dates.ts             períodos, dias locais
   ├─ features/
   │  ├─ auth/                login, cadastro, recuperação de senha
   │  ├─ onboarding/          primeiro acesso: plataformas + veículo
   │  ├─ vehicles/            veículos e custos por veículo
   │  ├─ platforms/           plataformas de trabalho
   │  ├─ shifts/              jornadas (lista, formulário, cálculo ao vivo)
   │  ├─ dashboard/           painel com filtros e gráficos
   │  └─ settings/            "Mais": conta, instalar app, sair
   ├─ lib/                    supabase, query client, formatação pt-BR, erros
   └─ types/database.ts       tipos das tabelas (espelham as migrations)
```

Cada feature segue o mesmo desenho: `api.ts` (acesso ao Supabase, conversão de linhas para tipos do domínio e os hooks do TanStack Query), `schema.ts` (Zod e conversão formulário ↔ banco), `labels.ts` (textos), os componentes e `pages.tsx`. Telas não chamam o Supabase diretamente.

## 4. Modelo de dados

Todas as tabelas têm `user_id` com padrão `auth.uid()`, RLS ligado e políticas `select/insert/update/delete` restritas a `user_id = auth.uid()`. Referências entre tabelas usam chave composta `(id, user_id)`, então nem com um UUID de outra conta é possível ligar dados entre usuários.

```
auth.users ─1:1─ profiles
    │
    ├─1:N─ vehicles ──────────────┐
    ├─1:N─ platforms ─────┐       │
    └─1:N─ shifts ────────┼───────┘ (vehicle_id)
              ├─1:N─ shift_earnings (platform_id, único por jornada)
              └─1:N─ expenses (shift_id opcional; vehicle_id opcional)
```

| Tabela | Conteúdo | Regras importantes |
| --- | --- | --- |
| `profiles` | nome, data de conclusão do onboarding | criada por gatilho no cadastro |
| `vehicles` | tipo (carro, moto), motorização (combustão, híbrido, híbrido plug-in, elétrico), combustível, consumo, preço, km/kWh, R$/kWh, custos fixos (aluguel semanal ou mensal, seguro, IPVA e licenciamento, outros, parcela do financiamento) | `CHECK` exige a configuração de energia certa para cada motorização; moto só combustão ou elétrica |
| `platforms` | nome, tipo, cor | nome único por usuário; arquivar em vez de apagar |
| `shifts` | data, início, fim, pausa, hodômetro inicial e final, **foto dos custos do veículo** (R$/km de energia + parâmetros usados) | fim > início; até 24 h; pausa menor que a duração; hodômetro final ≥ inicial; **sem sobreposição de horário por usuário e de hodômetro por veículo** (restrições `EXCLUDE`) |
| `shift_earnings` | por plataforma: valor recebido (líquido da taxa da plataforma), gorjetas, bônus, corridas | uma linha por plataforma por jornada |
| `expenses` | categoria, valor, descrição, data | na jornada ou avulsa (avulsa entra na etapa 3); data e veículo sincronizados com a jornada por gatilho |

A jornada é gravada pela função `save_shift(p_shift, p_earnings, p_expenses)`, que insere ou atualiza a jornada e substitui seus ganhos e despesas **numa única transação** (`security invoker`, então o RLS continua valendo).

**Foto dos custos.** Ao registrar uma jornada, o app grava o custo por km vigente naquele dia. Se o preço do combustível mudar amanhã, o lucro de ontem não muda. Na edição, a foto é mantida; o usuário pode pedir para recalcular com a configuração atual do veículo.

## 5. Regras financeiras

### 5.1 Unidades

- Dinheiro em **centavos inteiros** dentro do domínio; arredondamento só na borda de cada jornada (meio para cima). Totais de período somam centavos, sem nova perda.
- Taxas por km guardadas com 5 casas (`numeric(10,5)`), a mesma que o app usa para calcular a prévia antes de salvar.
- Combustão: km/l e R$/l (GNV: km/m³ e R$/m³). Elétrico: km/kWh e R$/kWh. Híbrido comum: como combustão. Híbrido plug-in: mistura pelo percentual rodado no modo elétrico.

### 5.2 Uma despesa entra em um lugar só

| Item | Resultado operacional | Fluxo de caixa |
| --- | --- | --- |
| Ganho da plataforma | valor **líquido** que a plataforma pagou | entra |
| Taxa da plataforma | **não é lançada** (já está descontada do líquido) | — |
| Combustível ou recarga | **estimativa** = km × custo por km | abastecimentos e recargas **pagos** |
| Manutenção, pedágio, estacionamento, alimentação, lavagem, celular, taxas, multas | valor lançado | valor lançado |
| Aluguel, parcela do financiamento, seguro, IPVA, outros fixos | **rateio diário** pelos dias do período | pagamentos entram na etapa 3 |

Assim, um abastecimento lançado na jornada nunca soma com a estimativa de combustível.

As reservas por km (manutenção, pneus e depreciação) saíram do app em 29/10/2026: o usuário quer ver quanto fez no dia. A manutenção paga passou a ser despesa do dia, e a parcela do financiamento entrou nos custos fixos. As colunas antigas continuam no banco, sempre zeradas.

### 5.3 Jornada

```
km                 = hodômetro final − hodômetro inicial
horas trabalhadas  = (fim − início) − pausa
receita            = Σ (líquido + gorjetas + bônus) das plataformas
energia estimada   = km × custo de energia por km
                     (elétrico com os kWh do medidor: kWh × preço do kWh, guardados na foto de custos)
despesas operac.   = Σ despesas da jornada exceto combustível
lucro da jornada   = receita − energia − despesas operacionais
custo por km       = (energia + despesas operacionais) ÷ km
ganho por hora     = lucro da jornada ÷ horas trabalhadas
```

### 5.4 Período (painel)

```
custos fixos do período = Σ por dia (mensal ÷ dias do mês, semanal ÷ 7, anual ÷ dias do ano)
                          contando só dias entre o início dos custos do veículo e hoje
resultado operacional   = Σ lucro das jornadas − custos fixos do período
fluxo de caixa          = receita − todas as despesas pagas (inclusive combustível)
```

Um mês completo soma exatamente o valor mensal; "este mês" conta só os dias até hoje.

## 6. Navegação

Rotas em português.

| Rota | Tela | Acesso |
| --- | --- | --- |
| `/entrar`, `/criar-conta`, `/recuperar-senha`, `/redefinir-senha` | autenticação | público |
| `/bem-vindo` | onboarding (plataformas e primeiro veículo) | logado, sem onboarding |
| `/` | painel | logado |
| `/jornadas`, `/jornadas/nova`, `/jornadas/:id` | histórico e formulário | logado |
| `/veiculos`, `/veiculos/novo`, `/veiculos/:id` | veículos | logado |
| `/plataformas` | plataformas | logado |
| `/mais` | conta, instalar app, sair | logado |

- **Celular:** barra inferior flutuante e arredondada com Painel, Jornadas, botão central "+" (nova jornada), Veículos e Mais. Respeita a área segura do iPhone.
- **Desktop (≥ 1024 px):** barra lateral fixa com os mesmos destinos e o botão "Registrar jornada" no topo; conteúdo com largura máxima.

## 7. Design system

Escuro sempre, preto e grafite com roxo como cor de ação.

| Token | Valor | Uso |
| --- | --- | --- |
| `--background` | `#0b0a10` | fundo do app |
| `--card` | `#14131b` | cartões |
| `--secondary`/`--muted` | `#1c1b25` | campos, áreas secundárias |
| `--border` | branco 8% | linhas finas |
| `--primary` | `#8b5cf6` (roxo) | botões, foco, item ativo |
| `--primary-strong` | `#7c3aed` | pressionado, gradiente |
| `--positive` | `#34d399` | lucro, metas batidas (sempre com sinal ou ícone) |
| `--negative` | `#f87171` | prejuízo, erros |
| `--warning` | `#fbbf24` | avisos |

- **Tipografia:** Geist Variable (auto-hospedada, funciona offline). Números de colunas com `tabular-nums`; números grandes com algarismos proporcionais.
- **Raios:** 12 px em campos e botões, 20 px em cartões, barra inferior em pílula.
- **Movimento:** pressionar escala 0,97 em 120 ms; folhas e diálogos entram com `cubic-bezier(0.32, 0.72, 0, 1)`; nada anima em ações repetitivas; `prefers-reduced-motion` remove deslocamentos.
- **Toque:** alvos ≥ 44 px, campos com 16 px (sem zoom no iOS), teclado numérico certo em cada campo (`inputmode`), sem destaque azul ao tocar, hover só em dispositivos com mouse.
- **Gráficos:** marcas finas (barras ≤ 24 px, cantos de 4 px), grade em linha fina sólida, legenda sempre que houver duas séries ou mais, cores categóricas em ordem fixa validadas para daltonismo, texto nunca na cor da série, tabela alternativa para cada gráfico.
- **Formatação:** `Intl` em pt-BR: `R$ 1.234,56`, `1.234,5 km`, `25/10/2026`, `14:30`, `8 h 30 min`.

## 8. Segurança

- RLS em todas as tabelas; chave `anon`/publishable no front é pública por design; a chave secreta nunca vai para o front nem para o repositório.
- `security definer` só no gatilho de criação de perfil, com `search_path` vazio.
- Cabeçalhos HTTP na Cloudflare: CSP restrita ao próprio domínio e ao Supabase, `frame-ancestors 'none'`, `nosniff`, `Referrer-Policy`.
- O service worker não guarda respostas do Supabase: dado financeiro sempre vem do servidor.
