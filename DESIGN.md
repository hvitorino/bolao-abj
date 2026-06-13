# DESIGN.md — Bolão do Cartola ABJ

## Conceito Visual

Interface inspirada no jogo **Elifoot** (clássico de futebol dos anos 90): densa, tabular, com placares grandes e pouco espaço em branco. A paleta de cores é extraída da **bandeira brasileira** — verde, amarelo e azul sobre fundo escuro.

O resultado é uma UI retro-funcional: parece um painel de controle de vestiário, não um app moderno. Isso é intencional.

---

## Paleta de Cores

| Token | Nome | Hex | Uso |
|-------|------|-----|-----|
| `color-primary` | Verde Brasil | `#009c3b` | Headers, borders principais, badges de status |
| `color-accent` | Amarelo Brasil | `#FFDF00` | Scores, CTAs, destaques, posição #1 no ranking |
| `color-secondary` | Azul Brasil | `#002776` | Cards, backgrounds secundários, nav ativa |
| `color-bg` | Preto fundo | `#0a0e1a` | Background base da aplicação |
| `color-surface` | Azul escuro | `#0d1b2a` | Surface de cards e painéis |
| `color-border` | Verde escuro | `#1a4a2e` | Bordas de tabelas e separadores |
| `color-text` | Branco | `#f0f4f8` | Texto primário |
| `color-muted` | Cinza esverdeado | `#5a7a6a` | Texto secundário, labels, meta |
| `color-live` | Vermelho vivo | `#ff3b30` | Indicador de jogo ao vivo (piscando) |
| `color-win` | Verde claro | `#00d26a` | Acertos, pontos positivos |
| `color-error` | Vermelho | `#ff453a` | Erros, deadline expirado |

### Uso em Tailwind

Configurar no `tailwind.config.ts` como variáveis CSS customizadas:

```css
:root {
  --color-primary: #009c3b;
  --color-accent: #FFDF00;
  --color-secondary: #002776;
  --color-bg: #0a0e1a;
  --color-surface: #0d1b2a;
  --color-border: #1a4a2e;
  --color-text: #f0f4f8;
  --color-muted: #5a7a6a;
  --color-live: #ff3b30;
  --color-win: #00d26a;
  --color-error: #ff453a;
}
```

---

## Tipografia

| Uso | Fonte | Estilo |
|-----|-------|--------|
| Corpo | `JetBrains Mono` (Google Fonts) | Regular 14px |
| Fallback | `Courier New`, monospace | — |
| Headings | `JetBrains Mono` | Bold, uppercase, letter-spacing: 0.1em |
| Placares | `JetBrains Mono` | Bold, 2xl–4xl |
| Labels | `JetBrains Mono` | Regular, uppercase, xs, muted |

**Regra:** Toda a interface usa exclusivamente fonte monospace. Nenhuma sans-serif ou serif.

---

## Componentes de Referência

### Placar de Jogo

```
┌──────────────────────────────────────────────────────┐
│  GRP A · 14 JUN 2026 · 15:00                         │
├──────────────────────────────────────────────────────┤
│         BRA          3  ×  1          ARG            │
│       BRASIL                       ARGENTINA         │
├──────────────────────────────────────────────────────┤
│  ██ AO VIVO ██   64'                                 │
└──────────────────────────────────────────────────────┘
```

- Placar: fonte grande, centralizado, `color-accent`
- Status `AO VIVO`: piscando em `color-live`
- Status `ENCERRADO`: `color-muted`, sem blink
- Status `PENDENTE`: `color-muted`, mostra horário

### Ranking

```
┌──────────────────────────────────────────────────────┐
│  RANKING — BOLÃO DO CARTOLA ABJ                      │
├─────┬───────────────────────┬────────┬───────────────┤
│  #  │ PARTICIPANTE          │ PONTOS │ APROVEIT.      │
├─────┼───────────────────────┼────────┼───────────────┤
│  1  │ ► CARTOLA_MASTER      │   47   │  73%          │
│  2  │   FUTEBOL_REI         │   39   │  61%          │
│  3  │   TORCEDOR_FIEL       │   35   │  55%          │
└─────┴───────────────────────┴────────┴───────────────┘
```

- Líder destacado em `color-accent` com seta `►`
- Usuário atual em `color-primary`
- Atualização em tempo real via Supabase Realtime

### Card de Palpite

```
┌──────────────────────────────────────────────────────┐
│  SEU PALPITE — BRA × ARG                             │
│  ─────────────────────────────────────────────────── │
│    BRA  [ 2 ]  ×  [ 1 ]  ARG                        │
│                                                      │
│  ⏱ DEADLINE: 14 JUN 14:55  (em 2h 13min)            │
│  [   CONFIRMAR PALPITE   ]                           │
└──────────────────────────────────────────────────────┘
```

- Inputs numéricos estilo LED: borda `color-accent`, bg `color-surface`
- Deadline: `color-muted` quando >30min, `color-error` quando <30min
- Após deadline: inputs desabilitados, exibe palpite registrado
- Botão CTA: bg `color-primary`, texto `color-bg`, uppercase

### Pontuação por Jogo

```
┌──────────────────────────────────────────────────────┐
│  BRA 3×1 ARG  ·  SEU PALPITE: 3×1  ·  +8 PTS       │
│  ─────────────────────────────────────────────────── │
│  ✓ Acertou o vencedor        +3                      │
│  ✓ Placar exato              +5                      │
│  ─────────────────────────────────────────────────── │
│  TOTAL                        8 pontos               │
└──────────────────────────────────────────────────────┘
```

---

## Princípios de Layout

1. **Dense first** — informação densa como no Elifoot; whitespace mínimo
2. **Tabular** — rankings, palpites e pontuações sempre em tabelas compactas
3. **Scores em destaque** — placares grandes e centralizados em `color-accent`
4. **Mobile first** — coluna única em mobile; 2 colunas em `md:`; 3 em `lg:`
5. **Dark only** — apenas tema escuro; sem modo claro
6. **Sem ícones decorativos** — usar símbolos ASCII (`►`, `✓`, `✗`, `⏱`, `██`) em vez de SVGs ornamentais
7. **Bordas simples** — `1px solid var(--color-border)` em todos os cards
8. **Sem sombras** — `box-shadow: none`; bordas e contraste de cor como separadores

---

## Comportamentos de UI

### Jogo ao vivo
- Badge `██ AO VIVO ██` pisca com `animation: blink 1s step-end infinite`
- Placar atualiza sem reload via Supabase Realtime
- Indicador visual de última atualização (timestamp muted)

### Navegação por dia
- Header com data centralizada, setas `◀ ▶` para dia anterior/próximo
- Destaque no dia atual
- Contagem de jogos por dia

### Deadline de palpite
- Quando `match_date - now() <= 5min`: inputs travados, mensagem de deadline expirado
- Quando `match_date - now() <= 30min`: cor do deadline muda para `color-error`

### Ranking em tempo real
- Posições animadas quando há mudança (transition suave)
- Usuário atual sempre visível (fixado se fora da viewport em mobile)

---

## Referência — Elifoot

O Elifoot (1990–2000s) era um jogo de gestão de futebol português com interface de texto no DOS/Windows. Características que inspiram este design:

- Background preto/azul escuro com texto brilhante
- Bordas de caixas simples (`┌─┐│└─┘`)
- Texto em maiúsculas
- Dados tabulares densos
- Placar central em destaque
- Nenhum elemento decorativo desnecessário
- Sensação de "terminal de dados"
