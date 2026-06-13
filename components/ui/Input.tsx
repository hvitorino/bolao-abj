'use client'

import { InputHTMLAttributes, forwardRef } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hasError?: boolean
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hasError, id, style, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')
    const showError = hasError || Boolean(error)

    const inputStyle: React.CSSProperties = {
      fontFamily: "'JetBrains Mono', 'Courier New', monospace",
      fontSize: '14px',
      backgroundColor: 'var(--color-surface)',
      color: 'var(--color-text)',
      border: `1px solid ${showError ? 'var(--color-error)' : 'var(--color-border)'}`,
      padding: '0.5rem 0.75rem',
      width: '100%',
      outline: 'none',
      boxShadow: 'none',
      ...style,
    }

    const labelStyle: React.CSSProperties = {
      fontFamily: "'JetBrains Mono', 'Courier New', monospace",
      fontSize: '12px',
      textTransform: 'uppercase',
      letterSpacing: '0.1em',
      color: 'var(--color-muted)',
      display: 'block',
      marginBottom: '0.25rem',
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        {label && (
          <label htmlFor={inputId} style={labelStyle}>
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          style={inputStyle}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = showError
              ? 'var(--color-error)'
              : 'var(--color-primary)'
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = showError
              ? 'var(--color-error)'
              : 'var(--color-border)'
          }}
          {...props}
        />
        {error && (
          <span
            style={{
              fontSize: '12px',
              color: 'var(--color-error)',
              fontFamily: "'JetBrains Mono', 'Courier New', monospace",
            }}
          >
            ✗ {error}
          </span>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'
