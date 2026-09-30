# Coleções automáticas sugeridas

> Atalho: `npm run setup:store` cria estas coleções pela Admin API (veja docs/LANCAMENTO.md, 4b).

Hoje a loja tem uma única coleção e nenhum produto com tipo ou tag, então o menu e as categorias da home apontam para buscas. Coleções automáticas resolvem isso sem editar produto por produto: a Shopify inclui sozinha todo produto cujo título atenda à condição, inclusive os que forem cadastrados depois.

## Como criar (5 minutos por coleção)

1. Admin > **Produtos > Coleções > Criar coleção**.
2. Título: o nome da tabela abaixo. Tipo: **Automatizada**.
3. Condições: **Título do produto > começa com** > a palavra indicada. Com mais de uma palavra, marque **qualquer condição**.
4. Salve. Depois, em **Conteúdo > Menus**, troque os links de busca do menu e dos blocos de categoria da home pelas novas coleções.

Contagens geradas a partir do catálogo público em 29/09/2026 (`node dev/suggest-collections.js` atualiza).

| Coleção | Condições (título começa com, qualquer uma) | Produtos | Exemplos |
| --- | --- | --- | --- |
| Limpadores e multiuso | LIMPADOR, MULTIUSO, LIMPA | 104 | MULTIUSO VEJA LIMPEZA PESADA VEJA 1L X-14 CLORO ATIVO; MULTIUSO VEJA LIMPEZA PESADA POWER FUSION LIMAO 950ML |
| Panos, esponjas e fibras | PANO, ESPONJA, FIBRA, FLANELA, TELA, DISCO | 77 | TELA PERFUMADA P/ MICTORIO NORMAL TUTTI FRUTTI UPPRO; TELA PERFUMADA P/ MICTORIO NORMAL MENTA UPPRO |
| Sabonetes e higiene | SABONETE, SABONETEIRA, SHAMPOO, CONDICIONADOR, DESODORANTE, ABSORVENTE | 74 | SHAMPOO SKALA MAIS CACHOS 325ML; SHAMPOO SKALA AMIDO DE MILHO 325ML |
| Sacos de lixo | SACO | 70 | SACO ROLO P/FREEZER 20X33 2L 1kg 100UN; SACO PARA MERCADO PICOTADO 30X40 3kg 500UN ROLL BAG |
| Vassouras, rodos e cabos | VASSOURA, RODO, CABO, PA LIXO, PA DE LIXO, PA GG, ESCOVA, BALDE, LIXEIRA | 67 | VASSOURA PIACAVA N. 05 PROLAR; VASSOURA PIACAVA N. 05 PASSE LIMPE |
| Papel higiênico e toalha | PAPEL | 64 | PAPEL TOA INTERFOLHA FOLHA DUPLA C/250 FLS IPEL; PAPEL TOA INTERFOLHA FOLHA DUPLA C/2400 SANTHER |
| Desinfetantes | DESINFETANTE, DESINF | 50 | DESINFETANTE WAVE 5L AZULIM; DESINFETANTE VIOLETTE 1L AZULIM |
| Sabões e alvejantes | SABAO, ALVEJANTE, CLORO, AGUA SANITARIA | 49 | SABAO PASTOSO RUTH 500g COCO; SABAO EM PO TIXAN PRIMAVERA LAVA ROUPAS 1,6 KG |
| Dispensers e suportes | DISPENSER, SUPORTE, PORTA, REFIL | 44 | SUPORTE PAPEL HIG ROLAO BR 32779 (NOBRE); SUPORTE PAPEL HIG ROLAO BR 19650* |
| Aromatizantes e odorizadores | ODORIZADOR, AROMATIZANTE, NEUTRALIZADOR, DIFUSOR, PASTILHA | 43 | PASTILHA ADESIVA SANITARIA LAVANDA 029; PASTILHA ADESIVA ODORIZANTE MARINE C/ 03 UND AZULIM |
| Café, açúcar e copa | CAFE, ACUCAR, BISCOITO, ADOCANTE, CHA, FILTRO | 43 | FILTRO PAPEL N 103 30UN 3.CORACOES; FILTRO PAPEL N 102 30UN 3.CORACOES |
| Álcool | ALCOOL | 33 | ALCOOL LIQUIDO ZEROBAC CRISTAL SPRAY 46% 500ML ASSEPTGEL; ALCOOL LIQUIDO NEUTRO 70% TUPI 5L |
| Detergentes e lava-louças | DETERGENTE, LAVA | 27 | LAVA LOUCAS NEUTRO 5L LAVVE; LAVA LOUCAS NEUTRO 5L AZULIM |
| Ceras e tratamento de pisos | CERA, ACABAMENTO, REMOVEDOR, IMPERMEABILIZANTE, LUSTRA | 26 | REMOVEDOR DE CERAS 1L AZULIM; REMOVEDOR CERAS E LIMPEZA PESADA 5L MAGICO |
| Descartáveis | COPO, GUARDANAPO, PRATO, TOUCA, MASCARA | 22 | TOUCA DESCARTAVEL TNT SANFONADO PRETA C/100 VABENE; TOUCA DESCARTAVEL TNT C/100 PREVEMAX |
| Luvas | LUVA | 19 | LUVA VINIL C/ AMIDO G C/100 TALGE; LUVA VABENE VINIFLEX M C 100 CAIXA C 100 UNDS |

321 produtos não se encaixam em nenhuma regra (lista em `dev/data/collections-suggested.json`). Para eles, use tipo de produto ou tags, ou crie coleções manuais.

Atenção: produtos que começam com "SH" são detergentes da linha SH (não shampoo) e ficam de fora de propósito.
