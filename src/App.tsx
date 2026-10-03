import { Fragment, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { audioReady, enableAudio, ring } from './lib/sound'
import { useSchool } from './lib/useSchool'
import { computeState, fmtCount, fmtHM, pickSchedule, toSec, zoned, type BellState } from './lib/engine'

const pad = (n: number) => String(n).padStart(2, '0')
const hms = (s: number) => `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`
const TITLE: Record<BellState['phase'], string> = { closed: '', before: 'Tanítás előtt', lesson: '', break: 'Szünet', after: 'Vége a tanításnak' }

/** 4×/mp-es ellenőrzéssel újraszámolja az állapotot a beállított időzóna (Europe/Budapest) szerint. */
function useBell() {
  const { data, offline } = useSchool()
  const [now, setNow] = useState(() => new Date())
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 250); return () => clearInterval(t) }, [])
  return useMemo(() => {
    if (!data) return { data, offline }
    const z = zoned(now, data.settings.timezone)
    const schedule = pickSchedule(data.schedules, z.weekday)
    const closed = data.closed.find(c => c.day === z.date)?.reason
    const state = computeState(z.secs, schedule?.lessons ?? [], closed, !schedule)
    return { data, offline, z, schedule, state }
  }, [now, data, offline])
}

/** Gyűrű: az ív az aktuális óra/szünet előrehaladása, a közepén a visszaszámláló. */
function Ring({ s }: { s: BellState }) {
  const R = 92, C = 2 * Math.PI * R
  const live = s.phase === 'lesson' || s.phase === 'break' || s.phase === 'before'
  const title = s.phase === 'lesson' ? s.current!.label : s.phase === 'closed' ? s.reason : TITLE[s.phase]
  return <div className={`ring ${s.phase}`}>
    <svg viewBox="0 0 200 200" aria-hidden="true">
      <circle className="track" cx="100" cy="100" r={R} />
      {live && <circle className="arc" cx="100" cy="100" r={R} strokeDasharray={C} strokeDashoffset={C * (1 - s.progress)} />}
    </svg>
    <div className="inner">
      <div className="title">{title}</div>
      {live && <>
        <div key={`${s.phase}-${s.current?.id ?? s.next?.id}`} className={`count flash ${s.soon ? 'soon' : ''}`}>{fmtCount(s.remaining)}</div>
        <div className="sub">{s.soon ? 'Hamarosan csengetés' : s.phase === 'before' ? 'az első csengetésig' : 'a csengetésig'}</div>
        {s.phase !== 'before' && <div className="pct">{Math.round(s.progress * 100)}%</div>}
      </>}
    </div>
  </div>
}

function Next({ s, secs }: { s: BellState; secs: number }) {
  if (!s.next) return null
  const m = Math.ceil((toSec(s.next.start_time) - secs) / 60)
  return <div className="next"><span>Következő</span><b>{s.next.label}</b>
    <span>{fmtHM(s.next.start_time)}{m > 0 && m < 120 ? `, ${m} perc múlva` : ''}</span></div>
}

export default function App() {
  const { data, offline, z, schedule, state } = useBell() as any
  const tv = location.pathname.startsWith('/display')
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') ?? '')
  useEffect(() => { document.documentElement.dataset.theme = theme || data?.settings.theme || 'dark' }, [theme, data])
  useEffect(() => { document.documentElement.dataset.phase = state?.phase ?? '' }, [state?.phase])

  // Csengetési hang: állapotváltáskor szól, ha az admin bekapcsolta és a hang engedélyezve van.
  const [audioOn, setAudioOn] = useState(audioReady())
  const key = state ? `${state.phase}-${state.current?.id ?? state.next?.id}` : ''
  const prev = useRef('')
  useEffect(() => {
    if (prev.current && key !== prev.current && state?.phase !== 'closed' && data?.settings.sound_enabled) ring()
    prev.current = key
  }, [key])
  // TV-mód méretezése az admin beállítása szerint.
  useEffect(() => { if (tv) document.documentElement.style.fontSize = `${data?.settings.tv_scale ?? 100}%` }, [tv, data])

  if (!data) return <main><div className="hero"><div className="title">{offline ? 'Nincs kapcsolat és nincs mentett adat.' : 'Betöltés…'}</div></div></main>
  const s: BellState = state
  const L = schedule ? [...schedule.lessons].sort((a: any, b: any) => a.position - b.position) : []
  const dateText = new Intl.DateTimeFormat('hu-HU', { timeZone: 'UTC', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    .format(new Date(z.date + 'T12:00:00Z'))

  return <main className={tv ? 'tv' : ''}>
    <header>
      <span className="brand">{data.settings.logo_url && <img className="logo" src={data.settings.logo_url} alt="" onError={e => { e.currentTarget.style.display = 'none' }} />}{data.name}</span>
      <div className="tools">
        {offline && <span className="pill">Offline mód</span>}
        {data.settings.sound_enabled && !audioOn && <button onClick={async () => setAudioOn(await enableAudio())}>Hang engedélyezése</button>}
        {!tv && <button onClick={() => { const t = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; localStorage.setItem('theme', t); setTheme(t) }}>Téma</button>}
      </div>
    </header>

    <section className="hero">
      <div className="clock">{tv && !data.settings.tv_show_seconds ? hms(z.secs).slice(0, 5) : hms(z.secs)}</div>
      <div className="date">{dateText}</div>
      <Ring s={s} />
      {(!tv || data.settings.tv_show_next) && <Next s={s} secs={z.secs} />}
    </section>

    {!tv && L.length > 0 && <section className="timeline">
      <h2>{schedule.name}</h2>
      <p className="meta">{L.length} óra, {fmtHM(L[0].start_time)} – {fmtHM(L[L.length - 1].end_time)}</p>
      <ol>{L.map((l: any, i: number) => {
        const nx = L[i + 1]
        const cls = s.current?.id === l.id ? 'now' : s.next?.id === l.id ? 'upnext' : s.phase !== 'closed' && z.secs >= toSec(l.end_time) ? 'past' : ''
        const gap = nx ? Math.round((toSec(nx.start_time) - toSec(l.end_time)) / 60) : 0
        const inBreak = s.phase === 'break' && s.next?.id === nx?.id
        const p = (v: boolean) => (v ? ({ '--p': `${s.progress * 100}%` } as CSSProperties) : undefined)
        return <Fragment key={l.id}>
          <li className={`l ${cls}`} style={p(cls === 'now')}><b>{l.label}</b><span>{fmtHM(l.start_time)} – {fmtHM(l.end_time)}</span></li>
          {gap > 0 && <li className={`g ${inBreak ? 'nowb' : ''}`} style={p(inBreak)}>{gap} perc szünet</li>}
        </Fragment>
      })}</ol>
    </section>}
  </main>
}
