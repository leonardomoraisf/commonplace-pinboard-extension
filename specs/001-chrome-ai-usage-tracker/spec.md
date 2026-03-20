# Feature Specification: Painel unificado de uso de IA (extensão Chrome)

**Feature Branch**: `001-chrome-ai-usage-tracker`  
**Created**: 2026-03-19  
**Status**: Draft  
**Input**: User description: "Quero criar uma extensão para usar no google chrome que irá servir para eu acompanhar o uso das minhas ferramentas de IA em um só lugar. Ideia: já logado nas plataformas Cursor e Codex. Páginas iniciais desejadas: uso Codex (ChatGPT) e gastos Cursor. Fluxo + para URL, seleção de secção, lista com scroll, persistência, título/favicon configuráveis."

## Clarifications

### Session 2026-03-19

- Q: Quando e como o conteúdo das amostras deve atualizar relativamente à página de origem? → A: Ao abrir o painel e/ou mediante ação explícita de atualização por entrada; sem atualização automática contínua em segundo plano (opção A).
- Q: Onde o utilizador abre e usa o painel unificado no Chrome? → A: Popup ao clicar no ícone da extensão (opção A).
- Q: Como deve funcionar o acesso da extensão aos sites adicionados (permissões)? → A: Uso exclusivamente pessoal pelo autor; sem preocupação com minimização de permissões nem posture de segurança formal — é aceitável o âmbito de permissões mais simples/largo que a implementação exija (equivalente prático à opção B).
- Q: Como deve ser determinada a ordem das entradas na lista? → A: Reordenação manual pelo utilizador, com ordem persistida (opção C).
- Q: Deve existir forma explícita de abrir a página completa a partir de cada entrada? → A: Sim — controlo dedicado e claro para abrir o URL num novo separador, sem depender de clicar na amostra (opção A).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Adicionar uma nova página monitorizada (Priority: P1)

O utilizador quer registar uma página web (por exemplo, área de uso ou gastos de uma ferramenta de IA) e escolher qual parte dessa página deve aparecer sempre no painel unificado. Clica no controlo “+” no topo, introduz o endereço da página, confirma, e escolhe visualmente a secção da página cujo conteúdo quer manter visível na lista. A nova entrada passa a aparecer na lista com uma amostra dessa secção.

**Why this priority**: Sem este fluxo não há produto — é o núcleo para concentrar o acompanhamento num só lugar.

**Independent Test**: Pode testar-se de ponta a ponta com um único URL: após o fluxo, a entrada existe na lista e mostra a área escolhida.

**Acceptance Scenarios**:

1. **Given** o painel da extensão aberto sem entradas (ou com entradas existentes), **When** o utilizador toca em “+”, introduz um URL válido e completa a seleção de secção, **Then** surge uma nova linha na lista com pré-visualização da secção escolhida.
2. **Given** uma entrada criada, **When** o utilizador fecha e volta a abrir o browser (ou a extensão) noutro momento, **Then** a mesma entrada e a mesma secção escolhida continuam disponíveis sem repetir o fluxo.

---

### User Story 2 - Ver todas as áreas numa lista simples com scroll (Priority: P2)

O utilizador quer percorrer, na janela do popup da extensão, as várias áreas que configurou (uso Codex, gastos Cursor, futuras páginas), cada uma como amostra da secção escolhida, numa lista vertical simples. Pode **reordenar** as entradas manualmente para definir a sequência preferida; essa ordem fica guardada. Quando há muitas entradas, a lista permite scroll para ver todas dentro do espaço disponível do popup.

**Why this priority**: Entrega o valor de “um só lugar” para comparar e rever várias fontes sem saltar entre separadores manualmente.

**Independent Test**: Com pelo menos duas entradas guardadas, verificar que ambas aparecem na lista e que é possível fazer scroll até à última.

**Acceptance Scenarios**:

1. **Given** várias entradas guardadas, **When** o utilizador abre o painel, **Then** vê cada entrada como bloco/list item com a amostra da respetiva secção.
2. **Given** mais entradas do que cabem no ecrã visível, **When** o utilizador faz scroll na lista, **Then** consegue alcançar todas as entradas sem sair do painel.
3. **Given** o painel estava fechado e os dados na página de origem mudaram, **When** o utilizador volta a abrir o painel, **Then** as amostras refletem uma nova leitura desse momento (sem depender de atualização automática contínua enquanto o painel esteve aberto).
4. **Given** o painel já está aberto e uma entrada mostra dados antigos, **When** o utilizador pede atualização explícita nessa entrada, **Then** só essa amostra é renovada segundo o estado atual da página alvo.
5. **Given** pelo menos duas entradas na lista, **When** o utilizador reordena manualmente os itens (por exemplo, arrastando ou com ações de subir/descer), **Then** a lista reflete imediatamente a nova ordem.
6. **Given** uma ordem personalizada, **When** o utilizador fecha o navegador e mais tarde reabre o painel, **Then** as entradas aparecem na mesma ordem guardada.
7. **Given** uma entrada com URL guardado, **When** o utilizador usa o **controlo dedicado** para abrir a página completa, **Then** o URL correto abre num **novo separador** sem que a interação dependa de clicar na amostra.

---

### User Story 3 - Título e ícone identificáveis e editáveis (Priority: P3)

Para cada entrada, o utilizador pode aceitar o título da página e o ícone (favicon) sugeridos automaticamente, ou definir um título próprio à criação. Mais tarde, pode manter o favicon visível e alterar só o título, para organizar o painel ao seu gosto.

**Why this priority**: Melhora reconhecimento rápido e organização quando há muitas ferramentas semelhantes.

**Independent Test**: Criar entrada com título automático; editar título; confirmar que o favicon continua visível conforme esperado.

**Acceptance Scenarios**:

1. **Given** o fluxo de adição de página, **When** o utilizador não define título manual, **Then** o sistema usa o título da página e mostra o favicon associado à entrada.
2. **Given** o fluxo de adição de página, **When** o utilizador define um título personalizado, **Then** esse título aparece na lista e o favicon pode continuar a ser mostrado.
3. **Given** uma entrada existente, **When** o utilizador altera apenas o título, **Then** o favicon e a secção monitorizada mantêm-se; só o texto de identificação muda.

---

### User Story 4 - Extensão fácil a novas páginas (Priority: P2)

O utilizador quer que adicionar novas páginas de controlo (além das que já usa hoje) siga sempre o mesmo fluxo “+ → URL → escolher secção”, sem depender de atualizações manuais à lista de sites.

**Why this priority**: Garante que o produto acompanha novas ferramentas ou novas URLs de relatórios sem retrabalho de configuração “fixa”.

**Independent Test**: Adicionar um URL diferente dos exemplos iniciais e repetir o fluxo com sucesso.

**Acceptance Scenarios**:

1. **Given** o utilizador descobre uma nova página de estatísticas ou uso, **When** usa o mesmo fluxo de adição, **Then** consegue incluí-la na lista tal como as entradas existentes.

---

### Edge Cases

- URL inválido, página em erro ou temporariamente indisponível: o utilizador recebe feedback claro e pode corrigir ou cancelar sem perder entradas já guardadas.
- Utilizador não está autenticado no site alvo: a pré-visualização reflete o que o site mostra nesse estado (por exemplo, ecrã de login); não se assume login automático pela extensão.
- Secção escolhida muito extensa: a lista deve continuar utilizável (por exemplo, limitando a altura da amostra com scroll interno ou truncagem visível, sem quebrar o scroll global da lista).
- Janela popup com dimensões limitadas pelo Chrome: o layout MUST manter lista e amostras utilizáveis exclusivamente com scroll interno (vertical global da lista e, se necessário, por entrada), sem exigir redimensionamento manual pelo utilizador para concluir tarefas principais.
- O mesmo URL adicionado mais de uma vez com secções diferentes: cada entrada é independente (identificador lógico distinto); a reordenação afeta cada item da lista, não confunde entradas distintas.
- Conteúdo da página muda no servidor: a amostra atualiza quando o utilizador abre (ou reabre) o painel principal ou quando dispara atualização explícita nessa entrada; não há atualização periódica automática em segundo plano; se a estrutura da página mudar de forma incompatível com a secção guardada, o utilizador pode precisar de reconfigurar essa entrada.
- Abrir o site original: o utilizador usa sempre o controlo dedicado (**FR-014**); se a amostra for interativa ou clicável por outro motivo, não deve substituir nem obscurecer essa ação intencional de “abrir página completa”.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: A extensão MUST apresentar um painel principal com uma lista vertical das áreas monitorizadas, aberto como **popup** ao clicar no ícone da extensão na barra de ferramentas do Chrome.
- **FR-002**: Cada item da lista MUST mostrar uma amostra visual da secção da página que o utilizador selecionou para essa entrada.
- **FR-003**: O painel MUST incluir um controlo “+” no topo que inicia o fluxo de adição de uma nova página.
- **FR-004**: No fluxo de adição, o utilizador MUST poder introduzir o URL da página e, em seguida, selecionar qual secção da página fica associada à entrada.
- **FR-005**: Todas as entradas (URL, secção escolhida, título, preferências de apresentação do ícone, **ordem na lista**) MUST persistir entre sessões do browser até o utilizador as remover ou alterar.
- **FR-006**: Para cada entrada, o utilizador MUST poder usar um título personalizado na criação OU aceitar o título derivado da página juntamente com o favicon exibido na lista.
- **FR-007**: Para cada entrada existente, o utilizador MUST poder alterar o título enquanto mantém o favicon (e a secção) salvo, salvo ação explícita em contrário.
- **FR-008**: Quando a lista exceder o espaço visível, o utilizador MUST poder fazer scroll para ver todos os itens.
- **FR-009**: O fluxo de adição MUST ser genérico: qualquer URL permitida pelo utilizador MUST poder ser adicionada pelo mesmo processo, sem lista fixa exclusiva de domínios (podendo existir exemplos ou atalhos informativos para as páginas que o utilizador já valoriza hoje: uso Codex no ChatGPT e gastos no dashboard Cursor).
- **FR-010**: O utilizador MUST poder remover ou reconfigurar uma entrada (por exemplo, voltar a escolher secção ou URL) sem apagar as restantes.
- **FR-011**: As amostras MUST obter conteúdo atualizado da página alvo quando o utilizador abre ou reabre o painel principal; o utilizador MUST poder pedir atualização explícita por entrada; o sistema MUST NOT realizar atualização automática contínua ou por intervalo fixo em segundo plano enquanto o painel permanece aberto.
- **FR-012**: Dado uso **exclusivamente pessoal** pelo autor, o modelo de permissões do Chrome MAY ser o de **maior âmbito necessário** à implementação (por exemplo, acesso amplo a URLs HTTPS), **sem** obrigatoriedade de consentimento incremental por domínio ao adicionar cada URL nem de documentação de ameaças para terceiros.
- **FR-013**: O utilizador MUST poder **reordenar manualmente** as entradas na lista; a ordem resultante MUST persistir juntamente com os restantes dados da entrada (alinhado com **FR-005**).
- **FR-014**: Cada entrada MUST expor uma forma **clara e dedicada** (por exemplo, ícone ou ligação no cabeçalho da entrada) de abrir o **URL completo** guardado num **novo separador**; abrir o site MUST NOT depender exclusivamente de clicar na área da amostra.

### Key Entities

- **Entrada monitorizada**: Representa uma fonte no painel. Atributos: endereço da página; referência à secção escolhida (de forma que a amostra possa ser reproduzida); título apresentado; favicon associado; **posição ordenável** na lista (definida pelo utilizador e persistida); metadados de criação/última atualização se úteis ao utilizador.

### Assumptions

- O utilizador gere a própria autenticação em cada site (Cursor, Codex/ChatGPT, outros); a extensão não substitui login nem armazena credenciais desses serviços.
- Os exemplos de páginas que o utilizador quer ver hoje são apenas referência de valor; o comportamento é o mesmo para qualquer nova página adicionada pelo fluxo “+”.
- O armazenamento das configurações é local ao dispositivo do utilizador, adequado a dados de organização pessoal.
- O produto destina-se ao navegador Google Chrome, como canal de distribuição pedido pelo utilizador.
- **Uso pessoal**: Ferramenta para um único utilizador (autor); não há requisito de minimização de permissões, endurecimento para partilha de máquina, nem conformidade explícita com requisitos de publicação na Chrome Web Store além do necessário para instalação local.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Um utilizador consegue adicionar uma nova entrada (URL + seleção de secção) e vê-la na lista em menos de 2 minutos na primeira utilização, sem documentação externa.
- **SC-002**: Após fechar completamente o navegador e reabrir, 100% das entradas configuradas reaparecem com a mesma secção, títulos/favicons e **ordem na lista** guardados, num teste com até 10 entradas.
- **SC-003**: Com 5 ou mais entradas, o utilizador consegue localizar qualquer uma fazendo scroll na lista em menos de 15 segundos.
- **SC-004**: Pelo menos 90% dos participantes num teste de usabilidade informal identificam corretamente qual ferramenta corresponde a cada entrada graças a título e ícone, sem abrir o site original.
- **SC-005**: O utilizador classifica como “fácil” ou equivalente a adição de uma nova página genérica (escala simples ou entrevista curta), alinhado com o objetivo de extensibilidade.
