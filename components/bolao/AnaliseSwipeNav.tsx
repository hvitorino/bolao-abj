'use client'

import { useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'

interface AnaliseSwipeNavProps {
  backUrl: string
  nextHref: string | null
  prevHref: string | null
}

export default function AnaliseSwipeNav({ backUrl, nextHref, prevHref }: AnaliseSwipeNavProps) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  useEffect(() => {
    let startX = 0
    let startY = 0

    function onTouchStart(e: TouchEvent) {
      startX = e.touches[0].clientX
      startY = e.touches[0].clientY
    }

    function onTouchEnd(e: TouchEvent) {
      const deltaX = e.changedTouches[0].clientX - startX
      const deltaY = e.changedTouches[0].clientY - startY
      if (Math.abs(deltaX) < 50 || Math.abs(deltaY) > Math.abs(deltaX)) return

      if (deltaX < 0 && nextHref) {
        startTransition(() => router.push(nextHref))
      } else if (deltaX > 0) {
        const target = prevHref ?? (window.history.length > 1 ? null : backUrl)
        if (target) {
          startTransition(() => router.push(target))
        } else {
          router.back()
        }
      }
    }

    document.body.addEventListener('touchstart', onTouchStart, { passive: true })
    document.body.addEventListener('touchend', onTouchEnd, { passive: true })
    return () => {
      document.body.removeEventListener('touchstart', onTouchStart)
      document.body.removeEventListener('touchend', onTouchEnd)
    }
  }, [backUrl, nextHref, prevHref, router])

  return null
}
