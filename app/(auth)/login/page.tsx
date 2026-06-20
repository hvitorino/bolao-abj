import type { Metadata } from 'next'
import LoginClient from './client'

export const metadata: Metadata = {
  title: 'Login — Bolão da Copa',
}

export default function LoginPage() {
  return <LoginClient />
}
