# Axon CRM

CRM de vendas da **Axon Tech** (criação de sites), inspirado no fluxo do Pipedrive: negócios em etapas, atividades como motor do processo, leads, contatos, produtos e previsão de receita. Feito em HTML/CSS/JS puro — **sem build, sem servidor, sem dependências**.

![status](https://img.shields.io/badge/vers%C3%A3o-1.0-256abf) ![testes](https://img.shields.io/badge/testes-140%20verifica%C3%A7%C3%B5es-0f7f1b)

## Como usar

| Jeito | Passos |
|---|---|
| **Mais simples** | Baixe `dist/axon-crm.html` (arquivo único, funciona offline) e dê dois cliques. |
| **Do código-fonte** | Abra `index.html` no navegador. |
| **Hospedar** | Publique a pasta (ou só o `dist/axon-crm.html`) em qualquer hospedagem estática (GitHub Pages, Netlify, Vercel…). |
| **Página privada no Claude** | Publique `dist/axon-crm.artifact.html` como artefato (com as capacidades `db` e `downloads`): os dados ficam na nuvem da sua conta, em qualquer aparelho. Veja “Seus dados”. |

Na primeira abertura o CRM pergunta seu nome e oferece **dados de exemplo** para você explorar (dá para apagar tudo depois em *Configurações → Dados e backup*).

## O que tem

**Negócios (pipeline)**
- Kanban com arrastar e soltar, reordenação dentro da etapa e zonas de soltar **Ganho / Perdido / Excluir**.
- Totais por etapa (valor, quantidade, probabilidade), previsão ponderada e **MRR** (recorrência) no topo.
- Indicador de atividade em cada card (agendada · atrasada · **sem atividade**) e alerta de negócio **parado** (rotting) por etapa.
- Vários pipelines, filtros (responsável, etiqueta, busca) e visão em **lista** ordenável.
- Teclado: `Alt + ←/→` move o card entre etapas · `/` ou `Ctrl/⌘ + K` busca · `N` novo negócio · `Esc` fecha.
- **Desfazer** em movimentações, exclusões e conclusões.

**Página do negócio**: barra de etapas clicável com dias em cada etapa, resumo com edição inline, pessoa e organização (links de e-mail, telefone e WhatsApp), aba *Foco* (próxima ação, notas fixadas, histórico unificado), notas, atividades e **produtos** (valor do projeto e MRR calculados automaticamente, com desconto).

**Leads** (caixa de entrada): cadastro manual, **importação de CSV** (reconhece exportações do Apollo, Sales Navigator, Sheets/Excel — `,` ou `;`) e conversão em negócio criando organização e pessoa sem duplicar.

**Atividades**: lista agrupada por prazo (atrasadas · hoje · amanhã · 7 dias…) e **calendário mensal**; ao concluir, sugere *Agendar próxima*. Tipos pensados para outbound: Ligação, WhatsApp, E-mail, LinkedIn, Reunião, Proposta, Tarefa.

**Pessoas e organizações** com histórico de negócios, atividades e notas.

**Produtos**: catálogo de serviços (projeto único ou mensal). Os preços iniciais são **valores de exemplo — ajuste em *Produtos***.

**Insights**: receita ganha (com variação vs. período anterior), pipeline aberto, conversão, ticket médio, ciclo, novos negócios (% outbound), funil de conversão por etapa, ganhos × perdidos, previsão por mês, **origem dos negócios (outbound × inbound × indicação)**, motivos de perda e atividades. Todo gráfico tem tooltip e **tabela equivalente** (botão no canto do cartão).

**Configurações**: pipelines e etapas (probabilidade e tempo para “parado”), origens (com grupo), motivos de perda, etiquetas, tipos de projeto, equipe, backup/restauração, exportação CSV e tema claro/escuro.

## Seus dados

**Arquivo local ou hospedagem estática** — os dados ficam **no navegador** (`localStorage`); nada é enviado para fora:

- Cada navegador/computador tem seus próprios dados — e eles ficam atrelados ao **endereço do arquivo**: abra sempre o mesmo arquivo (ou, melhor, publique em um endereço fixo `https://…`). Em Firefox/Safari, mover o arquivo ou abrir outra cópia mostra um CRM vazio; seus dados continuam no endereço anterior e voltam ao reabri-lo (ou via backup). Para levar para outro lugar: *Exportar backup (JSON)* → *Restaurar backup*.
- Limpar os dados do site apaga o CRM. **Exporte um backup com frequência** (o CRM avisa quando passar de 7 dias).

**Como artefato do Claude (`dist/axon-crm.artifact.html`)** — `js/cloud.js` detecta o `window.claude` e guarda tudo no armazenamento `db` da conta:

- Os dados acompanham você em qualquer aparelho; um indicador no topo mostra *Salvando… / Salvo na nuvem / Não salvo* (clique para tentar de novo). Ao voltar para a aba, o CRM busca alterações feitas em outro aparelho.
- O estado vira poucos documentos: `meta/config` (pipelines, produtos, listas, equipe) e registros agrupados em 32 “baldes” por coleção (`deals/b07`, `activities/b21`…), cada um abaixo do limite de 256 KiB. Só os baldes alterados são regravados. Quem lê o `db` por fora (por exemplo, o próprio Claude) encontra `{ r: { <id>: registro } }` em cada balde.
- Downloads (backup JSON e CSV) passam pela capability `downloads`, que pede confirmação.
- Sem login/permissão do `db`, o app cai para o `localStorage`, como no arquivo local. Se a nuvem estiver vazia e já houver dados no navegador, eles viram o primeiro conteúdo da nuvem.
- Não há edição simultânea: é uma ferramenta individual (dois aparelhos editando o mesmo registro ao mesmo tempo: vale a última gravação do balde).

## Estrutura

```
index.html            entrada (carrega css/ e js/ na ordem)
css/                  tokens (tema), componentes, telas
js/util.js            DOM seguro (h()), datas, moeda, CSV
js/data.js            configuração padrão da Axon + gerador de dados de exemplo
js/store.js           estado, persistência plugável, índices, regras de negócio
js/cloud.js           armazenamento na nuvem (db do Claude) quando roda como artefato
js/ui.js, forms.js    modal, menu, picker, tabela, formulários
js/parts.js           blocos compartilhados (atividade, nota, histórico)
js/views/*.js         telas (pipeline, deal, leads, activities, contacts, products, insights, settings)
js/app.js             shell: rotas (#/…), busca global, tema, onboarding
scripts/build.mjs     gera dist/axon-crm.html e dist/axon-crm.artifact.html (arquivos únicos)
tests/e2e.mjs         testes ponta a ponta (Playwright)
tests/cloud.mjs       testes do modo nuvem com um host falso (db + downloads)
```

## Desenvolvimento

```bash
npm install            # só para os testes (Playwright)
npm run build          # regenera os dois arquivos de dist/ — rode antes de commitar mudanças em css/ ou js/
npm test               # 140 verificações no Chromium (89 e2e + 51 do modo nuvem)
SHOTS=./shots npm test # também salva capturas de tela
```

Decisões de qualidade:
- **Sem `innerHTML` com dados**: todo texto vem de `textContent` (importar CSV de terceiros não executa código). Links só aceitam `http(s)`, `mailto:` e `tel:`; o CSV exportado neutraliza fórmulas (`=`, `+`, `-`, `@`).
- **Paleta dos gráficos validada** com o validador de dados da skill de visualização: rampa ordinal do funil (ΔL ≥ 0,06 e contraste ≥ 2:1 nos dois temas) e par ganhos/perdidos separável por daltônicos (ΔE ≥ 15 em visão normal).
- Valores em **R$** e datas em **pt-BR**; datas de atividade são “dia local” (sem problema de fuso).

## Próximos passos sugeridos

1. **Multiusuário e login** (backend, ex.: Supabase/Postgres) — o `store.js` já concentra todo o acesso a dados.
2. **Integração com Apollo/Pipedrive** (importar listas e negócios existentes por API).
3. Cadências de outbound (sequências de atividades automáticas), e-mail/WhatsApp registrados no histórico.
4. Metas por vendedor e por mês; campos personalizados; detecção de duplicados.
