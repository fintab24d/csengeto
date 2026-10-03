import { useEffect, useMemo, useRef, useState } from 'react'
import { audioReady, enableAudio, ring } from './lib/sound'
import { useSchool } from './lib/useSchool'
import { computeState, fmtCount, fmtHM, pickSchedule, toSec, zoned, type BellState } from './lib/engine'

const pad = (n: number) => String(n).padStart(2, '0')
const hms = (s: number) => `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`
const LABEL: Record<BellState['phase'], string> = { closed: '', before: 'Tanítás előtt', lesson: '', break: 'SZÜNET', after: 'Vége a tanításnak' }

/** Másodpercenként (4×/mp-es ellenőrzéssel) újraszámolja az állapotot a Europe/Budapest idő alapján. */
function useBell() {
  const { data, offline } = useSchool()
  const [now, setNow] = useState(() => new Date())
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 250); return () => clearInterval(t) }, [])
  return useMemo(() => {
    if (!data) return { data, offline }
    const tz = data.settings.timezone
    const z = zoned(now, tz)
    const schedule = pickSchedule(data.schedules, z.weekday)
    const closed = data.closed.find(c => c.day === z.date)?.reason
    const state = computeState(z.secs, schedule?.lessons ?? [], closed, !schedule)
    return { data, offline, z, schedule, state }
  }, [now, data, offline])
}

function Status({ s }: { s: BellState }) {
  if (s.phase === 'closed') return <div className="status">{s.reason}</div>
  const title = s.phase === 'lesson' ? s.current!.label : LABEL[s.phase]
  return <>
    <div className={`status ${s.phase}`}>{title}</div>
    {s.phase !== 'after' && <>
      <div key={`${s.phase}-${s.current?.id ?? s.next?.id}`} className={`count ${s.soon ? 'soon' : ''} flash`}>{fmtCount(s.remaining)}</div>
      <div className="sub">{s.soon ? 'Hamarosan csengetés' : 'következő csengetésig'}</div>
      {s.phase !== 'before' && <div className="bar" role="progressbar" aria-valuenow={Math.round(s.progress * 100)}>
        <i style={{ width: `${s.progress * 100}%` }} /></div>}
      {s.phase !== 'before' && <div className="sub">{Math.round(s.progress * 100)}%</div>}
    </>}
  </>
}

function Next({ s }: { s: BellState }) {
  if (!s.next) return null
  return <div className="next"><span>Következő</span><b>{s.next.label}</b><span>{fmtHM(s.next.start_time)}</span></div>
}

function Shell({ tv, children }: { tv?: boolean; children: React.ReactNode }) {
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') ?? '')
  const { data, offline, z } = useBell() as any
  useEffect(() => { document.documentElement.dataset.theme = theme || data?.settings.theme || 'dark' }, [theme, data])
  return <main className={tv ? 'tv' : ''}>
    <header>
      <span>{data?.name ?? 'Csengetés'}</span>
      {offline && <span className="pill">Offline mód</span>}
      {!tv && <button onClick={() => { const t = (document.documentElement.dataset.theme === 'dark') ? 'light' : 'dark'; localStorage.setItem('theme', t); setTheme(t) }}>Téma</button>}
    </header>
    {children}
    {z && <footer>{z.date}</footer>}
  </main>
}

export default function App() {
  const bell = useBell()
  const tv = location.pathname.startsWith('/display')
  const { data, offline, z, schedule, state } = bell as any
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') ?? '')
  useEffect(() => { document.documentElement.dataset.theme = theme || data?.settings.theme || 'dark' }, [theme, data])

  // Csengetési hang: állapotváltáskor szól, ha az admin bekapcsolta és a hang engedélyezve van.
  const [audioOn, setAudioOn] = useState(audioReady())
  const key = state ? `${state.phase}-${state.current?.id ?? state.next?.id}` : ''
  const prev = useRef('')
  useEffect(() => {
    if (prev.current && key !== prev.current && state?.phase !== 'closed' && data?.settings.sound_enabled) ring()
    prev.current = key
  }, [key])

  // TV-mód méretezése az admin beállítása szerint (a rem-alapú méretek vele együtt nőnek).
  useEffect(() => { if (tv) document.documentElement.style.fontSize = `${data?.settings.tv_scale ?? 100}%` }, [tv, data])

  if (!data) return <main><div className="status">{offline ? 'Nincs kapcsolat és nincs mentett adat.' : 'Betöltés…'}</div></main>
  const s: BellState = state

  return <main className={tv ? 'tv' : ''}>
    <header>
      <span className="brand">{data.settings.logo_url && <img className="logo" src={data.settings.logo_url} alt="" onError={e => { e.currentTarget.style.display = 'none' }} />}{data.name}</span>
      {data.settings.sound_enabled && !audioOn && <button onClick={async () => setAudioOn(await enableAudio())}>Hang engedélyezése</button>}
      {offline && <span className="pill">Offline mód</span>}
      {!tv && <button onClick={() => { const t = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; localStorage.setItem('theme', t); setTheme(t) }}>Téma</button>}
    </header>
    <section className="hero">
      <div className="clock">{tv && !data.settings.tv_show_seconds ? hms(z.secs).slice(0, 5) : hms(z.secs)}</div>
      <Status s={s} />
      {(!tv || data.settings.tv_show_next) && <Next s={s} />}
    </section>
    {!tv && schedule && <section className="timeline">
      <h2>{schedule.name}</h2>
      <ol>{[...schedule.lessons].sort((a: any, b: any) => a.position - b.position).map((l: any, i: number, a: any[]) => {
        const cls = s.current?.id === l.id ? 'now' : s.next?.id === l.id && s.phase !== 'closed' ? 'upnext' : z.secs >= toSec(l.end_time) ? 'past' : ''
        const gap = a[i + 1] ? Math.round((toSec(a[i + 1].start_time) - toSec(l.end_time)) / 60) : 0
        return <li key={l.id} className={cls}><b>{l.label}</b><span>{fmtHM(l.start_time)} – {fmtHM(l.end_time)}</span>
          {gap > 0 && <em>szünet {gap} perc</em>}</li>
      })}</ol>
    </section>}
  </main>
}
export { Shell }
