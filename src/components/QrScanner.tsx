import { useEffect, useRef, useState } from 'react'
import jsQR from 'jsqr'
import { XIcon } from './icons'

type Props = {
  onResult: (value: string) => void
  onClose: () => void
  title?: string
  hint?: string
}

type CameraState = 'starting' | 'scanning' | 'denied'

/**
 * Camera QR scanner. Prefers the native BarcodeDetector where available
 * (Android Chrome), falling back to jsQR over canvas frames everywhere else.
 */
export function QrScanner({ onResult, onClose, title = 'Scan code', hint }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const frameRef = useRef<number | null>(null)
  const settledRef = useRef(false)
  const [state, setState] = useState<CameraState>('starting')

  useEffect(() => {
    let cancelled = false

    function finish(value: string) {
      if (settledRef.current) return
      settledRef.current = true
      onResult(value)
    }

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        const video = videoRef.current
        if (!video) return
        video.srcObject = stream
        video.setAttribute('playsinline', 'true')
        await video.play()
        setState('scanning')

        const Detector = (window as any).BarcodeDetector
        const detector = Detector ? new Detector({ formats: ['qr_code'] }) : null

        const scanFrame = async () => {
          if (cancelled || settledRef.current) return
          const canvas = canvasRef.current
          if (video.readyState === video.HAVE_ENOUGH_DATA && canvas) {
            if (detector) {
              try {
                const codes = await detector.detect(video)
                if (codes?.[0]?.rawValue) return finish(codes[0].rawValue)
              } catch {
                // Fall through to jsQR below.
              }
            }

            canvas.width = video.videoWidth
            canvas.height = video.videoHeight
            const ctx = canvas.getContext('2d', { willReadFrequently: true })
            if (ctx && canvas.width > 0) {
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
              const image = ctx.getImageData(0, 0, canvas.width, canvas.height)
              const found = jsQR(image.data, image.width, image.height)
              if (found?.data) return finish(found.data)
            }
          }
          frameRef.current = requestAnimationFrame(scanFrame)
        }

        frameRef.current = requestAnimationFrame(scanFrame)
      } catch {
        if (!cancelled) setState('denied')
      }
    }

    start()

    return () => {
      cancelled = true
      if (frameRef.current) cancelAnimationFrame(frameRef.current)
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [onResult])

  return (
    <div className="fixed inset-0 z-60 bg-black/80 flex items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-gray-800">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close scanner"
            className="p-1 rounded-full active:bg-gray-100"
          >
            <XIcon className="w-6 h-6 text-gray-500" />
          </button>
        </div>

        {hint && <p className="text-xs text-gray-500">{hint}</p>}

        <div className="relative rounded-xl overflow-hidden bg-black aspect-square">
          <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
          <canvas ref={canvasRef} className="hidden" />

          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="w-3/5 h-3/5 border-4 border-white/80 rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
          </div>

          {state === 'starting' && (
            <p className="absolute inset-0 flex items-center justify-center text-white text-sm font-semibold">
              Starting camera…
            </p>
          )}

          {state === 'denied' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center">
              <p className="text-white text-sm font-semibold">Camera unavailable</p>
              <p className="text-white/70 text-xs">
                Allow camera access, or type the code in manually instead.
              </p>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-xl border-2 border-gray-300 py-3 text-sm font-bold text-gray-700 active:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
