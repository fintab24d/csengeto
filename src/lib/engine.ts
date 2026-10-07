// Tiszta időlogika: nincs benne UI, nincs benne hálózat. Minden számítás a megadott időzónában történik.
export interface Lesson { id: string; label: string; start_time: string; end_time: string; position: number }
export interface Schedule { id: string; name: string; weekdays: number[]; is_default: boolean; lessons: Lesson[] }
export type Phase = 'closed' | 'before' | 'lesson' | 'break' | 'after'
export interface BellState {
  phase: Phase; current?: Lesson; next?: Lesson
  remaining: number   // másodperc a következő csengetésig
  progress: number    // 0..1 az aktuális óra/szünet előrehaladása
  soon: boolean       // 60 mp-en belül csengetés
  reason?: string
}

export const toSec = (t: string) => { const [h, m, s] = t.split(':').map(Number); return h * 3600 + m * 60 + (s || 0) }

/** A pillanat dátuma, napszaka és hétköznapja az adott időzónában (a nyári/téli időszámítást az Intl kezeli). */
export function zoned(now: Date, tz: string) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: tz, hourCycle: 'h23', weekday: 'short', year: 'numeric', month: '2-digit',
    day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(now).map(x => [x.type, x.value]))
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    secs: +p.hour * 3600 + +p.minute * 60 + +p.second,
    weekday: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(p.weekday) + 1,
  }
}

/** Az adott napra érvényes rend: napra szabott, különben az alapértelmezett (csak hétköznap). */
export function pickSchedule(list: Schedule[], weekday: number) {
  return list.find(s => s.weekdays.includes(weekday)) ?? (weekday <= 5 ? list.find(s => s.is_default) : undefined)
}

export function computeState(secs: number, lessons: Lesson[], closedReason?: string, noSchool = false): BellState {
  const L = [...lessons].sort((a, b) => a.position - b.position)
  if (closedReason || noSchool || !L.length)
    return { phase: 'closed', remaining: 0, progress: 0, soon: false, reason: closedReason ?? 'Ma nincs tanítás.' }
  const mk = (phase: Phase, from: number, to: number, o: Partial<BellState>): BellState => ({
    phase, remaining: to - secs, progress: Math.min(1, Math.max(0, (secs - from) / (to - from))),
    soon: to - secs <= 60, ...o })
  if (secs < toSec(L[0].start_time)) return mk('before', 0, toSec(L[0].start_time), { next: L[0] })
  for (let i = 0; i < L.length; i++) {
    const s = toSec(L[i].start_time), e = toSec(L[i].end_time)
    if (secs >= s && secs < e) return mk('lesson', s, e, { current: L[i], next: L[i + 1] })
    const n = L[i + 1]
    if (n && secs >= e && secs < toSec(n.start_time)) return mk('break', e, toSec(n.start_time), { next: n })
  }
  return { phase: 'after', remaining: 0, progress: 1, soon: false }
}

export const fmtHM = (t: string) => t.slice(0, 5)
export const fmtCount = (s: number) => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60
  const p = (n: number) => String(n).padStart(2, '0')
  return h ? `${h}:${p(m)}:${p(x)}` : `${p(m)}:${p(x)}`
}

// ---- Következő tanítási nap (hétvégén, ünnepnapon, tanítás után) ----
const dayNum = (d: string) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / 86400000
export const addDays = (d: string, n: number) => new Date((dayNum(d) + n) * 86400000).toISOString().slice(0, 10)

/** A következő nap (legfeljebb 60 napon belül), amelyen van csengetési rend és nincs zárva az iskola. */
export function nextSchoolDay(today: string, schedules: Schedule[], closed: { day: string }[], overrides: Record<string, string> = {}) {
  for (let i = 1; i <= 60; i++) {
    const date = addDays(today, i)
    const weekday = ((new Date(dayNum(date) * 86400000).getUTCDay() + 6) % 7) + 1
    const schedule = scheduleFor(date, schedules, overrides)
    if (schedule && schedule.lessons.length > 0 && !closed.some(c => c.day === date)) return { date, weekday, schedule }
  }
}

/** Az adott helyi dátum+napszak valódi időpillanata (ms). Az óraátállást is helyesen kezeli. */
export function instantOf(date: string, secs: number, tz: string) {
  let t = dayNum(date) * 86400000 + secs * 1000
  for (let i = 0; i < 2; i++) { const z = zoned(new Date(t), tz); t += ((dayNum(date) - dayNum(z.date)) * 86400 + secs - z.secs) * 1000 }
  return t
}

export const weekdayOf = (d: string) => ((new Date(dayNum(d) * 86400000).getUTCDay() + 6) % 7) + 1
/** Tanítási napok száma [from, to] között (mindkét végpont beleszámít). */
export function schoolDaysBetween(from: string, to: string, schedules: Schedule[], closed: { day: string }[], overrides: Record<string, string> = {}) {
  let n = 0
  for (let d = from, i = 0; d <= to && i < 800; d = addDays(d, 1), i++) {
    const sch = scheduleFor(d, schedules, overrides)
    if (sch && sch.lessons.length > 0 && !closed.some(c => c.day === d)) n++
  }
  return n
}

/** Az adott dátum rendje: ha az adminban konkrét napra rendeltek rendet, az az erősebb; különben a hét napja szerinti. */
export function scheduleFor(date: string, schedules: Schedule[], overrides: Record<string, string> = {}) {
  const id = overrides[date]
  return (id ? schedules.find(s => s.id === id) : undefined) ?? pickSchedule(schedules, weekdayOf(date))
}
