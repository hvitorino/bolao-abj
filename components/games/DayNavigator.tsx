'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'

interface DayNavigatorProps {
  currentDate: string      // YYYY-MM-DD
  gameCount: number        // total de jogos no dia atual
  guessCount: number       // palpites do usuário no dia atual
  availableDates: string[] // datas YYYY-MM-DD com pelo menos 1 jogo, ordenadas ASC
}

// Formata data para exibição em português
// Ex: "2026-06-13" → "SÁBADO, 13 JUN 2026"
function formatDateDisplay(dateStr: string): string {
  // Usar Date com T12:00:00Z para evitar problema de timezone ao criar a data
  const date = new Date(`${dateStr}T12:00:00Z`)
  const formatted = date.toLocaleDateString('pt-BR', {
    timeZone: 'UTC',
    weekday: 'long',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
  // Capitalizar e remover pontos de abreviação (global replace para todos os "DE" e pontos)
  return formatted.toUpperCase().replace(/\./g, '').replace(/ DE /g, ' ')
}

// Soma ou subtrai dias de uma data YYYY-MM-DD
function offsetDate(dateStr: string, days: number): string {
  const date = new Date(`${dateStr}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

// Verifica se a data é hoje (em BRT)
function isToday(dateStr: string): boolean {
  const today = new Date()
    .toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    .split('/')
    .reverse()
    .map((part, index) => (index === 0 ? part : part.padStart(2, '0')))
    .join('-')
  return dateStr === today
}

export default function DayNavigator({
  currentDate,
  gameCount,
  guessCount,
  availableDates,
}: DayNavigatorProps) {
  const router = useRouter()
  const today = isToday(currentDate)

  const prevDate = offsetDate(currentDate, -1)
  const nextDate = offsetDate(currentDate, 1)

  // Estado do date picker
  const [isPickerOpen, setIsPickerOpen] = useState(false)
  const [focusedIndex, setFocusedIndex] = useState<number>(-1)
  const pickerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  function navigate(date: string) {
    router.push(`/jogos?date=${date}`)
  }

  // Fechar ao clicar fora
  useEffect(() => {
    if (!isPickerOpen) return
    function handleClickOutside(e: MouseEvent) {
      if (
        pickerRef.current &&
        !pickerRef.current.contains(e.target as Node)
      ) {
        setIsPickerOpen(false)
        setFocusedIndex(-1)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isPickerOpen])

  // Scroll automático do item focado
  useEffect(() => {
    if (focusedIndex < 0 || !listRef.current) return
    const item = listRef.current.children[focusedIndex] as HTMLElement
    item?.scrollIntoView({ block: 'nearest' })
  }, [focusedIndex])

  function openPicker() {
    const currentIdx = availableDates.indexOf(currentDate)
    setFocusedIndex(currentIdx >= 0 ? currentIdx : 0)
    setIsPickerOpen(true)
    // Mover foco para a lista após o próximo render
    setTimeout(() => listRef.current?.focus(), 0)
  }

  function closePicker(returnFocus = false) {
    setIsPickerOpen(false)
    setFocusedIndex(-1)
    if (returnFocus) triggerRef.current?.focus()
  }

  function handleTriggerKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      if (!isPickerOpen) {
        openPicker()
      } else {
        closePicker()
      }
    } else if (e.key === 'ArrowDown' && isPickerOpen) {
      e.preventDefault()
      setFocusedIndex((prev) =>
        prev < availableDates.length - 1 ? prev + 1 : 0
      )
    } else if (e.key === 'ArrowUp' && isPickerOpen) {
      e.preventDefault()
      setFocusedIndex((prev) =>
        prev > 0 ? prev - 1 : availableDates.length - 1
      )
    } else if (e.key === 'Escape' && isPickerOpen) {
      e.preventDefault()
      closePicker(true)
    } else if (e.key === 'Tab' && isPickerOpen) {
      closePicker()
    }
  }

  function handleListKeyDown(e: React.KeyboardEvent<HTMLUListElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setFocusedIndex((prev) =>
        prev < availableDates.length - 1 ? prev + 1 : 0
      )
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setFocusedIndex((prev) =>
        prev > 0 ? prev - 1 : availableDates.length - 1
      )
    } else if (e.key === 'Enter' && focusedIndex >= 0) {
      e.preventDefault()
      navigate(availableDates[focusedIndex])
      closePicker(true)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      closePicker(true)
    } else if (e.key === 'Tab') {
      closePicker()
    }
  }

  return (
    <div
      ref={pickerRef}
      style={{
        border: '1px solid var(--color-border)',
        backgroundColor: 'var(--color-surface)',
        fontFamily: "'JetBrains Mono', 'Courier New', monospace",
        overflow: 'visible',
        position: 'relative',
      }}
    >
      {/* Linha de navegação com setas e data */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.75rem 1rem',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <Button
          variant="secondary"
          onClick={() => navigate(prevDate)}
          aria-label="Dia anterior"
          style={{ padding: '0.25rem 0.75rem', fontSize: '16px' }}
        >
          ◀
        </Button>

        <div style={{ textAlign: 'center', flex: 1, minWidth: 0, padding: '0 0.5rem' }}>
          <button
            ref={triggerRef}
            type="button"
            aria-haspopup="listbox"
            aria-expanded={isPickerOpen}
            aria-label="Selecionar data"
            onClick={() => {
              if (isPickerOpen) {
                closePicker()
              } else {
                openPicker()
              }
            }}
            onKeyDown={handleTriggerKeyDown}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0',
              color: today ? 'var(--color-accent)' : 'var(--color-text)',
              fontSize: 'clamp(11px, 3vw, 14px)',
              fontWeight: 'bold',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              fontFamily: "'JetBrains Mono', 'Courier New', monospace",
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: '100%',
            }}
          >
            <span
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {formatDateDisplay(currentDate)}
            </span>
            <span
              style={{
                color: 'var(--color-muted)',
                fontSize: '10px',
                marginLeft: '0.4rem',
                flexShrink: 0,
              }}
            >
              {isPickerOpen ? '▲' : '▼'}
            </span>
          </button>
        </div>

        <Button
          variant="secondary"
          onClick={() => navigate(nextDate)}
          aria-label="Próximo dia"
          style={{ padding: '0.25rem 0.75rem', fontSize: '16px' }}
        >
          ▶
        </Button>
      </div>

      {/* Linha de contadores */}
      <div
        style={{
          padding: '0.5rem 1rem',
          display: 'flex',
          justifyContent: 'center',
          gap: '1.5rem',
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

      {/* Dropdown do date picker */}
      {isPickerOpen && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 100,
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderTop: 'none',
            maxHeight: '240px',
            overflowY: 'auto',
            fontFamily: "'JetBrains Mono', 'Courier New', monospace",
            boxShadow: 'none',
            borderRadius: 0,
          }}
        >
          {availableDates.length === 0 ? (
            <div
              style={{
                padding: '0.75rem 1rem',
                color: 'var(--color-muted)',
                fontSize: '12px',
                textTransform: 'uppercase',
                textAlign: 'center',
              }}
            >
              SEM DATAS DISPONÍVEIS
            </div>
          ) : (
            <ul
              ref={listRef}
              role="listbox"
              aria-label="Datas com jogos"
              aria-activedescendant={
                focusedIndex >= 0 ? `date-option-${focusedIndex}` : undefined
              }
              tabIndex={-1}
              onKeyDown={handleListKeyDown}
              style={{ listStyle: 'none', margin: 0, padding: 0, outline: 'none' }}
            >
              {availableDates.map((date, index) => {
                const isCurrentDate = date === currentDate
                const isFocused = index === focusedIndex

                return (
                  <li
                    key={date}
                    id={`date-option-${index}`}
                    role="option"
                    aria-selected={isCurrentDate}
                    onClick={() => {
                      navigate(date)
                      closePicker(true)
                    }}
                    style={{
                      fontSize: '12px',
                      padding: '0.4rem 1rem',
                      cursor: 'pointer',
                      color: isCurrentDate
                        ? 'var(--color-accent)'
                        : 'var(--color-text)',
                      fontWeight: isCurrentDate ? 'bold' : 'normal',
                      backgroundColor: isFocused
                        ? 'var(--color-secondary)'
                        : 'transparent',
                      borderBottom:
                        index < availableDates.length - 1
                          ? '1px solid var(--color-border)'
                          : 'none',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}
                  >
                    {formatDateDisplay(date)}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
