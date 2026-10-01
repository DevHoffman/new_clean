# Roteiro de lançamento — nota 10

O tema já cobre o que depende de código. Os itens abaixo dependem do admin da Shopify ou de conteúdo real, e são eles que separam um bom tema de uma loja que fatura R$ 1 milhão. Siga na ordem: cada bloco destrava o seguinte.

## 1. Acesso e publicação (dia 1)

- [ ] Conta com acesso à loja `dfd10g-i2` (dona, funcionária com permissão "Temas" ou colaboradora via Shopify Partners).
- [ ] `npm run push` envia o tema como **não publicado**. Nada muda para os clientes até você clicar em Publicar.
- [ ] Abra o tema no editor e confira a home, um produto, o carrinho e a busca.

## 2. Pagamento, frete e preços anunciados (dia 1–2) — obrigatório antes de publicar

- [ ] **Configurações > Pagamentos**: ativar Cielo e/ou Stripe (cartão), Pix e boleto conforme o contrato de cada provedor.
- [ ] **Desconto no Pix**: confirmar como ele é aplicado (gateway ou app de desconto por forma de pagamento). Só então marcar *Configurações do tema > Preço e pagamento > "Confirmo que este desconto é aplicado no checkout"*. Sem essa marcação, o tema não exibe preço com desconto no Pix (proteção contra anunciar um preço que não é cobrado).
- [ ] **Parcelamento**: número de parcelas sem juros e parcela mínima iguais ao contrato do gateway.
- [ ] **Textos que prometem condições**: barra de anúncios ("5% de desconto pagando no Pix", "Parcele em até 6x", "Frete grátis acima de R$ 150"), faixa de benefícios da home, linha de confiança do banner e selo da vitrine. Use os tokens `[frete]`, `[pix]` e `[parcelas]` nesses textos: o valor vem das configurações e as frases com Pix somem enquanto o desconto não estiver confirmado. Textos sem token (ex.: "Nota fiscal em todos os pedidos", "Entrega rápida") continuam sob sua revisão.
- [ ] **Configurações > Frete e entrega**: regra de frete grátis acima de R$ 150 e tarifas por região. O valor precisa bater com *Configurações do tema > Carrinho*.
- [ ] **Compra de teste** com cada forma de pagamento (roteiro no item 8).

## 3. Confiança (dia 2)

- [ ] *Configurações do tema > Dados da empresa*: razão social, CNPJ, endereço (Decreto 7.962/2013). O endereço aparece na coluna Atendimento do rodapé.
- [ ] Faixa de benefícios da home: o item "Nota fiscal — Em todos os pedidos" só pode ficar se a NF-e for emitida em todos os pedidos; senão, remova o bloco no editor.
- [ ] **Configurações > Políticas**: colar os textos de `docs/politicas/` depois da revisão jurídica.
- [ ] *Central de ajuda*: e-mail e horário reais.
- [ ] Redes sociais reais em *Configurações do tema > Redes sociais*.
- [ ] App de avaliações (ver `docs/automacoes.md`, item 5).

## 4. Catálogo (semana 1–2) — maior impacto em conversão

- [ ] Fotos dos **69 produtos disponíveis sem foto** (`docs/catalogo/produtos-sem-foto.csv`). Padrão: fundo branco, produto inteiro, 1000 × 1000 px, uma segunda foto (verso/rótulo) sempre que possível — o tema troca a imagem no hover.
- [ ] Descrição de 2 a 3 linhas nos produtos de maior valor (`docs/catalogo/descricoes-prioritarias.csv`, 150 itens): para que serve, rendimento/diluição, embalagem, onde usar. Enquanto não houver descrição, o produto mostra "Dúvidas sobre este produto?" com WhatsApp.
- [ ] Coleções automáticas (`docs/colecoes.md`) e troca dos links do menu e dos blocos de categoria.
- [ ] Sinônimos de busca (`docs/busca/sinonimos.md`).

## 4a. Loja de avaliação com 50 produtos (teste do tema)

Para ver a Home 100% preenchida numa loja vazia, sem tocar na loja real:

1. `node dev/export-shopify-csv.js` gera `docs/catalogo/produtos-importacao.csv` (50 produtos: os que a Home aponta, as marcas e buscas da Home, 3 por categoria e 3 esgotados). As tags `mais-vendidos` e `novidades` e 5 preços "Comparar a" são **de demonstração**; não são preços reais.
2. Admin da loja de teste > Produtos > **Importar** > escolher o arquivo.
3. Criar as coleções e páginas: `SHOPIFY_ADMIN_TOKEN=shpat_xxx npm run setup:store -- --apply --by-tag`, ou à mão: coleções automáticas **Mais vendidos** (tag é igual a `mais-vendidos`), **Novidades** (tag é igual a `novidades`) e **Ofertas** (preço de comparação definido); páginas `pedido-rapido`, `contact` e `faq` com os modelos de mesmo nome.
4. `npm run check:home` confere, no preview com essa amostra (`PREVIEW_SAMPLE=1 npm run preview`), que todos os blocos têm produtos e que nenhum link da Home cai numa busca vazia.

## 4b. Atalho: coleções, páginas e menus por script

Em vez de criar à mão as 16 coleções, `mais-vendidos`, `ofertas`, as páginas Pedido rápido/Contato/Dúvidas e os menus, rode o script (usa a Admin API; não apaga nada e não mexe em produtos, preços nem políticas):

1. Admin > Configurações > Apps > **Desenvolver apps** > criar app > API Admin com `read/write_products`, `read/write_content`, `read/write_online_store_navigation` > instalar e copiar o token (`shpat_…`).
2. Simulação (não cria nada): `SHOPIFY_ADMIN_TOKEN=shpat_xxx npm run setup:store`
3. Aplicar: `SHOPIFY_ADMIN_TOKEN=shpat_xxx npm run setup:store -- --apply` (opcional: `--only=collections,pages,menus`).

Regras: coleções e páginas que já existem são mantidas; os menus `main-menu` e `footer` só são reescritos enquanto tiverem o título padrão da Shopify. Depois de criadas as coleções, os blocos de categoria da home passam a apontar para elas sozinhos (o link de busca vira reserva). O script foi verificado só contra um servidor simulado: confira o resultado no admin; se a Shopify recusar alguma regra, a mensagem de erro aparece na linha da coleção.

## 5. Home e ofertas (semana 1)

- [ ] Tela de carregamento (preloader): aparece por no mínimo 2 s na primeira página de cada visita; nas outras páginas e ao recarregar na mesma aba ela não aparece. Para ver: `?nc_preloader=1` no endereço, ou Configurações do tema > Carregamento > "Toda vez que a Home for aberta". Faz parte do teste A/B dos efeitos (R38): na variante "lite" ela é desligada.
- [ ] Velocidade dos carrosséis (editor de temas, por seção): Mais vendidos 80 px/s, Marcas 50 s por volta, Novidades 35 px/s, Categorias 60 s por volta. Mantenha Mais vendidos como o mais rápido; para desligar o movimento, desmarque "Carrossel que se move sozinho".
- [ ] Ordenação padrão da Loja: "Mais vendidos" (Loja > Ordenação padrão). A coleção `mais-vendidos` também alimenta o bloco de busca (Cabeçalho > Busca).
- [ ] Banner: selecione a coleção da vitrine (padrão: Novidades) ou envie uma foto/vídeo real da operação.
- [ ] **Coleção `ofertas`** (o bloco de promoção lista produtos dela): Admin > Coleções > Criar > Automatizada > condição *Tag do produto é igual a* `oferta` (ou selecione os produtos manualmente). O handle deve ser `ofertas`. Em cada produto em promoção preencha **Preço de comparação** (preço "de") maior que o preço atual: o bloco só mostra produtos com desconto real e **some sozinho** enquanto não houver nenhum.
- [ ] Menu: renomeie o item "Catálogo" para **Loja** em Conteúdo > Menus (o tema já usa "Loja" no título da página, migalhas e SEO).
- [ ] Fotos são o que vende: cada produto do bloco de categorias, promoção e B2B aparece como foto. Use fundo branco, 1000 × 1000 px, produto inteiro.
- [ ] Bloco "Em promoção agora" (seção Promoções em destaque): mostra o produto de maior desconto em destaque e mais 3 cards da coleção `ofertas`; só lista produtos com "Comparar a" maior que o preço e some sozinho sem eles. Crie o desconto correspondente em **Descontos** e escolha o modo do contador (os modos que se repetem só se a oferta realmente se repete).
- [ ] Faixa "Compra para empresa?": confirme os benefícios listados.

## 6. Medição (semana 1)

- [ ] App **Google & YouTube** (GA4 + Merchant Center) ou o pixel de `docs/analytics/pixel-ga4.js` — nunca os dois. Eventos do tema e contêiner GTM: `docs/analytics/eventos.md`.
- [ ] App **Facebook & Instagram** (pixel e catálogo da Meta).
- [ ] Google Search Console: enviar `https://www.distribuidoranewclean.com.br/sitemap.xml`.
- [ ] Metas a acompanhar semanalmente: taxa de conversão, ticket médio, % de carrinhos que chegam ao checkout, termos de busca sem resultado.

## 7. Automações (semana 2)

- [ ] Checkout abandonado, recompra, tag de clientes empresariais e alerta de estoque (`docs/automacoes.md`).

## 8. Roteiro de compra de teste

Faça no celular e no computador, em janela anônima:

1. Buscar "papel toalha" e "desinfetante" pela busca do topo.
2. Adicionar um produto pela vitrine com quantidade 3 e outro pela página do produto.
3. No carrinho lateral: alterar quantidade, remover um item, ver a barra de frete grátis.
4. Em **Finalizar pedido**: preencher dados, calcular frete por CEP, escolher Pix, aplicar um cupom de teste.
5. Ir para o pagamento: conferir se **e-mail, nome, CEP, observação e cupom chegam preenchidos** ao checkout e se os atributos (CPF/CNPJ, empresa, forma de pagamento) aparecem no pedido no admin. Se o preenchimento não funcionar, troque *Finalizar pedido > Envio para o checkout* para "Formulário padrão".
6. Pagar com Pix: o desconto anunciado precisa aparecer no checkout.
7. Pagar com cartão parcelado e com boleto.
8. Conferir e-mail de confirmação, pedido em **Minha conta** e o botão "Comprar novamente".
9. Cancelar e reembolsar os pedidos de teste.

## 9. Performance na loja real

- [ ] PageSpeed Insights (mobile) em home, coleção e produto depois de instalar os apps. Meta: desempenho acima de 70 na loja real.
- [ ] Cada app novo: medir de novo. Apps que injetam scripts em todas as páginas são a principal causa de lentidão.

## 10. Depois do lançamento

- [ ] Testar por 2 semanas com e sem preloader e rolagem com inércia (*Experiência e animações*) e manter o que converter melhor.
- [ ] Preço por quantidade para empresas: catálogos B2B (Shopify Plus) ou app de descontos por volume. O tema já exibe as faixas quando elas existem.
