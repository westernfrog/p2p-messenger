// Persistence in localStorage. Everything stays on this device.

import { deserializeIdentity, serializeIdentity, type Identity } from './identity'

export interface Contact {
  pk: string
  name: string
  relays: string[]
  addedAt: number
  avatar?: string // mascot id they chose
}

export type MessageStatus = 'pending' | 'sent' | 'delivered'

export interface ChatMessage {
  id: string
  dir: 'in' | 'out'
  text: string
  ts: number
  status?: MessageStatus // outgoing only
}

export interface Settings {
  relays: string[]
  iceServers: RTCIceServer[]
}

export const DEFAULT_SETTINGS: Settings = {
  // Public relays only pass signaling (encrypted offers/answers), never chat messages.
  // Several are used because any given public relay is often down or rate-limiting.
  relays: [
    'wss://nos.lol',
    'wss://nostr.mom',
    'wss://relay.snort.social',
    'wss://offchain.pub',
    'wss://nostr.oxtr.dev',
    'wss://relay.nostr.net',
    'wss://relay.damus.io',
  ],
  iceServers: [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] }],
}

// Optional namespace so two identities can run side by side in one browser (`?profile=bob`).
const ns = new URLSearchParams(location.search).get('profile') ?? ''
const key = (k: string) => (ns ? `p2pmsg:${ns}:${k}` : `p2pmsg:${k}`)

function read<T>(k: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key(k))
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function write(k: string, value: unknown): void {
  localStorage.setItem(key(k), JSON.stringify(value))
}

export function loadIdentity(): Identity | null {
  const raw = localStorage.getItem(key('identity'))
  return raw ? deserializeIdentity(raw) : null
}

export function saveIdentity(id: Identity): void {
  localStorage.setItem(key('identity'), serializeIdentity(id))
}

export function loadSettings(): Settings {
  return { ...DEFAULT_SETTINGS, ...read<Partial<Settings>>('settings', {}) }
}

export function loadContacts(): Contact[] {
  return read<Contact[]>('contacts', [])
}

export function saveContacts(contacts: Contact[]): void {
  write('contacts', contacts)
}

export function loadMessages(pk: string): ChatMessage[] {
  return read<ChatMessage[]>(`messages:${pk}`, [])
}

export function saveMessages(pk: string, messages: ChatMessage[]): void {
  write(`messages:${pk}`, messages)
}

export function deleteMessages(pk: string): void {
  localStorage.removeItem(key(`messages:${pk}`))
}
