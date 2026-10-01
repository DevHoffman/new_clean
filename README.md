# New Clean — tema Shopify

Tema Online Store 2.0 da **Distribuidora New Clean** (materiais de limpeza para empresas e residências), feito do zero, sem etapa de build, com foco em conversão e velocidade.

- **Loja:** `dfd10g-i2.myshopify.com` (www.distribuidoranewclean.com.br)
- **Idioma padrão:** pt-BR (com tradução en)
- **Identidade:** azul `#1A5CA8`, azul-escuro `#0E3D73`, amarelo `#F5C227`; Montserrat + Inter

## Testar no computador

Instale as dependências uma vez:

```bash
npm install
```

### 1. Pré-visualização local (sem login)

```bash
npm run preview
```

Abra <http://localhost:3000>. O servidor em `dev/` renderiza os arquivos do tema com o **catálogo real** da loja e simula carrinho, busca, filtros e recomendações. Edite qualquer arquivo do tema e recarregue a página.

Para ver o efeito da segunda imagem no hover (o catálogo real tem uma foto por produto), emprestando fotos de produtos vizinhos:

```bash
npm run preview:demo
```

(ativa também o preço por quantidade de demonstração)

Para ver o preço por quantidade (exige catálogo B2B na loja real):

```bash
PREVIEW_DEMO_B2B=1 npm run preview
```

Sugestão de coleções automáticas a partir dos títulos (gera `dev/data/collections-suggested.json`):

```bash
node dev/suggest-collections.js
```

Conta de cliente para testar as páginas de `/account` na pré-visualização (não existe na loja real):

- E-mail: `cliente@newclean.test`
- Senha: `newclean123`

Para atualizar os produtos a partir da loja publicada:

```bash
npm run catalog
```

O que a pré-visualização **não** reproduz:

| Item | Na pré-visualização |
| --- | --- |
| Checkout | Mostra um aviso; o checkout é da Shopify |
| Menus, páginas, políticas | Dados de exemplo em `dev/data/preview.json` |
| Estoque | O catálogo público só informa disponível/esgotado, então o aviso "restam X unidades" não aparece |
| Recomendações e "Compre junto" | Simuladas por semelhança de nome |
| Filtros | Apenas disponibilidade e preço |
| Frete por CEP | Tarifas simuladas (na loja real vêm das regras de frete) |
| Editor de temas e apps | Não disponíveis |
| Contas de cliente | Só a conta de teste acima, com pedidos e endereços fictícios |
| Fontes | Carregadas do Google Fonts |

### 2. Pré-visualização na loja real (referência final)

```bash
npm run dev
```

A Shopify CLI pede login na conta da loja e abre o tema com os dados e o checkout reais, sem publicar nada. Use esta opção antes de publicar.

### Outros comandos

| Comando | O que faz |
| --- | --- |
| `npm run check` | Valida o código do tema (theme check) |
| `npm run build` | Gera `dist/` com CSS e JS minificados (a fonte não muda) |
| `npm run push` | Gera o build e envia `dist/` para a loja como tema **não publicado** |
| `npm run push:update` | Igual, mas sem sobrescrever `config/settings_data.json` (use em reenvios, para não apagar o que foi personalizado no editor) |
| `npm run preview:dist` | Pré-visualização local usando o build minificado |

## Lançamento

Requisitos numerados (R01–R40) com prioridade, responsável e critério de aceite: [`docs/REQUISITOS.md`](docs/REQUISITOS.md).

O passo a passo completo para publicar está em [`docs/LANCAMENTO.md`](docs/LANCAMENTO.md): pagamento e Pix, frete, dados da empresa, políticas, catálogo (listas geradas do catálogo real em `docs/catalogo/`), coleções (`docs/colecoes.md`), sinônimos de busca (`docs/busca/sinonimos.md`), medição (`docs/analytics/pixel-ga4.js`), automações (`docs/automacoes.md`) e o roteiro de compra de teste.

## Configuração na Shopify (checklist)

Em **Configurações do tema**:

1. **Logo** — envie o logo. Sem ele, o tema usa `assets/logo-new-clean.png`.
2. **Preço e pagamento** — parcelas (máximo 6x, padrão 6x), valor mínimo da parcela e desconto no Pix (padrão 5%).
   O tema apenas *exibe* esses valores; a regra precisa existir no meio de pagamento/checkout.
3. **Carrinho** — valor do frete grátis (padrão R$ 150), igual à regra de frete da loja.
4. **Redes sociais** — número do WhatsApp. Ele ativa o botão flutuante, o botão "Falar com um vendedor" da home,
   a faixa "Compra para empresa?" e o botão "Pedir cotação" na página de produto.
5. **Rodapé** — dados da empresa (razão social, CNPJ, endereço), exigidos pelo Decreto 7.962/2013.

No admin da Shopify:

- **Menus:** `main-menu` e `footer`. Menus com três níveis viram mega menu.
- **Página de pedido rápido:** crie uma página (ex.: "Pedido rápido", handle `pedido-rapido`) com o modelo de tema `page.pedido-rapido` e aponte para ela na central de ajuda e no menu.
- **Categorias:** hoje a loja tem uma única coleção e os produtos não têm tipo nem tag, então as categorias da home
  apontam para buscas (`/search?q=desinfetante&type=product`). Criar coleções automáticas por palavra do título
  (ex.: título contém "DESINFETANTE") melhora navegação, SEO e filtros; depois basta trocar os links dos blocos.
- **Search & Discovery:** filtros, produtos relacionados e complementares ("Compre junto").
- **Descrições e fotos:** nenhum produto tem descrição e 121 estão sem foto. São os dois pontos do catálogo que mais
  pesam na conversão.
- **Avaliações:** qualquer app que preencha `reviews.rating` / `reviews.rating_count`; adicione o widget na seção
  **Apps** da página de produto (âncora `avaliacoes`).

## Recursos de conversão

| Área | Recurso |
| --- | --- |
| Home | Banner, busca em destaque, proposta de valor, categorias, novidades, faixa para empresas (WhatsApp), segmentos, FAQ, newsletter |
| Vitrine | Seletor de quantidade e botão de compra sempre visíveis, preço no Pix, selos, imagem inteira da embalagem |
| Produto | Código, preço no Pix e parcelado, estoque, quantidade, cotação por WhatsApp, "Compre junto", garantias, barra fixa de compra |
| Carrinho | Gaveta lateral, progresso para frete grátis, upsell, total no Pix e parcelado |
| Coleção e busca | Filtros e ordenação sem recarregar, busca preditiva com termos populares |
| SEO | Dados estruturados (Product, BreadcrumbList, Organization, WebSite, FAQPage), Open Graph |
| Experiência | Tela de carregamento na primeira visita, rolagem suave com inércia, seções reveladas ao rolar, voltar ao topo com progresso, luz que acompanha o mouse no cabeçalho, central de ajuda "Posso ajudar?" (WhatsApp, telefone, e-mail, contato, FAQ) — tudo configurável em Configurações do tema, banner com bolhas que reagem ao mouse e inclinação 3D do texto, cabeçalho compacto ao rolar (sem deslocar o conteúdo), manifest PWA |
| B2B | Página **Pedido rápido** (busca + lista colada), "Comprar novamente" na conta, preço por quantidade (catálogo B2B da Shopify), barra de resumo do pedido no celular, cotação por WhatsApp |
| Confiança | Calculadora de frete por CEP no carrinho (tarifas reais da loja), status de atendimento (online/fora do horário) na central de ajuda, títulos normalizados |
| Dados | Eventos `view_item`, `add_to_cart`, `view_cart` no `dataLayer` para GTM/GA4 |

## Estrutura

```
assets/      CSS e JS. base.css + theme.js são globais; o restante é carregado pela seção que o usa
config/      Configurações do tema
layout/      theme.liquid e password.liquid
locales/     Traduções
sections/    Seções e grupos (cabeçalho e rodapé)
snippets/    Componentes (cartão de produto, preço, ícones…)
templates/   Templates JSON
dev/         Pré-visualização local — não é enviado para a Shopify (.shopifyignore)
```

### Convenções

- Cores e fontes vêm de `snippets/css-variables.liquid`. Não use cores fixas no CSS.
- Esquemas de cor por seção: `scheme-default`, `scheme-alt`, `scheme-inverse`, `scheme-accent`.
- Breakpoints: `750px`, `1000px`, `1200px`. CSS mobile-first.
- JavaScript em Web Components. O carrinho usa a Section Rendering API: todo elemento com
  `data-cart-section="<id da seção>"` é renderizado de novo após cada alteração (`window.theme.cart`).
- Nunca coloque um `<form>` dentro de outro: os cartões de produto têm formulário próprio.
- Textos da vitrine via `locales/`; conteúdo editável via configurações da seção.

## Políticas da loja

Rascunhos em `docs/politicas/` (privacidade/LGPD, trocas e devoluções, frete, termos, contato) para colar em **Configurações > Políticas** no admin; a Shopify publica em `/policies/...` e o rodapé lista os links sozinho. A pré-visualização local já exibe esses rascunhos. Revise os campos entre colchetes e o texto com um responsável jurídico.

## Checkout e página "Finalizar pedido"

O pagamento é sempre processado pela Shopify (Shopify Payments ou o gateway configurado no admin). O tema não substitui o checkout — isso não é possível para temas —, mas oferece uma página de pré-checkout (`/cart`, seção **Finalizar pedido**) inspirada em checkouts de uma etapa como o Vega Checkout:

1. Itens do pedido (com barra de frete grátis).
2. Dados do cliente: nome, e-mail, WhatsApp, CPF/CNPJ e empresa. Ficam salvos como **atributos do pedido** (visíveis no admin) e preenchem o checkout.
3. Frete por CEP com as tarifas reais da loja.
4. Preferência de pagamento (Pix com desconto, cartão parcelado, boleto), registrada no pedido. A cobrança acontece no checkout da Shopify.
5. Cupom (aplicado no checkout pela rota `/discount/CÓDIGO`) e resumo com total no Pix.

Em **Configurações do tema > Carrinho** dá para pular essa página e ir direto ao checkout. Os botões de checkout acelerado (Shop Pay, Google Pay) continuam disponíveis no bloco de compra do produto, desligados por padrão.

## SEO e segurança

- **SEO:** título e descrição por página (com descrição automática para produtos/coleções sem texto), Open Graph com imagem padrão configurável, dados estruturados (Organization com telefone/endereço, WebSite, Product, BreadcrumbList, FAQPage), `noindex` em busca, carrinho, conta e páginas filtradas, `alt` automático nas imagens, favicon SVG/PNG com fallback da marca.
- **Segurança:** HTTPS, PCI, proteção do checkout e cabeçalhos HTTP são responsabilidade da Shopify. No tema: todo dado vindo do cliente é escapado (`| escape`), links externos usam `rel="noopener"`, não há scripts de terceiros nem CDNs externos, `referrer-policy` restrita, formulários usam os endpoints nativos da Shopify (com proteção contra spam e CSRF da plataforma).

## Desempenho

O build (`npm run build`) minifica CSS e JS: 153 → 117 KB de CSS e 108 → 66 KB de JS. A Shopify entrega tudo comprimido (gzip), então o ganho na rede é de cerca de **10 KB por página**. Medido com Lighthouse mobile (compressão ligada, duas rodadas): as notas ficaram iguais dentro da variação (home 95, coleção 97, produto 89). O que mais pesa nas páginas são as imagens dos produtos (200 a 600 KB por página), então o maior ganho vem de fotos padronizadas e leves no cadastro.

## Qualidade medida (Lighthouse, mobile, pré-visualização local)

| Página | Desempenho | Acessibilidade | Boas práticas | SEO |
| --- | --- | --- | --- | --- |
| Home | 91 | 91 → corrigido | 100 | 100 |
| Catálogo | 88 | 97 | 100 | 100 |
| Produto | 94 | 97 | 100 | 100 |

Medido em 30/09/2026 contra o servidor local (imagens vindas do CDN da Shopify). Na loja real os números mudam com apps instalados e com o peso das imagens.

## Antes de publicar

- Rode `npm run dev` e teste o fluxo completo até o checkout.
- Publique com `npm run push` (gera o build minificado). Nos reenvios, use `npm run push:update`.
- Revise os textos padrão (FAQ, garantias, prazos): são genéricos e devem refletir as políticas reais.
- Confirme que frete grátis, Pix e parcelamento exibidos batem com as regras do checkout.
