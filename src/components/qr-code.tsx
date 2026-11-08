import QRCode from 'qrcode'
import { useMemo } from 'react'
import { cn } from '@/lib/utils'

/**
 * A QR code as inline SVG. Always dark modules on white, in both appearances, because
 * phone cameras read that most reliably.
 */
export function QrCode({ value, label, className }: { value: string; label: string; className?: string }) {
  const { size, path } = useMemo(() => {
    const { modules } = QRCode.create(value, { errorCorrectionLevel: 'M' })
    let d = ''
    for (let y = 0; y < modules.size; y++) {
      for (let x = 0; x < modules.size; x++) {
        if (modules.get(x, y)) d += `M${x} ${y}h1v1h-1z`
      }
    }
    return { size: modules.size, path: d }
  }, [value])
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${size} ${size}`}
      shapeRendering="crispEdges"
      className={cn('block aspect-square', className)}
    >
      <rect width={size} height={size} fill="#ffffff" />
      <path d={path} fill="#202723" />
    </svg>
  )
}
