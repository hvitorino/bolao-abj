const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

/**
 * Agrupa match_date pelo calendário US Eastern (America/New_York, UTC-4 no verão).
 *
 * A ESPN categoriza jogos pelo dia em horário Eastern, que é o fuso de referência
 * da Copa 2026. Jogos tarde da noite no Pacífico (ex: 20h PDT = 23h EDT)
 * ficam no mesmo dia do calendário ESPN, o que BRT (UTC-3) ou UTC não capturam
 * corretamente quando o horário UTC cai após meia-noite.
 *
 * Exemplos (Copa 2026):
 *   '2026-06-20T03:00:00Z' (TUR×PAR, 23h EDT 19/06) → '2026-06-19'
 *   '2026-06-19T20:00:00Z' (USA×AUS, 16h EDT 19/06) → '2026-06-19'
 */
export function matchDateToETDate(isoUtcString: string): string {
  const [month, day, year] = new Date(isoUtcString)
    .toLocaleDateString('en-US', { timeZone: 'America/New_York' })
    .split('/')
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
}

export function matchDateToLocalDate(isoUtcString: string): string {
  return new Date(isoUtcString)
    .toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    .split('/')
    .reverse()
    .map((part, index) => (index === 0 ? part : part.padStart(2, '0')))
    .join('-')
}

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
 * Converte um dia no fuso US Eastern (America/New_York) para os instantes UTC
 * correspondentes ao início e fim desse dia.
 *
 * A Copa 2026 usa Eastern Time como fuso de referência do calendário ESPN.
 * O offset é calculado dinamicamente via Intl para lidar com DST
 * (EDT = UTC-4 de março a novembro, que cobre todo o torneio).
 *
 * @param etDayString - Data no formato YYYY-MM-DD representando um dia em ET
 * @returns { start, end } - ISO 8601 UTC correspondentes a 00:00:00 e 23:59:59 ET
 */
export function dayBoundsInUTC(etDayString: string): { start: string; end: string } {
  const [yearStr, monthStr, dayStr] = etDayString.split('-')
  const year = parseInt(yearStr, 10)
  const month = parseInt(monthStr, 10) - 1 // 0-based para Date.UTC
  const day = parseInt(dayStr, 10)

  // Amostramos o meio-dia UTC do dia em questão para determinar o offset ET
  // sem ambiguidade de transição DST (que ocorre à meia-noite local).
  const noonUTC = new Date(Date.UTC(year, month, day, 12, 0, 0))
  const etHour = parseInt(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      hour: '2-digit',
      hour12: false,
    })
      .formatToParts(noonUTC)
      .find((p) => p.type === 'hour')?.value ?? '8',
    10,
  )

  // offsetHours: quantas horas adicionar ao horário ET para obter UTC
  // Ex.: EDT (UTC-4) → meio-dia UTC aparece como 08:00 ET → offsetHours = 12 - 8 = 4
  const offsetHours = 12 - etHour

  // Meia-noite ET em UTC: dia T(offsetHours):00:00Z
  const start = new Date(Date.UTC(year, month, day, offsetHours, 0, 0))
  // 23:59:59 ET em UTC: dia+1 T(offsetHours):00:00Z - 1 segundo
  const end = new Date(Date.UTC(year, month, day + 1, offsetHours, 0, 0) - 1000)

  return { start: start.toISOString(), end: end.toISOString() }
}
