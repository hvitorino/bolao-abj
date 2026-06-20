import type { Metadata } from 'next'
import EsqueciSenhaClient from './client'

export const metadata: Metadata = {
  title: 'Recuperar Senha — Bolão da Copa',
}

export default function EsqueciSenhaPage() {
  return <EsqueciSenhaClient />
}
