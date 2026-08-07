import { useEffect, useState } from 'react'
import { XIcon } from './icons'

type Props = {
  photos: string[]
  audio: string | null
  referenceNumber: string
}

/**
 * Officer-side evidence viewer: thumbnails open a full-screen lightbox with
 * keyboard/tap navigation, and everything can be pulled down in one go.
 */
export function EvidenceGallery({ photos, audio, referenceNumber }: Props) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const hasEvidence = photos.length > 0 || Boolean(audio)

  useEffect(() => {
    if (lightboxIndex === null) return

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setLightboxIndex(null)
      if (e.key === 'ArrowRight') setLightboxIndex((i) => (i === null ? null : (i + 1) % photos.length))
      if (e.key === 'ArrowLeft') setLightboxIndex((i) => (i === null ? null : (i - 1 + photos.length) % photos.length))
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightboxIndex, photos.length])

  if (!hasEvidence) {
    return (
      <div className="mt-2">
        <p className="font-bold text-xs uppercase text-slate-400">Evidence</p>
        <p className="text-sm text-slate-500 mt-1">No photos or voice notes attached.</p>
      </div>
    )
  }

  function downloadAll() {
    const urls = [...photos, ...(audio ? [audio] : [])]
    urls.forEach((url, i) => {
      const link = document.createElement('a')
      link.href = url
      link.download = `${referenceNumber}-evidence-${i + 1}`
      link.target = '_blank'
      link.rel = 'noreferrer'
      document.body.appendChild(link)
      link.click()
      link.remove()
    })
  }

  return (
    <div className="flex flex-col gap-3 mt-2">
      <div className="flex items-center justify-between">
        <p className="font-bold text-xs uppercase text-slate-400">
          Evidence ({photos.length} photo{photos.length === 1 ? '' : 's'}
          {audio ? ', 1 voice note' : ''})
        </p>
        <button
          type="button"
          onClick={downloadAll}
          className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg hover:bg-emerald-100"
        >
          Download all
        </button>
      </div>

      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((url, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setLightboxIndex(idx)}
              aria-label={`Open photo ${idx + 1} of ${photos.length}`}
              className="relative aspect-square rounded-xl border-2 border-slate-200 overflow-hidden hover:border-emerald-500 transition-all"
            >
              <img src={url} className="w-full h-full object-cover" alt="" />
              <span className="absolute bottom-1 right-1 bg-black/60 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                {idx + 1}
              </span>
            </button>
          ))}
        </div>
      )}

      {audio && (
        <div className="rounded-xl border-2 border-slate-200 bg-slate-50 p-3 flex flex-col gap-1.5">
          <p className="text-xs font-bold text-slate-600">Voice statement</p>
          <audio src={audio} controls className="w-full h-10" />
        </div>
      )}

      {lightboxIndex !== null && (
        <div
          className="fixed inset-0 z-70 bg-black/90 flex flex-col items-center justify-center px-4"
          onClick={() => setLightboxIndex(null)}
        >
          <div className="absolute top-4 right-4 flex items-center gap-3">
            <span className="text-white/80 text-sm font-semibold">
              {lightboxIndex + 1} / {photos.length}
            </span>
            <button
              type="button"
              onClick={() => setLightboxIndex(null)}
              aria-label="Close photo"
              className="p-2 rounded-full bg-white/10 hover:bg-white/20"
            >
              <XIcon className="w-6 h-6 text-white" />
            </button>
          </div>

          <img
            src={photos[lightboxIndex]}
            alt={`Evidence photo ${lightboxIndex + 1}`}
            className="max-h-[75vh] max-w-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />

          {photos.length > 1 && (
            <div className="flex gap-3 mt-4" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => setLightboxIndex((i) => (i! - 1 + photos.length) % photos.length)}
                className="px-5 py-2.5 rounded-xl bg-white/10 text-white font-bold text-sm hover:bg-white/20"
              >
                ‹ Prev
              </button>
              <button
                type="button"
                onClick={() => setLightboxIndex((i) => (i! + 1) % photos.length)}
                className="px-5 py-2.5 rounded-xl bg-white/10 text-white font-bold text-sm hover:bg-white/20"
              >
                Next ›
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
