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
| 2.9 | ~~Nota fiscal em todos os pedidos?~~ **Resolvido:** a equipe emite a nota em segundo plano depois da compra | Operação | Nada a fazer (R13) |

## Fase 3 — Integração com o Tiny (depende do Tiny)

> **Descoberta (01/10/2026):** o app **Sistema ERP da Olist (Tiny)** já está **instalado e ativo** na loja desde 02/12/2025, com acesso a Produtos, Encomendas e Outros dados e atividade recente (Produtos há 1 hora, Encomendas há 5 horas). Ou seja, o Tiny **já alimenta a Shopify**: os 1.133 produtos com SKU numérico, título em caixa alta e "Comparar a" igual ao preço vêm dele. **Não rodar `tiny:sync --apply`** enquanto o app estiver ativo (dois escritores sobre os mesmos produtos). O trabalho passa a ser **conferir e ajustar a configuração do app no Tiny** (Configurações > E-commerce > Integrações > Shopify): quais campos ele envia (título, descrição, marca, categoria, fotos), qual preço usa e se o preço promocional vira "Comparar a", qual depósito alimenta o estoque e o que fazer com estoque zero. **Descrição, foto e marca devem ser corrigidas no Tiny**, não na Shopify, senão a próxima sincronização sobrescreve.

> **Evidência medida na Shopify (01/10/2026, somente leitura):** o app atualiza o **estoque a cada poucos minutos** (16 produtos alterados no dia, 54 em 7 dias, 208 em 30), com quantidades reais (450, 32, 27, 0) e controle de estoque ligado; o preço é sincronizado, mas **"Comparar a" é sempre igual ao preço**, então nenhuma promoção do Tiny chega à loja hoje. Há 3 produtos "Example product" (de março) que parecem sobras da Shopify.

> **Bloqueio:** quem configura o app é quem tem **acesso ao Tiny**. Ação **3.0 (você):** descobrir quem instalou o app em 02/12/2025 (Definições > Utilizadores e o e-mail financeiro) e pedir que essa pessoa mande os prints das abas Produtos, Preços, Estoque e Pedidos da integração, ou que adicione você como usuário no Tiny. O script próprio também precisaria de acesso ao Tiny, então não contorna isso.

> **Diagnóstico do app no Tiny (01/10/2026, relatório da sessão com o navegador):**
> - **Preço:** regra "Preço fixo"; o anúncio tem campo de preço promocional com datas, mas **todos os 5 produtos amostrados têm promocional 0**. Não existe regra "de-por"; só um teste mostra se o promocional vira "Comparar a".
> - **Preço possivelmente desatualizado:** o Desinfetante Wave 5L (SKU 57282) está a **R$ 22,44 no Tiny** e a **R$ 18,58 na Shopify** (alterado pela última vez em 20/07). Os outros 4 produtos conferem. É preciso medir o tamanho do problema (`integracoes/tiny/compare-export.js`).
> - **Produtos:** descrição complementar **não é enviada**; fotos só para **produtos novos**; marca e categoria **não são enviadas**; o SKU é atualizado na importação. Consequência boa: **descrição e fotos extras podem ser feitas direto na Shopify sem serem sobrescritas.**
> - **Estoque:** envia o saldo disponível do depósito "Todos próprios", sem estoque de segurança, lançamento da saída ao salvar o pedido.
> - **Pedidos:** sincronização automática ligada, rastreio enviado ao marcar "enviado", mas o **mapeamento de situações está vazio**, as formas de recebimento estão "Não definida" e não foi achada emissão automática de nota fiscal.
> - **Catálogo:** 1.543 produtos ativos no Tiny, **416 fora da Shopify**.
> - **Atenção:** a sessão com o navegador inativou a integração por engano e ela foi reativada; confirmar que está **Ativa** e que o estoque voltou a atualizar.

> **Comparação com a exportação do Tiny (01/10/2026, 1.543 produtos ativos × 1.133 na Shopify, somente leitura):**
> - **Preço:** 1.035 produtos casaram por SKU; **122 têm preço diferente** (102 mais baratos na Shopify, 20 mais caros). 59 deles foram atualizados em setembro (o estoque sincroniza, o preço não). A integração parece **não propagar mudanças de preço**.
> - **Estoque:** 71 diferenças, 70 com a Shopify abaixo do Tiny por poucas unidades, o que é esperado (o app envia o saldo disponível, sem as reservas). Estoque está saudável.
> - **Fora da loja:** 395 ativos com SKU não estão na Shopify (83 vendáveis: preço, estoque e foto; muitos são itens de outros ramos, como agendas e água mineral). Mais 104 ativos no Tiny **sem SKU**, 10 SKUs repetidos no Tiny e 95 variantes sem SKU na Shopify.
> - **Cadastro do Tiny:** 0 produtos com preço promocional, 0 com marca, 0 com descrição complementar, 531 com categoria, 1.102 com 1 foto e nenhum com 2 ou mais.

> **Decisão do dono (01/10/2026): o preço da loja é o da Shopify.** O Tiny **não envia preço sozinho** (só estoque é automático; preço e produtos novos são enviados manualmente por "enviar preços" e "enviar para o e-commerce"), então as 118 diferenças de preço permanecem como estão: a Shopify foi alterada por último e continua assim. **Nada de preço será alterado nem automatizado.** Consequências:
> - **Promoções podem ser feitas direto na Shopify** (campo "Comparar a" maior que o preço), sem concorrer com o Tiny, enquanto ninguém usar o envio manual de preços. É assim que a coleção Ofertas e o bloco "Em promoção agora" passam a ter produtos.
> - **Atenção da equipe:** se alguém clicar em **"enviar preços para o e-commerce"** (ou no envio em lote) no Tiny, os preços da Shopify daquele produto voltam ao valor do Tiny e **apagam promoções**. **"Enviar para o e-commerce"** (produto completo) também pode sobrescrever descrição, tags e SEO. Evitar esses dois botões.
> - As ferramentas `compare-export.js` e `apply-prices-from-export.js` ficam disponíveis, mas **não serão usadas** sem nova decisão.

**Ações restantes:** (3.8) confirmar o status "Ativa" de vez em quando; (3.11) preencher no Tiny o mapeamento de situações e as formas de recebimento; avisar a equipe sobre os dois botões do Tiny acima. Os 417 produtos fora da loja ficam como estão. Ofertas passa a ser alimentada pela Shopify.

> **Atualização:** existe uma integração **nativa e homologada pela Shopify**, o app *Tiny ERP* (Olist), que se ativa de dentro do Tiny e não precisa de credenciais de API nem de servidor. Ela envia **preço e estoque do Tiny para a Shopify**, traz **pedidos da Shopify para o Tiny** (base para a nota fiscal), sincroniza o status dos pedidos nos dois sentidos e envia os códigos de rastreio. Produtos casam pelo **SKU**. O script próprio (`integracoes/tiny/`) passa a ser **plano B**, para o que o app não cobrir (por exemplo, transformar preço promocional em "Comparar a", se o app não fizer isso). Fonte: [ajuda da Olist](https://ajuda.olist.com/plataformas-de-e-commerce/integracao-erp-com-o-shopify).

**Caminho recomendado (nativo):** Tiny > Configurações > E-commerce > Integrações > *Incluir integração* > Shopify > URL `https://dfd10g-i2.myshopify.com` > *Logar no Shopify* > *Install Tiny ERP* > configurar as abas (produtos, estoque com o depósito, preços, situações, formas de pagamento e frete). **Antes de ligar:** definir o depósito de estoque, mapear as situações dos pedidos e testar com poucos produtos. Apagar o mapeamento de produtos **não pode ser desfeito**.

**Caminho alternativo (script próprio):** os passos 3.1 a 3.7 abaixo.


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
