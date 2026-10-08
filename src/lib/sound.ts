// Csengő: ha az admin feltöltött hangfájlt, az szól; különben a beépített, szintetizált csengő.
let ctx: AudioContext | null = null
let cached: { url: string; data: AudioBuffer } | null = null
export const audioReady = () => ctx?.state === 'running'

/** Csak felhasználói kattintásból hívd: a böngésző autoplay-szabályait nem kerüljük meg. */
export async function enableAudio() {
  ctx ??= new AudioContext()
  await ctx.resume()
  return ctx.state === 'running'
}

async function load(url: string) {
  if (cached?.url === url) return cached.data
  const r = await fetch(url)
  const data = await ctx!.decodeAudioData(await r.arrayBuffer())
  cached = { url, data }
  return data
}
/** Előre betölti a saját hangot, hogy csengetéskor ne legyen késés. */
export function preload(url?: string | null) { if (url && ctx && ctx.state === 'running') load(url).catch(() => {}) }

export async function ring(url?: string | null) {
  const c = ctx
  if (!c || c.state !== 'running') return          // nincs engedélyezve → csendben kihagyjuk
  if (url) {
    try { const s = c.createBufferSource(); s.buffer = await load(url); s.connect(c.destination); s.start(); return }
    catch { /* a saját hang nem játszható le: jön a beépített csengő */ }
  }
  const t0 = c.currentTime
  ;[880, 660, 880].forEach((f, i) => {
    const o = c.createOscillator(), g = c.createGain(), t = t0 + i * 0.7
    o.type = 'sine'; o.frequency.value = f
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.4, t + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.65)
    o.connect(g).connect(c.destination); o.start(t); o.stop(t + 0.7)
  })
}
