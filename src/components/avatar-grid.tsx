import { useEffect, useRef, type KeyboardEvent } from 'react'
import { MASCOTS, mascotUrl } from '@/core/avatars'
import { CheckIcon } from '@/lib/icons'
import { cn } from '@/lib/utils'

/**
 * Characters to choose from (a radio group, as in Share). Arrow keys move the choice,
 * Up/Down by a row; Home/End jump to the ends. `surface` is the colour behind the grid,
 * so the selection ring has a clean gap around the chosen character.
 */
export function AvatarGrid({
  value,
  onChange,
  surface = 'var(--group)',
  className,
}: {
  value: string
  onChange: (id: string) => void
  surface?: string
  className?: string
}) {
  const grid = useRef<HTMLDivElement>(null)
  const tiles = useRef<(HTMLButtonElement | null)[]>([])

  // Show the chosen one without scrolling the page.
  useEffect(() => {
    const el = tiles.current[MASCOTS.findIndex((m) => m.id === value)]
    const g = grid.current
    if (el && g && g.scrollHeight > g.clientHeight) g.scrollTop = el.offsetTop - g.offsetTop - 12
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function onKey(e: KeyboardEvent, i: number) {
    const cols = getComputedStyle(grid.current!).gridTemplateColumns.split(' ').length
    const moves: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: cols, ArrowUp: -cols }
    const to = e.key === 'Home' ? 0 : e.key === 'End' ? MASCOTS.length - 1 : moves[e.key] !== undefined ? i + moves[e.key] : null
    if (to === null || to < 0 || to >= MASCOTS.length) return
    e.preventDefault()
    onChange(MASCOTS[to].id)
    tiles.current[to]?.focus()
  }

  return (
    <div
      ref={grid}
      role="radiogroup"
      aria-label="Character"
      className={cn('grid grid-cols-[repeat(auto-fill,minmax(44px,1fr))] gap-2.5', className)}
      style={{ ['--gap' as string]: surface }}
    >
      {MASCOTS.map((m, i) => {
        const on = m.id === value
        return (
          <button
            key={m.id}
            ref={(el) => {
              tiles.current[i] = el
            }}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={m.label}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(m.id)}
            onKeyDown={(e) => onKey(e, i)}
            className="group/tile relative aspect-square rounded-full outline-none"
          >
            <span
              className={cn(
                'block size-full overflow-hidden rounded-full bg-fill transition-[transform,box-shadow,background-color] duration-200 ease-out',
                'group-hover/tile:scale-[1.06] group-hover/tile:bg-fill-strong group-active/tile:scale-95',
                on
                  ? 'shadow-[0_0_0_2px_var(--gap),0_0_0_4px_var(--primary)]'
                  : 'group-focus-visible/tile:shadow-[0_0_0_2px_var(--gap),0_0_0_4px_var(--ring)]',
              )}
            >
              <img src={mascotUrl(m.id)} alt="" loading="lazy" draggable={false} className="size-full scale-110 object-cover" />
            </span>
            {on && (
              <span
                aria-hidden="true"
                className="absolute -right-0.5 -bottom-0.5 grid size-[18px] place-items-center rounded-full bg-primary text-primary-foreground shadow-[0_0_0_2px_var(--gap)]"
              >
                <CheckIcon className="size-2.5" weight="bold" />
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
