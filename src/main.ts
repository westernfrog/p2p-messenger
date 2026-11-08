import '@fontsource-variable/inter/opsz.css'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'
import './style.css'

import { avatarHtml, isMascot, MASCOTS, mascotUrl } from './avatars'
import { createIdentity, cleanName, decodeCard, encodeCard, shortKey, type ContactCard, type Identity } from './identity'
import { hydrateIcons, icon, type IconName } from './icons'
import { keyPattern, safetyNumber } from './keyart'
import { markSvg } from './mark'
import { PeerManager, type PeerStatus, type WireMessage } from './peers'
import { renderQr, startScanner } from './qr'
import { Signaling } from './signaling'
import * as store from './store'
import type { ChatMessage, Contact } from './store'
import { uid } from './uid'

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T
const wide = window.matchMedia('(min-width: 768px)')

// ------------------------------------------------------------------- state

let me: Identity
let contacts: Contact[] = []
let activePk: string | null = null
let detailsPk: string | null = null
let query = ''
let signaling: Signaling
let peers: PeerManager
let startedAt = 0
const settings = store.loadSettings()
const messageCache = new Map<string, ChatMessage[]>()
const unread = new Map<string, number>()
const requests = new Map<string, ContactCard>() // people who added us
const ignoredRequests = new Set<string>()

// ------------------------------------------------------------------- boot
// Called at the bottom of this module, after every constant is initialised.

function boot(): void {
  hydrateIcons()
  for (const el of document.querySelectorAll<HTMLElement>('[data-mark]')) el.outerHTML = markSvg(Number(el.dataset.mark))
  trackViewportHeight()

  const existing = store.loadIdentity()
  if (existing) return startApp(existing)

  // Make the key now; the person picks a name and a character for it.
  const pending = createIdentity('')
  $('onboarding').hidden = false
  const preview = () => ($('onboarding-avatar').innerHTML = avatarHtml(pending.pk, pending.avatar, 64))
  preview()
  renderPicker($('onboarding-picker'), pending.avatar, (id) => {
    pending.avatar = id
    preview()
  })
  $<HTMLFormElement>('onboarding-form').addEventListener('submit', (e) => {
    e.preventDefault()
    pending.name = cleanName($<HTMLInputElement>('onboarding-name').value)
    store.saveIdentity(pending)
    $('onboarding').hidden = true
    startApp(pending)
  })
  if (window.matchMedia('(pointer: fine)').matches) $<HTMLInputElement>('onboarding-name').focus()
}

function startApp(identity: Identity): void {
  me = identity
  contacts = store.loadContacts()
  startedAt = Date.now()
  $('app').hidden = false

  signaling = new Signaling(me, settings.relays, (from, signal) => void peers.handleSignal(from, signal))
  peers = new PeerManager(me.pk, myCard, signaling, () => contacts, settings.iceServers, {
    onStatus: (pk) => {
      renderContacts()
      if (pk === activePk) {
        renderChatHeader()
        renderMessages()
      }
      if (pk === detailsPk) renderContactSheet()
    },
    onOpen: (pk) => {
      // Bring them up to date on our name and character, then send anything queued.
      peers.send(pk, { t: 'profile', n: me.name, a: me.avatar })
      flushOutbox(pk)
    },
    onMessage: handleWireMessage,
    onContactRequest: (card) => {
      if (ignoredRequests.has(card.pk) || requests.has(card.pk)) return
      requests.set(card.pk, card)
      renderRequests()
    },
    onContactCard: (card) => updateContactProfile(card.pk, card.n, card.a),
  })
  signaling.start()
  peers.start()

  window.addEventListener('online', () => {
    peers.pokeAll()
    renderNetwork()
  })
  window.addEventListener('offline', renderNetwork)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return
    peers.pokeAll()
    if (activePk) clearUnread(activePk)
  })
  setInterval(renderNetwork, 2_000)

  bindUi()
  renderMe()
  renderNetwork()
  renderContacts()
  if (wide.matches && contacts.length) openChat(sortedContacts()[0].pk)

  // Opened from a QR link (`#add=…`): go straight to adding that contact.
  if (location.hash.startsWith('#add=')) {
    const link = location.href
    history.replaceState(null, '', location.pathname + location.search)
    openAddSheet(link)
  }
}

function myCard(): ContactCard {
  return { v: 1, n: me.name, pk: me.pk, r: settings.relays, a: me.avatar }
}

// ------------------------------------------------------------------- contacts

function addContact(card: ContactCard): void {
  const existingContact = contacts.find((c) => c.pk === card.pk)
  if (existingContact) {
    existingContact.name = card.n
    existingContact.relays = card.r
    if (card.a) existingContact.avatar = card.a
  } else {
    contacts.push({ pk: card.pk, name: card.n, relays: card.r, addedAt: Date.now(), avatar: card.a })
  }
  store.saveContacts(contacts)
  requests.delete(card.pk)
  renderRequests()
  renderContacts()
  peers.poke(card.pk)
}

function updateContactProfile(pk: string, name: unknown, avatar: unknown): void {
  const c = contactOf(pk)
  if (!c) return
  const n = cleanName(name)
  const a = isMascot(avatar) ? avatar : c.avatar
  if (c.name === n && c.avatar === a) return
  c.name = n
  c.avatar = a
  store.saveContacts(contacts)
  renderContacts()
  if (pk === activePk) {
    renderChatHeader()
    renderMessages()
  }
  if (pk === detailsPk) renderContactSheet()
}

function removeContact(pk: string): void {
  contacts = contacts.filter((c) => c.pk !== pk)
  store.saveContacts(contacts)
  store.deleteMessages(pk)
  messageCache.delete(pk)
  unread.delete(pk)
  peers.disconnect(pk)
  if (activePk === pk) closeChat()
  renderContacts()
}

function contactOf(pk: string | null): Contact | undefined {
  return contacts.find((c) => c.pk === pk)
}

function lastActivity(c: Contact): number {
  return messages(c.pk).at(-1)?.ts ?? c.addedAt
}

function sortedContacts(): Contact[] {
  return [...contacts].sort((a, b) => lastActivity(b) - lastActivity(a))
}

// ------------------------------------------------------------------- messages

function messages(pk: string): ChatMessage[] {
  let list = messageCache.get(pk)
  if (!list) {
    list = store.loadMessages(pk)
    messageCache.set(pk, list)
  }
  return list
}

function persist(pk: string): void {
  store.saveMessages(pk, messages(pk))
}

function sendText(pk: string, text: string): void {
  const msg: ChatMessage = { id: uid(), dir: 'out', text, ts: Date.now(), status: 'pending' }
  messages(pk).push(msg)
  transmit(pk, msg)
  persist(pk)
  renderMessages(true)
  renderContacts()
}

function transmit(pk: string, msg: ChatMessage): void {
  const ok = peers.send(pk, { t: 'msg', id: msg.id, text: msg.text, ts: msg.ts })
  if (ok && msg.status === 'pending') msg.status = 'sent'
}

/** On connect, (re)send everything not yet acknowledged. The receiver de-duplicates by id. */
function flushOutbox(pk: string): void {
  let changed = false
  for (const msg of messages(pk)) {
    if (msg.dir === 'out' && msg.status !== 'delivered') {
      transmit(pk, msg)
      changed = true
    }
  }
  if (changed) {
    persist(pk)
    if (pk === activePk) renderMessages()
  }
}

function handleWireMessage(pk: string, wire: WireMessage): void {
  const list = messages(pk)
  if (wire.t === 'msg') {
    if (typeof wire.id !== 'string' || typeof wire.text !== 'string') return
    if (!list.some((m) => m.id === wire.id)) {
      list.push({ id: wire.id, dir: 'in', text: wire.text.slice(0, 4000), ts: Date.now() })
      persist(pk)
      const seen = pk === activePk && document.visibilityState === 'visible'
      if (!seen) unread.set(pk, (unread.get(pk) ?? 0) + 1)
      if (pk === activePk) renderMessages()
      renderContacts()
    }
    peers.send(pk, { t: 'ack', id: wire.id })
  } else if (wire.t === 'ack') {
    const msg = list.find((m) => m.id === wire.id && m.dir === 'out')
    if (msg && msg.status !== 'delivered') {
      msg.status = 'delivered'
      persist(pk)
      if (pk === activePk) renderMessages()
    }
  } else if (wire.t === 'profile') {
    updateContactProfile(pk, wire.n, wire.a)
  }
}

function clearUnread(pk: string): void {
  if (unread.delete(pk)) renderContacts()
}

// ------------------------------------------------------------------- navigation
// Opening a chat pushes a history entry, so swipe-back (iOS) and the back
// button (Android, desktop) return to the list.

function openChat(pk: string): void {
  if (!wide.matches) {
    if (history.state?.chat) history.replaceState({ chat: pk }, '')
    else history.pushState({ chat: pk }, '')
  }
  showChat(pk)
}

function closeChat(): void {
  if (history.state?.chat) history.back()
  else showChat(null)
}

window.addEventListener('popstate', () => {
  const pk = history.state?.chat
  showChat(pk && contactOf(pk) ? pk : wide.matches ? activePk : null)
})

function showChat(pk: string | null): void {
  activePk = pk
  $('app').classList.toggle('chat-open', !!pk)
  $('chat-empty').hidden = !!pk
  $('chat-view').hidden = !pk
  renderContacts()
  if (!pk) return
  clearUnread(pk)
  renderChatHeader()
  renderMessages(true)
  if (wide.matches) $('msg-input').focus()
}

// ------------------------------------------------------------------- sheets

function openSheet(dialog: HTMLDialogElement): void {
  for (const d of document.querySelectorAll<HTMLDialogElement>('dialog[open]')) d.close()
  dialog.showModal()
}

function setupSheet(dialog: HTMLDialogElement): void {
  for (const btn of dialog.querySelectorAll<HTMLElement>('[data-close]')) {
    btn.addEventListener('click', () => dialog.close())
  }
  // Tap on the dimmed backdrop closes the sheet.
  dialog.addEventListener('click', (e) => {
    const r = dialog.getBoundingClientRect()
    const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom
    if (!inside) dialog.close()
  })
  // Drag the grabber or title bar down to dismiss (narrow screens).
  let startY = 0
  let dy = 0
  let startT = 0
  let dragging = false
  for (const h of dialog.querySelectorAll<HTMLElement>('.sheet-grabber, .sheet-bar')) {
    h.addEventListener('pointerdown', (e) => {
      if (wide.matches || (e.target as HTMLElement).closest('button')) return
      dragging = true
      startY = e.clientY
      startT = performance.now()
      dy = 0
      h.setPointerCapture(e.pointerId)
      dialog.classList.add('dragging')
    })
    h.addEventListener('pointermove', (e) => {
      if (!dragging) return
      dy = Math.max(0, e.clientY - startY)
      dialog.style.transform = `translateY(${dy}px)`
    })
    const end = () => {
      if (!dragging) return
      dragging = false
      dialog.classList.remove('dragging')
      dialog.style.transform = ''
      const velocity = dy / Math.max(1, performance.now() - startT)
      if (dy > 120 || (dy > 30 && velocity > 0.6)) dialog.close()
    }
    h.addEventListener('pointerup', end)
    h.addEventListener('pointercancel', end)
  }
}

// ------------------------------------------------------------------- UI wiring

function bindUi(): void {
  for (const d of document.querySelectorAll<HTMLDialogElement>('dialog.sheet')) setupSheet(d)

  $('btn-me').addEventListener('click', openMyCodeSheet)
  $('btn-add').addEventListener('click', () => openAddSheet(''))
  for (const b of document.querySelectorAll<HTMLElement>('[data-action="add"]')) {
    b.addEventListener('click', () => openAddSheet('', true))
  }
  for (const b of document.querySelectorAll<HTMLElement>('[data-action="my-code"]')) {
    b.addEventListener('click', openMyCodeSheet)
  }
  $('btn-back').addEventListener('click', closeChat)
  $('chat-title').addEventListener('click', () => activePk && openContactSheet(activePk))
  $('btn-info').addEventListener('click', () => activePk && openContactSheet(activePk))

  $<HTMLInputElement>('search').addEventListener('input', (e) => {
    query = (e.target as HTMLInputElement).value.trim().toLowerCase()
    renderContacts()
  })

  // The large title folds into the toolbar as the list scrolls.
  const listScroll = document.querySelector<HTMLElement>('.list-scroll')!
  const listToolbar = document.querySelector<HTMLElement>('.list-toolbar')!
  listScroll.addEventListener('scroll', () => listToolbar.classList.toggle('scrolled', listScroll.scrollTop > 40), {
    passive: true,
  })

  bindComposer()
  bindMyCodeSheet()
  bindProfileSheet()
  bindAddSheet()
  bindContactSheet()
  wide.addEventListener('change', () => showChat(activePk))
}

function bindComposer(): void {
  const input = $<HTMLTextAreaElement>('msg-input')
  const send = $<HTMLButtonElement>('btn-send')
  const autosize = () => {
    input.style.height = 'auto'
    input.style.height = `${input.scrollHeight}px`
    send.disabled = !input.value.trim()
  }
  input.addEventListener('input', autosize)
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault()
      $<HTMLFormElement>('composer').requestSubmit()
    }
  })
  // Keep the keyboard open when tapping Send.
  send.addEventListener('pointerdown', (e) => e.preventDefault())
  $<HTMLFormElement>('composer').addEventListener('submit', (e) => {
    e.preventDefault()
    const text = input.value.trim()
    if (!text || !activePk) return
    sendText(activePk, text)
    input.value = ''
    autosize()
    input.focus()
  })
}

/** A grid of characters to choose from (radio group, arrow keys move the choice). */
function renderPicker(container: HTMLElement, selected: string, onSelect: (id: string) => void): void {
  let current = selected
  const buttons = MASCOTS.map(({ id, label }) => {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = 'mascot'
    b.setAttribute('role', 'radio')
    b.setAttribute('aria-label', label)
    b.innerHTML = `<img src="${mascotUrl(id)}" alt="" loading="lazy" draggable="false">`
    b.addEventListener('click', () => choose(id))
    return b
  })
  const sync = () =>
    buttons.forEach((b, i) => {
      const on = MASCOTS[i].id === current
      b.setAttribute('aria-checked', String(on))
      b.tabIndex = on ? 0 : -1
    })
  const choose = (id: string, focus = false) => {
    current = id
    sync()
    onSelect(id)
    if (focus) buttons[MASCOTS.findIndex((m) => m.id === id)].focus()
  }
  container.addEventListener('keydown', (e) => {
    const i = MASCOTS.findIndex((m) => m.id === current)
    const cols = getComputedStyle(container).gridTemplateColumns.split(' ').length
    const step = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: cols, ArrowUp: -cols }[e.key]
    if (!step) return
    e.preventDefault()
    const next = MASCOTS[Math.min(MASCOTS.length - 1, Math.max(0, i + step))]
    choose(next.id, true)
  })
  container.replaceChildren(...buttons)
  sync()
  // Show the chosen one without scrolling the page.
  const sel = buttons[MASCOTS.findIndex((m) => m.id === current)]
  if (sel) requestAnimationFrame(() => (container.scrollTop = sel.offsetTop - container.offsetTop - 10))
}

// ---- My code & profile

function bindMyCodeSheet(): void {
  const shareBtn = $<HTMLButtonElement>('btn-share-code')
  shareBtn.hidden = typeof navigator.share !== 'function'
  shareBtn.addEventListener('click', async () => {
    try {
      await navigator.share({
        title: `Chat with ${me.name}`,
        text: `Add me on Messenger. Paste this code under Add Contact:\n\n${encodeCard(myCard())}`,
      })
    } catch {
      /* cancelled */
    }
  })

  const copyBtn = $<HTMLButtonElement>('btn-copy-code')
  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(encodeCard(myCard()))
      copyBtn.innerHTML = `${icon('check')}<span>Copied</span>`
    } catch {
      copyBtn.innerHTML = `${icon('copy')}<span>Couldn't copy</span>`
    }
    setTimeout(() => (copyBtn.innerHTML = `${icon('copy')}<span>Copy Code</span>`), 1800)
  })
  $('btn-edit-profile').addEventListener('click', openProfileSheet)
}

function openMyCodeSheet(): void {
  const code = encodeCard(myCard())
  // The QR holds a link, so a phone's own camera app can open it too.
  void renderQr($<HTMLCanvasElement>('qr-canvas'), `${location.origin}${location.pathname}#add=${code}`)
  $('my-code-avatar').innerHTML = avatarHtml(me.pk, me.avatar, 40)
  $('my-code-name').textContent = me.name
  $('my-code-id').textContent = shortKey(me.pk)
  renderNetwork()
  openSheet($<HTMLDialogElement>('sheet-my-code'))
}

let draftAvatar = ''

function bindProfileSheet(): void {
  $('btn-profile-save').addEventListener('click', () => {
    me.name = cleanName($<HTMLInputElement>('profile-name').value)
    me.avatar = draftAvatar
    store.saveIdentity(me)
    renderMe()
    // Tell everyone connected right now; others hear it on their next hello.
    for (const c of contacts) peers.send(c.pk, { t: 'profile', n: me.name, a: me.avatar })
    $<HTMLDialogElement>('sheet-profile').close()
  })
}

function openProfileSheet(): void {
  draftAvatar = me.avatar
  $<HTMLInputElement>('profile-name').value = me.name
  const preview = () => ($('profile-avatar').innerHTML = avatarHtml(me.pk, draftAvatar, 64))
  preview()
  openSheet($<HTMLDialogElement>('sheet-profile'))
  renderPicker($('profile-picker'), draftAvatar, (id) => {
    draftAvatar = id
    preview()
  })
}

function renderMe(): void {
  $('btn-me').innerHTML = avatarHtml(me.pk, me.avatar, 32)
}

// ---- Add contact

let stopScan: (() => void) | null = null
let pendingCard: ContactCard | null = null

function bindAddSheet(): void {
  const sheet = $<HTMLDialogElement>('sheet-add')
  const codeInput = $<HTMLTextAreaElement>('add-code')
  sheet.addEventListener('close', stopScanner)
  $('btn-scan').addEventListener('click', startCamera)
  codeInput.addEventListener('input', () => validateAddCode(codeInput.value))
  $('btn-add-confirm').addEventListener('click', confirmAdd)

  const pasteBtn = $<HTMLButtonElement>('btn-paste')
  pasteBtn.hidden = typeof navigator.clipboard?.readText !== 'function'
  pasteBtn.addEventListener('click', async () => {
    try {
      codeInput.value = (await navigator.clipboard.readText()).trim()
      validateAddCode(codeInput.value)
    } catch {
      codeInput.focus()
    }
  })
}

function openAddSheet(prefill: string, autoCamera = false): void {
  $<HTMLTextAreaElement>('add-code').value = prefill
  showScanError('')
  validateAddCode(prefill)
  openSheet($<HTMLDialogElement>('sheet-add'))
  // Came from "Scan a Code": the person asked for the camera, so start it.
  if (autoCamera) void startCamera()
}

async function startCamera(): Promise<void> {
  showScanError('')
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
    showScanError('The camera needs a secure (https) connection. Paste the code below instead.')
    return
  }
  $('scanner-idle').hidden = true
  $('scan-video').hidden = false
  $('scanner-frame').hidden = false
  try {
    stopScan = await startScanner($<HTMLVideoElement>('scan-video'), (text) => {
      stopScanner()
      $<HTMLTextAreaElement>('add-code').value = text
      // A successful scan is a clear intent: add right away if the code is valid.
      if (validateAddCode(text)) confirmAdd()
    })
  } catch (err) {
    stopScanner()
    const denied = (err as Error).name === 'NotAllowedError'
    showScanError(
      denied
        ? 'Camera access is turned off. Allow it in your browser settings, or paste the code below.'
        : "Couldn't start the camera. Paste the code below instead.",
    )
  }
}

function stopScanner(): void {
  stopScan?.()
  stopScan = null
  $('scan-video').hidden = true
  $('scanner-frame').hidden = true
  $('scanner-idle').hidden = false
}

/** Validate as people type or paste; show who they're adding. */
function validateAddCode(value: string): boolean {
  const err = $('add-error')
  const preview = $('add-preview')
  const confirm = $<HTMLButtonElement>('btn-add-confirm')
  pendingCard = null
  err.hidden = true
  preview.hidden = true
  confirm.disabled = true
  confirm.textContent = 'Add'
  if (!value.trim()) return false
  try {
    const card = decodeCard(value)
    if (card.pk === me.pk) throw new Error("This is your own code. Scan your contact's code instead.")
    pendingCard = card
    const already = !!contactOf(card.pk)
    confirm.disabled = false
    confirm.textContent = already ? 'Open' : 'Add'
    preview.innerHTML = `${avatarHtml(card.pk, card.a, 40)}<span class="add-preview-text"><strong></strong><span class="detail mono"></span></span>${capsule(already ? 'blue' : 'green', 'check', already ? 'In your chats' : 'Valid code')}`
    preview.querySelector('strong')!.textContent = card.n
    preview.querySelector('.detail')!.textContent = shortKey(card.pk)
    preview.hidden = false
    return true
  } catch (e) {
    const message = (e as Error).message
    err.textContent = message.startsWith('This is your own')
      ? message
      : "That doesn't look like a contact code. Codes start with “p2pmsg:”."
    err.hidden = false
    return false
  }
}

function confirmAdd(): void {
  if (!pendingCard) return
  const card = pendingCard
  addContact(card)
  $<HTMLDialogElement>('sheet-add').close()
  openChat(card.pk)
}

function showScanError(text: string): void {
  const el = $('scan-error')
  el.textContent = text
  el.hidden = !text
}

// ---- Contact details

function bindContactSheet(): void {
  const sheet = $<HTMLDialogElement>('sheet-contact')
  sheet.addEventListener('close', () => {
    detailsPk = null
    $('remove-confirm').hidden = true
    $('btn-remove').hidden = false
  })
  $('btn-remove').addEventListener('click', () => {
    $('btn-remove').hidden = true
    $('remove-confirm').hidden = false
    $('btn-remove-cancel').focus()
  })
  $('btn-remove-cancel').addEventListener('click', () => {
    $('remove-confirm').hidden = true
    $('btn-remove').hidden = false
  })
  $('btn-remove-confirm').addEventListener('click', () => {
    const pk = detailsPk
    sheet.close()
    if (pk) removeContact(pk)
  })
}

function openContactSheet(pk: string): void {
  detailsPk = pk
  renderContactSheet()
  openSheet($<HTMLDialogElement>('sheet-contact'))
}

function renderContactSheet(): void {
  const c = contactOf(detailsPk)
  if (!c) return
  const status = peers.status(c.pk)
  $('contact-avatar').innerHTML = avatarHtml(c.pk, c.avatar, 88)
  $('contact-name').textContent = c.name
  setStatus($('contact-status'), status)
  $('contact-keyart').innerHTML = keyPattern(c.pk, 40, 'Key fingerprint')
  $('safety-number').textContent = safetyNumber(me.pk, c.pk)
  $('safety-hint').textContent = `Compare this with the number on ${c.name}'s phone. If they match, nobody swapped a key between you.`
  $('contact-key').textContent = shortKey(c.pk)
  $('contact-key').title = c.pk
  $('contact-added').textContent = new Date(c.addedAt).toLocaleDateString([], { dateStyle: 'medium' })
  $('remove-confirm-text').textContent = `Remove ${c.name} and delete your chat history? This can't be undone.`
}

// ------------------------------------------------------------------- rendering

const STATUS_LABEL: Record<PeerStatus, string> = {
  connected: 'Online',
  connecting: 'Connecting…',
  offline: 'Offline',
}

function setStatus(el: HTMLElement, status: PeerStatus, text = STATUS_LABEL[status]): void {
  el.className = `status ${status}`
  el.textContent = text
}

/** Share-style capsule: a tinted pill with an icon disc. */
function capsule(tone: 'gray' | 'blue' | 'green' | 'amber', iconName: IconName, text: string): string {
  const span = document.createElement('span')
  span.textContent = text
  return `<span class="capsule ${tone}"><span class="capsule-disc">${icon(iconName, 9)}</span>${span.innerHTML}</span>`
}

function renderChatHeader(): void {
  const c = contactOf(activePk)
  if (!c) return
  const status = peers.status(c.pk)
  $('chat-avatar').innerHTML = avatarHtml(c.pk, c.avatar, 34, status)
  $('chat-name').textContent = c.name
  setStatus($('chat-status'), status)
  $('chat-title').setAttribute('aria-label', `${c.name}, ${STATUS_LABEL[status]}. Contact details`)
}

const GROUP_GAP_MS = 2 * 60_000
const SEPARATOR_GAP_MS = 30 * 60_000
const JUMBO_EMOJI = /^(?:\p{Extended_Pictographic}(?:️|\p{Emoji_Modifier}|‍\p{Extended_Pictographic})*\s*){1,3}$/u

function renderMessages(forceBottom = false): void {
  const c = contactOf(activePk)
  if (!c) return
  const scroller = $('messages-scroll')
  const nearBottom = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 120
  const list = messages(c.pk)
  const status = peers.status(c.pk)
  const items: HTMLElement[] = []

  const intro = document.createElement('li')
  intro.className = 'chat-intro'
  intro.innerHTML = `${avatarHtml(c.pk, c.avatar, 64)}<strong></strong><span class="detail"></span>${capsule('green', 'lock', 'End-to-end encrypted')}`
  intro.querySelector('strong')!.textContent = c.name
  intro.querySelector('.detail')!.textContent = `Messages go straight to ${c.name}'s device. Nothing is stored on a server.`
  items.push(intro)

  // Status shows under your latest message, or under the last unsent one.
  const lastIdx = list.length - 1
  const statusIdx =
    list[lastIdx]?.dir === 'out' ? lastIdx : list.findLastIndex((m) => m.dir === 'out' && m.status === 'pending')

  list.forEach((m, i) => {
    const prev = list[i - 1]
    const next = list[i + 1]
    const sep = !prev || m.ts - prev.ts > SEPARATOR_GAP_MS || !sameDay(prev.ts, m.ts)
    const nextSep = !!next && (next.ts - m.ts > SEPARATOR_GAP_MS || !sameDay(m.ts, next.ts))
    const groupStart = sep || prev.dir !== m.dir || m.ts - prev.ts > GROUP_GAP_MS
    const groupEnd = !next || nextSep || next.dir !== m.dir || next.ts - m.ts > GROUP_GAP_MS || i === statusIdx

    if (sep) {
      const li = document.createElement('li')
      li.className = 'time-sep'
      li.innerHTML = `<b></b> <span></span>`
      li.querySelector('b')!.textContent = dayLabel(m.ts)
      li.querySelector('span')!.textContent = timeLabel(m.ts)
      items.push(li)
    }

    const li = document.createElement('li')
    li.className = `msg ${m.dir}${groupStart ? ' group-start' : ''}${groupEnd ? ' group-end' : ''}`
    if (m.dir === 'out' && m.status === 'pending' && i !== statusIdx) {
      const clock = document.createElement('span')
      clock.className = 'msg-pending'
      clock.innerHTML = icon('clock', 16)
      clock.setAttribute('role', 'img')
      clock.setAttribute('aria-label', 'Not sent yet')
      li.append(clock)
    }
    const bubble = document.createElement('div')
    bubble.className = `bubble${JUMBO_EMOJI.test(m.text) ? ' jumbo' : ''}`
    bubble.textContent = m.text
    bubble.title = new Date(m.ts).toLocaleString()
    li.append(bubble)
    items.push(li)

    if (i === statusIdx) {
      const s = document.createElement('li')
      s.className = 'msg-status'
      s.innerHTML =
        m.status === 'delivered'
          ? capsule('green', 'checks', 'Delivered')
          : m.status === 'sent'
            ? capsule('blue', 'check', 'Sent')
            : status === 'offline'
              ? capsule('gray', 'clock', `Waiting for ${c.name} to come online`)
              : capsule('amber', 'clock', 'Sending…')
      items.push(s)
    }
  })

  $('messages').replaceChildren(...items)
  if (forceBottom || nearBottom) scroller.scrollTop = scroller.scrollHeight
}

function renderContacts(): void {
  const listEl = $('contact-list')
  const online = contacts.filter((c) => peers.status(c.pk) === 'connected').length
  $('list-summary').textContent = contacts.length ? `${online} of ${contacts.length} online` : ''
  $('no-contacts').hidden = contacts.length > 0
  $('search-wrap').hidden = contacts.length < 2
  listEl.hidden = !contacts.length

  const shown = sortedContacts().filter((c) => !query || c.name.toLowerCase().includes(query))
  const noResults = $('no-results')
  noResults.hidden = !query || shown.length > 0
  noResults.textContent = `No chats match “${query}”.`
  const iconSize = wide.matches && matchMedia('(pointer: fine)').matches ? 40 : 48

  listEl.replaceChildren(
    ...shown.map((c) => {
      const status = peers.status(c.pk)
      const last = messages(c.pk).at(-1)
      const count = unread.get(c.pk) ?? 0

      const li = document.createElement('li')
      const row = document.createElement('button')
      row.type = 'button'
      row.className = `contact-row${count ? ' unread' : ''}`
      if (c.pk === activePk && wide.matches) row.setAttribute('aria-current', 'true')
      row.addEventListener('click', () => openChat(c.pk))

      const waiting = last?.dir === 'out' && last.status === 'pending'
      row.innerHTML = `
        ${avatarHtml(c.pk, c.avatar, iconSize, status)}
        <span class="contact-main">
          <span class="contact-line"><span class="contact-name"></span><span class="contact-time"></span></span>
          <span class="contact-line">${waiting ? capsule('gray', 'clock', 'Waiting') : ''}<span class="contact-preview"></span></span>
        </span>`
      row.querySelector('.contact-name')!.textContent = c.name
      row.querySelector('.contact-time')!.textContent = last ? listTime(last.ts) : ''
      row.querySelector('.contact-preview')!.textContent = last
        ? `${last.dir === 'out' ? 'You: ' : ''}${last.text}`
        : status === 'connected'
          ? 'Online now. Say hello!'
          : 'No messages yet'
      if (count) {
        const badge = document.createElement('span')
        badge.className = 'badge'
        badge.textContent = count > 99 ? '99+' : String(count)
        row.querySelector('.contact-line:last-child')!.append(badge)
      }
      row.setAttribute(
        'aria-label',
        [c.name, STATUS_LABEL[status], count ? `${count} unread` : '', last ? last.text : ''].filter(Boolean).join(', '),
      )
      li.append(row)
      return li
    }),
  )

  const totalUnread = [...unread.values()].reduce((a, b) => a + b, 0)
  document.title = totalUnread ? `(${totalUnread}) Messenger` : 'Messenger'
}

function renderRequests(): void {
  $('requests').replaceChildren(
    ...[...requests.values()].map((card) => {
      const div = document.createElement('div')
      div.className = 'group request'
      div.setAttribute('role', 'group')
      div.innerHTML = `
        <div class="request-head">${avatarHtml(card.pk, card.a, 44)}
          <p class="request-text"><strong></strong>added you. Add them back to start chatting.</p>
        </div>
        <div class="button-row">
          <button type="button" class="btn btn-secondary" data-ignore>Ignore</button>
          <button type="button" class="btn btn-primary" data-accept>Add Back</button>
        </div>`
      div.querySelector('strong')!.textContent = card.n
      div.setAttribute('aria-label', `${card.n} added you`)
      div.querySelector('[data-accept]')!.addEventListener('click', () => {
        addContact(card)
        openChat(card.pk)
      })
      div.querySelector('[data-ignore]')!.addEventListener('click', () => {
        ignoredRequests.add(card.pk)
        requests.delete(card.pk)
        renderRequests()
      })
      return div
    }),
  )
}

/** Plain-language connection state; relay details only in My Code. */
function renderNetwork(): void {
  const n = signaling.connectedRelays()
  const total = settings.relays.length
  const banner = $('net-banner')
  let text = ''
  if (!navigator.onLine) text = 'No network. Messages will send when you reconnect.'
  else if (n === 0 && Date.now() - startedAt > 8_000) text = "Can't reach the relays. Retrying…"
  banner.hidden = !text
  if (text && banner.textContent !== text) {
    banner.innerHTML = `${icon('wifiOff', 16)}<span></span>`
    banner.querySelector('span')!.textContent = text
  }
  const net = $('my-network')
  if (!navigator.onLine) setStatus(net, 'offline', 'No network')
  else if (n === 0) setStatus(net, 'connecting', 'Connecting…')
  else setStatus(net, 'connected', `Connected · ${n} of ${total} relays`)
}

// ------------------------------------------------------------------- helpers

function sameDay(a: number, b: number): boolean {
  return new Date(a).toDateString() === new Date(b).toDateString()
}

function dayLabel(ts: number): string {
  const now = new Date()
  const d = new Date(ts)
  if (sameDay(ts, now.getTime())) return 'Today'
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (sameDay(ts, yesterday.getTime())) return 'Yesterday'
  if (now.getTime() - ts < 6 * 86_400_000) return d.toLocaleDateString([], { weekday: 'long' })
  return d.toLocaleDateString([], {
    day: 'numeric',
    month: 'short',
    year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric',
  })
}

function timeLabel(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function listTime(ts: number): string {
  return sameDay(ts, Date.now()) ? timeLabel(ts) : dayLabel(ts)
}

/** Keep the layout the size of the visible area, so the on-screen keyboard never covers the composer. */
function trackViewportHeight(): void {
  const vv = window.visualViewport
  if (!vv) return
  const update = () => {
    document.documentElement.style.setProperty('--app-h', `${vv.height}px`)
    if (vv.offsetTop) window.scrollTo(0, 0)
  }
  vv.addEventListener('resize', update)
  update()
}

boot()
