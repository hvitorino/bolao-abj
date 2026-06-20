import type { Metadata } from 'next'
import CadastroClient from './client'

export const metadata: Metadata = {
  title: 'Cadastro — Bolão da Copa',
}

export default function CadastroPage() {
  return <CadastroClient />
}
