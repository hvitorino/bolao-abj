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
