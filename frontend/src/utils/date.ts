/**
 * 本地日期工具。全项目的业务日期（YYYY-MM-DD 字符串）一律从这里取，
 * 禁止使用 toISOString().split('T')[0] —— 那是 UTC 日期，东八区 0-8 点会得到"昨天"。
 */

/** 本地时区的 YYYY-MM-DD */
export function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** 今天的本地日期 */
export function todayStr(): string {
  return fmtDate(new Date())
}

/** 今天加减 N 天的本地日期 */
export function addDaysStr(days: number, from: Date = new Date()): string {
  const d = new Date(from)
  d.setDate(d.getDate() + days)
  return fmtDate(d)
}

/** 给定日期所在周的周一（本地） */
export function mondayOf(d: Date = new Date()): Date {
  const date = new Date(d)
  const day = date.getDay() || 7
  date.setDate(date.getDate() - day + 1)
  return date
}

/** 本地时间戳，用于 createdAt/updatedAt 展示等场景（ISO 串，但展示时须走 formatDateTime） */
export function nowIso(): string {
  return new Date().toISOString()
}

/** ISO 时间串 -> 本地 "YYYY-MM-DD HH:mm" 展示 */
export function formatDateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${fmtDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
