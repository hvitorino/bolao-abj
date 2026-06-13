# Bolão do Cartola ABJ

Bolão da Copa do Mundo FIFA 2026 para um pequeno grupo de amigos.

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend | Next.js 15 (App Router) + Tailwind CSS 4 + React 19 |
| Backend | Ruby 3.x / Sinatra — Vercel Serverless Functions (`@vercel/ruby`) |
| Banco de Dados | Supabase (PostgreSQL + Realtime + Auth) |
| Deploy | Vercel (monorepo) |

**Rationale:** Supabase oferece PostgreSQL gerenciado, autenticação e canais de Realtime nativos — ideal para ranking e placares ao vivo sem infraestrutura adicional. O `@vercel/ruby` permite rodar Sinatra como functions serverless no Vercel.

## Regras de Pontuação

Os bônus são cumulativos com o acerto do vencedor.

| Evento | Pontos |
|--------|--------|
| Acerto do vencedor | +3 |
| Placar exato | +5 |
| Somente placar do vencedor | +3 |
| Diferença de gols correta (acertou vencedor) | +2 |
| Somente placar do perdedor | +1 |
| Goleada — vencedor fez 3+ gols e usuário acertou o vencedor | +1 |

**Exemplo:** Brasil 3×1 Argentina; palpite Brasil 3×1 Argentina → +3 (vencedor) + 5 (placar exato) = **8 pts**

**Empate:** Acerto de empate conta como "acerto do vencedor" (+3). Placar exato no empate também aplica +5.

## Funcionalidades

| Slug | Descrição |
|------|-----------|
| `auth` | Cadastro de usuário e login |
| `game-navigation` | Visualizar e navegar pelos jogos dia a dia |
| `predictions` | Informar palpite jogo a jogo (deadline: 5 min antes do início) |
| `live-scores` | Acompanhar placares em tempo real |
| `scoring` | Pontuação por participante e por jogo em tempo real |
| `ranking` | Ranking do bolão em tempo real |

## Modelo de Dados (Alto Nível)

```sql
-- Usuários (gerenciado pelo Supabase Auth + tabela de perfil)
profiles (id uuid PK FK auth.users, name text, avatar_url text, created_at timestamptz)

-- Jogos da Copa 2026
games (
  id uuid PK,
  home_team text,         -- ex: "Brasil"
  away_team text,         -- ex: "Argentina"
  home_team_code char(3), -- ex: "BRA"
  away_team_code char(3), -- ex: "ARG"
  match_date timestamptz,
  home_score int,         -- null até o jogo começar
  away_score int,
  status text,            -- 'pending' | 'live' | 'finished'
  round text,             -- 'Grupo A' | 'Oitavas' | 'Quartas' | 'Semi' | 'Final'
  venue text,
  created_at timestamptz
)

-- Palpites dos participantes
predictions (
  id uuid PK,
  user_id uuid FK profiles,
  game_id uuid FK games,
  home_score int NOT NULL,
  away_score int NOT NULL,
  submitted_at timestamptz,
  UNIQUE(user_id, game_id)
)

-- Pontuação calculada por palpite
scores (
  id uuid PK,
  user_id uuid FK profiles,
  game_id uuid FK games,
  prediction_id uuid FK predictions,
  points int NOT NULL DEFAULT 0,
  breakdown jsonb, -- {"winner":3,"exact":5,"winner_score":0,"diff":0,"loser_score":0,"goleada":0}
  calculated_at timestamptz
)
```

**Real-time:** O Supabase Realtime transmite mudanças em `games` e `scores` para todos os clientes conectados.

## Pipeline de Desenvolvimento

### Agentes

| Agente | Arquivo | Responsabilidade |
|--------|---------|-----------------|
| Gerente de Produto | `.claude/agents/gerente-de-produto.md` | Prioriza features, orquestra o pipeline |
| Analista de Sistema | `.claude/agents/analista-de-sistema.md` | Escreve specs técnicas detalhadas |
| Programador | `.claude/agents/programador.md` | Implementa as specs |
| Revisor | `.claude/agents/revisor.md` | Revisa código e aprova ou solicita correções |
| Explorador | `.claude/agents/explorador.md` | Pesquisa novas funcionalidades |

### Convenção de Arquivos em `.pipeline/`

```
product-roadmap.md              # Roadmap priorizado — criado pelo PM
<feature>-spec.md               # Spec técnica — criada pelo Analista
<feature>-plan.md               # Plano de execução — criado pelo Programador
<feature>-changelog.md          # O que foi implementado — criado pelo Programador
<feature>-fix-N.md              # Correções (N=1,2,...) — criado pelo Revisor
<feature>-research.md           # Nova feature pesquisada — criado pelo Explorador
product-final-report.md         # Relatório final — criado pelo PM ao concluir tudo
```

## Estrutura de Diretórios

```
bolao-abj/
├── app/                        # Next.js App Router
│   ├── (auth)/                 # Rotas públicas: login, cadastro
│   │   ├── login/
│   │   └── cadastro/
│   ├── (dashboard)/            # Rotas protegidas
│   │   ├── jogos/              # Navegação por dia
│   │   ├── ranking/
│   │   └── meus-palpites/
│   ├── globals.css
│   └── layout.tsx
├── api/                        # Ruby/Sinatra — Vercel Functions
│   └── *.rb
├── components/                 # Componentes React reutilizáveis
│   ├── ui/                     # Primitivos (Button, Input, etc.)
│   └── bolao/                  # Componentes de domínio
├── lib/                        # Utilitários
│   ├── supabase/               # Supabase client (browser + server)
│   └── scoring.ts              # Lógica de pontuação (espelhada do Ruby)
├── public/
├── .pipeline/                  # Arquivos gerados pelo pipeline de agentes
├── .claude/agents/             # Definições dos agentes
├── CLAUDE.md
├── DESIGN.md
├── CHANGELOG.md
├── vercel.json
└── package.json
```

## Convenções de Código

- **Idioma da interface**: Português brasileiro
- **Variáveis/funções**: inglês (snake_case em Ruby, camelCase em TS)
- **Commits**: português — ex: `feat(auth): adiciona cadastro de usuário`
- **Branches**: `feature/<slug>` — ex: `feature/auth`
- **Merge**: somente após aprovação do Revisor, via `git merge feature/<slug>` na main
- **Design**: seguir DESIGN.md rigorosamente em todos os componentes frontend

## Copa do Mundo FIFA 2026

- Sede: Estados Unidos, Canadá e México
- Formato: 48 seleções, 12 grupos de 4 times (fase de grupos) + mata-mata
- Início: 11 de junho de 2026
- Final: 19 de julho de 2026
- Os dados dos jogos devem ser seedados no Supabase a partir de dados oficiais apenas quando houver fonte verificável no repositório; sem isso, usar dataset placeholder explicitamente marcado como fictício
