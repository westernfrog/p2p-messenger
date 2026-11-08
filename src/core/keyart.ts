// Visual identity derived from public keys.
//
// - Key pattern: a symmetric 5×5 pattern + hue taken from the key. Same key, same
//   pattern, on every device, so people can recognise each other at a glance.
// - Safety number: derived from BOTH keys. Two people who see the same number on
//   their phones know nobody swapped a key in between (compare it in person).

import { sha256 } from '@noble/hashes/sha2.js'
import { hexToBytes } from 'nostr-tools/utils'

export function keyHue(pk: string): number {
  return parseInt(pk.slice(0, 4), 16) % 360
}

/** Square SVG of the key pattern on a tinted circle. Colors come from CSS via --h. */
export function keyPattern(pk: string, size: number, label?: string): string {
  const bytes = hexToBytes(pk)
  const cells: string[] = []
  // 5 columns mirrored around the centre: decide 3 columns × 5 rows from key bits.
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 3; col++) {
      const bit = (bytes[2 + row * 3 + col] ?? 0) & 1
      if (!bit) continue
      const xs = col === 2 ? [2] : [col, 4 - col]
      for (const x of xs) cells.push(`<rect x="${x * 4 + 2}" y="${row * 4 + 2}" width="4" height="4"/>`)
    }
  }
  const a11y = label ? `role="img" aria-label="${escapeAttr(label)}"` : 'aria-hidden="true"'
  return `<svg class="keyart" style="--h:${keyHue(pk)}" width="${size}" height="${size}" viewBox="-3 -3 30 30" ${a11y}><circle class="keyart-bg" cx="12" cy="12" r="15"/><g class="keyart-fg">${cells.join('')}</g></svg>`
}

/** 12 digits in three groups, identical on both sides of a conversation. */
export function safetyNumber(pkA: string, pkB: string): string {
  const [a, b] = [pkA, pkB].sort()
  const digest = sha256(hexToBytes(a + b))
  const groups: string[] = []
  for (let i = 0; i < 3; i++) {
    const n = ((digest[i * 4] << 24) | (digest[i * 4 + 1] << 16) | (digest[i * 4 + 2] << 8) | digest[i * 4 + 3]) >>> 0
    groups.push(String(n % 10000).padStart(4, '0'))
  }
  return groups.join(' ')
}

function escapeAttr(s: string): string {
  return s.replace(/[&"<>]/g, (c) => ({ '&': '&amp;', '"': '&quot;', '<': '&lt;', '>': '&gt;' })[c]!)
}
