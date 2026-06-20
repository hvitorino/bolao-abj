import type { Metadata } from 'next'
import CadastroClient from './client'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Cadastro — Bolão da Copa',
}

export default function CadastroPage() {
  return <CadastroClient />
}
