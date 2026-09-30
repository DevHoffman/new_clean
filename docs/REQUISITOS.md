# Requisitos para a nota 10

Nota atual (30/09/2026): loja 7,5 · tema 9,0. Cada requisito abaixo tem um critério de aceite verificável; marque `[x]` só quando o critério for cumprido.

**Prioridade:** P0 = bloqueia a publicação · P1 = primeiras 2 semanas · P2 = otimização contínua.
**Responsável:** **Dono** = quem tem acesso de administrador à loja · **Time** = quem cadastra conteúdo · **Dev** = código do tema · **Jurídico** = revisão legal.

---

## Entregue no front-end (30/09/2026)

Itens que dependiam apenas do código do tema; o que resta neles é uma ação no admin ou conteúdo, indicada em cada linha por **[front ✔]**.

| Requisito | O que o tema passou a fazer | O que ainda falta (fora do código) |
| --- | --- | --- |
| R09 | Tokens `[frete]`, `[pix]`, `[parcelas]` na barra de anúncios, faixa de benefícios e banner; frases com Pix somem sem a confirmação | Conferir os valores em R05–R08 |
| R22 | Marcas com link "por fornecedor" | Preencher o fornecedor por produto (R22) |
| R24 | Seção "Mais vendidos"/"Novidades" oculta se a coleção não existir | Criar a coleção (R24) |
| R31 | Vídeo de fundo no banner | Gravar e enviar o vídeo |
| R32, R34, R39 | 16 eventos de análise, GTM só após consentimento | ID do GTM, GA4, banner de privacidade (R15) |
| R38 | Teste A/B dos efeitos | Ligar o teste e esperar 2 semanas de dados |

**Rodada 2 (front-end):** filtros e ordenação nos resultados da busca; `robots.txt` próprio (bloqueia filtros, ordenação, cupons e a variante do teste A/B); build minificado com `npm run build`; meta descrição do Pedido rápido corrigida. Acessibilidade medida pelo Lighthouse: 100 em 7 páginas.

Não são de front-end (dependem de acesso à loja, do admin ou de conteúdo): R01–R08, R10, R11, R12–R21, R23, R25–R30, R33, R35–R37, R40. R03 (validar no Liquid real) e R11 (preenchimento do checkout) têm código pronto, mas só podem ser confirmados com acesso à loja.

---

## A. Acesso e publicação

| ID | Pri. | Resp. | Requisito | Critério de aceite |
| --- | --- | --- | --- | --- |
| R01 | P0 | Dono | Dar acesso à loja `dfd10g-i2` a quem desenvolve (funcionário com permissão "Temas", colaborador via Partners, ou app Theme Access) | `npm run dev` abre o tema sobre a loja sem o erro "você não tem acesso" |
| R02 | P0 | Dev | Enviar o tema como **não publicado** (`npm run push`) e conferir no editor | Tema aparece na biblioteca, sem publicar; home, produto, carrinho e busca abrem sem erro de Liquid |
| R03 | P0 | Dev | Validar o tema contra o Liquid real da Shopify (a pré-visualização local é uma emulação e pode divergir) | Todas as páginas renderizam em `shopify theme dev` sem "Liquid error" e sem "translation missing"; diferenças corrigidas |
| R04 | P0 | Dono | Confirmar o tipo de conta de cliente em Configurações > Contas de cliente. As páginas de conta do tema (pedidos, "Comprar novamente", endereços) só funcionam nas **contas clássicas**; nas "novas contas" a Shopify hospeda a área e ignora esses modelos | Decisão registrada: manter clássicas (tema completo) ou usar novas (remover a promessa de "Comprar novamente") |

## B. Pagamento, preço e frete (o que é anunciado precisa ser cobrado)

| ID | Pri. | Resp. | Requisito | Critério de aceite |
| --- | --- | --- | --- | --- |
| R05 | P0 | Dono | Ativar os meios de pagamento: Cielo e/ou Stripe (cartão), Pix e boleto, conforme contratos | Os quatro aparecem no checkout; as bandeiras aparecem no rodapé |
| R06 | P0 | Dono | Definir como o **desconto do Pix (5%)** é aplicado (gateway ou app de desconto por forma de pagamento) e marcar "Confirmo que este desconto é aplicado no checkout" no tema | Compra de teste com Pix mostra o desconto no checkout; só então a opção do tema fica marcada. Sem a marcação, nenhum preço Pix aparece |
| R07 | P0 | Dono | Parcelamento (12x) e parcela mínima iguais ao contrato do gateway | Simulação no checkout bate com o que o tema exibe |
| R08 | P0 | Dono | Regra de **frete grátis acima de R$ 150** e tarifas por região em Configurações > Frete e entrega | Carrinho de R$ 149 cobra frete; de R$ 150 não cobra; barra do carrinho concorda |
| R09 | P0 | Dev | **[front ✔]** Textos com promessas (frete, Pix, parcelas) agora vêm das configurações por tokens `[frete]`, `[pix]`, `[parcelas]`; frases com Pix somem se o desconto não estiver confirmado. Revisar os textos livres que prometem condições: barra de anúncios, faixa de benefícios, linha do banner, selo da vitrine, promoção | Cada promessa (frete, Pix, 12x, nota fiscal, entrega) confere com R05–R08 e com a operação |
| R10 | P1 | Dono | Configurar a **marca do checkout** (logo, cores azul/amarelo) em Configurações > Checkout e personalizar os e-mails de pedido | Checkout e e-mails com a identidade da loja |
| R11 | P1 | Dev | Confirmar o **preenchimento automático do checkout** pelo link de carrinho (e-mail, nome, CEP, cupom, atributos) | Compra de teste: dados chegam preenchidos e CPF/CNPJ, empresa e forma de pagamento aparecem no pedido no admin. Se não chegarem, trocar para "Formulário padrão" |

## C. Confiança e conformidade

| ID | Pri. | Resp. | Requisito | Critério de aceite |
| --- | --- | --- | --- | --- |
| R12 | P0 | Dono | Preencher **Dados da empresa** (razão social, CNPJ, endereço) | Aparecem no rodapé (coluna da marca e Atendimento) e no JSON-LD |
| R13 | P0 | Dono | Confirmar que a **nota fiscal é emitida em todos os pedidos** | Se sim, mantém o item "Nota fiscal" da faixa de benefícios; se não, remover o bloco |
| R14 | P0 | Jurídico | Revisar e publicar as **políticas** (`docs/politicas/`) em Configurações > Políticas | 5 páginas publicadas; links em "Links úteis" abrem sem erro |
| R15 | P0 | Dono | Ativar o **banner de cookies/consentimento** (Configurações > Privacidade do cliente), exigência da LGPD; o tema não tem banner próprio | Banner aparece na primeira visita e respeita a escolha |
| R16 | P1 | Dono | Dados reais de contato: e-mail, horário, redes sociais (o telefone 27 99291-8283 já está configurado) | Central de ajuda, rodapé e contato mostram dados reais, sem "example.com" |
| R17 | P1 | Time | Instalar app de **avaliações** e ativar pedido automático 7 dias após a entrega | Estrelas aparecem no cartão, produto e busca (metacampos `reviews.rating`) |
| R18 | P1 | Dono/Time | Coletar 3+ **depoimentos reais** de clientes empresariais, com autorização | Seção de depoimentos publicada na home com nome/empresa reais |

## D. Catálogo (maior alavanca de conversão)

| ID | Pri. | Resp. | Requisito | Critério de aceite |
| --- | --- | --- | --- | --- |
| R19 | P0 | Time | Fotos dos **69 produtos disponíveis sem imagem** (`docs/catalogo/produtos-sem-foto.csv`); fundo branco, produto inteiro, 1000×1000 px | 0 produtos disponíveis exibindo "Imagem em breve" |
| R20 | P1 | Time | Restantes 52 produtos sem foto (indisponíveis) e **segunda foto** (verso/rótulo) nos mais vendidos | Hover troca a imagem nesses produtos |
| R21 | P1 | Time | Descrição de 2–3 linhas nos **150 produtos prioritários** (`docs/catalogo/descricoes-prioritarias.csv`) | 150 produtos com descrição; a caixa "Dúvidas sobre este produto?" some deles |
| R22 | P1 | Time | **[front ✔]** Marcas com link por fornecedor prontas (basta preencher o campo). Preencher **fornecedor (marca)** de cada produto; tipo de produto quando possível | Campo "Fornecedor" preenchido em 100% dos produtos disponíveis |
| R23 | P1 | Time | Criar as **16 coleções automáticas** (`docs/colecoes.md`) e trocar links de busca do menu e das categorias da home por elas | Menu e categorias apontam para coleções; cada coleção com 10+ produtos |
| R24 | P0 | Time | **[front ✔]** Seção some sozinha se a coleção não existir ou estiver vazia. Criar a coleção **"Mais vendidos"** com endereço `mais-vendidos` e ordenação "Mais vendidos" (no preview ela é simulada) | Seção "Mais vendidos" da home mostra 8 produtos reais; sem isso a seção fica vazia |
| R25 | P1 | Time | Configurar **sinônimos de busca** (`docs/busca/sinonimos.md`) e filtros no Search & Discovery | Buscar "papel toalha" encontra "TOA DE PAPEL…"; filtros de disponibilidade, preço e marca ativos |
| R26 | P2 | Time | Configurar **produtos complementares** (alimentam o "Compre junto") | Pares principais (dispenser + refil, balde + mop) aparecem na página de produto |
| R27 | P1 | Time | Normalizar títulos em CAIXA ALTA no cadastro (ou manter a normalização do tema) e completar abreviações | Títulos legíveis sem depender do tema; busca acha por nome completo |

## E. Home, ofertas e páginas

| ID | Pri. | Resp. | Requisito | Critério de aceite |
| --- | --- | --- | --- | --- |
| R28 | P0 | Time | Criar as páginas **Pedido rápido** (modelo `page.pedido-rapido`), **Contato** (`page.contact`) e **Dúvidas frequentes** (`page.faq`) com os endereços usados no tema | `/pages/pedido-rapido`, `/pages/contact` e `/pages/faq` abrem; central de ajuda e menu apontam para elas |
| R29 | P0 | Time | Criar os menus `main-menu` e `footer` no admin | Cabeçalho e rodapé exibem os menus reais |
| R30 | P1 | Time | Trocar o bloco de promoção por uma **oferta real** e criar o desconto correspondente em Descontos; escolher o modo do contador | Oferta com desconto aplicado no checkout; contador só usa modos recorrentes se a oferta realmente se repete |
| R31 | P1 | Time | **[front ✔]** Banner aceita vídeo de fundo (pausa com "reduzir movimento"/economia de dados). Foto ou **vídeo da operação** (estoque, entrega, equipe) para o banner | Banner usa mídia real ou a vitrine de produtos, decisão registrada |
| R32 | P2 | Dev | **[front ✔]** Eventos `section_view` e `scroll_depth` prontos. Medir a rolagem da home e decidir se corta blocos (segmentos, marcas); a home tem 12 blocos | Decisão baseada em mapa de calor/profundidade de rolagem |
| R33 | P2 | Time | Preço por quantidade para empresas (catálogo B2B da Shopify ou app de volume) | Faixas de preço aparecem na página de produto e no cartão |

## F. Medição e otimização

| ID | Pri. | Resp. | Requisito | Critério de aceite |
| --- | --- | --- | --- | --- |
| R34 | P0 | Time | **[front ✔]** Eventos do tema e GTM com consentimento prontos (`docs/analytics/eventos.md`). **GA4** (app Google & YouTube ou `docs/analytics/pixel-ga4.js`, nunca os dois) e pixel da Meta | Eventos `view_item`, `add_to_cart`, `begin_checkout` e `purchase` chegam no GA4 em compra de teste |
| R35 | P1 | Time | Enviar o sitemap ao **Google Search Console** | Sitemap "Sucesso" no Search Console |
| R36 | P1 | Time | Ativar as **automações** (`docs/automacoes.md`): checkout abandonado, recompra, tag de cliente empresa, alerta de estoque | 4 fluxos ativos; teste de checkout abandonado recebido |
| R37 | P1 | Dev | **PageSpeed** na loja real depois de instalar os apps | Desempenho mobile ≥ 70 em home, coleção e produto; cada app novo reavaliado |
| R38 | P2 | Dev/Time | **[front ✔]** Teste A/B dos efeitos pronto (setting + evento `fx_variant`). Testar por 2 semanas com e sem preloader e rolagem com inércia; manter o que converter melhor | Decisão registrada com taxa de conversão e rejeição de cada variante |
| R39 | P2 | Dev | **[front ✔]** Eventos para as métricas prontos. Acompanhar semanalmente conversão, ticket médio, % de carrinhos que chegam ao checkout e buscas sem resultado | Painel/planilha semanal com as 4 métricas por 4 semanas |

## G. Compra de teste (aceite final)

| ID | Pri. | Resp. | Requisito | Critério de aceite |
| --- | --- | --- | --- | --- |
| R40 | P0 | Dono/Dev | Executar o **roteiro de compra de teste** de `docs/LANCAMENTO.md` (seção 8) no celular e no computador, com Pix, cartão parcelado e boleto | Os 9 passos do roteiro passam; pedidos de teste cancelados e reembolsados |

---

## Resumo por prioridade

- **P0 (bloqueia a publicação): 19 itens** — R01–R09, R12–R15, R19, R24, R28, R29, R34, R40.
- **P1 (primeiras 2 semanas): 16 itens** — R10, R11, R16–R18, R20–R23, R25, R27, R30, R31, R35–R37.
- **P2 (otimização): 5 itens** — R26, R32, R33, R38, R39.

## Como cada bloco move a nota

| Bloco concluído | Nota da loja |
| --- | --- |
| Hoje | 7,5 |
| A + B + C (P0) + G: loja no ar e testada | 8,5 |
| + D (catálogo) | 9,0 |
| + R17/R18/R31 (prova social e mídia real) | 9,5 |
| + F com um mês de dados | 10 |

O que não depende de ninguém além do código (Dev) já está entregue; os itens de Dev que restam (R03, R11, R37) só podem ser executados depois de R01.
