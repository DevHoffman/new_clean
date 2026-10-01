# Menus da loja

Os menus são do admin da Shopify (Conteúdo > Menus), não do tema. Em uma loja nova eles vêm com os itens padrão (Início, Catálogo, Contacto), por isso o cabeçalho e o rodapé ficam diferentes do preview local. Abaixo está exatamente a estrutura usada no preview. O tema mostra um item chamado "Catálogo" como "Loja".

Para cada item, escolha **Adicionar item de menu**, digite o nome e cole o link (endereço relativo funciona, por exemplo `/collections/all`). Os itens com recuo são submenus: o menu principal tem 3 níveis e o tema os exibe como mega menu no desktop.

Quando as 16 coleções existirem (docs/colecoes.md), troque os links de busca (`/search?q=…`) pelas coleções.

## Menu principal (alta conversão)

Endereço (handle) do menu: `main-menu`, aplicado na loja real com `npm run setup:store -- --via-cli --only=menus --replace-menus --apply`. O cabeçalho e o rodapé usam este menu.

1. **Todas as categorias** (mega menu com 3 níveis)
2. **Mais vendidos**
3. **Novidades**
4. **Contato**

**Ofertas** (destacado em vermelho pela configuração "Item de menu em destaque") entra entre Categorias e Mais vendidos assim que houver produtos em promoção; o script o inclui por padrão e `--skip-menu=ofertas` o deixa de fora.

Não colocar "Início" (o logo já leva à Home) nem "Loja" (o botão de categorias e o link "Ver todas as categorias" cobrem). O mesmo menu aparece na coluna Institucional do rodapé.

- **Categorias** → `/collections/all`
  - **Limpeza geral** → `/search?q=limpador&type=product`
    - **Desinfetantes** → `/search?q=desinfetante&type=product`
    - **Limpadores e multiuso** → `/search?q=limpador&type=product`
    - **Detergentes** → `/search?q=detergente&type=product`
    - **Álcool** → `/search?q=alcool&type=product`
  - **Papéis e descartáveis** → `/search?q=papel&type=product`
    - **Papel higiênico e toalha** → `/search?q=papel&type=product`
    - **Sacos de lixo** → `/search?q=saco&type=product`
    - **Copos descartáveis** → `/search?q=copo&type=product`
  - **Utensílios** → `/search?q=vassoura&type=product`
    - **Vassouras** → `/search?q=vassoura&type=product`
    - **Rodos** → `/search?q=rodo&type=product`
    - **Panos e flanelas** → `/search?q=pano&type=product`
    - **Luvas** → `/search?q=luva&type=product`
  - **Higiene pessoal** → `/search?q=sabonete&type=product`
    - **Sabonetes** → `/search?q=sabonete&type=product`
    - **Saboneteiras e dispensers** → `/search?q=saboneteira&type=product`
- **Mais vendidos** → `/collections/mais-vendidos`
- **Novidades** → `/collections/novidades`
- **Contato** → `/pages/contact`

## Rodapé

A coluna **Institucional** do rodapé usa o **menu principal** (`main-menu`), então só esse menu precisa ser criado. O menu `footer` não é mais usado pelo tema.

## Outras diferenças do rodapé (não são menus)

| Bloco do rodapé | De onde vem | Como preencher |
| --- | --- | --- |
| **Links úteis** | Políticas da loja | Configurações > Políticas: cole os textos de `docs/politicas/` |
| **Bandeiras de cartão** | Meios de pagamento ativos | Aparecem quando Cielo/Stripe/Pix/boleto estiverem ativos em Configurações > Pagamentos |
| **Razão social, CNPJ e endereço** | Configurações do tema > Dados da empresa | Preencher. No preview eram valores de exemplo |
| **E-mail e horário de atendimento** | Configurações do tema > Ajuda | Preencher. No preview eram valores de exemplo |
| **Telefone e WhatsApp** | Configurações do tema > Ajuda / Redes sociais | WhatsApp: (27) 99248-7715 |
