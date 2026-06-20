import type { Metadata } from 'next'
import EsqueciSenhaClient from './client'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Recuperar Senha — Bolão da Copa',
}

export default function EsqueciSenhaPage() {
  return <EsqueciSenhaClient />
}
