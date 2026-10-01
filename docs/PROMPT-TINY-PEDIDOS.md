# Prompt 3 para a sessão com acesso ao navegador (Tiny): pedidos vindos da Shopify

Cole tudo abaixo da linha na sessão do Claude que controla o seu Chrome (Tiny logado em `erp.olist.com`). Melhor momento para rodar: **depois de uma compra de teste na loja**, para o agente ler também esse pedido.

---

## CONTEXTO

Loja Shopify **Distribuidora New Clean** ligada ao **Tiny / Olist ERP** pela integração Shopify (`https://erp.olist.com/integracoes#/ecommerce/edit/9143`). Já se sabe: o estoque sincroniza sozinho; preço e produtos novos são enviados manualmente (isso está decidido e **não é para mexer**); a nota fiscal é emitida pela equipe depois da compra (**não investigar nota fiscal**).

Na integração, a sincronização automática de **pedidos** está ligada, o rastreio é enviado ao marcar "enviado", mas na aba **Mapeamentos** as **situações de pedidos estão vazias** e as **formas de recebimento** estão como "Não definida". Falta saber **como os pedidos da Shopify estão chegando ao Tiny** e o que precisa ser mapeado.

## OBJETIVO

Verificar, **somente lendo**, se os pedidos da Shopify entram no Tiny corretamente e quais mapeamentos faltam para o status, o pagamento e o frete ficarem certos.

## REGRAS (importantes)

1. **Somente leitura.** Não salve, não altere, não exclua, não ative/desative nada, não importe nem reprocesse pedidos. Se abrir um painel de edição, saia com **cancelar/fechar**.
2. **Não mexa na chave Ativa/Inativa da integração** nem em nenhum interruptor.
3. **Não clique** em: *importar pedidos*, *receber do e-commerce*, *reprocessar*, *emitir nota*, *alterar situação*, *enviar rastreio*, *excluir*, *cancelar pedido*. Se existir um botão assim, **descreva-o** sem clicar.
4. **Dados pessoais:** não registre nome, CPF/CNPJ, e-mail, telefone ou endereço de clientes. Escreva `[omitido]`. Vale registrar: número do pedido, datas, situação, forma de recebimento (apenas o tipo: Pix, cartão, boleto, outro), forma de frete, valor total, itens (código e quantidade).
5. Se não achar algo, diga **"não encontrei"** e onde procurou. Não invente. Se uma tela pedir decisão minha, **pare e pergunte**.

## O QUE INVESTIGAR

### 1. Pedidos que vieram da Shopify
Em Vendas → Pedidos de vendas (ou equivalente), filtre por **origem/integração Shopify** (ou e-commerce), **últimos 30 dias**. Informe:
- quantos pedidos existem, e **a data e hora do mais recente**;
- quantos há por **situação** (Em aberto, Aprovado, Preparando envio, Faturado, Pronto para envio, Enviado, Entregue, Cancelado… use os nomes que aparecerem);
- se o filtro por origem não existir, diga como identificou os pedidos da Shopify (ex.: número do pedido da Shopify no campo de observação ou no anúncio).

### 2. Os 3 pedidos mais recentes da Shopify (sem dados pessoais)
Para cada um, abra em leitura e informe: número no Tiny, número na Shopify (ex.: #1001), data, **situação atual**, **forma de recebimento** (tipo), **forma de frete** e transportadora, valor total, itens (código × quantidade), se tem **código de rastreio**, se o **estoque foi lançado/reservado**, e se há **alertas ou pendências** na tela do pedido.

### 3. Mapeamentos da integração
Em Integração Shopify → **Mapeamentos**, para cada sub-aba abaixo, **sem selecionar nem salvar nada**:
- **Situações de pedidos:** liste **todas as linhas** (cada situação/status da Shopify que a tela mostra) e, para cada linha, **todas as opções** que o seletor de situação do Tiny oferece (abra o seletor só para ler e feche com Esc).
- **Formas de recebimento:** liste as linhas existentes (as "Não definida") com os nomes que a tela mostra e as opções do seletor de cada uma.
- **Formas de frete:** confirme quantas linhas existem e se alguma está sem mapeamento.

### 4. Erros e pendências de pedidos
Procure uma tela ou aba de **pedidos com erro de importação**, **log** de pedidos, **fila** ou **pendências** da integração. Se existir, informe quantos itens há e **o tipo do erro** (sem dados pessoais). Se não existir, diga onde procurou.

### 5. Estoque x pedidos (só ler)
Em Configurações gerais de e-commerce (`/parametros_ecommerce_geral`) e na aba **Outros**/**Pedidos** da integração, anote as opções ligadas a **estoque ao salvar o pedido**, **reserva** e **cancelamento** (valor atual e texto de ajuda).

## FORMATO DA RESPOSTA

Português, Markdown, **exatamente** nesta estrutura:

```
# Relatório 3 — Pedidos Shopify → Tiny

## 1. Pedidos dos últimos 30 dias
(total, mais recente, por situação, como identificou os da Shopify)

## 2. Três pedidos mais recentes
| Pedido Tiny | Pedido Shopify | Data | Situação | Forma de recebimento | Frete | Valor | Itens | Rastreio | Estoque | Alertas |

## 3. Mapeamentos
### Situações de pedidos
| Linha (status da Shopify) | Opções do Tiny disponíveis |
### Formas de recebimento
### Formas de frete

## 4. Erros e pendências

## 5. Estoque x pedidos (opções e valores)

## 6. Respostas diretas
1. Os pedidos da Shopify estão chegando ao Tiny? (sim / não / parcialmente) — evidência.
2. Em que situação eles chegam hoje, sem o mapeamento? E o que acontece quando o pedido é pago, enviado ou cancelado na Shopify ou no Tiny?
3. O que recomenda mapear, linha a linha, em Situações e em Formas de recebimento?
4. O frete e o rastreio chegam certos? (frete mapeado, rastreio enviado à Shopify)
5. Há pedidos perdidos, duplicados ou com erro?

## 7. Não encontrei / dúvidas
```

Não faça nenhuma alteração. Entregue o relatório e pare.
