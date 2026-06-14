# Fix 1: Edição de Palpites

**Slug:** predictions-edit
**Data:** 2026-06-14
**Rodada de revisão:** 1

---

## Problemas Encontrados

### Problema 1: Backend não valida `game.status` antes de permitir edição
**Arquivo:** `app/api/predictions/[id]/route.ts` (linha 92–120)
**Severidade:** importante
**Descrição:** O endpoint `PATCH /api/predictions/:id` busca o campo `status` do jogo (`select('id,match_date,status')`) mas nunca o utiliza para bloquear a edição. A spec define: "Jogo `live` ou `finished` nunca permitem edição, independentemente do deadline calculado." Um chamador direto da API (ex: via curl) consegue editar um palpite de jogo ao vivo se a `match_date` ainda está no futuro — cenário possível se o admin muda o status para `live` antes da hora oficial. O frontend protege isso corretamente (não passa `onEditRequest` para jogos `live`/`finished`), mas a validação de negócio deve existir também no backend.

**Correção esperada:** Após buscar o jogo (linha ~92), adicionar verificação do status antes da checagem de deadline:

```typescript
// Após buscar o jogo e verificar !game || !game.match_date:
if (game.status === 'live' || game.status === 'finished') {
  return NextResponse.json(
    {
      error: 'deadline_expired',
      message: 'Prazo encerrado. Não é possível editar o palpite.',
    },
    { status: 422 }
  )
}
```

Usar o mesmo error code `deadline_expired` para que o frontend exiba a mesma mensagem amigável. Inserir este bloco entre a verificação de `!game || !game.match_date` e o cálculo do `deadline` temporal.

---

### Problema 2: `predictionId` declarado na interface mas nunca usado
**Arquivo:** `components/bolao/PredictionDisplay.tsx` (linha 12)
**Severidade:** menor
**Descrição:** A prop `predictionId?: string` foi adicionada à interface `PredictionDisplayProps` mas não é desestruturada no componente nem passada pelo `GameCard`. É dead code. A prop foi listada na spec como "necessária para o PATCH", mas a implementação corretamente usou `initialPrediction.id` dentro do `PredictionForm` — o `PredictionDisplay` não precisou do ID. Deixar a prop na interface cria confusão sobre sua finalidade.

**Correção esperada:** Remover a linha `predictionId?: string // UUID — necessário para o PATCH` da interface `PredictionDisplayProps` em `components/bolao/PredictionDisplay.tsx`.

---

### Problema 3: Botão CANCELAR some quando deadline expira com formulário de edição aberto
**Arquivo:** `components/bolao/PredictionForm.tsx` (linha 359)
**Severidade:** menor
**Descrição:** A condição do botão CANCELAR é `{isEditMode && onCancelEdit && !isDeadlinePassed}`. Quando o deadline expira enquanto o formulário de edição está aberto, o botão CANCELAR some junto com o botão SALVAR, deixando o usuário sem nenhuma ação visível — preso no formulário desabilitado. O usuário não consegue retornar ao `PredictionDisplay` sem recarregar a página.

**Correção esperada:** Remover a condição `!isDeadlinePassed` do botão CANCELAR. O botão deve aparecer em modo edição independentemente do deadline, pois é uma ação de navegação (voltar ao display), não de modificação de dados:

```tsx
{/* Botão CANCELAR — somente no modo edição */}
{isEditMode && onCancelEdit && (
  <button
    type="button"
    onClick={onCancelEdit}
    style={{
      marginTop: '0.4rem',
      width: '100%',
      padding: '0.25rem',
      backgroundColor: 'transparent',
      border: 'none',
      color: 'var(--color-muted)',
      fontFamily: "'JetBrains Mono', 'Courier New', monospace",
      fontSize: '11px',
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      cursor: 'pointer',
    }}
  >
    CANCELAR
  </button>
)}
```

---

## Itens OK (não precisam ser revisados novamente)

- Validações em cascata do endpoint PATCH na ordem correta: 401 → UUID validation → 404 → 403 → deadline → scores
- TypeScript compila sem erros; `next build` passa limpo
- `isEditMode = initialPrediction != null && onCancelEdit != null` — discriminador correto
- `currentPrediction` como estado local no `GameCard` — atualização imediata sem reload
- Três ramos exclusivos no `GameCard` (isEditing+prediction / prediction+!isEditing / !prediction+!isEditing)
- Jogos `live`/`finished` no `GameCard` não passam `matchDate`/`onEditRequest` — botão EDITAR nunca aparece no frontend
- RLS migration `predictions_update_own` correta: `USING` + `WITH CHECK` ambos com `auth.uid() = user_id`
- Design: fonte JetBrains Mono, cores da paleta DESIGN.md, botão ghost com `border: color-primary`, botão SALVAR com `bg: color-primary`
- Commits em português com prefixos corretos, branch `feature/predictions-edit`
- `onSuccess(updated)` notifica o `GameCard` após edição bem-sucedida
- Erros específicos mapeados no frontend: `deadline_expired` e `forbidden` com mensagens PT-BR
- Label "SALVAR ALTERAÇÃO" em modo edição vs "CONFIRMAR PALPITE" em modo criação
- Título "EDITAR PALPITE" em modo edição vs "SEU PALPITE" em modo criação
