import { Avatar } from '@/components/avatar'
import type { PeerStatus } from '@/lib/app'
import { LockSimpleIcon, WifiSlashIcon } from '@/lib/icons'
import { cn } from '@/lib/utils'

interface Person {
  pk: string
  mascot?: string
}

/**
 * The app's signature: you and them, joined by a line, as in the logo. The line is the
 * direct connection itself: dashed and grey when there is none, flowing amber while it is
 * being made, solid green with a lock when messages can travel.
 */
export function LinkVisual({
  me,
  them,
  status,
  size = 56,
  className,
}: {
  me: Person
  them: Person | null
  status: PeerStatus
  size?: number
  className?: string
}) {
  const color =
    status === 'connected' ? 'var(--sig-green)' : status === 'connecting' ? 'var(--sig-amber)' : 'var(--sig-gray)'
  const label =
    status === 'connected'
      ? 'Direct link open'
      : status === 'connecting'
        ? 'Making a direct link'
        : 'No direct link right now'
  return (
    <div role="img" aria-label={label} className={cn('flex items-center', className)}>
      <Avatar pk={me.pk} mascot={me.mascot} size={size} />
      <div className="relative mx-1 grid h-6 w-16 place-items-center">
        <svg className="absolute inset-0 size-full overflow-visible" viewBox="0 0 64 24" preserveAspectRatio="none" aria-hidden="true">
          <line
            x1="0"
            y1="12"
            x2="64"
            y2="12"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray={status === 'connected' ? undefined : '2 6'}
            style={status === 'connecting' ? { animation: 'link-flow 0.8s linear infinite' } : undefined}
            opacity={status === 'offline' ? 0.6 : 1}
          />
        </svg>
        <span
          className={cn(
            'relative grid size-6 place-items-center rounded-full shadow-[0_0_0_3px_var(--background)] transition-colors duration-300',
            status === 'connected'
              ? 'bg-sig-green text-white'
              : status === 'connecting'
                ? 'bg-sig-amber text-white'
                : 'bg-muted text-muted-foreground',
          )}
          aria-hidden="true"
        >
          {status === 'offline' ? (
            <WifiSlashIcon className="size-3.5" weight="bold" />
          ) : (
            <LockSimpleIcon className="size-3.5" weight="fill" />
          )}
        </span>
      </div>
      {them ? (
        <Avatar pk={them.pk} mascot={them.mascot} size={size} />
      ) : (
        <span
          className="grid shrink-0 place-items-center rounded-full border-2 border-dashed border-fill-strong text-lg font-semibold text-muted-foreground"
          style={{ width: size, height: size }}
        >
          ?
        </span>
      )}
    </div>
  )
}
