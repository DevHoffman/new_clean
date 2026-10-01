# Prompt 2 para a sessão com acesso ao navegador (Tiny): por que o preço não sincroniza

Cole tudo abaixo da linha na sessão do Claude que controla o seu Chrome (Tiny logado em `erp.olist.com`).

---

## CONTEXTO

Loja Shopify **Distribuidora New Clean**, ligada ao **Tiny / Olist ERP** pela integração Shopify (`https://erp.olist.com/integracoes#/ecommerce/edit/9143`; abas Conexão, Produtos, Pedidos, Mapeamentos, Outros; dentro de Produtos existem sub-abas como **Preços** e **Fluxo de Produtos**).

Já medi (comparando a exportação do Tiny com a Shopify):
- O **estoque sincroniza** normalmente.
- O **preço NÃO sincroniza**: 122 de ~1.035 produtos têm preço diferente. Exemplos, com o preço do Tiny e o da Shopify: SKU `18857` (70,53 × 36,62), `57946` (90,41 × 58,86), `43` (29,72 × 6,04), `1625` (95,56 × 68,52), `36838` (99,50 × 77,74) e, no sentido contrário, `71065` (10,38 × 18,04) e `38.35` (5,66 × 9,60). Além disso, `57282` (Tiny 22,44 × Shopify 18,58).
- **395 produtos ativos com SKU não estão na Shopify**, por exemplo SKU `7948` (ÁGUA MINERAL PEDRA AZUL 330, estoque 24), `95309` (AGENDA CD 2026) e `82090` (ABSORVENTE INT.GEL SECA C/AB).
- Regra de preço da integração: **"Preço fixo"**; no anúncio do SKU 57282 a forma de cálculo é "Igual ao produto".

## OBJETIVO

Descobrir **quando e por que o Tiny envia (ou deixa de enviar) o preço e os produtos novos para a Shopify**, e onde se corrige. Só leitura.

## REGRAS (importantes)

1. **Somente leitura.** Não salve, não altere, não exclua, não ative nem desative nada. Se abrir um painel de edição, saia com **cancelar/fechar**.
2. **Não mexa na chave Ativa/Inativa da integração**, nem em nenhum interruptor da tela. (Numa rodada anterior a integração foi inativada por engano e teve de ser reativada.)
3. **Não clique** em: *enviar*, *enviar preços*, *enviar estoque*, *sincronizar*, *atualizar anúncio*, *reimportar*, *desfazer mapeamento*, *excluir*, *criar anúncio*. Quando existir um botão assim, **descreva** o que ele faz (nome, onde fica, texto de ajuda ou aviso) sem clicar.
4. **Não registre** preço de custo, fornecedor, dados de clientes ou de pedidos, senhas e tokens. Escreva `[omitido]`.
5. Se não achar algo, diga **"não encontrei"** e onde procurou. Não invente. Se uma tela pedir uma decisão minha, **pare e pergunte**.

## O QUE INVESTIGAR

### 1. Status
Na lista de integrações e na tela da integração: a integração Shopify está **Ativa**? Mostre o texto exato do status. Há aviso de erro, pendência ou "última sincronização" em algum lugar? Anote data e hora.

### 2. Sub-aba "Fluxo de Produtos" (a mais importante)
Em Integração Shopify → **Produtos** → **Fluxo de Produtos**. Copie **todas** as opções com o valor atual (marcado/desmarcado, lista escolhida), com o texto exato de cada rótulo e de cada texto de ajuda. Responda: o fluxo envia **preço** automaticamente quando ele muda no Tiny? O fluxo cria **produtos novos** na Shopify automaticamente? O que dispara cada envio (salvar o produto, rotina agendada, botão manual)? Existe campo de frequência, horário ou fila?

### 3. Sub-aba "Preços"
Releia a sub-aba **Preços** e transcreva **todas** as opções e o texto de ajuda: o que significa exatamente **"Preço fixo"** versus **"Conforme lista de preços"** e **"Conforme regras de preço"**; se há opção de "enviar preço ao alterar"; se existe aviso sobre alterações manuais feitas na Shopify.

### 4. Anúncios dos produtos com preço divergente
Em Cadastros → Produtos, abra (só leitura) a aba **anúncios** dos SKUs `18857`, `57946`, `43`, `71065`, `38.35` e `57282`. Para cada um, informe: preço de venda do produto, preço promocional, **forma de cálculo** do anúncio (Igual ao produto / Preço fixo), o **valor fixo** se houver, a data/hora da **última atualização enviada** e o conteúdo do **Histórico de atualizações** do anúncio (resuma). Ele mostra algum erro de envio?

### 5. Produtos que não foram para a loja
Abra (só leitura) os SKUs `7948`, `95309` e `82090`. Informe: tem anúncio da Shopify? Se não tem, por quê (há campo "enviar para o e-commerce", categoria obrigatória, situação, estoque mínimo, "exibir na loja")? Existe algum **filtro de listagem** (por anúncio, por integração) que permita contar quantos produtos ativos **não têm anúncio** Shopify? Se existir, aplique o filtro **sem alterar nada** e informe a contagem.

### 6. Botões e ações manuais (apenas descrever)
Liste as ações manuais que existem para a Shopify, por produto e em massa (por exemplo, "enviar produtos", "atualizar preços", "sincronizar estoque"), onde ficam, o texto exato do botão e o aviso que o Tiny mostra antes de executar. **Não clique.**

### 7. (Opcional, se achar rápido) Nota fiscal
Em Configurações, procure as preferências de **emissão automática de nota fiscal** para vendas de e-commerce e informe se estão ligadas e para qual natureza de operação.

## FORMATO DA RESPOSTA

Português, Markdown, **exatamente** nesta estrutura:

```
# Relatório 2 — Fluxo de preços e produtos

## 1. Status da integração
## 2. Fluxo de Produtos (todas as opções: rótulo | valor | ajuda)
## 3. Aba Preços (opções e significado de "Preço fixo")
## 4. Anúncios divergentes
| SKU | Preço no produto | Promocional | Forma de cálculo | Valor fixo | Última atualização enviada | Histórico/erros |
## 5. Produtos fora da loja
| SKU | Tem anúncio? | Motivo provável | Observações |
(contagem de ativos sem anúncio, se obtida)
## 6. Ações manuais disponíveis (descrição, sem executar)
## 7. Nota fiscal (se encontrado)

## 8. Respostas diretas
1. O preço é enviado automaticamente quando muda no Tiny? (sim / não / só manualmente) — o que dispara?
2. Por que os 122 preços ficaram diferentes? (hipótese apoiada no que viu)
3. Como corrigir em massa com segurança? (qual tela ou botão, em que ordem, e o que o Tiny avisa)
4. Produtos novos vão sozinhos para a Shopify? Por que estes 395 não foram?
5. Há risco de o Tiny sobrescrever na Shopify algo que eu edite lá (descrição, fotos, tags)?

## 9. Não encontrei / dúvidas
```

Não faça nenhuma alteração. Entregue o relatório e pare.
