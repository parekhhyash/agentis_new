const PER_SIDE = 9

// Card faces cycle through the site palette: sky, pink/rose, purple, blue, yellow.
const FACES = [
  'from-sky-300 to-sky-500',
  'from-pink-300 to-rose-500',
  'from-violet-400 to-purple-600',
  'from-amber-200 to-amber-400',
  'from-indigo-400 to-blue-600',
  'from-pink-200 to-pink-400',
  'from-rose-300 to-red-400',
  'from-sky-200 to-indigo-400',
  'from-fuchsia-300 to-violet-500',
]

type Card = { side: -1 | 1; k: number; left: number; angle: number; height: number; face: string }

// k = distance from the centre gap. Cards near the centre are tall and almost
// edge-on; outer ones are shorter and turn towards the viewer, so they read
// wider and overlap - the "fanned deck" look.
function layout(): Card[] {
  const cards: Card[] = []
  for (const side of [-1, 1] as const) {
    let offset = 2.8
    for (let k = 0; k < PER_SIDE; k++) {
      offset += k === 0 ? 0 : 2.6 + k * 0.62
      cards.push({
        side,
        k,
        left: 50 + side * offset,
        angle: 82 - k * 6.5,
        height: 100 - k * 5.5,
        face: FACES[(k + (side === 1 ? 4 : 0)) % FACES.length],
      })
    }
  }
  return cards
}

const CARDS = layout()

export default function CardFan({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`relative h-48 overflow-hidden rounded-[2rem] sm:h-72 lg:h-80 ${className}`}
      style={{ perspective: '1100px', perspectiveOrigin: '50% 40%' }}
    >
      {CARDS.map((card) => (
        <div
          key={`${card.side}-${card.k}`}
          className={`absolute bottom-0 overflow-hidden rounded-t-[1.75rem] rounded-b-md bg-gradient-to-br ${card.face} shadow-[0_0_0_1px_rgba(255,255,255,0.25)_inset]`}
          style={{
            left: `${card.left}%`,
            width: '13%',
            height: `${card.height}%`,
            marginLeft: '-6.5%',
            zIndex: PER_SIDE - card.k,
            // Left cards turn their inner edge away; right cards mirror it.
            transform: `translateY(14%) rotateY(${card.side * card.angle}deg)`,
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-white/35 via-transparent to-black/10" />
          <div className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-white/25 to-transparent" />
        </div>
      ))}
    </div>
  )
}
