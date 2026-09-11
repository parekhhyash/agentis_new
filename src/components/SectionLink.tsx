import type { ReactNode } from 'react'

/**
 * Same-page anchor that scrolls to a section by id. Deliberately avoids
 * setting location.hash: the app uses HashRouter for routing, so an
 * ordinary href="#id" jump would be read as a route change to a
 * non-existent page and blank the whole app.
 */
export default function SectionLink({
  id,
  className,
  children,
}: {
  id: string
  className?: string
  children: ReactNode
}) {
  return (
    <a
      href={`#${id}`}
      className={className}
      onClick={(e) => {
        e.preventDefault()
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
      }}
    >
      {children}
    </a>
  )
}
