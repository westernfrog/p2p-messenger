import type { CSSProperties } from 'react'
import { mascotFor, mascotUrl } from '@/core/avatars'
import type { PeerStatus } from '@/lib/app'
import { cn } from '@/lib/utils'

/**
 * A person: their page-mascot character in a soft circle, with an optional presence light
 * (green when a direct link is open, amber while it's being made, none when offline).
 * `surface` is the colour behind the avatar, so the light has a clean ring around it.
 */
export function Avatar({
  pk,
  mascot,
  size,
  presence,
  surface = 'var(--background)',
  className,
}: {
  pk: string
  mascot?: string
  size: number
  presence?: PeerStatus
  surface?: string
  className?: string
}) {
  const light = Math.max(10, Math.round(size * 0.27))
  return (
    <span
      aria-hidden="true"
      className={cn('relative block shrink-0', className)}
      style={{ width: size, height: size }}
    >
      <span className="block size-full overflow-hidden rounded-full bg-fill-strong shadow-[0_0_0_1px_var(--separator)]">
        <img
          src={mascotUrl(mascotFor(pk, mascot))}
          alt=""
          draggable={false}
          width={size}
          height={size}
          className="size-full scale-110 object-cover"
        />
      </span>
      {presence && presence !== 'offline' && (
        <span
          className={cn(
            'absolute -right-px -bottom-px rounded-full',
            presence === 'connected' ? 'bg-sig-green' : 'bg-sig-amber',
          )}
          style={{ width: light, height: light, boxShadow: `0 0 0 2px ${surface}` } as CSSProperties}
        />
      )}
    </span>
  )
}
