const WEEKEND_DAYS = [0, 6]

const HOLIDAYS_2026: Record<string, string[]> = {
  '2026': [
    '2026-01-01', '2026-01-02', '2026-01-03',
    '2026-02-15', '2026-02-16', '2026-02-17', '2026-02-18', '2026-02-19', '2026-02-20', '2026-02-21', '2026-02-22', '2026-02-23',
    '2026-04-04', '2026-04-05', '2026-04-06',
    '2026-05-01', '2026-05-02', '2026-05-03', '2026-05-04', '2026-05-05',
    '2026-06-19', '2026-06-20', '2026-06-21',
    '2026-09-25', '2026-09-26', '2026-09-27',
    '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07'
  ]
}

const WORKDAYS_OVERRIDE: Record<string, string[]> = {
  '2026': [
    '2026-01-04',
    '2026-02-14', '2026-02-28',
    '2026-05-09',
    '2026-09-20',
    '2026-10-10'
  ]
}

function fmt(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function isInList(dateStr: string, list: string[]): boolean {
  return list.includes(dateStr)
}

export function isHoliday(date: Date): boolean {
  const dateStr = fmt(date)
  const year = date.getFullYear().toString()
  const holidays = HOLIDAYS_2026[year] || []
  return isInList(dateStr, holidays)
}

export function isWorkdayOverride(date: Date): boolean {
  const dateStr = fmt(date)
  const year = date.getFullYear().toString()
  const overrides = WORKDAYS_OVERRIDE[year] || []
  return isInList(dateStr, overrides)
}

export function isWeekend(date: Date): boolean {
  return WEEKEND_DAYS.includes(date.getDay())
}

export function isNonWorkday(date: Date, includeHolidays = false): boolean {
  if (includeHolidays) return false
  if (isWorkdayOverride(date)) return false
  if (isHoliday(date)) return true
  return isWeekend(date)
}

export function addWorkingDays(startDate: string, days: number, includeHolidays = false): string {
  const d = new Date(startDate + 'T00:00:00')
  let remaining = days
  while (remaining > 0) {
    d.setDate(d.getDate() + 1)
    if (!isNonWorkday(d, includeHolidays)) {
      remaining--
    }
  }
  return fmt(d)
}

export function calcWorkingDays(startDate: string, endDate: string, includeHolidays = false): number {
  const start = new Date(startDate + 'T00:00:00')
  const end = new Date(endDate + 'T00:00:00')
  let count = 0
  const d = new Date(start)
  while (d <= end) {
    if (!isNonWorkday(d, includeHolidays)) count++
    d.setDate(d.getDate() + 1)
  }
  return count
}
