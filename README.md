# P2P Messenger

Browser messenger where chats go **directly between devices** over WebRTC. No account and no server
of our own. Contacts pair by scanning a QR code (or pasting a code).

```bash
npm install
npm run dev        # http://localhost:5173 (desktop; paste codes instead of scanning)
npm run dev:lan    # HTTPS on your LAN, so phones can open it and use the camera
```

To try two users in one browser, open a second tab with `?profile=bob`.

## How it works

| Piece | What it does |
|---|---|
| **Identity** (`src/identity.ts`) | A secp256k1 keypair made on first launch. The public key is your permanent ID. |
| **Contact code / QR** | `{name, public key, relays}`. Adding someone stores this locally. |
| **Signaling** (`src/signaling.ts`) | WebRTC needs to swap an offer/answer (current IPs) before connecting. These go through **public Nostr relays** as ephemeral events, **encrypted to the recipient** (NIP-44) and **signed by the sender**. Relays never see contents and never carry chat messages. |
| **Connection** (`src/peers.ts`) | One `RTCPeerConnection` + data channel per contact. Offline peers send `hello` every 20s; the peer with the smaller key makes the offer, so both sides never offer at once. |
| **Messages** (`src/main.ts`) | Sent over the data channel (DTLS-encrypted). Unacknowledged messages are queued on the sender and resent on reconnect; receivers deduplicate by id. |

**Why relays can't intercept:** the SDP inside each signed offer/answer contains the DTLS
certificate fingerprint, so the WebRTC connection is bound to the contact's key.

## Limits

- **Both people must be online at the same time** for a message to move. Until then it waits on the sender's device ("waiting" → ✓ sent → ✓✓ delivered).
- **Some networks block direct connections** (symmetric NAT on some mobile carriers, strict corporate firewalls). Fixing that needs a TURN relay. Add one to `iceServers` in `src/store.ts` if needed.
- **Uses third-party infrastructure:** public STUN servers (Google, Cloudflare) to discover your public IP, and public Nostr relays for signaling. You don't run anything, and any single relay going down is fine.
- **Contacts see each other's IP address** (inherent to direct connections).
- **The secret key and chat history are stored unencrypted in `localStorage`.** Clearing site data deletes your identity.
- One device per identity. Opening the same identity in two places will make them fight over the connection.

## Design

The UI follows the **Share** app's design language (`~/projects/share/ui`): its grey-green palette and
Apple-blue actions, Inter + IBM Plex Mono, concentric radii, grouped white cards on the window ground,
tinted status capsules, and Phosphor icons. Avatars are characters from
[page-mascot](https://github.com/nilbuild/page-mascot) (MIT, © 2026 Kamran Ahmed; licence in
`public/mascots/LICENSE`), the same set Share uses. Your chosen character and name travel in your contact
code and are re-sent to contacts whenever you connect.
