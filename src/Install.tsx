import { useEffect, useState } from 'react'
import { APP_NAME } from './lib/brand'

/** Telepítési oldal (/telepites): a TV-n lévő QR-kód ide visz.
 *  Android / számítógép (Chrome, Edge): Telepítés gomb. iPhone / iPad: lépésről lépésre útmutató. */
export default function Install() {
  const [ev, setEv] = useState<any>(null)
  const [done, setDone] = useState(false)
  useEffect(() => {
    document.documentElement.dataset.theme = localStorage.getItem('theme') ?? 'dark'
    document.documentElement.dataset.style = localStorage.getItem('style') ?? 'neon'
    document.title = `Telepítés – ${APP_NAME}`
    const on = (e: Event) => {
      e.preventDefault(); setEv(e)
      // Automatikus kísérlet: a böngésző általában elutasítja (koppintás nélkül nem engedi), ilyenkor egy koppintás elég
      try { Promise.resolve((e as any).prompt()).catch(() => {}) } catch { /* marad a koppintás */ }
    }, ok = () => setDone(true)
    window.addEventListener('beforeinstallprompt', on); window.addEventListener('appinstalled', ok)
    return () => { window.removeEventListener('beforeinstallprompt', on); window.removeEventListener('appinstalled', ok) }
  }, [])
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const install = async () => { if (!ev) return; ev.prompt(); await ev.userChoice; setEv(null) }
  const standalone = matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true

  return <main className="install" onClick={e => { if (ev && !(e.target as HTMLElement).closest('a,button')) install() }}><section className="panel">
    <img className="appicon" src="/icon-192.png" alt="" />
    <h1>Telepítsd a {APP_NAME} alkalmazást</h1>
    {standalone || done ? <p>Kész, az alkalmazás már telepítve van.</p>
      : ev ? <><p>Koppints bárhová a képernyőn, és a telefon felajánlja a telepítést. A kezdőképernyőre kerül, és onnan indul.</p>
          <button className="cta" onClick={install}>Telepítés most</button></>
      : ios ? <ol>
          <li>Nyisd meg ezt az oldalt a <b>Safariban</b>.</li>
          <li>Koppints a <b>Megosztás</b> ikonra (a nyilas négyzet).</li>
          <li>Válaszd a <b>Főképernyőhöz adás</b> lehetőséget.</li>
          <li>Koppints a <b>Hozzáadás</b> gombra.</li></ol>
      : <ol>
          <li>Koppints a böngésző menüjére (a három pont).</li>
          <li>Válaszd az <b>Alkalmazás telepítése</b> vagy a <b>Hozzáadás a kezdőképernyőhöz</b> pontot.</li>
          <li>Erősítsd meg a telepítést.</li></ol>}
    <a className="btn" href="/">Tovább az oldalra</a>
  </section></main>
}
