import { useId } from 'react'
import { cn } from '@/lib/utils'

/**
 * The Messenger mark, in the Share family's style: white artwork on a cable-blue tile.
 * A speech bubble holding two device nodes joined by a line: two people, linked directly.
 */
export function Mark({ size = 24, className }: { size?: number; className?: string }) {
  const id = useId().replace(/:/g, '')
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={cn('block shrink-0 drop-shadow-[0_1px_1px_rgb(30_79_194/0.25)]', className)}
    >
      <defs>
        <linearGradient id={`${id}t`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4C8BF5" />
          <stop offset="1" stopColor="#1E4FC2" />
        </linearGradient>
        <linearGradient id={`${id}s`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".22" />
          <stop offset=".55" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="24" height="24" rx="6.4" fill={`url(#${id}t)`} />
      <rect width="24" height="24" rx="6.4" fill={`url(#${id}s)`} />
      <path
        d="M7.4 5.9h9.2a2.9 2.9 0 0 1 2.9 2.9v5.1a2.9 2.9 0 0 1-2.9 2.9h-5.2l-3.3 2.6v-2.6h-.7a2.9 2.9 0 0 1-2.9-2.9V8.8a2.9 2.9 0 0 1 2.9-2.9z"
        fill="none"
        stroke="#fff"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M9.2 11.35h5.6" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="8.9" cy="11.35" r="1.75" fill="#fff" />
      <circle cx="15.1" cy="11.35" r="1.75" fill="#fff" />
    </svg>
  )
}
