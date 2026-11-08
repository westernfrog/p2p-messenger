// The app's state and everything that changes it. Components read it with `useApp()` and call
// `actions.*`; the networking (Signaling, PeerManager) lives here, outside React.

import { useSyncExternalStore } from 'react'
import { toast } from 'sonner'
import { isMascot } from '@/core/avatars'
import { cleanName, createIdentity, decodeCard, encodeCard, type ContactCard, type Identity } from '@/core/identity'
import { PeerManager, type PeerStatus, type WireMessage } from '@/core/peers'
import { Signaling } from '@/core/signaling'
import * as store from '@/core/store'
import type { ChatMessage, Contact, Settings } from '@/core/store'
import { uid } from '@/core/uid'

export type { ChatMessage, Contact, PeerStatus }

export type Sheet =
  | { kind: 'add'; tab: 'scan' | 'code'; prefill?: string }
  | { kind: 'contact'; pk: string }
  | { kind: 'settings' }
  | null

export interface NetState {
  online: boolean
  relays: number
  total: number
  /** False for the first few seconds, so "can't reach relays" isn't shown while still dialling. */
  settled: boolean
}

export interface AppState {
  me: Identity | null
  contacts: Contact[]
  messages: Record<string, ChatMessage[]>
  statuses: Record<string, PeerStatus>
  unread: Record<string, number>
  /** People who scanned our code and are waiting for us to add them back. */
  requests: ContactCard[]
  /** pk → time their "typing" expires. */
  typing: Record<string, number>
  net: NetState
  activePk: string | null
  sheet: Sheet
  settings: Settings
}

const TYPING_TTL_MS = 5_000
const TYPING_SEND_EVERY_MS = 2_500
const MAX_TEXT = 4000

// ------------------------------------------------------------------ store

const settings = store.loadSettings()
let state: AppState = {
  me: store.loadIdentity(),
  contacts: [],
  messages: {},
  statuses: {},
  unread: {},
  requests: [],
  typing: {},
  net: { online: navigator.onLine, relays: 0, total: settings.relays.length, settled: false },
  activePk: null,
  sheet: null,
  settings,
}
const listeners = new Set<() => void>()

function set(patch: Partial<AppState>): void {
  state = { ...state, ...patch }
  for (const l of listeners) l()
}

export function getState(): AppState {
  return state
}

export function useApp(): AppState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => state,
  )
}

// ------------------------------------------------------------------ networking

let signaling: Signaling | null = null
let peers: PeerManager | null = null
const ignoredRequests = new Set<string>()
const lastTypingSent = new Map<string, number>()

function me(): Identity {
  return state.me!
}

function myCard(): ContactCard {
  return { v: 1, n: me().name, pk: me().pk, r: state.settings.relays, a: me().avatar }
}

export function myCode(): string {
  return encodeCard(myCard())
}

/** The QR holds a link, so a phone's own camera app can open it too. */
export function myLink(): string {
  return `${location.origin}${location.pathname}${location.search}#add=${myCode()}`
}

function start(): void {
  const contacts = store.loadContacts()
  const messages: Record<string, ChatMessage[]> = {}
  for (const c of contacts) messages[c.pk] = store.loadMessages(c.pk)
  set({ contacts, messages, unread: store.loadUnread() })

  signaling = new Signaling(me(), state.settings.relays, (from, signal) => void peers?.handleSignal(from, signal))
  peers = new PeerManager(me().pk, myCard, signaling, () => state.contacts, state.settings.iceServers, {
    onStatus: (pk, status) => {
      // When an open link drops, that's the last time we saw them.
      if (status === 'offline' && state.statuses[pk] === 'connected') touchLastSeen(pk)
      set({ statuses: { ...state.statuses, [pk]: status } })
    },
    onOpen: (pk) => {
      touchLastSeen(pk)
      // Bring them up to date on our name and character, then send anything queued.
      peers!.send(pk, { t: 'profile', n: me().name, a: me().avatar })
      flushOutbox(pk)
    },
    onMessage: handleWire,
    onContactRequest: (card) => {
      if (ignoredRequests.has(card.pk) || state.requests.some((r) => r.pk === card.pk)) return
      set({ requests: [...state.requests, card] })
      // Showing our code right now? The request appears there instead.
      if (state.sheet?.kind === 'add' && state.sheet.tab === 'code') return
      toast(`${card.n} wants to chat`, {
        description: 'They scanned your code. Add them back to connect.',
        action: { label: 'Add', onClick: () => actions.acceptRequest(card.pk) },
        duration: 10_000,
      })
    },
    onContactCard: (card) => updateProfile(card.pk, card.n, card.a),
  })
  signaling.start()
  peers.start()

  const refreshNet = () => {
    const relays = signaling?.connectedRelays() ?? 0
    const online = navigator.onLine
    const settled = state.net.settled || relays > 0 || performance.now() > 8_000
    const n = state.net
    if (n.relays !== relays || n.online !== online || n.settled !== settled) {
      set({ net: { ...n, relays, online, settled } })
    }
    // Typing indicators expire on their own.
    const now = Date.now()
    if (Object.values(state.typing).some((t) => t < now)) {
      set({ typing: Object.fromEntries(Object.entries(state.typing).filter(([, t]) => t >= now)) })
    }
  }
  setInterval(refreshNet, 1_000)
  window.addEventListener('online', () => {
    peers?.pokeAll()
    refreshNet()
  })
  window.addEventListener('offline', refreshNet)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return
    peers?.pokeAll()
    if (state.activePk) clearUnread(state.activePk)
  })
}

function touchLastSeen(pk: string): void {
  if (contactOf(pk)) patchContact(pk, { lastSeen: Date.now() })
}

// ------------------------------------------------------------------ contacts

function contactOf(pk: string | null | undefined): Contact | undefined {
  return state.contacts.find((c) => c.pk === pk)
}

function patchContact(pk: string, patch: Partial<Contact>): void {
  const contacts = state.contacts.map((c) => (c.pk === pk ? { ...c, ...patch } : c))
  store.saveContacts(contacts)
  set({ contacts })
}

function updateProfile(pk: string, name: unknown, avatar: unknown): void {
  const c = contactOf(pk)
  if (!c) return
  const n = cleanName(name)
  const a = isMascot(avatar) ? avatar : c.avatar
  if (c.name !== n || c.avatar !== a) patchContact(pk, { name: n, avatar: a })
}

function addCard(card: ContactCard): void {
  const existing = contactOf(card.pk)
  let contacts: Contact[]
  if (existing) {
    contacts = state.contacts.map((c) =>
      c.pk === card.pk ? { ...c, name: card.n, relays: card.r, avatar: card.a ?? c.avatar } : c,
    )
  } else {
    contacts = [...state.contacts, { pk: card.pk, name: card.n, relays: card.r, addedAt: Date.now(), avatar: card.a }]
  }
  store.saveContacts(contacts)
  set({
    contacts,
    requests: state.requests.filter((r) => r.pk !== card.pk),
    messages: { ...state.messages, [card.pk]: state.messages[card.pk] ?? store.loadMessages(card.pk) },
  })
  peers?.poke(card.pk)
}

// ------------------------------------------------------------------ messages

function setMessages(pk: string, list: ChatMessage[]): void {
  store.saveMessages(pk, list)
  set({ messages: { ...state.messages, [pk]: list } })
}

function transmit(pk: string, msg: ChatMessage): ChatMessage {
  const ok = peers?.send(pk, { t: 'msg', id: msg.id, text: msg.text, ts: msg.ts })
  return ok && msg.status === 'pending' ? { ...msg, status: 'sent' } : msg
}

/** On connect, (re)send everything not yet acknowledged. The receiver de-duplicates by id. */
function flushOutbox(pk: string): void {
  const list = state.messages[pk] ?? []
  if (!list.some((m) => m.dir === 'out' && m.status !== 'delivered')) return
  setMessages(
    pk,
    list.map((m) => (m.dir === 'out' && m.status !== 'delivered' ? transmit(pk, m) : m)),
  )
}

function handleWire(pk: string, wire: WireMessage): void {
  const list = state.messages[pk] ?? []
  switch (wire.t) {
    case 'msg': {
      if (typeof wire.id !== 'string' || typeof wire.text !== 'string') return
      if (!list.some((m) => m.id === wire.id)) {
        setMessages(pk, [...list, { id: wire.id, dir: 'in', text: wire.text.slice(0, MAX_TEXT), ts: Date.now() }])
        const { [pk]: _, ...typing } = state.typing
        set({ typing })
        const seen = pk === state.activePk && document.visibilityState === 'visible'
        if (!seen) {
          setUnread(pk, (state.unread[pk] ?? 0) + 1)
          notify(pk, wire.text)
        }
      }
      peers?.send(pk, { t: 'ack', id: wire.id })
      return
    }
    case 'ack': {
      const i = list.findIndex((m) => m.id === wire.id && m.dir === 'out')
      if (i < 0 || list[i].status === 'delivered') return
      setMessages(pk, list.with(i, { ...list[i], status: 'delivered' }))
      return
    }
    case 'profile':
      return updateProfile(pk, wire.n, wire.a)
    case 'typing':
      set({ typing: { ...state.typing, [pk]: Date.now() + TYPING_TTL_MS } })
      return
  }
}

function setUnread(pk: string, n: number): void {
  const { [pk]: _, ...rest } = state.unread
  const unread = n > 0 ? { ...rest, [pk]: n } : rest
  store.saveUnread(unread)
  set({ unread })
  const total = Object.values(unread).reduce((a, b) => a + b, 0)
  document.title = total ? `(${total}) Messenger` : 'Messenger'
}

function clearUnread(pk: string): void {
  if (state.unread[pk]) setUnread(pk, 0)
}

function notify(pk: string, text: string): void {
  if (!state.settings.notifications || typeof Notification === 'undefined') return
  if (Notification.permission !== 'granted' || document.visibilityState === 'visible') return
  const c = contactOf(pk)
  if (!c) return
  const n = new Notification(c.name, { body: text.slice(0, 140), tag: pk, icon: '/favicon.svg' })
  n.onclick = () => {
    window.focus()
    actions.openChat(pk)
    n.close()
  }
}

// ------------------------------------------------------------------ navigation
// On narrow screens, opening a chat pushes a history entry so swipe-back (iOS) and the
// back button (Android, desktop) return to the list.

const wide = window.matchMedia('(min-width: 768px)')

window.addEventListener('popstate', () => {
  const pk = history.state?.chat
  if (wide.matches) return
  set({ activePk: pk && contactOf(pk) ? pk : null })
})

// ------------------------------------------------------------------ actions

export const actions = {
  /** First run: make the identity with the chosen name and character. */
  createProfile(name: string, avatar: string, pending: Identity): void {
    const id: Identity = { ...pending, name: cleanName(name), avatar }
    store.saveIdentity(id)
    set({ me: id })
    start()
    // They arrived through someone's invite link: pick up where that left off.
    const link = sessionStorage.getItem('p2pmsg:pending-add')
    if (link) {
      sessionStorage.removeItem('p2pmsg:pending-add')
      set({ sheet: { kind: 'add', tab: 'scan', prefill: link } })
    }
  },

  newIdentity(): Identity {
    return createIdentity('')
  },

  boot(): void {
    if (state.me) start()
  },

  updateMe(name: string, avatar: string): void {
    const id = { ...me(), name: cleanName(name), avatar }
    store.saveIdentity(id)
    set({ me: id })
    // Tell everyone connected now; the rest hear it on their next hello.
    for (const c of state.contacts) peers?.send(c.pk, { t: 'profile', n: id.name, a: id.avatar })
  },

  openChat(pk: string): void {
    if (!wide.matches) {
      if (history.state?.chat) history.replaceState({ chat: pk }, '')
      else history.pushState({ chat: pk }, '')
    }
    set({ activePk: pk, sheet: null })
    clearUnread(pk)
  },

  closeChat(): void {
    if (history.state?.chat) history.back()
    else set({ activePk: null })
  },

  openSheet(sheet: Sheet): void {
    set({ sheet })
  },

  closeSheet(): void {
    set({ sheet: null })
  },

  /** Check a pasted or scanned code. Returns the card, or a message saying what's wrong. */
  checkCode(input: string): { card: ContactCard; known: boolean } | { error: string } {
    try {
      const card = decodeCard(input)
      if (card.pk === me().pk) return { error: "That's your own code. Scan your contact's code instead." }
      return { card, known: !!contactOf(card.pk) }
    } catch {
      return { error: 'That isn’t a contact code. Codes and invite links contain “p2pmsg:”.' }
    }
  },

  addContact(card: ContactCard): void {
    const known = !!contactOf(card.pk)
    addCard(card)
    actions.openChat(card.pk)
    if (!known) {
      toast.success(`${card.n} added`, {
        description: `You’ll connect once ${card.n} adds you back and is online.`,
      })
    }
  },

  acceptRequest(pk: string): void {
    const card = state.requests.find((r) => r.pk === pk)
    if (!card) return
    addCard(card)
    actions.openChat(pk)
    toast.success(`${card.n} added`)
  },

  ignoreRequest(pk: string): void {
    ignoredRequests.add(pk)
    set({ requests: state.requests.filter((r) => r.pk !== pk) })
  },

  removeContact(pk: string): void {
    const name = contactOf(pk)?.name
    const contacts = state.contacts.filter((c) => c.pk !== pk)
    store.saveContacts(contacts)
    store.deleteMessages(pk)
    peers?.disconnect(pk)
    const { [pk]: _m, ...messages } = state.messages
    set({ contacts, messages, sheet: null })
    setUnread(pk, 0)
    if (state.activePk === pk) {
      if (history.state?.chat) history.back()
      set({ activePk: null })
    }
    if (name) toast(`${name} removed`)
  },

  clearHistory(pk: string): void {
    setMessages(pk, [])
    toast('Chat history cleared')
  },

  setVerified(pk: string, verified: boolean): void {
    patchContact(pk, { verified })
  },

  send(pk: string, raw: string): void {
    const text = raw.trim().slice(0, MAX_TEXT)
    if (!text) return
    const msg = transmit(pk, { id: uid(), dir: 'out', text, ts: Date.now(), status: 'pending' })
    lastTypingSent.delete(pk)
    setMessages(pk, [...(state.messages[pk] ?? []), msg])
  },

  /** Called as people type; tells the contact at most every few seconds. */
  typing(pk: string): void {
    const now = Date.now()
    if (now - (lastTypingSent.get(pk) ?? 0) < TYPING_SEND_EVERY_MS) return
    if (peers?.send(pk, { t: 'typing' })) lastTypingSent.set(pk, now)
  },

  /** Send a waiting message again now (resets the connection attempt). */
  retry(pk: string): void {
    peers?.poke(pk)
  },

  deleteMessage(pk: string, id: string): void {
    setMessages(
      pk,
      (state.messages[pk] ?? []).filter((m) => m.id !== id),
    )
  },

  async setNotifications(on: boolean): Promise<void> {
    if (on && typeof Notification !== 'undefined' && Notification.permission !== 'granted') {
      const result = await Notification.requestPermission()
      if (result !== 'granted') {
        toast.error('Notifications are blocked', { description: 'Allow them for this site in your browser settings.' })
        on = false
      }
    }
    store.saveSettings({ notifications: on })
    set({ settings: { ...state.settings, notifications: on } })
  },

  eraseDevice(): void {
    peers?.stop()
    signaling?.stop()
    store.eraseAll()
    location.replace(location.pathname + location.search)
  },
}

export function statusOf(pk: string): PeerStatus {
  return state.statuses[pk] ?? 'offline'
}
