# Quickstart: desenvolvimento e teste local

## Pré-requisitos

- Google Chrome recente (Manifest V3).
- Este repositório clonado em `/home/leokr/projects/ai_usage_tracking` (ou equivalente).

## Estrutura prevista (após implementação)

```text
extension/
├── manifest.json
├── popup.html
├── popup.css
├── popup.js
├── background.js
├── content/
│   └── picker.js
├── vendor/
│   └── sortable.min.js   # SortableJS, cópia local
└── icons/
    └── *.png
```

## Carregar a extensão unpacked

1. Abrir `chrome://extensions`.
2. Ativar **Modo de programador**.
3. **Carregar sem compactação** → escolher a pasta `extension/` na raiz do repo (criada na implementação).

## Fluxo de teste manual

1. Clicar no ícone da extensão → abre o **popup**.
2. **+** → introduzir `https://cursor.com/dashboard/spending` (ou URL de teste) → confirmar → separador abre com modo seleção → clicar na região desejada → verificar cartão no popup com amostra.
3. Repetir para segunda URL (ex. página Codex) e confirmar **scroll** na lista.
4. **Arrastar** cartões → fechar browser → reabrir → confirmar **ordem** (SC-002).
5. **Abrir página completa** pelo controlo dedicado → novo separador com URL correto.
6. **Atualizar** uma entrada sem o site aberto → confirmar abertura temporária ou mensagem + cache conforme plano.

## Design (referência rápida)

- Cartões: fundo branco, `border-radius: 12px`, sombra leve.
- Botões e inputs: `border-radius: 8px`, estados `:focus-visible` visíveis.
- Lista: `max-height` no contentor com `overflow-y: auto` no popup.

## Notas

- Estar **autenticado** nos sites alvo nos separadores normais ajuda o matcher de tabs; o botão **atualizar** cobre o caso sem separador aberto.
- Para desenvolvimento, após alterar `manifest.json` ou service worker, usar **Recarregar** em `chrome://extensions`.
