# Spec: Botão Fixo no Rodapé com Bottom Sheet de Resumo

**Slug:** recap-bottom-sheet
**Data:** 2026-06-19
**Status:** spec

---

## Objetivo

Substituir o `RecapFloatingButton` (chip fixo no canto inferior esquerdo) por um botão de largura total fixado no rodapé da tela ("footer pill"), que ao ser clicado abre o conteúdo do resumo diário em um bottom sheet com animação de slide-up. O bottom sheet exibe exatamente o mesmo conteúdo hoje presente no `DailyRecapModal`. O comportamento de abertura automática no primeiro acesso do dia é preservado, abrindo o bottom sheet em vez do modal centralizado.

---

## Histórias de Usuário

- Como participante do bolão, quero ver um botão claro e acessível no rodapé da tela para abrir o resumo do dia anterior, sem precisar encontrar um chip pequeno no canto da tela.
- Como participante, quero que o resumo deslize de baixo para cima ao abrir, com animação suave, para uma experiência de navegação fluida típica de apps mobile.
- Como participante em iPhone, quero que o botão e o bottom sheet respeitem a safe-area do iOS, sem conteúdo cortado pela barra de navegação do sistema.
- Como participante, quero fechar o bottom sheet tocando fora dele ou no botão "FECHAR", de forma que feche com animação de slide-down.
- Como participante acessando o app pela primeira vez no dia, quero que o resumo apareça automaticamente (mesmo comportamento de antes), agora como bottom sheet.

---

## Modelo de Dados

Nenhuma alteração de schema. Nenhuma migration necessária. A feature é 100% frontend.

---

## Backend — Endpoints Ruby/Sinatra

Nenhum endpoint novo ou modificado.

---

## Frontend — Componentes React

### RecapFooterButton

**Arquivo:** `components/bolao/RecapFooterButton.tsx`

**Descrição:** Substitui `RecapFloatingButton`. Botão fixo de largura total no rodapé da tela. Visível apenas quando `hasData === true` e `loading === false`.

**Props:**
```typescript
interface RecapFooterButtonProps {
  loading: boolean
  hasData: boolean
  onOpen: () => void
}
```

**Estados:**
- `loading === true` ou `hasData === false`: retorna `null` (sem renderização)
- Padrão: renderiza o botão fixo no rodapé

**Estilo e layout:**
- `position: fixed`, `bottom: 0`, `left: 0`, `right: 0`, `zIndex: 50`
- `padding-bottom: calc(0.75rem + env(safe-area-inset-bottom))` — safe-area iOS
- `padding-top: 0.75rem`
- `padding-left: 1rem`, `padding-right: 1rem`
- Background: `var(--color-surface)`
- Borda superior: `1px solid var(--color-border)`
- Sem `border-radius`
- Sem `box-shadow`
- O botão interno ocupa toda a largura disponível (largura 100% dentro do container com `max-width: 960px; margin: 0 auto`)

**Botão interno:**
- Texto: `► RESUMO DE ONTEM`
- Fonte: JetBrains Mono, 12px, uppercase, `letter-spacing: 0.1em`, `font-weight: bold`
- Cor de texto padrão: `var(--color-muted)`
- Background: `var(--color-surface)`
- Borda: `1px solid var(--color-border)`
- `border-radius: 0`
- `padding: 0.625rem 1rem`
- `width: 100%`
- `cursor: pointer`
- Hover: cor do texto muda para `var(--color-accent)`, borda muda para `var(--color-accent)`
- Transição: `color 0.15s ease, border-color 0.15s ease`

**Conflito com GroupChatWidget:** O `GroupChatWidget` está fixado no canto inferior direito (`position: fixed; bottom: 1.5rem; right: 1rem; z-index: 40`). O `RecapFooterButton` deve ter `z-index: 50` e ocupar o rodapé completo. O `GroupChatWidget` é renderizado acima do rodapé quando expandido (zIndex 40 já presente). O Programador deve garantir que o chat widget não fique coberto pelo botão do rodapé — o botão deve ter `z-index` suficiente para aparecer sobre o conteúdo principal, mas o chat widget expandido (painel) tem z-index maior que 40 no componente atual, por isso o Programador deve revisar os z-index do `GroupChatWidget` para confirmar que não há conflito visual.

---

### RecapBottomSheet

**Arquivo:** `components/bolao/RecapBottomSheet.tsx`

**Descrição:** Bottom sheet com animação de slide-up/slide-down. Renderiza o mesmo conteúdo que `DailyRecapModal` (jogos de ontem, ranking do dia, badges). Substitui o `DailyRecapModal` como superfície de exibição do resumo.

**Props:**
```typescript
interface RecapBottomSheetProps {
  groupId: string
  currentUserId: string
  isOpen: boolean
  onClose: () => void
}
```

**Estados:**
- `isOpen === false` e sem animação de saída em progresso: retorna `null`
- `isOpen === true`: renderiza backdrop + painel com animação de entrada
- Transição de fechamento: animação de slide-down antes de desmontar

**Estrutura do componente:**

O estado de animação é controlado por um estado interno `visible: boolean` separado de `isOpen`:
- Quando `isOpen` muda para `true`: setar `visible = true` imediatamente
- Quando `isOpen` muda para `false`: manter `visible = true` por 300ms (duração da animação de saída), depois setar `visible = false`
- Retornar `null` apenas quando `!visible`

Implementação com `useEffect` e `setTimeout`:
```typescript
const [visible, setVisible] = useState(false)
const [animating, setAnimating] = useState(false) // true durante slide-down

useEffect(() => {
  if (isOpen) {
    setVisible(true)
    setAnimating(false)
  } else if (visible) {
    setAnimating(true)
    const timer = setTimeout(() => {
      setVisible(false)
      setAnimating(false)
    }, 300)
    return () => clearTimeout(timer)
  }
}, [isOpen])
```

**Animação — usando CSS Keyframes via `<style>` tag injetada ou classes globais:**

Como o projeto não usa Framer Motion, a animação é implementada via CSS inline com `@keyframes` definidas em `app/globals.css`:

```css
@keyframes slideUp {
  from { transform: translateY(100%); }
  to   { transform: translateY(0); }
}

@keyframes slideDown {
  from { transform: translateY(0); }
  to   { transform: translateY(100%); }
}
```

O painel aplica a animação via `style.animation`:
- Quando abrindo (`isOpen && !animating`): `animation: slideUp 0.3s ease-out forwards`
- Quando fechando (`animating`): `animation: slideDown 0.3s ease-in forwards`

**Layout do painel (bottom sheet):**
- `position: fixed`, `bottom: 0`, `left: 0`, `right: 0`
- `zIndex: 201`
- `maxHeight: 85vh`
- `overflowY: auto`
- Background: `var(--color-surface)`
- Borda superior: `1px solid var(--color-border)` — sem border-radius
- `padding: 1.25rem 1.5rem`
- `padding-bottom: calc(1.25rem + env(safe-area-inset-bottom))` — safe-area iOS
- `fontFamily: "'JetBrains Mono', 'Courier New', monospace"`

**Backdrop:**
- `position: fixed`, `inset: 0`, `zIndex: 200`
- Background: `rgba(10, 14, 26, 0.85)`
- Clique no backdrop chama `onClose`

**Conteúdo do painel** (mesma estrutura do `DailyRecapModal`):

1. **Handle visual** (indicador de arrasto): `div` centralizado, 40px de largura, 3px de altura, background `var(--color-border)`, `margin: 0 auto 1rem`, sem border-radius excessivo (2px no máximo para indicar que é um handle).

2. **Cabeçalho da seção:** linha com título `RESUMO DO DIA — {data.yesterdayLabel}` (cor `var(--color-accent)`, 14px, bold, uppercase, letter-spacing 0.1em) + botão "✕" de fechar alinhado à direita (cor `var(--color-muted)`, sem background, sem borda, cursor pointer, hover muda para `var(--color-text)`).

3. **Mensagem lúdica:** parágrafo com mensagem aleatória (mesma lógica do `DailyRecapModal`, 12px, `var(--color-muted)`).

4. **Seção JOGOS DE ONTEM:** separador + label + lista de jogos (mesma estrutura do `DailyRecapModal`).

5. **Seção RANKING DO DIA:** separador + label + tabela (mesma estrutura do `DailyRecapModal`, incluindo destaque do líder e do usuário atual).

6. **Seção DESTAQUES:** separador + label + badges (mesma estrutura do `DailyRecapModal`, incluindo `secondaryDescription` para `mae_dina`).

7. **Botão FECHAR:** full-width, background `var(--color-primary)`, cor `var(--color-bg)`, uppercase, bold, padding `0.625rem`.

**Nota sobre conteúdo:** O `RecapBottomSheet` recebe `groupId` e `currentUserId` mas não deve chamar `useDailyRecap` diretamente — os dados vêm do `RecapController` que já os possui. O conteúdo a exibir é passado via props adicionais `data` e o estado `hasData` para evitar dupla chamada ao hook. Veja a spec de `RecapController` abaixo.

**Props completas revisadas:**
```typescript
import type { RecapData } from '@/lib/hooks/useDailyRecap'

interface RecapBottomSheetProps {
  data: RecapData | null
  currentUserId: string
  isOpen: boolean
  onClose: () => void
}
```

---

### RecapController (modificado)

**Arquivo:** `components/bolao/RecapController.tsx` (arquivo existente — modificar)

**Mudança:** Substituir `RecapFloatingButton` por `RecapFooterButton` e `DailyRecapModal` por `RecapBottomSheet`.

**Estado atual do componente:**
```typescript
// Atual
import { RecapFloatingButton } from './RecapFloatingButton'
import { DailyRecapModal } from './DailyRecapModal'
```

**Estado alvo:**
```typescript
// Novo
import { RecapFooterButton } from './RecapFooterButton'
import { RecapBottomSheet } from './RecapBottomSheet'
```

**Lógica do `forceOpen`:** mantida identicamente. O `RecapController` continua gerenciando `forceOpen: boolean`.

**Passagem de dados:** O `RecapController` já chama `useDailyRecap(groupId)` para obter `loading`, `hasData`. Expandir para também obter `data` e passá-lo para o `RecapBottomSheet` como prop, evitando chamada duplicada ao hook.

**Interface após modificação:**
```typescript
interface RecapControllerProps {
  groupId: string
  currentUserId: string
}

export function RecapController({ groupId, currentUserId }: RecapControllerProps) {
  const [forceOpen, setForceOpen] = useState(false)
  const { loading, hasData, data } = useDailyRecap(groupId)

  return (
    <>
      <RecapFooterButton
        loading={loading}
        hasData={hasData}
        onOpen={() => setForceOpen(true)}
      />
      <RecapBottomSheet
        data={data}
        currentUserId={currentUserId}
        isOpen={forceOpen}
        onClose={() => setForceOpen(false)}
      />
    </>
  )
}
```

**Importante:** O comportamento de abertura automática (primeiro acesso do dia via localStorage) deve ser migrado do `DailyRecapModal` para o `RecapController`, que agora controla o estado de abertura. Isso significa que o `RecapController` assume a responsabilidade pelo `Effect 1` (verificação do localStorage) e aciona `setForceOpen(true)` quando necessário.

Lógica a migrar do `DailyRecapModal` para o `RecapController`:
```typescript
const decidedRef = useRef(false)

useEffect(() => {
  if (loading) return
  if (decidedRef.current) return
  decidedRef.current = true

  const key = getRecapKey() // função auxiliar existente
  if (localStorage.getItem(key) === 'shown') return

  localStorage.setItem(key, 'shown')

  if (hasData) {
    queueMicrotask(() => setForceOpen(true))
  }
}, [loading, hasData])
```

---

### DailyRecapModal (removido ou mantido sem uso)

O `DailyRecapModal` tem dois destinos possíveis:

**Opção preferida:** remover o arquivo `DailyRecapModal.tsx` inteiramente, uma vez que todo o conteúdo é migrado para `RecapBottomSheet`. O Programador deve verificar se há qualquer outro importador do `DailyRecapModal` via `grep -r "DailyRecapModal"` antes de remover.

**Opção alternativa (se houver outros consumidores):** manter o arquivo mas remover sua montagem do `RecapController`.

---

### RecapFloatingButton (removido)

O arquivo `components/bolao/RecapFloatingButton.tsx` deve ser deletado. Verificar antes com `grep -r "RecapFloatingButton"` que não há outro importador além do `RecapController`.

---

## Regras de Negócio

1. **Visibilidade do botão:** o `RecapFooterButton` só é renderizado quando `hasData === true`. Se não houver jogos finalizados no dia anterior, o botão não aparece e o rodapé não ocupa espaço na tela.

2. **Abertura automática:** no primeiro acesso do dia, o bottom sheet abre automaticamente se `hasData === true`. A chave de controle é `bolao_recap_YYYY-MM-DD` no localStorage, calculada em BRT (UTC-3). Uma vez marcado como `'shown'`, não reabre no mesmo dia pelo fluxo automático. O fluxo sob demanda (clique no botão) ignora essa chave.

3. **Fechamento:** o bottom sheet fecha ao clicar no backdrop, no botão "✕" do cabeçalho, ou no botão "FECHAR" no rodapé do painel.

4. **Safe-area iOS:** `padding-bottom` do botão e do painel deve usar `env(safe-area-inset-bottom)` para não sobrepor a home indicator do iPhone.

5. **Scroll do painel:** o painel tem `maxHeight: 85vh` e `overflowY: auto`. O scroll do painel não deve propagar para o body (aplicar `overflow: hidden` no body quando o bottom sheet estiver aberto — via `useEffect` que adiciona/remove estilo no `document.body`).

6. **Conteúdo:** exibir exatamente as mesmas 3 seções do `DailyRecapModal`: jogos de ontem, ranking do dia, destaques (Craque do Dia, Mãe Diná, Pé-frio). Nenhuma regra de negócio de pontuação ou de cálculo de badges é alterada.

---

## Proteção de Rotas

Nenhuma rota nova. O `RecapController` é montado no `app/(dashboard)/layout.tsx`, que já exige autenticação.

---

## Integração Supabase Realtime

Nenhuma. Feature 100% client-side sem subscrições novas.

---

## Ajuste de layout no dashboard

O `DashboardLayout` em `app/(dashboard)/layout.tsx` renderiza o conteúdo principal em `<main>` com `padding: '1.5rem'`. Com o `RecapFooterButton` fixado no rodapé, o conteúdo da última seção pode ficar coberto pelo botão em algumas viewports.

O Programador deve adicionar `padding-bottom` ao `<main>` quando o `RecapFooterButton` estiver visível. Como o layout é um Server Component e o botão é client-side, a abordagem mais simples é adicionar `padding-bottom: 4rem` incondicional ao `<main>` quando o `RecapController` estiver presente — o rodapé do botão tem altura aproximada de 3.5rem + safe-area.

Alternativa: criar uma CSS variable ou classe utilitária que seja aplicada pelo `RecapController` no body/root quando o botão estiver visível.

A abordagem simples (padding-bottom fixo no main quando `activeGroup` existe) é suficiente e preferível pela ausência de complexidade.

---

## Critérios de Aceite

- [ ] `RecapFloatingButton.tsx` removido do projeto (nenhum importador restante)
- [ ] `RecapFooterButton.tsx` criado em `components/bolao/` e renderizado no rodapé quando `hasData === true`
- [ ] O botão é full-width, fixado no bottom da tela, com safe-area iOS respeitada via `env(safe-area-inset-bottom)`
- [ ] Clicar no botão abre o `RecapBottomSheet` com animação de slide-up (300ms, ease-out)
- [ ] Bottom sheet exibe as seções: JOGOS DE ONTEM, RANKING DO DIA, DESTAQUES (3 badges: Craque do Dia, Mãe Diná, Pé-frio)
- [ ] Fechar o bottom sheet via backdrop, botão "✕" ou botão "FECHAR" dispara animação de slide-down (300ms, ease-in) antes de desmontar
- [ ] Comportamento automático (primeiro acesso do dia via localStorage) abre o bottom sheet, não o modal centralizado
- [ ] `DailyRecapModal.tsx` removido ou inutilizado (sem montagem ativa)
- [ ] `RecapController.tsx` atualizado para usar os novos componentes e gerenciar a lógica de abertura automática
- [ ] Sem conflito visual com `GroupChatWidget` (canto inferior direito)
- [ ] `padding-bottom` do `<main>` no dashboard ajustado para não sobrepor conteúdo com o botão fixo
- [ ] `npm run lint` sem erros novos
- [ ] `npm run build` sem erros
- [ ] Design segue DESIGN.md: fonte JetBrains Mono, paleta `color-surface`/`color-border`/`color-accent`/`color-primary`, sem border-radius excessivo, sem sombras, uppercase, dense
- [ ] Funciona em mobile (coluna única, safe-area respeitada)
- [ ] Funciona em desktop (botão e painel limitados a `max-width: 960px` centralizado ou full-width — a critério do Programador, desde que não quebre o layout)
