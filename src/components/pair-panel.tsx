import { useState } from 'react'
import { toast } from 'sonner'
import { Avatar } from '@/components/avatar'
import { Capsule } from '@/components/capsule'
import { QrCode } from '@/components/qr-code'
import { Scanner } from '@/components/scanner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { shortKey, type ContactCard } from '@/core/identity'
import { actions, myCode, myLink, useApp } from '@/lib/app'
import { CheckIcon, ClipboardTextIcon, CopyIcon, ExportIcon, QrCodeIcon, ScanIcon } from '@/lib/icons'
import { cn } from '@/lib/utils'

export type PairTab = 'scan' | 'code'

/**
 * Adding someone, in one place. Two people together: one shows their code, the other scans it.
 * Whoever is showing sees the scan arrive right here and adds the other back with one tap,
 * so both sides finish on the same screen they started on.
 */
export function PairPanel({
  tab,
  onTabChange,
  autoCamera = false,
  prefill = '',
  className,
}: {
  tab: PairTab
  onTabChange: (tab: PairTab) => void
  autoCamera?: boolean
  prefill?: string
  className?: string
}) {
  return (
    <Tabs value={tab} onValueChange={(v) => onTabChange(v as PairTab)} className={cn('gap-4', className)}>
      <TabsList className="h-9 w-full">
        <TabsTrigger value="scan" className="text-[13px]">
          <ScanIcon />
          Scan Code
        </TabsTrigger>
        <TabsTrigger value="code" className="text-[13px]">
          <QrCodeIcon />
          My Code
        </TabsTrigger>
      </TabsList>
      <TabsContent value="scan" className="grid gap-4">
        <ScanTab autoCamera={autoCamera} prefill={prefill} />
      </TabsContent>
      <TabsContent value="code" className="grid gap-4">
        <MyCodeTab />
      </TabsContent>
    </Tabs>
  )
}

// ------------------------------------------------------------------ my code

function MyCodeTab() {
  const { me, requests } = useApp()
  const [copied, setCopied] = useState(false)
  if (!me) return null
  const canShare = typeof navigator.share === 'function'

  async function copy() {
    try {
      await navigator.clipboard.writeText(myLink())
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      toast.error('Couldn’t copy', { description: 'Your browser blocked the clipboard.' })
    }
  }

  async function share() {
    try {
      await navigator.share({
        title: `Chat with ${me!.name} on Messenger`,
        text: `Add me on Messenger. Open this link, or paste the code under Add Contact:\n\n${myCode()}`,
        url: myLink(),
      })
    } catch {
      /* cancelled */
    }
  }

  return (
    <>
      <figure className="mx-auto grid w-full max-w-72 gap-3 rounded-window bg-group p-4 shadow-group">
        <div className="rounded-group bg-white p-3 shadow-[0_0_0_1px_var(--separator)]">
          <QrCode value={myLink()} label={`QR code to add ${me.name}`} className="w-full" />
        </div>
        <figcaption className="flex items-center gap-2.5 px-0.5">
          <Avatar pk={me.pk} mascot={me.avatar} size={32} />
          <span className="grid min-w-0 leading-tight">
            <strong className="truncate text-[15px] font-semibold md:text-sm">{me.name}</strong>
            <span className="font-mono text-[11px] text-muted-foreground">{shortKey(me.pk)}</span>
          </span>
        </figcaption>
      </figure>

      <p className="text-center text-[13px] text-balance text-muted-foreground">
        Your contact opens Messenger, taps <strong className="font-semibold text-foreground">Add</strong>, and scans
        this. Not in the same place? Send them your invite link.
      </p>

      <div className="flex gap-2">
        {canShare && (
          <Button variant="secondary" size="lg" className="flex-1" onClick={() => void share()}>
            <ExportIcon />
            Share…
          </Button>
        )}
        <Button variant="secondary" size="lg" className="flex-1" onClick={() => void copy()} aria-live="polite">
          {copied ? <CheckIcon weight="bold" /> : <CopyIcon />}
          {copied ? 'Link Copied' : 'Copy Invite Link'}
        </Button>
      </div>

      <section aria-label="People who scanned your code" className="grid gap-2" aria-live="polite">
        {requests.length === 0 ? (
          <p className="flex items-center justify-center gap-2 py-1 text-xs text-muted-foreground">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-sig-blue opacity-50 motion-reduce:animate-none" />
              <span className="relative inline-flex size-2 rounded-full bg-sig-blue" />
            </span>
            Waiting for a scan…
          </p>
        ) : (
          requests.map((card) => <RequestRow key={card.pk} card={card} />)
        )}
      </section>
    </>
  )
}

/** Someone scanned our code: add them back (or ignore them). */
export function RequestRow({ card, surface = 'var(--group)' }: { card: ContactCard; surface?: string }) {
  return (
    <div
      className="flex items-center gap-3 rounded-group bg-group p-3 shadow-group animate-[row-in_0.3s_var(--ease-out-soft)]"
      role="group"
      aria-label={`${card.n} scanned your code`}
    >
      <Avatar pk={card.pk} mascot={card.a} size={40} surface={surface} />
      <div className="min-w-0 flex-1 leading-tight">
        <p className="truncate text-[15px] font-semibold md:text-sm">{card.n}</p>
        <p className="truncate text-xs text-muted-foreground">Scanned your code</p>
      </div>
      <Button variant="ghost" size="sm" onClick={() => actions.ignoreRequest(card.pk)}>
        Ignore
      </Button>
      <Button size="sm" onClick={() => actions.acceptRequest(card.pk)}>
        Add
      </Button>
    </div>
  )
}

// ------------------------------------------------------------------ scan / paste

function ScanTab({ autoCamera, prefill }: { autoCamera: boolean; prefill: string }) {
  const [code, setCode] = useState(prefill)
  const check = code.trim() ? actions.checkCode(code) : null
  const canPaste = typeof navigator.clipboard?.readText === 'function'

  function onScan(text: string) {
    const r = actions.checkCode(text)
    setCode(text)
    // A successful scan is a clear intent: add right away.
    if ('card' in r) actions.addContact(r.card)
  }

  async function paste() {
    try {
      setCode((await navigator.clipboard.readText()).trim())
    } catch {
      document.getElementById('pair-code')?.focus()
    }
  }

  return (
    <>
      <Scanner autoStart={autoCamera} onResult={onScan} />

      <div className="flex items-center gap-3 text-xs text-muted-foreground before:h-px before:flex-1 before:bg-separator after:h-px after:flex-1 after:bg-separator">
        or paste a code or invite link
      </div>

      <form
        className="grid gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (check && 'card' in check) actions.addContact(check.card)
        }}
      >
        <label htmlFor="pair-code" className="sr-only">
          Contact code or invite link
        </label>
        <div className="flex gap-2">
          <Input
            id="pair-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="p2pmsg:… or a link"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            enterKeyHint="go"
            aria-invalid={!!check && 'error' in check}
            aria-describedby="pair-code-msg"
            className="h-9 font-mono text-[13px]"
          />
          {canPaste && (
            <Button type="button" variant="secondary" size="lg" onClick={() => void paste()}>
              <ClipboardTextIcon />
              Paste
            </Button>
          )}
        </div>
        <div id="pair-code-msg" aria-live="polite">
          {check && 'error' in check && <p className="px-1 text-[13px] text-destructive">{check.error}</p>}
          {check && 'card' in check && (
            <div className="mt-1 flex items-center gap-3 rounded-group bg-group p-3 shadow-group animate-[row-in_0.25s_var(--ease-out-soft)]">
              <Avatar pk={check.card.pk} mascot={check.card.a} size={40} surface="var(--group)" />
              <div className="grid min-w-0 flex-1 gap-0.5 leading-tight">
                <p className="truncate text-[15px] font-semibold md:text-sm">{check.card.n}</p>
                {check.known ? (
                  <Capsule tone="blue" icon={<CheckIcon weight="bold" />}>
                    Already in your chats
                  </Capsule>
                ) : (
                  <span className="font-mono text-[11px] text-muted-foreground">{shortKey(check.card.pk)}</span>
                )}
              </div>
              <Button type="submit" size="lg" className="px-4">
                {check.known ? 'Open Chat' : `Add ${firstName(check.card.n)}`}
              </Button>
            </div>
          )}
        </div>
      </form>
    </>
  )
}

function firstName(name: string): string {
  const first = name.split(/\s+/)[0]
  return first.length > 14 ? 'Contact' : first
}
