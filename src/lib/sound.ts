// Alapértelmezett csengő: WebAudio-val szintetizálva, külön hangfájl nélkül.
let ctx: AudioContext | null = null
export const audioReady = () => ctx?.state === 'running'

/** Csak felhasználói kattintásból hívd: a böngésző autoplay-szabályait nem kerüljük meg. */
export async function enableAudio() {
  ctx ??= new AudioContext()
  await ctx.resume()
  return ctx.state === 'running'
}

export function ring() {
  const c = ctx
  if (!c || c.state !== 'running') return          // nincs engedélyezve → csendben kihagyjuk
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
