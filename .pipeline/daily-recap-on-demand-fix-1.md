# Fix 1: Resumo Diário sob Demanda

**Slug:** daily-recap-on-demand
**Data:** 2026-06-19
**Rodada de revisão:** 1

---

## Problemas Encontrados

### Problema 1: Effect 2 pode reabrir o modal após o usuário fechá-lo
**Arquivo:** `components/bolao/DailyRecapModal.tsx` (linhas 225–231)
**Severidade:** importante
**Descrição:**
O Effect 2 tem como dependências `[forceOpen, loading, hasData]`. Isso significa que, enquanto `forceOpen === true`, qualquer mudança em `loading` ou `hasData` (ex: re-render causado por StrictMode, refetch do hook, ou mudança de estado do componente pai) aciona o effect novamente e chama `setIsOpen(true)`, mesmo que o usuário já tenha fechado o modal (`isOpen === false`). O `handleClose` chama `onClose?.()` que seta `recapOpen = false` no pai — mas há uma janela de tempo entre `setIsOpen(false)` e a propagação de `forceOpen = false` para o filho em que um re-render intermediário poderia reabrir o modal indevidamente.

**Correção esperada:**
Adicionar uma guarda `if (isOpen) return` no início do Effect 2, para que ele não tente abrir o modal se este já estiver aberto (evita o `queueMicrotask` desnecessário), e nunca reabra se o modal já foi fechado enquanto `forceOpen` ainda não foi atualizado para `false`. A forma mais robusta é checar o estado atual via ref:

```typescript
// Effect 2: abertura sob demanda (forceOpen=true ignora localStorage)
useEffect(() => {
  if (!forceOpen) return
  if (loading) return
  if (!hasData) return
  if (isOpen) return  // já está aberto, não precisa reabrir
  queueMicrotask(() => setIsOpen(true))
}, [forceOpen, loading, hasData, isOpen])
```

Alternativamente, usar um `isOpenRef` sincronizado com `isOpen` para evitar que `isOpen` como dependência cause loops:

```typescript
const isOpenRef = useRef(false)
// no handleClose: isOpenRef.current = false
// no setIsOpen(true): isOpenRef.current = true (ou via useEffect que sincroniza)

// Effect 2:
useEffect(() => {
  if (!forceOpen) return
  if (loading) return
  if (!hasData) return
  if (isOpenRef.current) return
  queueMicrotask(() => setIsOpen(true))
}, [forceOpen, loading, hasData])
```

A solução mais simples e direta é adicionar `isOpen` nas dependências com a guarda `if (isOpen) return`. React com StrictMode vai montar duas vezes em dev, mas como `queueMicrotask` é usado, a segunda chamada encontrará `isOpen = true` e retornará sem efeito.

---

## Itens OK (não precisam ser revisados novamente)

- `DailyRecapModal` — props `forceOpen` e `onClose` implementadas conforme spec
- `DailyRecapModal` — Effect 1 (abertura automática) inalterado e correto; `decidedRef` protege contra dupla execução
- `DailyRecapModal` — `handleClose` chama `onClose?.()` em ambos os caminhos de fechamento (botão FECHAR e backdrop via `onClick={handleClose}`)
- `DailyRecapModal` — abertura sob demanda não grava nem lê `localStorage` (regra de negócio 2 respeitada)
- `RecapButton` — renderiza `null` durante loading e quando `hasData === false` (critério de aceite respeitado)
- `RecapButton` — estilo segue DESIGN.md: JetBrains Mono 11px, uppercase, `color-muted` normal, `color-accent` no hover, `borderBottom` em hover, sem ícones
- `RecapButton` — `currentUserId` propagado do layout para suporte ao destaque do usuário atual no modal (decisão técnica documentada e correta)
- `NavLinks` — `RecapButton` inserido após os links de rota, dentro do mesmo `<nav>`, conforme spec
- `NavLinks` — `overflowX: 'auto'` adicionado para compatibilidade mobile (critério de aceite respeitado)
- `DashboardLayout` — `groupId={activeGroup?.id ?? ''}` e `currentUserId={user.id}` passados para `NavLinks`
- `DashboardLayout` — instância original do `DailyRecapModal` (automática) preservada inalterada
- Dupla instância do `DailyRecapModal` — consciente e aceita pela spec (regra de negócio 4)
- Backend e banco de dados — sem alterações, conforme spec
- Commits em português com prefixo correto
- Branch `feature/daily-recap-on-demand` correta
- Design segue DESIGN.md (paleta, tipografia monospace, estilo Elifoot, sem ícones decorativos)
- Interface em português brasileiro
