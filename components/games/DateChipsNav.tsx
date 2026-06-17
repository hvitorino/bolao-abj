'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

interface DateChipsNavProps {
  currentDate: string      // YYYY-MM-DD — data ativa atualmente exibida
  availableDates: string[] // YYYY-MM-DD[] ordenado ASC — datas com pelo menos 1 jogo
  gameCount: number        // total de jogos no dia atual (exibido abaixo da faixa)
  guessCount: number       // palpites do usuário no dia atual (exibido abaixo da faixa)
}

// Formata data para exibição abreviada no chip
// Ex: "2026-06-11" → "11 JUN", "2026-07-19" → "19 JUL"
function formatChipDate(dateStr: string): string {
  const date = new Date(`${dateStr}T12:00:00Z`)
  const day = date.toLocaleDateString('pt-BR', { timeZone: 'UTC', day: '2-digit' })
  const month = date.toLocaleDateString('pt-BR', { timeZone: 'UTC', month: 'short' })
  return `${day} ${month.replace('.', '').toUpperCase()}`
}

export default function DateChipsNav({
  currentDate,
  availableDates,
  gameCount,
  guessCount,
}: DateChipsNavProps) {
  const router = useRouter()
  const activeChipRef = useRef<HTMLButtonElement>(null)

  // Centralizar o chip ativo na faixa ao carregar ou ao mudar a data
  useEffect(() => {
    activeChipRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'center',
    })
  }, [currentDate])

  return (
    <div
      style={{
        border: '1px solid var(--color-border)',
        backgroundColor: 'var(--color-surface)',
        fontFamily: "'JetBrains Mono', 'Courier New', monospace",
        padding: '0.75rem 1rem 0.5rem 1rem',
      }}
    >
      {availableDates.length === 0 ? (
        <div
          style={{
            color: 'var(--color-muted)',
            fontSize: '11px',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            textAlign: 'center',
            padding: '0.5rem 0',
          }}
        >
          SEM DATAS DISPONÍVEIS
        </div>
      ) : (
        <>
          {/* Faixa de chips com scroll horizontal sem barra de scroll */}
          <div
            style={{
              overflowX: 'auto',
              WebkitOverflowScrolling: 'touch',
              scrollbarWidth: 'none',
              display: 'flex',
              gap: '0.375rem',
              paddingBottom: '2px', // evita corte da borda inferior dos chips
            }}
            // Ocultar scrollbar no webkit via className (adicionado abaixo via style global em globals.css)
            className="date-chips-scroll"
          >
            {availableDates.map((date) => {
              const isActive = date === currentDate
              return (
                <button
                  key={date}
                  ref={isActive ? activeChipRef : null}
                  type="button"
                  aria-current={isActive ? 'true' : undefined}
                  onClick={() => {
                    if (!isActive) {
                      router.push(`/jogos?date=${date}`)
                    }
                  }}
                  style={{
                    flexShrink: 0,
                    padding: '0.35rem 0.75rem',
                    fontSize: '12px',
                    fontFamily: "'JetBrains Mono', 'Courier New', monospace",
                    fontWeight: isActive ? 'bold' : 'normal',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: isActive ? 'var(--color-accent)' : 'var(--color-muted)',
                    backgroundColor: 'var(--color-surface)',
                    border: isActive
                      ? '1px solid var(--color-accent)'
                      : '1px solid var(--color-border)',
                    borderRadius: 0,
                    cursor: isActive ? 'default' : 'pointer',
                    transition: 'color 0.1s, border-color 0.1s',
                    whiteSpace: 'nowrap',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      const btn = e.currentTarget
                      btn.style.color = 'var(--color-text)'
                      btn.style.borderColor = 'var(--color-muted)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      const btn = e.currentTarget
                      btn.style.color = 'var(--color-muted)'
                      btn.style.borderColor = 'var(--color-border)'
                    }
                  }}
                >
                  {formatChipDate(date)}
                </button>
              )
            })}
          </div>

          {/* Linha de contadores */}
          <div
            style={{
              paddingTop: '0.5rem',
              display: 'flex',
              justifyContent: 'center',
              gap: '0.5rem',
              alignItems: 'center',
            }}
          >
            <span
              style={{
                color: 'var(--color-muted)',
                fontSize: '11px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              {gameCount} {gameCount === 1 ? 'JOGO' : 'JOGOS'}
            </span>

            <span style={{ color: 'var(--color-muted)', fontSize: '11px' }}>·</span>

            <span
              style={{
                color: guessCount > 0 ? 'var(--color-primary)' : 'var(--color-muted)',
                fontSize: '11px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              {guessCount} {guessCount === 1 ? 'PALPITE' : 'PALPITES'} REGISTRADO{guessCount !== 1 ? 'S' : ''}
            </span>
          </div>
        </>
      )}
    </div>
  )
}
