# Fix 1: Refatoração do Daily Recap Modal

**Slug:** daily-recap-modal-refactor
**Data:** 2026-06-19
**Rodada de revisão:** 1

---

## Problemas Encontrados

### Problema 1: `currentUserId` declarada mas não usada em `RecapFloatingButton`
**Arquivo:** `components/bolao/RecapFloatingButton.tsx` (linha 9 e 13)
**Severidade:** menor
**Descrição:** A interface `RecapFloatingButtonProps` declara `currentUserId: string`, mas a função desestrutura apenas `{ groupId, onOpen }` — `currentUserId` nunca é lida nem repassada. Dead code que polui a interface e cria a impressão incorreta de que o componente precisa da identidade do usuário para funcionar.
**Correção esperada:** Remover `currentUserId: string` da interface `RecapFloatingButtonProps`. A assinatura da função já não usa o campo; basta remover da declaração do tipo. Verificar que `RecapController` ainda compila depois (ele passa `currentUserId` para o botão — essa prop também deve ser removida da chamada em `RecapController.tsx`).

### Problema 2: `useDailyRecap` chamado duas vezes — double-fetch ao Supabase
**Arquivo:** `components/bolao/RecapFloatingButton.tsx` (linha 14) e `components/bolao/DailyRecapModal.tsx` (linha 199)
**Severidade:** importante
**Descrição:** O `RecapController` renderiza `<RecapFloatingButton>` e `<DailyRecapModal>` simultaneamente. Cada um chama `useDailyRecap(groupId)` de forma independente, sem compartilhamento de estado. Isso dispara **duas rodadas completas de queries paralelas ao Supabase** com exatamente os mesmos filtros (games do dia anterior, scores e predictions do mesmo grupo). Em dias com muitos jogos, o payload duplicado onera desnecessariamente a conexão e o banco.

A spec (seção "Conflito potencial") identificou o risco de dupla instância do modal e prescreveu o `RecapController` para evitá-lo — mas o double-fetch é uma consequência análoga que não foi eliminada.

**Correção esperada:** Elevar o `useDailyRecap(groupId)` para o `RecapController`, que passa os dados relevantes via props para os filhos:

```tsx
// RecapController.tsx
'use client'

import { useState } from 'react'
import { useDailyRecap } from '@/lib/hooks/useDailyRecap'
import { RecapFloatingButton } from './RecapFloatingButton'
import { DailyRecapModal } from './DailyRecapModal'

interface RecapControllerProps {
  groupId: string
  currentUserId: string
}

export function RecapController({ groupId, currentUserId }: RecapControllerProps) {
  const [forceOpen, setForceOpen] = useState(false)
  const { loading, hasData } = useDailyRecap(groupId)

  return (
    <>
      <RecapFloatingButton
        loading={loading}
        hasData={hasData}
        onOpen={() => setForceOpen(true)}
      />
      <DailyRecapModal
        groupId={groupId}
        currentUserId={currentUserId}
        forceOpen={forceOpen}
        onClose={() => setForceOpen(false)}
      />
    </>
  )
}
```

`RecapFloatingButton` deixa de chamar `useDailyRecap` e passa a receber `loading` e `hasData` via props:

```tsx
// RecapFloatingButton.tsx
'use client'

const FONT = "'JetBrains Mono', 'Courier New', monospace"

interface RecapFloatingButtonProps {
  loading: boolean
  hasData: boolean
  onOpen: () => void
}

export function RecapFloatingButton({ loading, hasData, onOpen }: RecapFloatingButtonProps) {
  if (loading || !hasData) return null
  // ... resto do JSX permanece igual
}
```

`DailyRecapModal` mantém seu próprio `useDailyRecap` interno (já que precisa de `data` para renderizar o conteúdo e também controla a abertura automática via localStorage). Com essa mudança, o hook é chamado exatamente uma vez no `RecapController` para visibilidade do botão, e uma vez no modal para conteúdo — ainda são duas chamadas, porém com papel semântico distinto. A alternativa mais agressiva (passar `data` via prop ao modal) alteraria a interface pública do `DailyRecapModal` e poderia impactar outros usos futuros.

**Alternativa aceitável (se a mudança acima for considerada muito invasiva):** Reduzir o escopo da correção ao Problema 1 apenas (remover `currentUserId` da interface) e documentar o double-fetch como débito técnico no changelog. O double-fetch não causa incorreção funcional — apenas desperdício de rede.

---

## Itens OK (não precisam ser revisados novamente)

- Remoção do `RecapButton.tsx` — arquivo deletado corretamente, sem imports residuais em nenhum arquivo
- `NavLinks` sem props `groupId`/`currentUserId` — remoção completa da interface e da assinatura
- `layout.tsx` com exatamente uma instância de `DailyRecapModal` (via `RecapController`) — dupla instância do modal eliminada
- Badge `mae_dina` com `secondaryDescription` — tipo atualizado, renderização condicional correta no modal
- Fallback de artilharia quando `videntes.length === 0` — lógica correta, emite badge com base na maior soma de gols apostados
- Badge `pe_frio` renomeado de `'PÉ-FRIO DO DIA'` para `'PE-FRIO'` — label correto
- Badges `artilheiro` e `apostador` removidos completamente de `calcBadges`
- Query de predictions agora inclui `home_score, away_score` — correto
- Tipo `RawPrediction` atualizado com os dois campos — correto
- Mapeamento do resultado de predictions propaga `home_score ?? 0` e `away_score ?? 0` — correto
- TypeScript compila sem erros (`tsc --noEmit` passou limpo)
- Commits em português com prefixo correto (`feat`, `chore`)
- Branch `feature/daily-recap-modal-refactor` — correta
- Estilos do `RecapFloatingButton`: `position: fixed`, `bottom: 1.5rem`, `left: 1.5rem`, `zIndex: 50`, sem `border-radius`, sem `box-shadow`, JetBrains Mono, uppercase — todos conforme DESIGN.md e spec
- Hover do botão altera cor do texto e da borda para `var(--color-accent)` — correto
- Texto `"► RESUMO DE ONTEM"` — conforme especificado na spec
- Proteção de rotas inalterada — feature opera dentro do dashboard protegido
- Nenhuma migration de banco necessária — confirmado
- Backend Ruby sem alterações — correto (feature 100% frontend)
