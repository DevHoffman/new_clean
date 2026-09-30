# Automações que recuperam e repetem vendas

Nenhuma delas depende do tema; todas são configuradas no admin da Shopify.

## 1. Carrinho e checkout abandonados (ativar já)

**Marketing > Automações > Criar automação > Recuperar checkout abandonado** (Shopify Email, incluso no plano).

- Envio 1: 1 hora depois. Assunto: "Seu pedido ficou esperando". Mostre os itens e o botão de voltar ao checkout.
- Envio 2 (opcional): 24 horas depois, com o lembrete de frete grátis acima de R$ 150.
- Não ofereça cupom no primeiro envio; clientes aprendem a abandonar para ganhar desconto.

## 2. Lembrete de recompra (o que faz uma distribuidora escalar)

Materiais de limpeza acabam em ciclos previsíveis. Com **Shopify Flow** (gratuito):

1. Gatilho: **Pedido pago**.
2. Ação: **Aguardar** 25 dias (ajuste pelo seu ciclo médio).
3. Condição: cliente não fez pedido desde então.
4. Ação: **Enviar e-mail de marketing** (Shopify Email) com "Comprar novamente" apontando para `/account` (o botão de recompra já está no tema) ou para a página **Pedido rápido**.

Para lembrete por WhatsApp, use um app de WhatsApp com integração Flow; a Shopify não envia WhatsApp nativamente.

## 3. Clientes empresariais (B2B)

Flow: **Pedido criado** > condição "atributo do pedido *CPF/CNPJ* tem 14 dígitos" > **adicionar tag** `empresa` ao cliente. A página "Finalizar pedido" já grava CPF/CNPJ e empresa como atributos do pedido. Com a tag, você segmenta campanhas e condições comerciais.

## 4. Estoque

Flow: **Estoque do produto mudou** > quantidade menor que 5 > **enviar e-mail interno**. Evita vender o que acabou, a principal causa de reclamação em distribuidoras.

## 5. Pós-venda e avaliações

Instale um app de avaliações (Judge.me tem plano gratuito) e ative o pedido automático de avaliação 7 dias após a entrega. O tema já mostra as estrelas no cartão, no produto e na busca assim que o app preencher os metacampos `reviews.rating` e `reviews.rating_count`.
