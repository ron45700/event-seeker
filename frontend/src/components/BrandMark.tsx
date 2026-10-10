import { useId } from 'react'

/**
 * The event seeker mark: a stage light finding the mic. Same drawing as public/icon.svg, on
 * a rounded tile. Its colours are the brand's and stay the same in both themes: on the dark
 * page the tile melts into the background and the light carries the mark; on the light page
 * the tile reads as an app icon. Decorative; the wordmark beside it names the link.
 */
export function BrandMark({ className }: { className?: string }) {
  const beam = useId()
  return (
    <svg className={className} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={beam} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f4b740" />
          <stop offset="1" stopColor="#f4b740" stopOpacity="0.55" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill="#10131c" />
      <rect x="24" y="7" width="16" height="7" rx="2.5" fill="#f4b740" />
      <path d="M26.5 15h11L51 50H13Z" fill={`url(#${beam})`} />
      <ellipse cx="32" cy="50.5" rx="19.5" ry="5" fill="#f4b740" />
      <rect x="27.4" y="20.5" width="9.2" height="14" rx="4.6" fill="#10131c" />
      <path d="M27.4 27.6h9.2" stroke="#f4b740" strokeWidth="1.4" />
      <rect x="30.6" y="34" width="2.8" height="15" fill="#10131c" />
      <ellipse cx="32" cy="50" rx="6.5" ry="1.7" fill="#10131c" />
    </svg>
  )
}
