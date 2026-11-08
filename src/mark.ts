/**
 * The Messenger mark, drawn in the Share family's style: white artwork on a cable-blue tile.
 * A speech bubble holding two device nodes joined by a line — two people, linked directly.
 */
let n = 0
export function markSvg(size = 24): string {
  const id = `mk${n++}`
  return `<svg class="mark" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true">
  <defs>
    <linearGradient id="${id}t" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4C8BF5"/><stop offset="1" stop-color="#1E4FC2"/></linearGradient>
    <linearGradient id="${id}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset=".55" stop-color="#fff" stop-opacity="0"/></linearGradient>
  </defs>
  <rect width="24" height="24" rx="6.4" fill="url(#${id}t)"/>
  <rect width="24" height="24" rx="6.4" fill="url(#${id}s)"/>
  <path d="M7.4 5.9h9.2a2.9 2.9 0 0 1 2.9 2.9v5.1a2.9 2.9 0 0 1-2.9 2.9h-5.2l-3.3 2.6v-2.6h-.7a2.9 2.9 0 0 1-2.9-2.9V8.8a2.9 2.9 0 0 1 2.9-2.9z" fill="none" stroke="#fff" stroke-width="1.8" stroke-linejoin="round"/>
  <path d="M9.2 11.35h5.6" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>
  <circle cx="8.9" cy="11.35" r="1.75" fill="#fff"/>
  <circle cx="15.1" cy="11.35" r="1.75" fill="#fff"/>
</svg>`
}
