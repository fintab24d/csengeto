import { useCallback, useEffect, useState, type FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, SCHOOL_SLUG } from './lib/supabase'
import { enableAudio, ring } from './lib/sound'
import { fmtHM, toSec, type Schedule } from './lib/engine'
import { KIND, type Countdown } from './lib/kinds'

interface Full {
  id: string; name: string
  settings: { timezone: string; theme: string; sound_enabled: boolean; logo_url: string | null; tv_show_seconds: boolean; tv_show_next: boolean; tv_scale: number }
  countdowns: Countdown[]; schedules: Schedule[]; closed_days: { id: string; day: string; reason: string }[]
}
type Res = PromiseLike<{ error: { message: string } | null }>
const DAYS = ['H', 'K', 'Sze', 'Cs', 'P', 'Szo', 'V']
const ZONES = ['Europe/Budapest', 'Europe/Bratislava', 'Europe/Vienna', 'Europe/Bucharest', 'Europe/Belgrade']
const p2 = (n: number) => String(n).padStart(2, '0')
const plus = (t: string, m: number) => { const s = Math.min(86340, toSec(t) + m * 60); return `${p2(Math.floor(s / 3600))}:${p2(Math.floor(s / 60) % 60)}` }

export default function Admin() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])
  if (session === undefined) return <main className="admin">Betöltés…</main>
  return session ? <Panel /> : <Login />
}

function Login() {
  const [email, setEmail] = useState(''), [pw, setPw] = useState(''), [err, setErr] = useState('')
  const go = async (e: FormEvent) => {
    e.preventDefault()
    const { error } = await supabase.auth.signInWithPassword({ email, password: pw })
    if (error) setErr('Hibás email vagy jelszó.')
  }
  return <main className="admin"><h1>Admin belépés</h1>
    <form onSubmit={go} className="row">
      <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
      <input type="password" placeholder="Jelszó" value={pw} onChange={e => setPw(e.target.value)} required />
      <button>Belépés</button>
    </form>{err && <p>{err}</p>}</main>
}

function Panel() {
  const [d, setD] = useState<Full | null>(null)
  const [admin, setAdmin] = useState(true)
  const [sel, setSel] = useState('')
  const [msg, setMsg] = useState('')
  const [cd, setCd] = useState({ day: '', reason: '' })
  const [ev, setEv] = useState({ title: '', kind: 'other', date: '', time: '00:00' })

  const load = useCallback(async () => {
    const m = await supabase.from('school_members').select('school_id')
    setAdmin(!!m.data?.length)
    const { data, error } = await supabase.from('schools')
      .select('id, name, settings(*), schedules(*, lessons(*)), closed_days(*), countdowns(*)').eq('slug', SCHOOL_SLUG).single()
    if (error || !data) return setMsg('Hiba: ' + (error?.message ?? 'nincs adat'))
    const r = data as any
    setD({ ...r, settings: Array.isArray(r.settings) ? r.settings[0] : r.settings })
  }, [])
  useEffect(() => { load() }, [load])

  if (!d) return <main className="admin">{msg || 'Betöltés…'}</main>
  if (!admin) return <main className="admin"><p>Ehhez a fiókhoz nincs admin jogosultság rendelve (lásd README 6. lépés).</p>
    <button onClick={() => supabase.auth.signOut()}>Kilépés</button></main>

  const run = async (p: Res) => { const { error } = await p; setMsg(error ? 'Hiba: ' + error.message : 'Mentve'); await load() }
  const setS = (patch: object) => run(supabase.from('settings').update(patch).eq('school_id', d.id))
  const cur = d.schedules.find(s => s.id === (sel || d.schedules[0]?.id))
  const lessons = cur ? [...cur.lessons].sort((a, b) => a.position - b.position) : []

  const addSchedule = async () => {
    const { data, error } = await supabase.from('schedules').insert({ school_id: d.id, name: 'Új csengetési rend' }).select('id').single()
    if (error) return setMsg('Hiba: ' + error.message)
    setSel(data.id); await load()
  }
  const makeDefault = async (id: string) => {
    await supabase.from('schedules').update({ is_default: false }).eq('school_id', d.id)   // max. egy alapértelmezett lehet
    run(supabase.from('schedules').update({ is_default: true }).eq('id', id))
  }
  const addLesson = () => {
    const last = lessons[lessons.length - 1]
    const start = last ? plus(last.end_time, 10) : '08:00'
    run(supabase.from('lessons').insert({ schedule_id: cur!.id, label: `${lessons.length + 1}. óra`, start_time: start, end_time: plus(start, 45), position: (last?.position ?? 0) + 1 }))
  }

  const upload = async (f: File) => {
    const path = `${d.id}/logo-${Date.now()}.${f.name.split('.').pop()}`   // mappa = iskola azonosító (RLS ezt ellenőrzi)
    const { error } = await supabase.storage.from('logos').upload(path, f, { contentType: f.type })
    if (error) return setMsg('Hiba: ' + error.message)
    await setS({ logo_url: supabase.storage.from('logos').getPublicUrl(path).data.publicUrl })
  }

  return <main className="admin">
    <header><h1>Admin – {d.name}</h1><button onClick={() => supabase.auth.signOut()}>Kilépés</button></header>
    <p className="msg" role="status">{msg}</p>

    <section><h2>Beállítások</h2>
      <div className="row">Iskola neve <input defaultValue={d.name} key={d.name} onBlur={e => e.target.value !== d.name && run(supabase.from('schools').update({ name: e.target.value }).eq('id', d.id))} /></div>
      <div className="row">Időzóna <select value={d.settings.timezone} onChange={e => setS({ timezone: e.target.value })}>{ZONES.map(z => <option key={z}>{z}</option>)}</select>
        Téma <select value={d.settings.theme} onChange={e => setS({ theme: e.target.value })}><option value="dark">Sötét</option><option value="light">Világos</option></select></div>
      <div className="row"><label><input type="checkbox" checked={d.settings.sound_enabled} onChange={e => setS({ sound_enabled: e.target.checked })} /> Csengetési hang</label>
        <button onClick={async () => { await enableAudio(); ring() }}>Hang kipróbálása</button></div>
      <div className="row">Logó {d.settings.logo_url && <img className="logo" src={d.settings.logo_url} alt="" />}
        <input type="file" accept="image/png,image/jpeg,image/webp" onChange={e => e.target.files?.[0] && upload(e.target.files[0])} />
        {d.settings.logo_url && <button onClick={() => setS({ logo_url: null })}>Logó eltávolítása</button>}</div>
      <div className="row">TV-mód:
        <label><input type="checkbox" checked={d.settings.tv_show_seconds} onChange={e => setS({ tv_show_seconds: e.target.checked })} /> másodperc az órán</label>
        <label><input type="checkbox" checked={d.settings.tv_show_next} onChange={e => setS({ tv_show_next: e.target.checked })} /> következő óra</label>
        <label>méret <input type="number" min={50} max={150} step={10} defaultValue={d.settings.tv_scale} key={d.settings.tv_scale} onBlur={e => setS({ tv_scale: Math.min(150, Math.max(50, +e.target.value || 100)) })} /> %</label></div>
    </section>

    <section><h2>Csengetési rendek</h2>
      <div className="row">{d.schedules.map(s => <button key={s.id} className={s.id === cur?.id ? 'on' : ''} onClick={() => setSel(s.id)}>{s.name}{s.is_default ? ' ★' : ''}</button>)}
        <button onClick={addSchedule}>+ Új rend</button></div>
      {cur && <>
        <div className="row"><input defaultValue={cur.name} key={cur.id + cur.name} onBlur={e => e.target.value !== cur.name && run(supabase.from('schedules').update({ name: e.target.value }).eq('id', cur.id))} />
          <button onClick={() => makeDefault(cur.id)} disabled={cur.is_default}>{cur.is_default ? 'Alapértelmezett ★' : 'Legyen alapértelmezett'}</button>
          <button onClick={() => confirm('Biztosan törlöd a rendet az óráival együtt?') && run(supabase.from('schedules').delete().eq('id', cur.id))}>Rend törlése</button></div>
        <div className="row">Ezeken a napokon él (üres = csak alapértelmezettként):
          {DAYS.map((n, i) => <label key={n}><input type="checkbox" checked={cur.weekdays.includes(i + 1)}
            onChange={e => run(supabase.from('schedules').update({ weekdays: e.target.checked ? [...cur.weekdays, i + 1].sort() : cur.weekdays.filter(x => x !== i + 1) }).eq('id', cur.id))} /> {n}</label>)}</div>
        {lessons.map((l, i) => <div className="row" key={l.id}>
          <input defaultValue={l.label} key={l.id + l.label} size={10} onBlur={e => e.target.value !== l.label && run(supabase.from('lessons').update({ label: e.target.value }).eq('id', l.id))} />
          <input type="time" defaultValue={fmtHM(l.start_time)} key={l.id + l.start_time} onBlur={e => e.target.value !== fmtHM(l.start_time) && run(supabase.from('lessons').update({ start_time: e.target.value }).eq('id', l.id))} />
          –<input type="time" defaultValue={fmtHM(l.end_time)} key={l.id + l.end_time} onBlur={e => e.target.value !== fmtHM(l.end_time) && run(supabase.from('lessons').update({ end_time: e.target.value }).eq('id', l.id))} />
          <button onClick={() => run(supabase.from('lessons').delete().eq('id', l.id))}>Törlés</button>
          {lessons[i + 1] && <em>szünet: {Math.round((toSec(lessons[i + 1].start_time) - toSec(l.end_time)) / 60)} perc</em>}</div>)}
        <button onClick={addLesson}>+ Új óra</button>
      </>}
    </section>

    <section><h2>Ünnepnapok, tanítás nélküli napok</h2>
      {d.closed_days.sort((a, b) => a.day.localeCompare(b.day)).map(c => <div className="row" key={c.id}>{c.day} – {c.reason}
        <button onClick={() => run(supabase.from('closed_days').delete().eq('id', c.id))}>Törlés</button></div>)}
      <div className="row"><input type="date" value={cd.day} onChange={e => setCd({ ...cd, day: e.target.value })} />
        <input placeholder="Megnevezés" value={cd.reason} onChange={e => setCd({ ...cd, reason: e.target.value })} />
        <button disabled={!cd.day || !cd.reason} onClick={async () => { await run(supabase.from('closed_days').insert({ school_id: d.id, ...cd })); setCd({ day: '', reason: '' }) }}>Hozzáadás</button></div>
    </section>

    <section><h2>Visszaszámlálók (szünetek, ünnepek)</h2>
      {[...(d.countdowns ?? [])].sort((a, b) => (a.target_date + a.target_time).localeCompare(b.target_date + b.target_time)).map(c =>
        <div className="row" key={c.id}>{KIND[c.kind]?.icon} {c.title} – {c.target_date} {c.target_time.slice(0, 5)}
          <button onClick={() => run(supabase.from('countdowns').delete().eq('id', c.id))}>Törlés</button></div>)}
      <div className="row"><input placeholder="Megnevezés (pl. Nyári szünet)" value={ev.title} onChange={e => setEv({ ...ev, title: e.target.value })} />
        <select value={ev.kind} onChange={e => setEv({ ...ev, kind: e.target.value })}>{Object.entries(KIND).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}</select>
        <input type="date" value={ev.date} onChange={e => setEv({ ...ev, date: e.target.value })} />
        <input type="time" value={ev.time} onChange={e => setEv({ ...ev, time: e.target.value })} />
        <button disabled={!ev.title || !ev.date} onClick={async () => { await run(supabase.from('countdowns').insert({ school_id: d.id, title: ev.title, kind: ev.kind, target_date: ev.date, target_time: ev.time })); setEv({ title: '', kind: 'other', date: '', time: '00:00' }) }}>Hozzáadás</button></div>
    </section>
  </main>
}
