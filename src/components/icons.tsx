type IconProps = { className?: string }

export function MonitorIcon({ className }: IconProps) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect x="2.5" y="4" width="19" height="13" rx="2" />
      <path d="M8 21h8" />
      <path d="M12 17v4" />
    </svg>
  )
}

export function ChevronDownIcon({ className }: IconProps) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}

export function ArrowUpIcon({ className }: IconProps) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M12 19V5" />
      <path d="m5 12 7-7 7 7" />
    </svg>
  )
}

export function QuoteIcon({ className }: IconProps) {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M7.17 6A5.17 5.17 0 0 0 2 11.17V18h6.83v-6.83H4.5a2.67 2.67 0 0 1 2.67-2.67V6Zm10 0A5.17 5.17 0 0 0 12 11.17V18h6.83v-6.83H14.5a2.67 2.67 0 0 1 2.67-2.67V6Z" />
    </svg>
  )
}
