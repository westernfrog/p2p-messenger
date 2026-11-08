import { useMemo, useState } from 'react'
import { Avatar } from '@/components/avatar'
import { Capsule, StatusText } from '@/components/capsule'
import { LinkVisual } from '@/components/link-visual'
import { Mark } from '@/components/mark'
import { RequestRow } from '@/components/pair-panel'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useWide } from '@/hooks/use-media'
import { actions, statusOf, useApp, type AppState, type Contact } from '@/lib/app'
import { listTime } from '@/lib/format'
import { ClockIcon, MagnifyingGlassIcon, PlusIcon, QrCodeIcon, ScanIcon, WifiSlashIcon, XIcon } from '@/lib/icons'
import { cn } from '@/lib/utils'

/** The list of chats: the app's home on phones, the sidebar on wide screens. */
export function ChatList() {
  const app = useApp()
  const wide = useWide()
  const [query, setQuery] = useState('')
  const [scrolled, setScrolled] = useState(false)
  const me = app.me!

  const sorted = useMemo(() => {
    const last = (c: Contact) => app.messages[c.pk]?.at(-1)?.ts ?? c.addedAt
    return [...app.contacts].sort((a, b) => last(b) - last(a))
  }, [app.contacts, app.messages])
  const q = query.trim().toLowerCase()
  const shown = q ? sorted.filter((c) => c.name.toLowerCase().includes(q)) : sorted
  const online = app.contacts.filter((c) => app.statuses[c.pk] === 'connected').length
  const empty = app.contacts.length === 0

  const addButton = (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="secondary"
          size={wide ? 'icon-sm' : 'icon'}
          className="rounded-full"
          aria-label="Add contact"
          onClick={() => actions.openSheet({ kind: 'add', tab: wide ? 'code' : 'scan' })}
        >
          <PlusIcon weight="bold" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Add Contact</TooltipContent>
    </Tooltip>
  )

  return (
    <aside className="relative flex min-h-0 flex-col bg-background md:border-r md:border-separator" aria-label="Chats">
      {/* Toolbar */}
      <header
        className={cn(
          'z-10 flex min-h-[calc(3.25rem+env(safe-area-inset-top))] shrink-0 items-center justify-between gap-2 border-b px-3 pt-[env(safe-area-inset-top)] transition-colors md:px-4',
          scrolled || wide ? 'border-separator' : 'border-transparent',
        )}
      >
        {wide ? (
          <span className="flex items-center gap-2 text-[15px] font-bold tracking-[-0.01em]">
            <Mark size={24} />
            Messenger
          </span>
        ) : (
          <button
            type="button"
            onClick={() => actions.openSheet({ kind: 'settings' })}
            className="relative rounded-full outline-none before:absolute before:-inset-1.5 focus-visible:ring-2 focus-visible:ring-ring active:scale-95"
            aria-label="Settings and profile"
          >
            <Avatar pk={me.pk} mascot={me.avatar} size={34} />
          </button>
        )}
        {!wide && (
          <span
            aria-hidden="true"
            className={cn('text-[15px] font-semibold transition-opacity', scrolled ? 'opacity-100' : 'opacity-0')}
          >
            Chats
          </span>
        )}
        {addButton}
      </header>

      <div
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[max(0.75rem,env(safe-area-inset-bottom))]"
        onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 36)}
      >
        {!wide && (
          <div className="flex flex-wrap items-baseline gap-x-2.5 px-4 pt-1.5 pb-3">
            <h1 className="text-[2rem] leading-tight font-bold tracking-[-0.02em]">Chats</h1>
            {!empty && (
              <span className="text-[13px] text-muted-foreground">
                {online} of {app.contacts.length} connected
              </span>
            )}
          </div>
        )}

        {app.contacts.length > 1 && (
          <label className="mx-3 mt-2 mb-2 flex h-9 items-center gap-2 rounded-control bg-seg-track px-2.5 text-muted-foreground transition-shadow focus-within:shadow-field-focus md:mx-3 md:h-8">
            <MagnifyingGlassIcon className="size-4 shrink-0" />
            <span className="sr-only">Search chats</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search"
              autoComplete="off"
              enterKeyHint="search"
              className="min-w-0 flex-1 bg-transparent text-[15px] text-foreground outline-none placeholder:text-muted-foreground md:text-sm [&::-webkit-search-cancel-button]:hidden"
            />
            {query && (
              <button type="button" onClick={() => setQuery('')} aria-label="Clear search" className="rounded-full p-0.5 hover:text-foreground">
                <XIcon className="size-3.5" weight="bold" />
              </button>
            )}
          </label>
        )}

        <NetBanner net={app.net} />

        {app.requests.length > 0 && (
          <section aria-labelledby="requests-title" className="mx-3 mt-1 mb-3 grid gap-2">
            <h2 id="requests-title" className="px-1 text-[13px] font-semibold">
              Wants to chat
            </h2>
            {app.requests.map((card) => (
              <RequestRow key={card.pk} card={card} />
            ))}
          </section>
        )}

        {empty ? (
          wide ? (
            <p className="px-6 py-10 text-center text-[13px] text-balance text-muted-foreground">
              Your chats appear here once you add someone.
            </p>
          ) : (
            <EmptyState />
          )
        ) : (
          <ul className="px-2 pt-1 md:pt-2" aria-label="Conversations">
            {shown.map((c) => (
              <ChatRow key={c.pk} contact={c} app={app} wide={wide} />
            ))}
            {q && shown.length === 0 && (
              <li className="px-4 py-8 text-center text-[13px] text-muted-foreground">No chats match “{query.trim()}”.</li>
            )}
          </ul>
        )}
      </div>

      {wide && <MeFooter />}
    </aside>
  )
}

function ChatRow({ contact: c, app, wide }: { contact: Contact; app: AppState; wide: boolean }) {
  const status = statusOf(c.pk)
  const last = app.messages[c.pk]?.at(-1)
  const unread = app.unread[c.pk] ?? 0
  const typing = (app.typing[c.pk] ?? 0) > Date.now()
  const selected = wide && app.activePk === c.pk
  const waiting = last?.dir === 'out' && last.status === 'pending'
  const preview = typing
    ? 'typing…'
    : last
      ? `${last.dir === 'out' ? 'You: ' : ''}${last.text}`
      : status === 'connected'
        ? 'Connected. Say hello!'
        : 'No messages yet'

  return (
    <li className="group/row relative [&+li]:before:absolute [&+li]:before:top-0 [&+li]:before:right-3 [&+li]:before:left-[4.5rem] [&+li]:before:h-px [&+li]:before:bg-separator md:[&+li]:before:left-[3.875rem] [&:has(>button:hover)+li]:before:opacity-0 [&:has(>button:hover)]:before:opacity-0 [&:has(>button[aria-current])+li]:before:opacity-0 [&:has(>button[aria-current])]:before:opacity-0">
      <button
        type="button"
        onClick={() => actions.openChat(c.pk)}
        aria-current={selected ? 'true' : undefined}
        className={cn(
          'flex min-h-[4.5rem] w-full items-center gap-3 rounded-group px-2.5 py-2 text-left transition-colors outline-none md:min-h-[3.75rem]',
          'hover:bg-fill focus-visible:bg-fill focus-visible:ring-2 focus-visible:ring-ring/60 active:bg-fill-strong',
          selected && 'bg-fill-strong hover:bg-fill-strong',
        )}
      >
        <Avatar pk={c.pk} mascot={c.avatar} size={wide ? 40 : 50} presence={status} surface="var(--background)" />
        <span className="grid min-w-0 flex-1 gap-0.5">
          <span className="flex items-baseline gap-2">
            <span className="min-w-0 flex-1 truncate text-[16px] font-semibold md:text-sm">{c.name}</span>
            {last && <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{listTime(last.ts)}</span>}
          </span>
          <span className="flex items-center gap-2">
            {waiting && (
              <Capsule tone="gray" icon={<ClockIcon weight="bold" />}>
                Waiting
              </Capsule>
            )}
            <span
              className={cn(
                'min-w-0 flex-1 truncate text-[14px] md:text-[13px]',
                typing ? 'text-sig-blue-ink italic' : unread ? 'font-medium text-foreground' : 'text-muted-foreground',
              )}
            >
              {preview}
            </span>
            {unread > 0 && (
              <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-primary px-1.5 text-xs font-bold text-primary-foreground tabular-nums">
                {unread > 99 ? '99+' : unread}
                <span className="sr-only"> unread</span>
              </span>
            )}
          </span>
        </span>
      </button>
    </li>
  )
}

/** Teach pairing where it happens: the empty home screen. */
function EmptyState() {
  const { me } = useApp()
  return (
    <div className="mx-4 mt-6 grid justify-items-center gap-5 rounded-window border border-dashed border-fill-strong bg-window/50 px-5 py-9 text-center">
      <LinkVisual me={{ pk: me!.pk, mascot: me!.avatar }} them={null} status="offline" size={52} />
      <div className="grid max-w-[19rem] gap-1.5">
        <h2 className="text-[17px] font-semibold">Add your first contact</h2>
        <p className="text-[15px] leading-snug text-muted-foreground">
          Meet up with a friend. One of you shows a code, the other scans it. That’s the whole setup.
        </p>
      </div>
      <div className="grid w-full max-w-64 gap-2">
        <Button size="lg" className="h-11 text-[15px] font-semibold" onClick={() => actions.openSheet({ kind: 'add', tab: 'scan' })}>
          <ScanIcon />
          Scan a Code
        </Button>
        <Button variant="secondary" size="lg" className="h-11 text-[15px] font-semibold" onClick={() => actions.openSheet({ kind: 'add', tab: 'code' })}>
          <QrCodeIcon />
          Show My Code
        </Button>
      </div>
    </div>
  )
}

/** Plain-language connection trouble, only when there is some. */
function NetBanner({ net }: { net: AppState['net'] }) {
  const text = !net.online
    ? 'No internet connection. Messages will send when you’re back online.'
    : net.settled && net.relays === 0
      ? 'Can’t reach the relays that introduce devices. Retrying…'
      : ''
  if (!text) return null
  return (
    <div
      role="status"
      className="mx-3 mb-2 flex items-start gap-2 rounded-control bg-[color-mix(in_srgb,var(--sig-amber)_14%,transparent)] px-3 py-2 text-[13px] font-medium text-sig-amber-ink"
    >
      <WifiSlashIcon className="mt-0.5 size-4 shrink-0" />
      {text}
    </div>
  )
}

/** Desktop: you, at the foot of the sidebar; opens Settings. */
function MeFooter() {
  const { me, net } = useApp()
  const tone = !net.online ? 'gray' : net.relays > 0 ? 'green' : 'amber'
  const label = !net.online ? 'Offline' : net.relays > 0 ? 'Ready to connect' : 'Connecting…'
  return (
    <button
      type="button"
      onClick={() => actions.openSheet({ kind: 'settings' })}
      className="flex shrink-0 items-center gap-2.5 border-t border-separator px-4 py-3 text-left transition-colors outline-none hover:bg-fill focus-visible:bg-fill"
      aria-label={`${me!.name}, ${label}. Settings`}
    >
      <Avatar pk={me!.pk} mascot={me!.avatar} size={32} />
      <span className="grid min-w-0 flex-1 leading-tight">
        <span className="truncate text-sm font-semibold">{me!.name}</span>
        <StatusText tone={tone}>{label}</StatusText>
      </span>
      <span className="text-xs text-muted-foreground">Settings</span>
    </button>
  )
}
