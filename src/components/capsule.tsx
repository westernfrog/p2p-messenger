import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type Tone = 'gray' | 'blue' | 'green' | 'amber' | 'red'

const TONES: Record<Tone, string> = {
  gray: '[--sig:var(--sig-gray)] [--sig-ink:var(--sig-gray-ink)]',
  blue: '[--sig:var(--sig-blue)] [--sig-ink:var(--sig-blue-ink)]',
  green: '[--sig:var(--sig-green)] [--sig-ink:var(--sig-green-ink)]',
  amber: '[--sig:var(--sig-amber)] [--sig-ink:var(--sig-amber-ink)]',
  red: '[--sig:var(--sig-red)] [--sig-ink:var(--sig-red-ink)]',
}

/** Share's Activity capsule: what happened, said by one tinted pill with an icon disc. */
export function Capsule({
  tone,
  icon,
  children,
  className,
}: {
  tone: Tone
  icon: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        TONES[tone],
        'inline-flex h-5 shrink-0 items-center gap-1 rounded-full pr-2 pl-[3px] text-xs font-semibold whitespace-nowrap',
        'bg-[color-mix(in_srgb,var(--sig)_14%,transparent)] text-(--sig-ink)',
        className,
      )}
    >
      <span className="grid size-3.5 place-items-center rounded-full bg-(--sig-ink) text-background [&_svg]:size-[9px]">
        {icon}
      </span>
      {children}
    </span>
  )
}

/** A status light and words in the status colour (Share's device "Status" column). */
export function StatusText({
  tone,
  children,
  className,
}: {
  tone: 'green' | 'amber' | 'gray'
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex min-w-0 items-center gap-1.5 text-xs whitespace-nowrap',
        tone === 'green' ? 'text-online' : tone === 'amber' ? 'text-activity' : 'text-muted-foreground',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'size-[7px] shrink-0 rounded-full',
          tone === 'green' ? 'bg-sig-green' : tone === 'amber' ? 'bg-sig-amber' : 'bg-sig-gray/45',
        )}
      />
      <span className="truncate">{children}</span>
    </span>
  )
}
