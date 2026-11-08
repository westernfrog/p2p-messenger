// Avatars: characters from page-mascot (https://github.com/nilbuild/page-mascot, MIT,
// © 2026 Kamran Ahmed; licence in public/mascots/LICENSE), the same set the Share app uses.

const IDS = `afro astronaut bald ballerina bear beard builder bunny cap cat chef clockwork crt cube deer dino
drone fox frog gearbot glasses grandpa granny hamster hedgehog hijabi knight koala lantern mouse
nurse otter owl panda penguin pirate postbot pug raccoon radio redpanda rocket scientist scout
sheep sikh skater sloth tiger toaster tv wizard`.split(/\s+/)

const LABELS: Record<string, string> = { crt: 'CRT', tv: 'TV', redpanda: 'Red panda' }

export const MASCOTS = IDS.map((id) => ({ id, label: LABELS[id] ?? id[0].toUpperCase() + id.slice(1) }))

export const isMascot = (id: unknown): id is string => typeof id === 'string' && IDS.includes(id)

export const mascotUrl = (id: string) => `${import.meta.env.BASE_URL}mascots/thumbs/${id}.webp`

/** A stable default for people who never picked one (or older contact codes). */
export function defaultMascot(pk: string): string {
  return IDS[parseInt(pk.slice(-6), 16) % IDS.length]
}

export function mascotFor(pk: string, chosen?: string): string {
  return isMascot(chosen) ? chosen : defaultMascot(pk)
}
