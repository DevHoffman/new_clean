# Prompt para a sessão com acesso ao navegador (Tiny / Olist ERP)

Cole tudo abaixo da linha em uma sessão do Claude que controla o seu Chrome, com o Tiny já logado em `erp.olist.com`. Ela devolve um relatório que você cola de volta na conversa do projeto.

---

## CONTEXTO

Sou responsável pela loja Shopify **Distribuidora New Clean** (`dfd10g-i2.myshopify.com`, domínio `www.distribuidoranewclean.com.br`). Ela recebe produtos, preços, estoque e pedidos do **Tiny / Olist ERP** pelo app "Sistema ERP da Olist", instalado na Shopify em 02/12/2025. O Tiny está aberto e logado neste navegador. A integração aparece em `https://erp.olist.com/integracoes#/ecommerce/edit/9143` ("Integração com Shopify", status "Você está conectado na Shopify"), mas essa tela só mostra a **conexão**, não as regras de sincronização.

O que já medi pela Shopify: o estoque é atualizado a cada poucos minutos; o preço é sincronizado, mas o campo "Comparar a" da Shopify é **sempre igual ao preço**, então nenhuma promoção chega à loja. Os produtos chegam sem descrição, com 1 foto, tipo vazio e a mesma marca (`DISTRIBUIDORA NEW CLEAN`) em todos.

## OBJETIVO

Descobrir, **somente lendo**, (1) como a integração com a Shopify está configurada e (2) quais dados existem no cadastro de produtos do Tiny. Preciso saber se o preço promocional do Tiny pode virar "Comparar a" na Shopify e se dá para completar descrição, marca, categoria e fotos pelo Tiny.

## REGRAS (importantes)

1. **Somente leitura.** Não salve, não altere, não exclua, não ative, não desative e não rode nenhuma sincronização, importação ou exportação. Se uma tela abrir em modo de edição, saia sem salvar (use "voltar" ou feche a aba).
2. **Não clique** em nada parecido com: *desfazer mapeamento*, *excluir*, *desconectar*, *reimportar*, *enviar produtos agora*, *sincronizar agora*. Esses botões podem ser irreversíveis.
3. **Não copie nem me mostre** senhas, tokens, chaves de API, dados de clientes (nome, CPF/CNPJ, e-mail, telefone, endereço) nem dados de pedidos de pessoas. Se aparecerem, omita ou escreva `[omitido]`.
4. Se alguma tela exigir uma decisão minha ou pedir confirmação de login, **pare e me pergunte**.
5. Se algo não for encontrado, diga **"não encontrei"** e onde procurou. Não invente valores.

## O QUE INVESTIGAR

### A. Configuração da integração Shopify
Procure as telas de configuração da integração (não só a de conexão): botão **Configurar/Editar/Preferências** na lista de integrações, abas ou seções dentro da integração, ou em Configurações > E-commerce/Integrações. Se necessário, abra o link "Acesse a ajuda sobre a integração". Para **cada** aba ou seção encontrada, registre o nome e **todas as opções com o valor atual** (marcado/desmarcado, lista escolhida). Preciso especialmente de:

1. **Produtos:** quais campos o Tiny **envia** à Shopify (título, descrição, descrição complementar, marca, categoria/tipo, tags, fotos, SKU, peso, dimensões); se **envia produtos novos**; se **atualiza** os existentes (e quais campos); se **importa** produtos da Shopify; qual identificador usa para casar (SKU/código/ID).
2. **Preços:** qual **lista de preço** usa; o que faz com o **preço promocional**: ele vira o preço de venda? Existe uma regra para enviar o preço normal como "preço de comparação" ("Comparar a", "preço de/por")? Há opção de arredondamento ou acréscimo?
3. **Estoque:** qual **depósito** alimenta a loja; se envia o saldo **disponível** ou o total; se considera reservas; o que acontece com **estoque zero** (indisponibilizar, manter, ocultar); com que frequência atualiza.
4. **Pedidos:** se importa pedidos da Shopify; como estão mapeadas as **situações** dos pedidos; formas de pagamento e de frete mapeadas; se emite **nota fiscal** automaticamente; se envia **código de rastreio** à Shopify.
5. Qualquer opção de **sincronização automática ou agendada**, histórico/log de sincronização e **erros recentes** (resuma; não copie dados de clientes).

### B. Cadastro de produtos no Tiny
Em Cadastros > Produtos, abra **somente para leitura** estes produtos (busque pelo código/SKU):

| Produto | SKU |
| --- | --- |
| DESINFETANTE WAVE 5L AZULIM | `57282` |
| TOA DE PAPEL MILI 200FLS 2X100 FLS | `7896104997727` |
| SACO LIXO 60L PRETO SUPER REF. C/100 ALMOFADA NEWCLEAN | `2401` |
| START DETERGENTE MAQ 5L | `71442` |
| VASSOURA PIACAVA N. 05 PROLAR | `1701` |

Para cada um, registre: **preço de venda**, **preço promocional** (e se há datas de validade), **preço de custo** (apenas se estiver visível; é opcional), **marca**, **categoria**, **tipo/unidade**, **descrição**, **descrição complementar**, **quantidade de fotos/anexos**, **estoque por depósito** e qualquer aba ou campo ligado à **integração com a Shopify ou e-commerce** (por exemplo "enviar para e-commerce", id do anúncio, "exibir na loja").

### C. Panorama do catálogo (por contagem, sem listar tudo)
Se a tela de listagem permitir filtros e contagens, informe aproximadamente:
1. quantos produtos **têm preço promocional** preenchido;
2. quantos produtos **têm marca** preenchida;
3. quantos **têm descrição complementar**;
4. quantos **têm mais de 1 foto**;
5. quantos produtos ativos **não estão marcados** para enviar ao e-commerce, se existir esse controle.
Se não houver como obter contagens sem alterar nada, diga isso e passe para o relatório.

## FORMATO DA RESPOSTA

Responda em português, em Markdown, **exatamente** nesta estrutura (copiável):

```
# Relatório Tiny × Shopify

## 1. Onde fica a configuração
(caminho de menus até as telas, e quais abas existem)

## 2. Configuração da integração
### Produtos
- campo: valor atual
### Preços
- ...
### Estoque
- ...
### Pedidos
- ...
### Sincronização e erros
- ...

## 3. Produtos de exemplo
| Produto | Preço | Promocional | Marca | Categoria | Descrição? | Compl.? | Fotos | Estoque | Campos da integração |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |

## 4. Panorama do catálogo
(contagens, ou "não foi possível sem alterar dados")

## 5. Respostas diretas
1. O preço promocional do Tiny vira "Comparar a" na Shopify hoje? (sim / não / não encontrei) e por quê.
2. Existe no Tiny dado suficiente para preencher marca, categoria, descrição e mais fotos? (sim / parcial / não)
3. Esses campos são enviados à Shopify pela integração? (campo a campo)
4. O estoque vem de qual depósito e como trata estoque zero?
5. Os pedidos da Shopify entram no Tiny? (sim / não) Com nota fiscal e rastreio automáticos?

## 6. Não encontrei / dúvidas
(o que ficou sem resposta e onde procurei)
```

Não faça nenhuma alteração. Quando terminar, entregue o relatório e pare.
