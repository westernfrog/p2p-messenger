import { useEffect, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { AvatarGrid } from '@/components/avatar-grid'
import { Avatar } from '@/components/avatar'
import { StatusText } from '@/components/capsule'
import { PairPanel, type PairTab } from '@/components/pair-panel'
import { BarButton, Group, ResponsiveSheet, Row, RowButton } from '@/components/responsive-sheet'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { shortKey } from '@/core/identity'
import { keyPattern, safetyNumber } from '@/core/keyart'
import { actions, statusOf, useApp } from '@/lib/app'
import { agoLabel } from '@/lib/format'
import { BroomIcon, CopyIcon, QrCodeIcon, SealCheckIcon, TrashIcon } from '@/lib/icons'
import { presenceOf } from '@/lib/presence'

/** Whichever sheet the app state asks for. Only one is ever open (sheets.md). */
export function Sheets() {
  const { sheet } = useApp()
  return (
    <>
      <AddSheet open={sheet?.kind === 'add'} />
      <ContactSheet pk={sheet?.kind === 'contact' ? sheet.pk : null} />
      <SettingsSheet open={sheet?.kind === 'settings'} />
    </>
  )
}

const close = (open: boolean) => !open && actions.closeSheet()

// ------------------------------------------------------------------ add contact

function AddSheet({ open }: { open: boolean }) {
  const { sheet } = useApp()
  const initial = sheet?.kind === 'add' ? sheet : null
  const [tab, setTab] = useState<PairTab>('scan')
  const [key, setKey] = useState(0)

  // Each opening starts fresh on the tab it was asked for.
  useEffect(() => {
    if (initial) {
      setTab(initial.tab)
      setKey((k) => k + 1)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={close}
      title="Add Contact"
      description="Scan your contact's code, or show them yours."
      leading={<BarButton onClick={actions.closeSheet}>Cancel</BarButton>}
    >
      <PairPanel
        key={key}
        tab={tab}
        onTabChange={(t) => {
          setTab(t)
          actions.openSheet({ kind: 'add', tab: t })
        }}
        autoCamera={initial?.tab === 'scan' && !initial.prefill && matchMedia('(pointer: coarse)').matches}
        prefill={initial?.prefill}
      />
    </ResponsiveSheet>
  )
}

// ------------------------------------------------------------------ contact details

function ContactSheet({ pk }: { pk: string | null }) {
  const app = useApp()
  const [last, setLast] = useState(pk)
  if (pk && pk !== last) setLast(pk)
  // Keep showing the contact while the sheet animates closed.
  const c = app.contacts.find((x) => x.pk === (pk ?? last))
  const me = app.me
  const [confirm, setConfirm] = useState<'remove' | 'clear' | null>(null)

  if (!c || !me) return null
  const status = statusOf(c.pk)
  const presence = presenceOf(c, status)
  const count = app.messages[c.pk]?.length ?? 0

  async function copyKey() {
    try {
      await navigator.clipboard.writeText(c!.pk)
      toast('Key copied')
    } catch {
      /* ignore */
    }
  }

  return (
    <>
      <ResponsiveSheet
        open={!!pk}
        onOpenChange={close}
        title="Contact"
        description={`Details and safety number for ${c.name}.`}
        trailing={
          <BarButton strong onClick={actions.closeSheet}>
            Done
          </BarButton>
        }
        className="grid content-start gap-6"
      >
        <div className="grid justify-items-center gap-2 pt-1 text-center">
          <Avatar pk={c.pk} mascot={c.avatar} size={84} presence={status} surface="var(--card)" />
          <h2 className="mt-1 flex items-center gap-1.5 text-xl font-bold tracking-[-0.015em]">
            {c.name}
            {c.verified && <SealCheckIcon weight="fill" className="size-5 text-sig-blue" aria-label="Verified" />}
          </h2>
          <StatusText tone={presence.tone} className="text-[13px]">
            {presence.label}
          </StatusText>
        </div>

        <Group
          title="Safety Number"
          footer={`Compare this number with the one on ${c.name}’s screen, in person. If they match, nobody swapped a key between you.`}
        >
          <div className="flex items-center gap-4 px-3.5 py-3.5">
            <span dangerouslySetInnerHTML={{ __html: keyPattern(c.pk, 44, 'Key fingerprint') }} />
            <p className="font-mono text-xl font-medium tracking-[0.06em] tabular-nums">{safetyNumber(me.pk, c.pk)}</p>
          </div>
          <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 px-3.5 py-2 text-[15px] md:text-sm">
            <span className="flex items-center gap-2.5">
              <SealCheckIcon className="size-[18px] text-sig-blue" weight={c.verified ? 'fill' : 'regular'} />
              Mark as Verified
            </span>
            <Switch checked={!!c.verified} onCheckedChange={(v) => actions.setVerified(c.pk, v)} />
          </label>
        </Group>

        <Group>
          <Row label="Key">
            <button
              type="button"
              onClick={() => void copyKey()}
              title={c.pk}
              className="inline-flex items-center gap-1.5 rounded-chip px-1 font-mono text-[13px] hover:text-foreground"
            >
              {shortKey(c.pk)}
              <CopyIcon className="size-3.5" />
              <span className="sr-only">Copy key</span>
            </button>
          </Row>
          <Row label="Added">{new Date(c.addedAt).toLocaleDateString([], { dateStyle: 'medium' })}</Row>
          <Row label="Last connected">{status === 'connected' ? 'Now' : c.lastSeen ? agoLabel(c.lastSeen) : 'Never'}</Row>
        </Group>

        <Group>
          <RowButton icon={<BroomIcon />} disabled={!count} onClick={() => setConfirm('clear')} className="disabled:opacity-50">
            Clear Chat History
          </RowButton>
          <RowButton icon={<TrashIcon />} destructive onClick={() => setConfirm('remove')}>
            Remove Contact
          </RowButton>
        </Group>
      </ResponsiveSheet>

      <Confirm
        open={confirm === 'clear'}
        onOpenChange={() => setConfirm(null)}
        title={`Clear chat with ${c.name}?`}
        body="Messages are deleted from this device. Their copy stays on their device."
        action="Clear History"
        onConfirm={() => actions.clearHistory(c.pk)}
      />
      <Confirm
        open={confirm === 'remove'}
        onOpenChange={() => setConfirm(null)}
        title={`Remove ${c.name}?`}
        body="Your chat history with them is deleted from this device. To chat again, you’ll both need to scan codes again."
        action="Remove"
        onConfirm={() => actions.removeContact(c.pk)}
      />
    </>
  )
}

// ------------------------------------------------------------------ settings

function SettingsSheet({ open }: { open: boolean }) {
  const app = useApp()
  const me = app.me
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState('')
  const [avatar, setAvatar] = useState('')
  const [erase, setErase] = useState(false)

  useEffect(() => {
    if (!open) setEditing(false)
  }, [open])

  if (!me) return null
  const { net } = app
  const online = app.contacts.filter((c) => statusOf(c.pk) === 'connected').length

  function startEdit() {
    setName(me!.name)
    setAvatar(me!.avatar)
    setEditing(true)
  }

  function save() {
    actions.updateMe(name, avatar)
    setEditing(false)
    toast.success('Profile updated', { description: 'Contacts see it the next time you connect.' })
  }

  const netStatus = !net.online
    ? { tone: 'gray' as const, label: 'No network' }
    : net.relays > 0
      ? { tone: 'green' as const, label: 'Ready' }
      : net.settled
        ? { tone: 'amber' as const, label: 'Can’t reach relays' }
        : { tone: 'amber' as const, label: 'Connecting…' }

  return (
    <>
      <ResponsiveSheet
        open={open}
        onOpenChange={close}
        title={editing ? 'Edit Profile' : 'Settings'}
        description="Your profile, network and privacy settings."
        leading={editing ? <BarButton onClick={() => setEditing(false)}>Cancel</BarButton> : null}
        trailing={
          editing ? (
            <BarButton strong onClick={save} disabled={!name.trim()}>
              Save
            </BarButton>
          ) : (
            <BarButton strong onClick={actions.closeSheet}>
              Done
            </BarButton>
          )
        }
        className="grid content-start gap-6"
      >
        {editing ? (
          <>
            <div className="grid justify-items-center gap-3">
              <Avatar pk={me.pk} mascot={avatar} size={84} />
            </div>
            <Group title="Name" footer="Shown to people you add. Contacts see changes the next time you connect.">
              <div className="p-2">
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={40}
                  autoComplete="nickname"
                  autoCapitalize="words"
                  aria-label="Name"
                  className="h-9"
                />
              </div>
            </Group>
            <Group title="Character">
              <AvatarGrid value={avatar} onChange={setAvatar} className="max-h-64 overflow-y-auto p-3.5" />
            </Group>
          </>
        ) : (
          <>
            <Group>
              <div className="flex items-center gap-3.5 px-3.5 py-3.5">
                <Avatar pk={me.pk} mascot={me.avatar} size={56} />
                <div className="grid min-w-0 flex-1 leading-tight">
                  <p className="truncate text-[17px] font-semibold">{me.name}</p>
                  <p className="font-mono text-xs text-muted-foreground">{shortKey(me.pk)}</p>
                </div>
                <Button variant="secondary" onClick={startEdit}>
                  Edit
                </Button>
              </div>
              <RowButton icon={<QrCodeIcon />} onClick={() => actions.openSheet({ kind: 'add', tab: 'code' })}>
                Show My Code
              </RowButton>
            </Group>

            <Group
              title="Connection"
              footer="Relays only pass encrypted connection requests between devices. Messages travel directly between you and your contact and never touch a server."
            >
              <Row label="Status">
                <StatusText tone={netStatus.tone} className="text-[13px] md:text-xs">
                  {netStatus.label}
                </StatusText>
              </Row>
              <Row label="Relays">
                {net.relays} of {net.total} reachable
              </Row>
              <Row label="Contacts connected">
                {online} of {app.contacts.length}
              </Row>
            </Group>

            <Group footer="Shows the sender and message when this tab is in the background.">
              <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 px-3.5 py-2 text-[15px] md:text-sm">
                Notifications
                <Switch
                  checked={!!app.settings.notifications}
                  onCheckedChange={(v) => void actions.setNotifications(v)}
                  disabled={typeof Notification === 'undefined'}
                />
              </label>
            </Group>

            <Group
              title="This Device"
              footer="Your key, contacts and chats are stored only in this browser. Clearing site data has the same effect as erasing."
            >
              <RowButton icon={<TrashIcon />} destructive onClick={() => setErase(true)}>
                Erase This Device…
              </RowButton>
            </Group>

            <p className="px-1 text-center text-[11px] leading-4 text-muted-foreground">
              Characters from{' '}
              <a className="underline underline-offset-2 hover:text-foreground" href="https://github.com/nilbuild/page-mascot" target="_blank" rel="noreferrer">
                page-mascot
              </a>{' '}
              by Kamran Ahmed (MIT).
            </p>
          </>
        )}
      </ResponsiveSheet>

      <Confirm
        open={erase}
        onOpenChange={setErase}
        title="Erase this device?"
        body="Your key, contacts and every chat are deleted from this browser. You’ll start over with a new identity, and contacts will need to add you again."
        action="Erase Everything"
        onConfirm={actions.eraseDevice}
      />
    </>
  )
}

// ------------------------------------------------------------------ confirm

/** A destructive action, confirmed (alerts.md: Cancel is always there, and the default). */
function Confirm({
  open,
  onOpenChange,
  title,
  body,
  action,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  body: ReactNode
  action: string
  onConfirm: () => void
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{body}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onConfirm}>
            {action}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
