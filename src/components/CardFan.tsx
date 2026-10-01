const PER_SIDE = 9

// Solid brand colours, no gradients.
const FACES = [
  'bg-brand-sky',
  'bg-brand-pink',
  'bg-brand-violet',
  'bg-brand-yellow',
  'bg-brand-blue',
  'bg-brand-orchid',
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
          className={`absolute bottom-0 rounded-t-[1.75rem] rounded-b-md ${card.face} shadow-[inset_0_0_0_1px_rgba(255,255,255,0.3)]`}
          style={{
            left: `${card.left}%`,
            width: '13%',
            height: `${card.height}%`,
            marginLeft: '-6.5%',
            zIndex: PER_SIDE - card.k,
            // Left cards turn their inner edge away; right cards mirror it.
            transform: `translateY(14%) rotateY(${card.side * card.angle}deg)`,
          }}
        />
      ))}
    </div>
  )
}
