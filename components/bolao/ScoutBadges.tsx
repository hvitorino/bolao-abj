interface ScoutBadgesProps {
  scouts: string[]
}

export const SCOUT_META: Record<string, { emoji: string; label: string }> = {
  mae_dina:           { emoji: '🔮', label: 'Mãe Diná — mais placares exatos' },
  manja_muito:        { emoji: '🧠', label: 'Manja Muito — mais vencedores acertados' },
  cego_em_tiroteio:   { emoji: '🙈', label: 'Cego em Tiroteio — mais vencedores errados' },
  sumido:             { emoji: '👻', label: 'Sumido — fez o menor número de palpites' },
  onde_esta_wally:    { emoji: '🔭', label: 'Onde está Wally? — nunca palpitou neste grupo' },
}

export function ScoutBadges({ scouts }: ScoutBadgesProps) {
  if (!scouts || scouts.length === 0) return null

  return (
    <span
      style={{
        display: 'inline-flex',
        gap: '0.25rem',
        flexShrink: 0,
        marginLeft: '0.35rem',
        fontSize: '14px',
        lineHeight: 1,
        verticalAlign: 'middle',
      }}
    >
      {scouts.map((scout) => {
        const meta = SCOUT_META[scout]
        if (!meta) return null
        return (
          <span
            key={scout}
            title={meta.label}
            style={{ cursor: 'default', userSelect: 'none' }}
          >
            {meta.emoji}
          </span>
        )
      })}
    </span>
  )
}
