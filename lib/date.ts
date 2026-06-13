const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

export function isValidDateString(dateStr: string): boolean {
  if (!ISO_DATE_REGEX.test(dateStr)) return false

  const [yearStr, monthStr, dayStr] = dateStr.split('-')
  const year = Number(yearStr)
  const month = Number(monthStr)
  const day = Number(dayStr)

  const date = new Date(Date.UTC(year, month - 1, day))

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}

export function todayInBrasilia(): string {
  return new Date()
    .toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    .split('/')
    .reverse()
    .map((part, index) => (index === 0 ? part : part.padStart(2, '0')))
    .join('-')
}

/**
 * Converte um dia no fuso de Brasília (America/Sao_Paulo) para os instantes UTC
 * correspondentes ao início e fim desse dia.
 *
 * O offset UTC é calculado dinamicamente via Intl para lidar corretamente com
 * horário de verão (UTC-3 no inverno, UTC-2 no horário de verão brasiliense).
 *
 * @param brasiliaDayString - Data no formato YYYY-MM-DD representando um dia em BRT
 * @returns { start, end } - ISO 8601 UTC correspondentes a 00:00:00 e 23:59:59 BRT
 */
export function dayBoundsInUTC(brasiliaDayString: string): { start: string; end: string } {
  const [yearStr, monthStr, dayStr] = brasiliaDayString.split('-')
  const year = parseInt(yearStr, 10)
  const month = parseInt(monthStr, 10) - 1 // 0-based para Date.UTC
  const day = parseInt(dayStr, 10)

  // Amostramos o meio-dia UTC do dia em questão para determinar o offset BRT
  // sem ambiguidade de transição DST (que ocorre à meia-noite local).
  const noonUTC = new Date(Date.UTC(year, month, day, 12, 0, 0))
  const brtHour = parseInt(
    new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      hour12: false,
    })
      .formatToParts(noonUTC)
      .find((p) => p.type === 'hour')?.value ?? '9',
    10,
  )

  // offsetHours: quantas horas adicionar ao horário BRT para obter UTC
  // Ex.: BRT UTC-3 → meio-dia UTC aparece como 09:00 BRT → offsetHours = 12 - 9 = 3
  const offsetHours = 12 - brtHour

  // Meia-noite BRT em UTC: dia T(offsetHours):00:00Z
  const start = new Date(Date.UTC(year, month, day, offsetHours, 0, 0))
  // 23:59:59 BRT em UTC: dia+1 T(offsetHours):00:00Z - 1 segundo
  const end = new Date(Date.UTC(year, month, day + 1, offsetHours, 0, 0) - 1000)

  return { start: start.toISOString(), end: end.toISOString() }
}
