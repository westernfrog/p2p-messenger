import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { CameraIcon, TriangleAlertIcon } from '@/lib/icons'
import { cn } from '@/lib/utils'

type ScanState = 'idle' | 'starting' | 'running' | 'error'

/**
 * The camera viewfinder. Asks for the camera only when someone taps Start Camera (or opens
 * the sheet from "Scan Code", which is the same request), and stops it when the view goes away.
 */
export function Scanner({ autoStart, onResult }: { autoStart: boolean; onResult: (text: string) => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const stop = useRef<(() => void) | null>(null)
  const [state, setState] = useState<ScanState>('idle')
  const [error, setError] = useState('')
  const result = useRef(onResult)
  result.current = onResult

  async function begin() {
    setError('')
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setState('error')
      setError('The camera needs a secure (https) connection. Paste the code below instead.')
      return
    }
    setState('starting')
    try {
      // The decoder is loaded only when the camera is actually used.
      const { startScanner } = await import('@/core/qr')
      stop.current = await startScanner(video.current!, (text) => {
        stop.current = null
        setState('idle')
        result.current(text)
      })
      setState('running')
    } catch (err) {
      stop.current?.()
      stop.current = null
      setState('error')
      setError(
        (err as Error).name === 'NotAllowedError'
          ? 'Camera access is off. Allow it in your browser’s site settings, or paste the code below.'
          : 'Couldn’t start the camera. Paste the code below instead.',
      )
    }
  }

  useEffect(() => {
    if (autoStart) void begin()
    return () => stop.current?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const live = state === 'running' || state === 'starting'
  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-group bg-[#101112] sm:aspect-[4/3]">
      <video
        ref={video}
        playsInline
        muted
        className={cn('absolute inset-0 size-full object-cover transition-opacity duration-300', state === 'running' ? 'opacity-100' : 'opacity-0')}
      />
      {live && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="relative size-[58%] rounded-[22px] shadow-[0_0_0_100vmax_rgb(0_0_0/0.35)]">
            {['top-0 left-0 border-t-4 border-l-4 rounded-tl-[22px]', 'top-0 right-0 border-t-4 border-r-4 rounded-tr-[22px]', 'bottom-0 left-0 border-b-4 border-l-4 rounded-bl-[22px]', 'right-0 bottom-0 border-r-4 border-b-4 rounded-br-[22px]'].map((c) => (
              <span key={c} className={cn('absolute size-9 border-white', c)} />
            ))}
          </div>
        </div>
      )}
      {live && (
        <p className="absolute inset-x-0 bottom-3 text-center text-[13px] font-medium text-white/90 [text-shadow:0_1px_2px_rgb(0_0_0/0.5)]" role="status">
          {state === 'starting' ? 'Starting camera…' : 'Point at your contact’s code'}
        </p>
      )}
      {!live && (
        <div className="absolute inset-0 grid place-content-center justify-items-center gap-3 p-6 text-center text-white">
          <span className="grid size-14 place-items-center rounded-full bg-white/12">
            {state === 'error' ? <TriangleAlertIcon className="size-7 text-sig-amber" /> : <CameraIcon className="size-7" />}
          </span>
          <p className="max-w-64 text-sm text-white/80" role={state === 'error' ? 'alert' : undefined}>
            {state === 'error' ? error : 'Scan the code on your contact’s screen.'}
          </p>
          <Button size="lg" className="px-4" onClick={() => void begin()}>
            {state === 'error' ? 'Try Again' : 'Start Camera'}
          </Button>
        </div>
      )}
    </div>
  )
}
