import type { Contact, PeerStatus } from '@/lib/app'
import { agoLabel } from '@/lib/format'

export interface Presence {
  tone: 'green' | 'amber' | 'gray'
  label: string
}

/** How a contact's connection reads in words, everywhere it's shown. */
export function presenceOf(contact: Contact, status: PeerStatus): Presence {
  if (status === 'connected') return { tone: 'green', label: 'Connected' }
  if (status === 'connecting') return { tone: 'amber', label: 'Connecting…' }
  if (contact.lastSeen) return { tone: 'gray', label: `Last connected ${agoLabel(contact.lastSeen)}` }
  return { tone: 'gray', label: 'Not connected yet' }
}
