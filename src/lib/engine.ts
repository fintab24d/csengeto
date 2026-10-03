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
