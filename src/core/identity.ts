import { generateSecretKey, getPublicKey } from 'nostr-tools/pure'
import { bytesToHex, hexToBytes, isHex32 } from 'nostr-tools/utils'
import { defaultMascot, isMascot } from './avatars'

export interface Identity {
  sk: Uint8Array
  pk: string // hex public key — this is the user's permanent ID
  name: string
  avatar: string // mascot id
}

/** What a QR code / contact code carries. */
export interface ContactCard {
  v: 1
  n: string // display name
  pk: string // hex public key
  r: string[] // relays this user listens on for signaling
  a?: string // mascot id
}

const CODE_PREFIX = 'p2pmsg:'
const MAX_NAME = 40

export function createIdentity(name: string): Identity {
  const sk = generateSecretKey()
  const pk = getPublicKey(sk)
  return { sk, pk, name: cleanName(name), avatar: defaultMascot(pk) }
}

export function serializeIdentity(id: Identity): string {
  return JSON.stringify({ sk: bytesToHex(id.sk), name: id.name, avatar: id.avatar })
}

export function deserializeIdentity(raw: string): Identity | null {
  try {
    const { sk, name, avatar } = JSON.parse(raw)
    const bytes = hexToBytes(sk)
    const pk = getPublicKey(bytes)
    return { sk: bytes, pk, name: cleanName(name), avatar: isMascot(avatar) ? avatar : defaultMascot(pk) }
  } catch {
    return null
  }
}

export function cleanName(name: unknown): string {
  return String(name ?? '').trim().slice(0, MAX_NAME) || 'Anonymous'
}

export function encodeCard(card: ContactCard): string {
  const bytes = new TextEncoder().encode(JSON.stringify(card))
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return CODE_PREFIX + btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Accepts a bare code or a link containing `#add=<code>`. Throws on invalid input. */
export function decodeCard(input: string): ContactCard {
  let code = input.trim()
  const hashIdx = code.indexOf('#add=')
  if (hashIdx >= 0) code = decodeURIComponent(code.slice(hashIdx + 5))
  if (!code.startsWith(CODE_PREFIX)) throw new Error('Not a contact code')
  const b64 = code.slice(CODE_PREFIX.length).replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(b64)
  const card = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))))
  return validateCard(card)
}

export function validateCard(card: any): ContactCard {
  if (!card || card.v !== 1 || typeof card.pk !== 'string' || !isHex32(card.pk)) {
    throw new Error('Invalid contact code')
  }
  const relays = Array.isArray(card.r)
    ? card.r.filter((u: unknown) => typeof u === 'string' && /^wss?:\/\//.test(u)).slice(0, 8)
    : []
  return { v: 1, n: cleanName(card.n), pk: card.pk.toLowerCase(), r: relays, a: isMascot(card.a) ? card.a : undefined }
}

export function shortKey(pk: string): string {
  return `${pk.slice(0, 6)}…${pk.slice(-4)}`
}
