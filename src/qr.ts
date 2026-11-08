import QRCode from 'qrcode'
import jsQR from 'jsqr'

export function renderQr(canvas: HTMLCanvasElement, text: string): Promise<void> {
  return QRCode.toCanvas(canvas, text, { errorCorrectionLevel: 'M', margin: 2, width: 280 })
}

/**
 * Scan QR codes from the camera into `video`. Calls `onResult` once with the first
 * decoded text. Returns a function that stops the camera.
 */
export async function startScanner(
  video: HTMLVideoElement,
  onResult: (text: string) => void,
): Promise<() => void> {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'environment' },
    audio: false,
  })
  video.srcObject = stream
  await video.play()

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  let stopped = false
  let frame = 0

  const stop = () => {
    stopped = true
    cancelAnimationFrame(frame)
    stream.getTracks().forEach((t) => t.stop())
    video.srcObject = null
  }

  const scan = () => {
    if (stopped) return
    if (video.readyState >= video.HAVE_ENOUGH_DATA && video.videoWidth) {
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      ctx.drawImage(video, 0, 0)
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const code = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' })
      if (code?.data) {
        stop()
        onResult(code.data)
        return
      }
    }
    frame = requestAnimationFrame(scan)
  }
  frame = requestAnimationFrame(scan)
  return stop
}
