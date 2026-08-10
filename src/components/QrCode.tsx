import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'

type Props = {
  value: string
  size?: number
  className?: string
}

/**
 * Renders a real, scannable QR code. Replaces the earlier decorative
 * canvas grid, which looked like a QR code but encoded nothing.
 */
export function QrCode({ value, size = 200, className = '' }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !value) return

    QRCode.toCanvas(canvas, value, {
      width: size,
      margin: 1,
      errorCorrectionLevel: 'L',
      color: { dark: '#0f172a', light: '#ffffff' },
    })
      .then(() => setError(null))
      .catch(() => setError('This code is too large to display as a QR image.'))
  }, [value, size])

  if (error) {
    return (
      <p className={`text-xs text-amber-700 bg-amber-50 border-2 border-amber-200 rounded-xl p-3 text-center ${className}`}>
        {error} Use the copy button below instead.
      </p>
    )
  }

  return <canvas ref={canvasRef} className={className} />
}
