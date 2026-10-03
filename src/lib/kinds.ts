export interface Countdown { id: string; title: string; kind: string; target_date: string; target_time: string }
/** A visszaszámlálók fajtái: ikon + szín + név (a kártyák ezzel kapnak saját hangulatot). */
export const KIND: Record<string, { icon: string; label: string; color: string }> = {
  summer: { icon: '☀️', label: 'Nyári szünet', color: '#f2b64d' },
  autumn: { icon: '🍂', label: 'Őszi szünet', color: '#e8845a' },
  winter: { icon: '❄️', label: 'Téli szünet', color: '#7fb8ff' },
  spring: { icon: '🌷', label: 'Tavaszi szünet', color: '#6fd39a' },
  other: { icon: '🎒', label: 'Egyéb', color: '#8fa4ff' },
}
