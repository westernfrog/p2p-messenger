import { useEffect, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { toast } from 'sonner'
import { Avatar } from '@/components/avatar'
import { Capsule, StatusText } from '@/components/capsule'
import { LinkVisual } from '@/components/link-visual'
import { Button } from '@/components/ui/button'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { useWide } from '@/hooks/use-media'
import { actions, statusOf, useApp, type ChatMessage, type Contact } from '@/lib/app'
import { dayLabel, sameDay, timeLabel } from '@/lib/format'
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ArrowsClockwiseIcon,
  CaretLeftIcon,
  CheckIcon,
  ChecksIcon,
  ClockIcon,
  CopyIcon,
  InfoIcon,
  LockSimpleIcon,
  SealCheckIcon,
  TrashIcon,
} from '@/lib/icons'
import { presenceOf } from '@/lib/presence'
import { cn } from '@/lib/utils'

const GROUP_GAP_MS = 2 * 60_000
const SEPARATOR_GAP_MS = 30 * 60_000
const JUMBO_EMOJI = /^(?:\p{Extended_Pictographic}(?:️|\p{Emoji_Modifier}|‍\p{Extended_Pictographic})*\s*){1,3}$/u

export function ChatView({ contact: c }: { contact: Contact }) {
  const app = useApp()
  const wide = useWide()
  const status = statusOf(c.pk)
  const presence = presenceOf(c, status)
  const list = app.messages[c.pk] ?? []
  const typing = (app.typing[c.pk] ?? 0) > Date.now()

  const scroller = useRef<HTMLDivElement>(null)
  const pinned = useRef(true)
  const [showJump, setShowJump] = useState(false)

  // Stay at the bottom as messages arrive, unless someone has scrolled up to read.
  useLayoutEffect(() => {
    const el = scroller.current
    if (el && pinned.current) el.scrollTop = el.scrollHeight
  }, [list.length, typing, c.pk])

  useLayoutEffect(() => {
    pinned.current = true
    setShowJump(false)
    const el = scroller.current
    if (el) el.scrollTop = el.scrollHeight
  }, [c.pk])

  function onScroll() {
    const el = scroller.current!
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80
    pinned.current = atBottom
    setShowJump(!atBottom)
  }

  function jump() {
    const el = scroller.current!
    el.scrollTo({ top: el.scrollHeight, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
  }

  // Status shows under your latest message, or under the last unsent one.
  const lastIdx = list.length - 1
  const statusIdx =
    list[lastIdx]?.dir === 'out' ? lastIdx : list.findLastIndex((m) => m.dir === 'out' && m.status === 'pending')

  return (
    <section className="flex min-h-0 flex-1 flex-col bg-background" aria-label={`Conversation with ${c.name}`}>
      {/* Toolbar */}
      <header className="z-10 grid min-h-[calc(3.25rem+env(safe-area-inset-top))] shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-1 border-b border-separator px-1.5 pt-[env(safe-area-inset-top)] md:px-3">
        <div className="justify-self-start">
          {!wide && (
            <Button variant="ghost" className="h-10 gap-0.5 pr-2 pl-1 text-[16px] font-normal text-link" onClick={actions.closeChat}>
              <CaretLeftIcon className="size-5!" weight="bold" />
              Chats
              {Object.entries(app.unread).some(([pk, n]) => pk !== c.pk && n > 0) && (
                <span className="ml-1 grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1.5 text-xs font-bold text-primary-foreground">
                  {Object.entries(app.unread).reduce((a, [pk, n]) => (pk === c.pk ? a : a + n), 0)}
                </span>
              )}
            </Button>
          )}
        </div>
        <button
          type="button"
          onClick={() => actions.openSheet({ kind: 'contact', pk: c.pk })}
          className="flex max-w-[min(60vw,26rem)] min-w-0 items-center gap-2.5 rounded-control px-2.5 py-1 transition-colors outline-none hover:bg-fill focus-visible:bg-fill active:bg-fill-strong"
          aria-label={`${c.name}, ${presence.label}. Contact details`}
        >
          <Avatar pk={c.pk} mascot={c.avatar} size={34} presence={status} />
          <span className="grid min-w-0 text-left leading-tight">
            <span className="flex items-center gap-1 truncate text-[15px] font-semibold md:text-sm">
              <span className="truncate">{c.name}</span>
              {c.verified && <SealCheckIcon weight="fill" className="size-3.5 shrink-0 text-sig-blue" aria-label="Verified" />}
            </span>
            <StatusText tone={presence.tone} className="text-[12px]">
              {typing ? 'typing…' : presence.label}
            </StatusText>
          </span>
        </button>
        <div className="justify-self-end">
          <Button
            variant="ghost"
            size="icon"
            className="size-10 rounded-full text-link"
            aria-label="Contact details"
            onClick={() => actions.openSheet({ kind: 'contact', pk: c.pk })}
          >
            <InfoIcon className="size-[22px]!" />
          </Button>
        </div>
      </header>

      {/* Messages */}
      <div className="relative min-h-0 flex-1">
        <div ref={scroller} onScroll={onScroll} className="absolute inset-0 overflow-y-auto overscroll-contain">
          <ol className="mx-auto flex max-w-[54rem] flex-col gap-0.5 px-3.5 pt-3 pb-2.5 md:px-5" aria-live="polite" aria-relevant="additions">
            <Intro contact={c} hasMessages={list.length > 0} />
            {list.map((m, i) => (
              <MessageItem key={m.id} contact={c} list={list} index={i} showStatus={i === statusIdx} />
            ))}
            {typing && <TypingBubble />}
          </ol>
        </div>
        {showJump && (
          <Button
            variant="outline"
            size="icon"
            onClick={jump}
            aria-label="Jump to latest message"
            className="absolute right-4 bottom-3 size-9 rounded-full bg-popover shadow-popover animate-in fade-in-0 zoom-in-90"
          >
            <ArrowDownIcon weight="bold" />
          </Button>
        )}
      </div>

      <Composer contact={c} />
    </section>
  )
}

/** The top of every conversation: the link between you two, and what it means. */
function Intro({ contact: c, hasMessages }: { contact: Contact; hasMessages: boolean }) {
  const { me } = useApp()
  const status = statusOf(c.pk)
  const neverMet = !c.lastSeen && status !== 'connected'
  return (
    <li className="mx-auto mt-5 mb-4 grid max-w-[22rem] justify-items-center gap-2.5 text-center">
      <LinkVisual me={{ pk: me!.pk, mascot: me!.avatar }} them={{ pk: c.pk, mascot: c.avatar }} status={status} size={52} />
      <strong className="mt-1 text-[17px] font-semibold">{c.name}</strong>
      <p className="text-[13px] leading-snug text-balance text-muted-foreground">
        {neverMet
          ? `Waiting for ${c.name} to add you back. You can write now; messages send as soon as you connect.`
          : `Messages go straight to ${c.name}’s device. Nothing is stored on a server.`}
      </p>
      <Capsule tone="green" icon={<LockSimpleIcon weight="fill" />}>
        End-to-end encrypted
      </Capsule>
      {neverMet && !hasMessages && (
        <Button variant="link" size="sm" className="h-auto p-0 text-[13px]" onClick={() => actions.openSheet({ kind: 'add', tab: 'code' })}>
          Show them my code
        </Button>
      )}
    </li>
  )
}

function MessageItem({
  contact: c,
  list,
  index: i,
  showStatus,
}: {
  contact: Contact
  list: ChatMessage[]
  index: number
  showStatus: boolean
}) {
  const m = list[i]
  const prev = list[i - 1]
  const next = list[i + 1]
  const sep = !prev || m.ts - prev.ts > SEPARATOR_GAP_MS || !sameDay(prev.ts, m.ts)
  const nextSep = !!next && (next.ts - m.ts > SEPARATOR_GAP_MS || !sameDay(m.ts, next.ts))
  const start = sep || prev.dir !== m.dir || m.ts - prev.ts > GROUP_GAP_MS
  const end = !next || nextSep || next.dir !== m.dir || next.ts - m.ts > GROUP_GAP_MS || showStatus
  const out = m.dir === 'out'
  const jumbo = JUMBO_EMOJI.test(m.text)
  const fresh = Date.now() - m.ts < 1500

  async function copy() {
    try {
      await navigator.clipboard.writeText(m.text)
      toast('Copied')
    } catch {
      /* ignore */
    }
  }

  return (
    <>
      {sep && (
        <li className="my-3 self-center text-xs text-muted-foreground">
          <b className="font-semibold text-foreground">{dayLabel(m.ts)}</b> {timeLabel(m.ts)}
        </li>
      )}
      <li className={cn('flex items-end gap-1.5', out && 'justify-end', start && 'mt-2')}>
        {out && m.status === 'pending' && !showStatus && (
          <ClockIcon className="mb-2 size-4 shrink-0 text-muted-foreground" aria-label="Not sent yet" />
        )}
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <div
              title={new Date(m.ts).toLocaleString()}
              className={cn(
                'max-w-[min(78%,34rem)] text-[16px] leading-[1.38] break-words whitespace-pre-wrap select-text md:text-[15px]',
                fresh && 'animate-[msg-in_0.25s_var(--ease-out-soft)]',
                jumbo
                  ? 'px-0.5 text-[2.5rem] leading-tight'
                  : cn(
                      'rounded-[18px] px-3.5 py-2',
                      out ? 'bg-primary text-primary-foreground' : 'bg-bubble-in text-foreground',
                      out ? !start && 'rounded-tr-chip' : !start && 'rounded-tl-chip',
                      out ? !end && 'rounded-br-chip' : !end && 'rounded-bl-chip',
                    ),
              )}
            >
              <span className="sr-only">{out ? 'You: ' : `${c.name}: `}</span>
              {m.text}
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem onSelect={() => void copy()}>
              <CopyIcon />
              Copy
            </ContextMenuItem>
            {out && m.status === 'pending' && (
              <ContextMenuItem onSelect={() => actions.retry(c.pk)}>
                <ArrowsClockwiseIcon />
                Try Sending Now
              </ContextMenuItem>
            )}
            <ContextMenuSeparator />
            <ContextMenuItem variant="destructive" onSelect={() => actions.deleteMessage(c.pk, m.id)}>
              <TrashIcon />
              Delete for Me
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      </li>
      {showStatus && <MessageStatus contact={c} message={m} />}
    </>
  )
}

function MessageStatus({ contact: c, message: m }: { contact: Contact; message: ChatMessage }) {
  const status = statusOf(c.pk)
  return (
    <li className="mt-1 mb-1 self-end">
      {m.status === 'delivered' ? (
        <Capsule tone="green" icon={<ChecksIcon weight="bold" />}>
          Delivered
        </Capsule>
      ) : m.status === 'sent' ? (
        <Capsule tone="blue" icon={<CheckIcon weight="bold" />}>
          Sent
        </Capsule>
      ) : status === 'offline' ? (
        <button type="button" onClick={() => actions.retry(c.pk)} className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring" title="Try connecting now">
          <Capsule tone="gray" icon={<ClockIcon weight="bold" />}>
            Waiting for {c.name} to connect
          </Capsule>
        </button>
      ) : (
        <Capsule tone="amber" icon={<ClockIcon weight="bold" />}>
          Sending…
        </Capsule>
      )}
    </li>
  )
}

function TypingBubble() {
  return (
    <li className="mt-2 flex" aria-label="typing">
      <span className="flex items-center gap-1 rounded-[18px] bg-bubble-in px-3.5 py-3">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="size-2 rounded-full bg-muted-foreground"
            style={{ animation: `typing-dot 1.2s ${i * 0.15}s ease-in-out infinite` }}
          />
        ))}
      </span>
    </li>
  )
}

function Composer({ contact: c }: { contact: Contact }) {
  const [drafts] = useState(() => new Map<string, string>())
  const [text, setText] = useState(drafts.get(c.pk) ?? '')
  const input = useRef<HTMLTextAreaElement>(null)
  const wide = useWide()

  // Each chat keeps its own draft.
  useEffect(() => {
    setText(drafts.get(c.pk) ?? '')
    if (wide) input.current?.focus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c.pk])

  function change(v: string) {
    setText(v)
    drafts.set(c.pk, v)
    if (v.trim()) actions.typing(c.pk)
  }

  function submit(e?: FormEvent) {
    e?.preventDefault()
    if (!text.trim()) return
    actions.send(c.pk, text)
    change('')
    input.current?.focus()
  }

  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      submit()
    }
  }

  return (
    <form
      onSubmit={submit}
      className="shrink-0 border-t border-separator bg-background px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:px-5 md:pb-3"
    >
      <div className="mx-auto flex max-w-[54rem] items-end gap-2 rounded-[22px] bg-field py-1 pr-1 pl-4 shadow-field transition-shadow focus-within:shadow-field-focus">
        <label htmlFor="composer" className="sr-only">
          Message {c.name}
        </label>
        <textarea
          id="composer"
          ref={input}
          rows={1}
          value={text}
          onChange={(e) => change(e.target.value)}
          onKeyDown={onKey}
          placeholder={`Message ${c.name}`}
          enterKeyHint="send"
          maxLength={4000}
          autoComplete="off"
          className="field-sizing-content max-h-40 min-h-8 flex-1 resize-none bg-transparent py-1.5 text-[16px] leading-snug outline-none placeholder:text-muted-foreground md:text-[15px]"
        />
        <Button
          type="submit"
          size="icon"
          aria-label="Send"
          disabled={!text.trim()}
          // Keep the keyboard open when tapping Send.
          onPointerDown={(e) => e.preventDefault()}
          className="mb-0.5 size-8 shrink-0 rounded-full disabled:bg-fill-strong disabled:text-muted-foreground disabled:opacity-100"
        >
          <ArrowUpIcon weight="bold" className="size-4" />
        </Button>
      </div>
    </form>
  )
}
