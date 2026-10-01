// A single statement over five faint, evenly overlapping circles.
const CIRCLES = 5
const R = 160
const STEP = 120 // centre-to-centre distance; < 2R so neighbours intersect

export default function QuoteCircles() {
  const width = 2 * R + STEP * (CIRCLES - 1)

  return (
    <section className="relative z-10 overflow-x-clip px-4 py-20 sm:px-6 sm:py-28">
      <div className="relative mx-auto flex max-w-[78rem] items-center justify-center">
        <svg
          viewBox={`0 0 ${width} ${2 * R}`}
          aria-hidden="true"
          className="absolute top-1/2 left-1/2 w-[160%] max-w-none -translate-x-1/2 -translate-y-1/2 sm:w-full sm:max-w-4xl"
          fill="none"
        >
          {Array.from({ length: CIRCLES }, (_, i) => (
            <circle
              key={i}
              cx={R + i * STEP}
              cy={R}
              r={R - 1}
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
              className="stroke-slate-200"
            />
          ))}
        </svg>
        <p className="font-display relative py-16 text-center text-4xl text-balance text-slate-900 sm:py-24 sm:text-6xl">
          Built to do the work, so you can lead.
        </p>
      </div>
    </section>
  )
}
