# Eventos de análise do tema

O tema alimenta o `window.dataLayer` com eventos no padrão GA4. **Nada sai da loja** até você informar um contêiner do Google Tag Manager em *Configurações do tema > Análise e rastreamento*; e mesmo então o GTM só carrega depois que o visitante permite análise no banner de privacidade da Shopify (ativar o banner é o requisito R15).

## O que é medido onde

| Etapa | Quem mede |
| --- | --- |
| Navegação, busca, vitrines, promoções, contato, carrinho | **Este tema** (eventos abaixo → GTM) |
| Início do checkout, pagamento e **compra** (`purchase`) | **Pixel da Shopify** (app Google & YouTube ou o pixel de `pixel-ga4.js`). O tema não enxerga o checkout |

Não configure GA4 no GTM **e** no app Google & YouTube ao mesmo tempo: as compras seriam contadas em dobro. Uma opção segura: GA4 pelo app da Shopify (compras) e o GTM só para os eventos do tema, sem tag de GA4 de `page_view`/`purchase` nele.

## Eventos

| Evento | Quando dispara | Parâmetros principais |
| --- | --- | --- |
| `view_item` | Abertura da página de produto | `ecommerce.items[]` |
| `view_item_list` | Uma vitrine (Mais vendidos, Novidades, catálogo…) fica 25% visível | `item_list_name`, `ecommerce.items[]` (até 12) |
| `select_item` | Clique em um produto da vitrine | `item_list_name`, `ecommerce.items[]` |
| `add_to_cart` | Produto adicionado (vitrine, produto, pedido rápido, recompra) | `ecommerce.items[]` |
| `remove_from_cart` | Item removido do carrinho | `item_key` |
| `view_cart` | Carrinho lateral aberto | — |
| `checkout_click` | Clique em "Finalizar pedido" / "Ir para o pagamento" | `source` (`drawer` ou `page`) |
| `search` | Envio de qualquer campo de busca | `search_term` |
| `view_search_results` | Página de resultados | `search_term`, `results_count` (0 = busca sem resultado) |
| `contact_click` | Clique em WhatsApp, telefone ou e-mail | `method` (`whatsapp`/`phone`/`email`), `location` (`help_widget`, `hero`, `product`, `footer`, `b2b_cta`…) |
| `select_promotion` | Clique em banner, promoção, categorias, segmentos, marcas ou benefícios | `promotion_name` (seção), `creative_name` (texto do link) |
| `help_open` | Central de ajuda aberta | — |
| `quick_order_add` | Itens adicionados pela página Pedido rápido | — |
| `section_view` | Cada seção da página aparece pela primeira vez | `section_name`, `section_position` |
| `scroll_depth` | 25, 50, 75 e 90% da página | `percent` |
| `fx_variant` | Início da visita, se o teste A/B dos efeitos estiver ligado | `fx_variant` (`full` ou `lite`) |

Todos levam `page_type` (home, collection, product, cart, search…).

## Configuração sugerida no GA4

1. **Dimensões personalizadas** (Admin > Definições personalizadas), escopo evento: `page_type`, `location`, `method`, `section_name`, `promotion_name`, `fx_variant`.
2. **Eventos principais** (antes "conversões"): `contact_click` (lead por WhatsApp/telefone), `checkout_click` e `purchase`.
3. **Explorações úteis**:
   - Funil da home: `section_view` por `section_name` × `section_position` (onde o visitante para de descer) — resolve o R32.
   - Vitrines: `view_item_list` → `select_item` → `add_to_cart` por `item_list_name`.
   - Buscas sem resultado: `view_search_results` com `results_count = 0` (alimenta os sinônimos, R25).
   - Origem dos leads: `contact_click` por `location`.

## Teste A/B dos efeitos (R38)

1. Ligue *Configurações do tema > Experiência e animações > Testar os efeitos com metade dos visitantes*.
2. Cada visitante é sorteado uma vez: `full` (tudo) ou `lite` (sem preloader, rolagem com inércia, animações de entrada, bolhas do banner e indicador do menu).
3. No GA4, compare por `fx_variant`: taxa de conversão, taxa de engajamento e `scroll_depth` (com no mínimo duas semanas de dados e volume suficiente para diferença estatística).
4. Para ver cada versão você mesmo: `?nc_fx=lite` ou `?nc_fx=full` no endereço.

## Testar no navegador

Em qualquer página, abra o console e digite `dataLayer` para ver os eventos já disparados.
