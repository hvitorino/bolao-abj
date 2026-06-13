'use client'

import { ButtonHTMLAttributes, forwardRef } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger'
  fullWidth?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', fullWidth = false, children, disabled, style, ...props }, ref) => {
    const baseStyle: React.CSSProperties = {
      fontFamily: "'JetBrains Mono', 'Courier New', monospace",
      fontSize: '14px',
      fontWeight: 'bold',
      textTransform: 'uppercase',
      letterSpacing: '0.1em',
      padding: '0.625rem 1.5rem',
      border: '1px solid',
      cursor: disabled ? 'not-allowed' : 'pointer',
      width: fullWidth ? '100%' : 'auto',
      boxShadow: 'none',
      transition: 'opacity 0.15s',
      opacity: disabled ? 0.6 : 1,
    }

    const variantStyles: Record<string, React.CSSProperties> = {
      primary: {
        backgroundColor: 'var(--color-primary)',
        color: 'var(--color-bg)',
        borderColor: 'var(--color-primary)',
      },
      secondary: {
        backgroundColor: 'transparent',
        color: 'var(--color-primary)',
        borderColor: 'var(--color-primary)',
      },
      danger: {
        backgroundColor: 'var(--color-error)',
        color: 'var(--color-bg)',
        borderColor: 'var(--color-error)',
      },
    }

    return (
      <button
        ref={ref}
        disabled={disabled}
        style={{ ...baseStyle, ...variantStyles[variant], ...style }}
        {...props}
      >
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'
