// Signaling over public Nostr relays.
//
// WebRTC peers must swap an offer/answer (which carry their current network
// addresses) before they can connect. We post those as Nostr events:
//   - ephemeral kind, so relays forward them but don't store them
//   - content encrypted to the recipient with NIP-44, so relays can't read them
//   - signed with the sender's key, so they can't be forged — which also
//     authenticates the DTLS fingerprint inside the SDP, so a relay can't MITM
//     the WebRTC connection.

import { SimplePool } from 'nostr-tools/pool'
import { finalizeEvent, type Event } from 'nostr-tools/pure'
import * as nip44 from 'nostr-tools/nip44'
import type { ContactCard, Identity } from './identity'

export const SIGNAL_KIND = 25050 // 20000–29999 = ephemeral (NIP-01)
const MAX_AGE_S = 120

export type Signal =
  | { t: 'hello'; reply?: boolean; card: ContactCard }
  | { t: 'offer'; sid: string; sdp: string }
  | { t: 'answer'; sid: string; sdp: string }

const now = () => Math.floor(Date.now() / 1000)

export class Signaling {
  private pool = new SimplePool({ enablePing: true, enableReconnect: true })
  private convKeys = new Map<string, Uint8Array>()
  private seen = new Set<string>()
  private sub?: { close: () => void }

  constructor(
    private me: Identity,
    readonly relays: string[],
    private onSignal: (from: string, signal: Signal) => void,
  ) {}

  start(): void {
    this.sub = this.pool.subscribeMany(
      this.relays,
      { kinds: [SIGNAL_KIND], '#p': [this.me.pk], since: now() - 30 },
      { onevent: (ev) => this.handle(ev) },
    )
  }

  stop(): void {
    this.sub?.close()
    this.pool.destroy()
  }

  /** Number of relays currently connected. */
  connectedRelays(): number {
    let n = 0
    for (const [url, ok] of this.pool.listConnectionStatus()) if (ok && this.relays.includes(url.replace(/\/$/, ''))) n++
    return n
  }

  async send(to: string, toRelays: string[], signal: Signal): Promise<boolean> {
    const ev = finalizeEvent(
      {
        kind: SIGNAL_KIND,
        created_at: now(),
        tags: [['p', to]],
        content: nip44.encrypt(JSON.stringify(signal), this.convKey(to)),
      },
      this.me.sk,
    )
    // Publish to our relays and theirs, so it arrives even if they use different ones.
    const targets = [...new Set([...this.relays, ...toRelays])]
    const results = await Promise.allSettled(this.pool.publish(targets, ev))
    return results.some((r) => r.status === 'fulfilled')
  }

  private handle(ev: Event): void {
    // The pool has already verified the signature.
    if (ev.pubkey === this.me.pk || this.seen.has(ev.id)) return
    if (Math.abs(now() - ev.created_at) > MAX_AGE_S) return // stale or replayed
    this.seen.add(ev.id)
    if (this.seen.size > 2000) this.seen = new Set([...this.seen].slice(-1000))

    let signal: Signal
    try {
      signal = JSON.parse(nip44.decrypt(ev.content, this.convKey(ev.pubkey)))
    } catch {
      return
    }
    if (!signal || typeof signal.t !== 'string') return
    this.onSignal(ev.pubkey, signal)
  }

  private convKey(pk: string): Uint8Array {
    let k = this.convKeys.get(pk)
    if (!k) {
      k = nip44.getConversationKey(this.me.sk, pk)
      this.convKeys.set(pk, k)
    }
    return k
  }
}
