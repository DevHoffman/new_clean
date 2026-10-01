# Integração Tiny ERP → Shopify

Copia produtos do **Tiny ERP (Olist)** para a Shopify: preço, estoque e, se você pedir, cadastro completo e produtos novos. O tema continua lendo tudo da Shopify; o Tiny nunca é consultado pelo navegador.

- Os produtos são casados pelo **SKU** (o código do produto no Tiny = SKU da variante na Shopify). Os produtos que já existem são atualizados, não duplicados.
- **Nunca apaga nem arquiva** nada. Sem `--apply` só simula.
- Só produtos **simples** (tipo S). Variações, kits e produtos fabricados são ignorados e contados no resumo.

## 1. Credenciais

**Tiny (API v3, OAuth).** Crie um aplicativo em Tiny > Configurações > Extensões/Integrações > *Aplicativos API v3* ([passo a passo oficial](https://ajuda.olist.com/hubs-e-plataformas-via-api/aplicativos-api-v3-configuracoes-e-utilizacao)). Cadastre como URL de redirecionamento exatamente `http://localhost:3456/callback` e guarde o *client id* e o *client secret*.

**Shopify.** Admin > Configurações > Apps > Desenvolver apps > criar app > API Admin com `read_products`, `write_products`, `read_inventory`, `write_inventory` e `read_locations` > instalar > copiar o token `shpat_…`.

Nada disso vai para o repositório nem para o chat: use variáveis de ambiente.

```bash
export TINY_CLIENT_ID=...  TINY_CLIENT_SECRET=...
export SHOPIFY_ADMIN_TOKEN=shpat_...            # SHOPIFY_STORE padrão: dfd10g-i2.myshopify.com
npm run tiny:auth                                # abre o consentimento e grava integracoes/tiny/.tokens.json
```

## 2. Primeira execução (sempre nesta ordem)

```bash
npm run tiny:test                                          # 9 verificações com Tiny e Shopify simulados
npm run tiny:sync -- --limit=3 --verbose                   # simulação com 3 produtos: confira os campos
npm run tiny:sync                                          # simulação completa de preço + estoque
npm run tiny:sync -- --apply --limit=20 --verbose          # grava 20 produtos; confira no admin
npm run tiny:sync -- --apply                               # grava tudo
```

O teste usa servidores falsos, então **prova a lógica, não o formato real das respostas**. Na primeira simulação com credenciais reais, compare os nomes dos campos (preço, estoque, marca, fotos) com o que o Tiny devolve; o mapeamento fica em `lib/mapping.js`.

## 3. O que cada opção faz

| Comando | Efeito |
| --- | --- |
| *(nada)* | Simulação de preço + estoque dos produtos que já existem |
| `--apply` | Grava preço e estoque |
| `--content` | Também título, descrição, marca e tipo **sobrescrevem** o que está na Shopify; foto só entra se o produto não tiver |
| `--replace-images` | Com `--content`, adiciona as fotos do Tiny mesmo que já exista foto |
| `--create` | Cria produtos que estão no Tiny e não na Shopify, como **rascunho** |
| `--publish-new` | Com `--create`, já publica |
| `--only=price` / `--only=stock` | Sincroniza só uma das duas coisas |
| `--sku=A,B`, `--limit=N`, `--concurrency=N`, `--verbose` | Filtros e ritmo |

Regras de preço: se o Tiny tem preço promocional menor que o normal, a Shopify recebe o promocional como **preço** e o normal como **comparar a**. É isso que faz o bloco "Em promoção agora" da Home aparecer.

Estoque: usa o saldo **disponível** (já descontadas as reservas) no local principal da loja e liga o controle de estoque do item. Produto que o Tiny não controla estoque (`controlar: false`) é mantido como está. Produto com estoque 0 passa a aparecer como esgotado na loja.

## 4. Onde rodar (atenção ao token)

O token de renovação do Tiny dura cerca de **24 horas** e **muda a cada renovação**. Se a sincronização ficar mais de um dia sem rodar, a autorização expira e é preciso repetir `npm run tiny:auth`. Por isso:

- Rode **pelo menos uma vez por dia** e guarde `.tokens.json` em disco persistente (caminho em `TINY_TOKENS_FILE`).
- **Servidor ou contêiner com disco persistente** (VPS, Cloud Run com volume, etc.) e um agendamento (cron) é o caminho mais simples.
- **GitHub Actions** não guarda arquivos entre execuções; só serve se o token renovado for regravado num Secret (exige um token pessoal do GitHub com permissão de escrever Secrets). Não está configurado.

## 5. Limites conhecidos

- O estoque não tem data de alteração: cada execução consulta o saldo de todos os produtos (2 a 3 chamadas por produto). Com 1.133 produtos, conte alguns minutos; o limite de requisições é por conta Tiny e compartilhado com outros apps, e o cliente espera e tenta de novo quando recebe 429.
- Variações (tipo V), kits e produtos fabricados ainda não são sincronizados.
- Pedidos da Shopify **não** voltam para o Tiny (emissão de nota fiscal). Isso é outra integração.
