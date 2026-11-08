/** Random id. Uses getRandomValues, which (unlike randomUUID) also works on plain-http LAN addresses. */
export function uid(): string {
  const b = crypto.getRandomValues(new Uint8Array(16))
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
}
