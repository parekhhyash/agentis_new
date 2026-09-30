// Placeholder wordmarks - swap for real customer logos (e.g. { name, src:
// '/images/logos/acme.svg' }) once you have permission to show them.
type Logo = { name: string; src?: string; className?: string }

const logos: Logo[] = [
  { name: 'NORTHWIND', className: 'font-sans text-2xl font-extrabold tracking-tight sm:text-3xl' },
  { name: 'Lumen & Co', className: 'font-display text-3xl sm:text-4xl' },
  { name: 'kestrel', className: 'font-sans text-3xl font-semibold lowercase tracking-tight sm:text-4xl' },
  { name: 'OAKLINE', className: 'font-serif text-2xl tracking-[0.25em] sm:text-3xl' },
  { name: 'Brightpath', className: 'font-sans text-2xl font-bold italic sm:text-3xl' },
  { name: 'HALCYON', className: 'font-display text-2xl tracking-[0.15em] sm:text-3xl' },
  { name: 'mosaic.', className: 'font-sans text-3xl font-black tracking-tighter sm:text-4xl' },
  { name: 'Veritas Labs', className: 'font-serif text-2xl font-semibold sm:text-3xl' },
]

function LogoItem({ logo }: { logo: Logo }) {
  return logo.src ? (
    <img src={logo.src} alt={logo.name} className="h-9 w-auto brightness-0 sm:h-11" />
  ) : (
    <span className={`whitespace-nowrap text-slate-900 ${logo.className ?? ''}`}>{logo.name}</span>
  )
}

export default function LogoMarquee() {
  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row sm:gap-10">
      <span className="shrink-0 text-base font-medium text-slate-900">Used by teams at</span>
      <div className="group relative w-full overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
        {/* Two identical halves: sliding by -50% lands exactly on the start of the copy. */}
        <div className="flex w-max animate-marquee items-center group-hover:[animation-play-state:paused] motion-reduce:animate-none">
          {[0, 1].map((copy) => (
            <ul key={copy} aria-hidden={copy === 1} className="flex shrink-0 items-center gap-16 pr-16 sm:gap-20 sm:pr-20">
              {logos.map((logo) => (
                <li key={logo.name}>
                  <LogoItem logo={logo} />
                </li>
              ))}
            </ul>
          ))}
        </div>
      </div>
    </div>
  )
}
