import type { Metadata } from 'next'
import NovaSenhaClient from './client'

export const metadata: Metadata = {
  title: 'Nova Senha — Bolão da Copa',
}

export default function NovaSenhaPage() {
  return <NovaSenhaClient />
}
