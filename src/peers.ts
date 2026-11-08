// WebRTC connection management: one RTCPeerConnection + data channel per contact.
//
// Handshake (all messages go through Signaling):
//   1. A peer that is not connected periodically sends `hello` to each contact.
//   2. Roles are fixed by comparing public keys, so both sides never offer at once:
//      the smaller key is the "initiator" and makes the offer.
//      - initiator gets hello      -> sends offer
//      - non-initiator gets hello  -> replies hello (reply: true), prompting an offer
//   3. Non-initiator answers; ICE runs; the data channel opens.
// ICE candidates are gathered fully before sending (no trickle), so a connection
// takes exactly one offer and one answer.

import type { ContactCard } from './identity'
import type { Signal, Signaling } from './signaling'
import type { Contact } from './store'
import { uid } from './uid'

export type PeerStatus = 'offline' | 'connecting' | 'connected'

export type WireMessage =
  | { t: 'msg'; id: string; text: string; ts: number }
  | { t: 'ack'; id: string }
  | { t: 'profile'; n: string; a?: string }

interface Session {
  pc: RTCPeerConnection
  dc: RTCDataChannel
  sid: string
  startedAt: number
  connectedAt?: number
  disconnectTimer?: ReturnType<typeof setTimeout>
}

export interface PeerCallbacks {
  onStatus(pk: string, status: PeerStatus): void
  onOpen(pk: string): void
  onMessage(pk: string, msg: WireMessage): void
  /** A hello from someone who isn't in our contacts (they added us). */
  onContactRequest(card: ContactCard): void
  /** A contact's current name/avatar, carried on every hello. */
  onContactCard(card: ContactCard): void
}

const HELLO_INTERVAL_MS = 20_000
const CONNECT_TIMEOUT_MS = 25_000
const OFFER_RETRY_MS = 8_000
const ICE_GATHER_TIMEOUT_MS = 4_000
const DISCONNECT_GRACE_MS = 6_000

export class PeerManager {
  private sessions = new Map<string, Session>()
  private statuses = new Map<string, PeerStatus>()
  private timer?: ReturnType<typeof setInterval>

  constructor(
    private myPk: string,
    private myCard: () => ContactCard,
    private signaling: Signaling,
    private contacts: () => Contact[],
    private iceServers: RTCIceServer[],
    private cb: PeerCallbacks,
  ) {}

  start(): void {
    this.tick()
    this.timer = setInterval(() => this.tick(), HELLO_INTERVAL_MS)
  }

  stop(): void {
    clearInterval(this.timer)
    for (const pk of [...this.sessions.keys()]) this.teardown(pk, false)
  }

  status(pk: string): PeerStatus {
    return this.statuses.get(pk) ?? 'offline'
  }

  /** Send over the data channel. Returns false if not connected. */
  send(pk: string, msg: WireMessage): boolean {
    const s = this.sessions.get(pk)
    if (!s || s.dc.readyState !== 'open') return false
    try {
      s.dc.send(JSON.stringify(msg))
      return true
    } catch {
      return false
    }
  }

  /** Try to reach a contact now (e.g. just added, or the network came back). */
  poke(pk: string): void {
    if (!this.sessions.has(pk)) void this.sendHello(pk, false)
  }

  pokeAll(): void {
    for (const c of this.contacts()) this.poke(c.pk)
  }

  disconnect(pk: string): void {
    this.teardown(pk, false)
    this.statuses.delete(pk)
  }

  async handleSignal(from: string, signal: Signal): Promise<void> {
    const contact = this.contact(from)
    if (!contact) {
      if (signal.t === 'hello' && signal.card?.pk === from) this.cb.onContactRequest(signal.card)
      return
    }
    try {
      switch (signal.t) {
        case 'hello':
          if (signal.card?.pk === from) this.cb.onContactCard(signal.card)
          return this.onHello(from, !!signal.reply)
        case 'offer':
          return await this.onOffer(from, signal.sid, signal.sdp)
        case 'answer':
          return await this.onAnswer(from, signal.sid, signal.sdp)
      }
    } catch (err) {
      console.warn('[peers] signal handling failed', signal.t, err)
      this.teardown(from, true)
    }
  }

  // ---------------------------------------------------------------- handshake

  private isInitiator(pk: string): boolean {
    return this.myPk < pk
  }

  private onHello(pk: string, isReply: boolean): void {
    if (!this.isInitiator(pk)) {
      // Let the initiator know we're here; it will send an offer.
      if (!isReply) void this.sendHello(pk, true)
      return
    }
    const s = this.sessions.get(pk)
    const now = Date.now()
    // A hello means the peer has no connection to us. Start one, unless an attempt
    // is already under way or a connection has only just come up (stray hello).
    // (A non-initiator stops saying hello once it has our offer, so a hello arriving
    // well after we sent one means the offer was lost.)
    if (s && !s.connectedAt && now - s.startedAt < OFFER_RETRY_MS) return
    if (s?.connectedAt && now - s.connectedAt < 5_000) return
    void this.startOffer(pk)
  }

  private async startOffer(pk: string): Promise<void> {
    const s = this.createSession(pk, uid())
    await s.pc.setLocalDescription(await s.pc.createOffer())
    await waitForIce(s.pc)
    if (!this.isCurrent(pk, s)) return
    await this.signaling.send(pk, this.contact(pk)?.relays ?? [], {
      t: 'offer',
      sid: s.sid,
      sdp: s.pc.localDescription!.sdp,
    })
  }

  private async onOffer(pk: string, sid: string, sdp: string): Promise<void> {
    if (this.isInitiator(pk)) return // roles are fixed; ignore
    // A new offer always replaces whatever we had: the peer has restarted or lost us.
    const s = this.createSession(pk, sid)
    await s.pc.setRemoteDescription({ type: 'offer', sdp })
    await s.pc.setLocalDescription(await s.pc.createAnswer())
    await waitForIce(s.pc)
    if (!this.isCurrent(pk, s)) return
    await this.signaling.send(pk, this.contact(pk)?.relays ?? [], {
      t: 'answer',
      sid,
      sdp: s.pc.localDescription!.sdp,
    })
  }

  private async onAnswer(pk: string, sid: string, sdp: string): Promise<void> {
    const s = this.sessions.get(pk)
    if (!s || s.sid !== sid || s.pc.signalingState !== 'have-local-offer') return
    await s.pc.setRemoteDescription({ type: 'answer', sdp })
  }

  private sendHello(pk: string, reply: boolean): Promise<boolean> {
    const relays = this.contact(pk)?.relays ?? []
    return this.signaling.send(pk, relays, { t: 'hello', reply, card: this.myCard() })
  }

  // ----------------------------------------------------------------- sessions

  private createSession(pk: string, sid: string): Session {
    this.teardown(pk, false)
    const pc = new RTCPeerConnection({ iceServers: this.iceServers })
    // Pre-negotiated channel: both sides create it with the same id, no ondatachannel needed.
    const dc = pc.createDataChannel('chat', { negotiated: true, id: 0, ordered: true })
    const s: Session = { pc, dc, sid, startedAt: Date.now() }
    this.sessions.set(pk, s)
    this.setStatus(pk, 'connecting')

    dc.onopen = () => {
      if (!this.isCurrent(pk, s)) return
      s.connectedAt = Date.now()
      this.setStatus(pk, 'connected')
      this.cb.onOpen(pk)
    }
    dc.onclose = () => {
      if (this.isCurrent(pk, s)) this.teardown(pk, true)
    }
    dc.onmessage = (e) => {
      let msg: WireMessage
      try {
        msg = JSON.parse(String(e.data))
      } catch {
        return
      }
      if (this.isCurrent(pk, s)) this.cb.onMessage(pk, msg)
    }
    pc.onconnectionstatechange = () => {
      if (!this.isCurrent(pk, s)) return
      const state = pc.connectionState
      if (state === 'failed' || state === 'closed') {
        this.teardown(pk, true)
      } else if (state === 'disconnected') {
        // Often recovers on its own (brief network blip); give it a moment.
        clearTimeout(s.disconnectTimer)
        s.disconnectTimer = setTimeout(() => {
          if (this.isCurrent(pk, s) && pc.connectionState !== 'connected') this.teardown(pk, true)
        }, DISCONNECT_GRACE_MS)
      } else if (state === 'connected') {
        clearTimeout(s.disconnectTimer)
      }
    }
    return s
  }

  private teardown(pk: string, reconnect: boolean): void {
    const s = this.sessions.get(pk)
    if (!s) return
    this.sessions.delete(pk)
    clearTimeout(s.disconnectTimer)
    s.dc.onopen = s.dc.onclose = s.dc.onmessage = null
    s.pc.onconnectionstatechange = null
    try {
      s.pc.close()
    } catch {
      /* already closed */
    }
    this.setStatus(pk, 'offline')
    if (reconnect && this.contact(pk)) setTimeout(() => this.poke(pk), 1_000)
  }

  private tick(): void {
    const now = Date.now()
    for (const c of this.contacts()) {
      const s = this.sessions.get(c.pk)
      if (s && !s.connectedAt && now - s.startedAt > CONNECT_TIMEOUT_MS) this.teardown(c.pk, false)
      if (!this.sessions.has(c.pk)) void this.sendHello(c.pk, false)
    }
  }

  private isCurrent(pk: string, s: Session): boolean {
    return this.sessions.get(pk) === s
  }

  private contact(pk: string): Contact | undefined {
    return this.contacts().find((c) => c.pk === pk)
  }

  private setStatus(pk: string, status: PeerStatus): void {
    if (this.statuses.get(pk) === status) return
    this.statuses.set(pk, status)
    this.cb.onStatus(pk, status)
  }
}

function waitForIce(pc: RTCPeerConnection): Promise<void> {
  return new Promise((resolve) => {
    if (pc.iceGatheringState === 'complete') return resolve()
    const done = () => {
      clearTimeout(timer)
      pc.removeEventListener('icegatheringstatechange', onChange)
      resolve()
    }
    const onChange = () => pc.iceGatheringState === 'complete' && done()
    const timer = setTimeout(done, ICE_GATHER_TIMEOUT_MS)
    pc.addEventListener('icegatheringstatechange', onChange)
  })
}
