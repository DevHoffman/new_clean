# Plano de ação — o que falta para a loja ficar pronta

Base: conferência feita na loja real (`dfd10g-i2`, domínio `www.distribuidoranewclean.com.br`) com o tema `new_clean/main` publicado. Cada item tem **dono**, **depende de** e **pronto quando** (critério que dá para verificar).

**Donos:** **Claude** = eu faço com o CLI/Git já autorizados · **Você** = precisa do admin da loja ou de uma decisão · **Jurídico** = revisão legal · **Tiny** = precisa do ERP.

## Estado de hoje (verificado)

| Área | Situação |
| --- | --- |
| Tema publicado | `new_clean/main`, sincronizado com o GitHub; rodapé, menu e número novo no ar |
| Menu | Categorias · Ofertas · Mais vendidos · Novidades · Contato |
| Home | Mais vendidos e Novidades aparecem; "Em promoção agora" oculta (sem produto em promoção) |
| Coleções | `mais-vendidos` (250 produtos), `novidades`, `ofertas` (**vazia**) |
| Páginas | `contact`, `faq` (modelo certo) e `pedido-rapido` (sem uso) |
| Políticas | Privacidade e termos publicados; **envio, contato e aviso legal sem política**; reembolso "rever" |
| Checkout | Abre e recebe nome e CEP; pagamento ainda não testado |
| Frete | Cálculo por CEP corrigido (R$ 25,00 até R$ 149,99); regra do grátis acima de R$ 150 não confirmada |
| Contas de cliente | Contas novas (Shopify): login, endereços e pedidos do tema não são usados |

---

## Andamento

| Item | Situação |
| --- | --- |
| 1.1 Ofertas fora do menu | **Feito** (volta quando houver promoção) |
| 1.2 16 coleções por categoria | **Feito**: criadas e publicadas (alcool 33, desinfetantes 50, limpadores 104…) |
| 1.3 Menu com links para as coleções | **Feito** |
| 1.4 Excluir `menu-new-clean` | **Feito** |
| 1.5 E-mail público | **Feito** (`financeiro@`); razão social, CNPJ, endereço e horário **aguardam seus dados** |
| 1.6 Políticas de envio e contato | **Aguardando a revisão jurídica** (rascunhos prontos em `docs/politicas/`) |
| 1.7 Conferência em produção | Feita a cada entrega |

## Fase 1 — Eu resolvo agora (sem depender de ninguém, ~1 h)

Cada passo é simulado antes de gravar e verificado em produção depois.

| # | Ação | Depende de | Pronto quando |
| --- | --- | --- | --- |
| 1.1 | **Ofertas no menu:** tirar o item até haver promoções (ou manter, se você decidir) | Decisão sua | O menu não leva a página vazia |
| 1.2 | **Criar as 16 coleções por categoria** (automáticas, por título) e publicá-las na Loja online | Seu aval | Cada coleção responde 200 e tem 10+ produtos |
| 1.3 | **Menu com links para as coleções** (hoje as categorias levam a buscas) | 1.2 | Todos os itens de categoria levam a `/collections/…` |
| 1.4 | **Excluir o menu sem uso** `menu-new-clean` | — | Só `main-menu`, `footer` e o menu da conta restam |
| 1.5 | **E-mail público e dados da empresa** no rodapé e nos dados estruturados | Seus dados (fase 0) | Rodapé mostra razão social, CNPJ, endereço e e-mail reais |
| 1.6 | **Política de envio, contato e aviso legal:** carregar os rascunhos de `docs/politicas/` pelo CLI | Seu aval + escopo `write_legal_policies` | `/policies/shipping-policy` e `/policies/contact-information` respondem 200 |
| 1.7 | Rodar `npm run check`, commit, `pull --rebase`, push e **conferir a produção** (menu, rodapé, números) | 1.1–1.6 | Varredura de produção sem divergência |

## Fase 2 — Você, no admin (1 dia)

| # | Ação | Onde | Pronto quando |
| --- | --- | --- | --- |
| 2.1 | **Revisão jurídica** das políticas de reembolso, envio, privacidade e termos | Jurídico | Textos aprovados e publicados (R14) |
| 2.2 | **Banner de cookies (LGPD)** | Configurações > Privacidade do cliente | Aparece na 1ª visita e respeita a escolha (R15) |
| 2.3 | **Meios de pagamento:** Cielo/Stripe (cartão), Pix e boleto | Configurações > Pagamentos | Os 3 aparecem no checkout; as bandeiras no rodapé (R05) |
| 2.4 | **Desconto no Pix:** definir como é aplicado e marcar a confirmação no tema | Pagamentos + Configurações do tema > Preço e pagamento | Compra de teste com Pix mostra o desconto; só então o tema exibe "5% no Pix" (R06) |
| 2.5 | **Parcelamento 6x** igual ao contrato do gateway | Pagamentos | A simulação do checkout bate com o tema (R07) |
| 2.6 | **Frete grátis acima de R$ 150** e tarifas por região | Configurações > Frete e entrega | Carrinho de R$ 149 cobra; de R$ 150 não cobra (R08) |
| 2.7 | **Regras de devolução e cancelamento** (hoje: 7 dias, sem cancelamento) | Configurações > Políticas | Iguais ao que a empresa pratica |
| 2.8 | **Marca do checkout** (logo e cores) e e-mails de pedido | Configurações > Checkout | Checkout e e-mails com a identidade da loja (R10) |
| 2.9 | **Nota fiscal em todos os pedidos?** confirmar (o tema promete isso) | Operação | Se não for verdade, remover o item da faixa de benefícios (R13) |

## Fase 3 — Integração com o Tiny (depende do Tiny)

| # | Ação | Dono | Pronto quando |
| --- | --- | --- | --- |
| 3.1 | Criar o **aplicativo API v3** no Tiny (redirecionamento `http://localhost:3456/callback`) e guardar client id e secret | Você | Credenciais em mãos |
| 3.2 | Autorizar e testar: `npm run tiny:auth`, depois `tiny:sync -- --limit=3 --verbose` | Claude + você | Campos reais do Tiny batem com o mapeamento |
| 3.3 | Ajustar o mapeamento aos campos reais, se divergirem | Claude | Teste automático e simulação com 3 produtos corretos |
| 3.4 | **Simulação completa** de preço e estoque | Claude | Relatório sem erros; você valida uma amostra |
| 3.5 | **Gravar** 20 produtos, conferir no admin; depois todos | Claude + você | Preços e estoques batem com o Tiny |
| 3.6 | **Rodar todo dia** (o token do Tiny vence em ~24 h): servidor com disco persistente e agendamento | Você escolhe onde hospedar; Claude configura | Execução diária registrada; "Ofertas" passa a se preencher sozinha |
| 3.7 | Decidir se o Tiny também atualiza **título, descrição, marca e foto** (`--content`) | Você | Decisão registrada |

## Fase 4 — Catálogo (a maior alavanca de conversão)

| # | Ação | Dono | Pronto quando |
| --- | --- | --- | --- |
| 4.1 | Fotos dos **69 produtos disponíveis sem imagem** (`docs/catalogo/produtos-sem-foto.csv`): fundo branco, 1000 × 1000 px | Time (ou Tiny, se tiver) | 0 produtos disponíveis sem foto (R19) |
| 4.2 | **Descrição curta** dos 150 produtos prioritários (`docs/catalogo/descricoes-prioritarias.csv`) | Time | A caixa "Dúvidas sobre este produto?" some desses itens (R21) |
| 4.3 | **Segunda foto** (rótulo/verso) nos mais vendidos | Time | O hover troca a imagem (R20) |
| 4.4 | Preencher o **fornecedor (marca)** de cada produto | Time (ou Tiny) | Links de marca filtram por fornecedor (R22) |
| 4.5 | **Sinônimos de busca** (`docs/busca/sinonimos.md`) | Você, no Search & Discovery | "papel toalha" e "papel higiênico" encontram os produtos (R25) |

## Fase 5 — Aceite e medição

| # | Ação | Dono | Pronto quando |
| --- | --- | --- | --- |
| 5.1 | **Compra de teste** completa, no celular e no computador, com Pix, cartão e boleto; cancelar e reembolsar | Você (eu acompanho) | Os 9 passos de `docs/LANCAMENTO.md` seção 8 passam (R40) |
| 5.2 | **GA4:** eventos `view_item`, `add_to_cart`, `begin_checkout` e `purchase` chegando | Você | Compra de teste aparece no GA4 (R34) |
| 5.3 | **Search Console:** enviar o sitemap | Você | Sitemap "Sucesso" (R35) |
| 5.4 | **PageSpeed** na loja real depois dos apps | Claude | Desempenho mobile ≥ 70 em Home, coleção e produto (R37) |
| 5.5 | **Teste A/B** dos efeitos (preloader e rolagem) por 2 semanas | Você liga, Claude lê | Decisão registrada com conversão de cada variante (R38) |
| 5.6 | Automações: carrinho abandonado, recompra, alerta de estoque | Você (`docs/automacoes.md`) | 4 fluxos ativos (R36) |

---

## Ordem recomendada

1. **Hoje:** fase 0 (suas 3 decisões abaixo) e fase 1 (eu).
2. **Esta semana:** fase 2 (você) e 3.1 (credenciais do Tiny).
3. **Semana 2:** fase 3 completa e comece a fase 4.
4. **Antes de divulgar a loja:** 5.1 (compra de teste) e 2.2–2.6 concluídos.

## Fase 0 — Decisões e dados que preciso de você

1. **E-mail público** que aparece no rodapé: `adm@`, `financeiro@` ou outro.
2. **Razão social, CNPJ, endereço e horário** de atendimento.
3. **Ofertas:** tirar do menu até haver promoções, ou manter.
4. **Aval** para criar as 16 coleções (1.2) e carregar as políticas (1.6).

## Regras de trabalho

- Mudança no tema: `npm run check` → commit → `git pull --rebase origin main` → push → **conferir a produção**.
- Mudança de conteúdo (menu, coleção, política): script com simulação primeiro, gravação só com aval.
- O sincronismo do GitHub só envia arquivos alterados no commit e **descarta em silêncio** o que a Shopify recusa; por isso toda entrega termina com a conferência da produção.
- Nada de preço ou estoque é gravado pelo Tiny sem passar por simulação e amostra de 20 produtos.
