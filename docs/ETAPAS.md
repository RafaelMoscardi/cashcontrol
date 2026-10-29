# CashControl: etapas de entrega

Cada etapa termina com algo que dá para usar e testar. Uma etapa só começa quando os critérios da anterior passam.

Legenda: ✅ entregue e verificado · 🟡 em andamento · ⬜ não iniciado

---

## Etapa 0: fundação ✅

Arquitetura, projeto e banco prontos para receber funcionalidades.

**Entregáveis**
- Projeto React + TypeScript + Vite com Tailwind 4, shadcn/ui, Recharts, PWA.
- Arquitetura documentada ([ARQUITETURA.md](ARQUITETURA.md)).
- Migration inicial com todas as tabelas da etapa 1, RLS e função `save_shift`.
- Servidor Supabase local (PGlite) para desenvolver sem conta e sem Docker.
- CI no GitHub Actions: tipos, lint e testes.

**Critérios de aceitação**
- [x] `npm run check` passa (tipos, lint, testes de fórmulas e de banco).
- [x] A migration roda do zero num PostgreSQL limpo.
- [x] Testes provam que um usuário não lê, altera nem referencia dados de outro.

---

## Etapa 1: primeira entrega funcional ✅

Cadastro, veículo, jornada e painel com dados reais.

**Escopo**
1. Cadastro, login, logout, recuperação e redefinição de senha.
2. Primeiro acesso: escolher plataformas e cadastrar o primeiro veículo.
3. Veículos: criar, editar, arquivar; combustão (gasolina, etanol, diesel, GNV), híbrido, híbrido plug-in, elétrico; custos fixos.
4. Jornada: data, início, fim, pausa, hodômetro, ganhos por plataforma (líquido, gorjetas, bônus, corridas), despesas; cálculo ao vivo antes de salvar.
5. Histórico de jornadas com edição e exclusão.
6. Painel: filtro de período (hoje, semana, mês, mês anterior, datas personalizadas), indicadores, resultado operacional separado do fluxo de caixa, gráficos de receita × lucro por dia, receita por plataforma e composição de custos.

**Critérios de aceitação** (verificados em 25/10/2026 no servidor local, em 360, 390, 768 e 1280 px)
- [x] Criar conta, sair, entrar de novo e redefinir a senha pelo link de recuperação.
- [x] Um usuário novo é levado ao primeiro acesso e não chega ao painel sem veículo.
- [x] O formulário de veículo só pede os campos da motorização escolhida e recusa valores impossíveis (consumo zero, preço negativo).
- [x] Jornada de 08:00 às 18:00 com 1 h de pausa, 120 km, R$ 300 líquidos, carro a 12 km/l e R$ 6,00/l: mostra 9 h, energia R$ 60,00, lucro R$ 240,00, R$ 26,67/h e custo R$ 0,50/km, iguais antes e depois de salvar. (Até 29/10/2026 havia também a reserva por km; ela saiu do app.)
- [x] Abastecimento lançado na jornada aparece no fluxo de caixa e **não** reduz o lucro operacional.
- [x] Jornada com horário ou hodômetro sobreposto a outra é recusada com mensagem clara.
- [x] Editar uma jornada recalcula o painel; excluir remove do painel.
- [x] Mudar o preço do combustível do veículo não altera jornadas antigas.
- [x] Painel do mês com aluguel de R$ 2.400/mês desconta só os dias decorridos.
- [x] Layout sem rolagem horizontal em 360 px; barra inferior respeita a área segura; desktop com barra lateral.
- [x] App instalável (manifesto e service worker válidos no build de produção).

**Como testar:** `npm run dev:local` e seguir o roteiro em [PUBLICACAO.md](PUBLICACAO.md#roteiro-de-teste-da-etapa-1).

**Ainda não verificado:** contra um projeto Supabase hospedado (depende de você criar o projeto; o SQL é o mesmo que rodou nos testes) e em aparelho físico (área segura do iPhone, teclado, instalação).

---

## Etapa 2: metas e jornada ao vivo ⬜

**Escopo**
- Metas diária, semanal e mensal (de faturamento ou de lucro), com progresso no painel e quanto falta por hora/km.
- Meta mensal sugerida a partir dos custos fixos + renda desejada.
- "Iniciar jornada" agora (hora e hodômetro) e "Encerrar jornada" depois.
- Plataformas: cores, ordem e arquivamento na tela de plataformas.

**Critérios de aceitação**
- [ ] Meta semanal de R$ 1.500 com R$ 900 lucrados mostra 60% e o valor restante.
- [ ] Jornada iniciada aparece no topo do painel e não permite iniciar outra.
- [ ] Metas respeitam a semana de segunda a domingo e o mês civil.

---

## Etapa 3: despesas e fluxo de caixa ⬜

**Escopo**
- Despesas avulsas (fora de jornada): fixas recorrentes e variáveis.
- Pagamentos de custos fixos e parcelas entram no fluxo de caixa.
- Opção por veículo: custo de energia pela estimativa ou pelos abastecimentos.

**Critérios de aceitação**
- [ ] Troca de óleo de R$ 250 lançada avulsa reduz o lucro e o caixa do dia em que foi paga.
- [ ] Custo fixo marcado como pago aparece uma vez no caixa do mês.
- [ ] Nenhum valor aparece duas vezes no resultado operacional (teste automatizado cobrindo todas as categorias).

---

## Etapa 4: histórico completo e relatórios ⬜

**Escopo**
- Todos os lançamentos (jornadas e despesas) com busca, filtros e edição.
- Relatórios por plataforma e por veículo; comparação com o período anterior.
- Exportação CSV.

**Critérios de aceitação**
- [ ] Filtro por plataforma soma igual ao painel no mesmo período.
- [ ] CSV abre no Excel e Google Planilhas com acentos e vírgula decimal.

---

## Etapa 5: refinamentos ⬜

- Gravação offline com fila e sincronização.
- LGPD: exportar meus dados e excluir minha conta pelo app.
- Lembretes locais (registrar jornada, meta próxima).
- Testes ponta a ponta (Playwright) no CI contra o servidor local.
- Auditoria de acessibilidade e desempenho (Lighthouse ≥ 90 em PWA, acessibilidade e desempenho no celular).
