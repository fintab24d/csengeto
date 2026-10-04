export interface Countdown { id: string; title: string; kind: string; target_date: string; target_time: string }
/** A visszaszámlálók fajtái: ikon + szín + név (a kártyák ezzel kapnak saját hangulatot). */
export const KIND: Record<string, { icon: string; label: string; color: string }> = {
  summer: { icon: '☀️', label: 'Nyári szünet', color: '#d4ff3a' },
  autumn: { icon: '🍂', label: 'Őszi szünet', color: '#ffb347' },
  winter: { icon: '❄️', label: 'Téli szünet', color: '#5cf0ff' },
  spring: { icon: '🌷', label: 'Tavaszi szünet', color: '#39ff7a' },
  other: { icon: '🎒', label: 'Egyéb', color: '#9dffbd' },
}
