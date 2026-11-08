import { useState } from 'react'
import { ChatList } from '@/components/chat-list'
import { ChatView } from '@/components/chat-view'
import { Mark } from '@/components/mark'
import { Onboarding } from '@/components/onboarding'
import { PairPanel, type PairTab } from '@/components/pair-panel'
import { Sheets } from '@/components/sheets'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useWide } from '@/hooks/use-media'
import { useApp } from '@/lib/app'
import { LockSimpleIcon } from '@/lib/icons'

export default function App() {
  const { me } = useApp()
  const wide = useWide()
  return (
    <TooltipProvider delayDuration={500}>
      {me ? <Shell /> : <Onboarding />}
      <Toaster position={wide ? 'bottom-right' : 'top-center'} />
    </TooltipProvider>
  )
}

/**
 * Phones: one screen at a time, the list or a conversation (pushed, with swipe-back).
 * Wide screens: a split view, the list beside the conversation (split-views.md).
 */
function Shell() {
  const app = useApp()
  const wide = useWide()
  const active = app.contacts.find((c) => c.pk === app.activePk)

  return (
    <div className="grid h-[var(--app-h,100dvh)] grid-cols-1 overflow-hidden pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)] md:grid-cols-[minmax(19rem,22rem)_1fr]">
      {(wide || !active) && <ChatList />}
      {active ? <ChatView contact={active} /> : wide && <Placeholder />}
      <Sheets />
    </div>
  )
}

/** Wide screens with no chat open. With no contacts yet, pairing happens right here. */
function Placeholder() {
  const { contacts } = useApp()
  const [tab, setTab] = useState<PairTab>('code')
  if (contacts.length === 0) {
    return (
      <main className="grid min-h-0 overflow-y-auto bg-window px-6 py-10">
        <div className="m-auto grid w-full max-w-[25rem] gap-6">
          <div className="grid gap-1.5 text-center">
            <h1 className="text-[1.375rem] leading-tight font-bold tracking-[-0.015em]">Add your first contact</h1>
            <p className="text-sm text-balance text-muted-foreground">
              One of you shows a code, the other scans it. Not together? Send your invite link.
            </p>
          </div>
          <div className="rounded-window bg-card p-5 shadow-group [--group:var(--sheet-group)] [--field:var(--sheet-field)]">
            <PairPanel tab={tab} onTabChange={setTab} />
          </div>
        </div>
      </main>
    )
  }
  return (
    <main className="grid place-content-center justify-items-center gap-2 bg-window p-6 text-center">
      <Mark size={48} className="mb-2" />
      <p className="text-[15px] font-semibold">Pick a chat</p>
      <p className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
        <LockSimpleIcon weight="fill" className="size-3.5" />
        Messages go straight to your contact’s device.
      </p>
    </main>
  )
}
