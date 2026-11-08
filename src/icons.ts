// Icons: Phosphor (https://phosphoricons.com, MIT), the same family the Share app uses, chosen
// for its SF Symbols-like shapes. Regular weight by default; bold where Share uses bold.
// Icons are decorative (aria-hidden); the control carrying one always has a label.

import arrowUp from '@phosphor-icons/core/assets/bold/arrow-up-bold.svg?raw'
import camera from '@phosphor-icons/core/assets/regular/camera.svg?raw'
import caretLeft from '@phosphor-icons/core/assets/bold/caret-left-bold.svg?raw'
import check from '@phosphor-icons/core/assets/bold/check-bold.svg?raw'
import checks from '@phosphor-icons/core/assets/bold/checks-bold.svg?raw'
import clipboard from '@phosphor-icons/core/assets/regular/clipboard-text.svg?raw'
import clock from '@phosphor-icons/core/assets/regular/clock.svg?raw'
import copy from '@phosphor-icons/core/assets/regular/copy.svg?raw'
import exportIcon from '@phosphor-icons/core/assets/regular/export.svg?raw'
import fingerprint from '@phosphor-icons/core/assets/regular/fingerprint.svg?raw'
import info from '@phosphor-icons/core/assets/regular/info.svg?raw'
import lock from '@phosphor-icons/core/assets/regular/lock-simple.svg?raw'
import search from '@phosphor-icons/core/assets/regular/magnifying-glass.svg?raw'
import pencil from '@phosphor-icons/core/assets/regular/pencil-simple.svg?raw'
import plus from '@phosphor-icons/core/assets/bold/plus-bold.svg?raw'
import qr from '@phosphor-icons/core/assets/regular/qr-code.svg?raw'
import trash from '@phosphor-icons/core/assets/regular/trash.svg?raw'
import userPlus from '@phosphor-icons/core/assets/regular/user-plus.svg?raw'
import wifiOff from '@phosphor-icons/core/assets/regular/wifi-slash.svg?raw'
import x from '@phosphor-icons/core/assets/bold/x-bold.svg?raw'

const svgs = {
  arrowUp, camera, caretLeft, check, checks, clipboard, clock, copy, export: exportIcon, fingerprint,
  info, lock, search, pencil, plus, qr, trash, userPlus, wifiOff, x,
} as const

export type IconName = keyof typeof svgs

export function icon(name: IconName, size = 20): string {
  return svgs[name].replace(
    '<svg ',
    `<svg class="icon" width="${size}" height="${size}" aria-hidden="true" focusable="false" `,
  )
}

/** Replace every `<i data-icon="name">` placeholder in the document with its SVG. */
export function hydrateIcons(root: ParentNode = document): void {
  for (const el of root.querySelectorAll<HTMLElement>('i[data-icon]')) {
    el.outerHTML = icon(el.dataset.icon as IconName, Number(el.dataset.size) || 20)
  }
}
