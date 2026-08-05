import { useState, useEffect } from 'react'
import { SpeakerIcon } from './icons'
import { useTranslations } from '../lib/translations'

type Props = {
  text: string
  className?: string
}

export function PlayExplanationButton({ text, className = '' }: Props) {
  const { t, language } = useTranslations()
  const [isSpeaking, setIsSpeaking] = useState(false)

  useEffect(() => {
    return () => {
      // Clean up speaking status on unmount
      if (isSpeaking) {
        window.speechSynthesis.cancel()
      }
    }
  }, [isSpeaking])

  function handlePlayStop() {
    if (isSpeaking) {
      window.speechSynthesis.cancel()
      setIsSpeaking(false)
      return
    }

    // Cancel any current speaking
    window.speechSynthesis.cancel()

    if (!text) return

    const utterance = new SpeechSynthesisUtterance(text)

    // Select voice based on language
    const voices = window.speechSynthesis.getVoices()
    let voice = null

    if (language === 'lo') {
      voice = voices.find(v => v.lang.toLowerCase().includes('lo') || v.lang.toLowerCase().includes('la'))
    } else if (language === 'en') {
      voice = voices.find(v => v.lang.toLowerCase().includes('en'))
    } else if (language === 'hm') {
      voice = voices.find(v => v.lang.toLowerCase().includes('hm') || v.lang.toLowerCase().includes('th') || v.lang.toLowerCase().includes('vi'))
    } else if (language === 'km') {
      voice = voices.find(v => v.lang.toLowerCase().includes('km') || v.lang.toLowerCase().includes('kh'))
    }

    if (voice) {
      utterance.voice = voice
    }
    
    // Set appropriate lang tag
    utterance.lang = {
      lo: 'lo-LA',
      en: 'en-US',
      hm: 'hmn-CN',
      km: 'khm-KH',
    }[language] || 'en-US'

    utterance.onstart = () => setIsSpeaking(true)
    utterance.onend = () => setIsSpeaking(false)
    utterance.onerror = () => setIsSpeaking(false)

    window.speechSynthesis.speak(utterance)
  }

  // Trigger voice loading in browser
  useEffect(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.getVoices()
    }
  }, [])

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <button
        type="button"
        onClick={handlePlayStop}
        className={`flex items-center gap-2 rounded-full border-2 px-3.5 py-2 text-sm font-bold transition-all ${
          isSpeaking 
            ? 'border-red-500 bg-red-50 text-red-800 scale-102 shadow-sm animate-pulse' 
            : 'border-emerald-600 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 active:scale-98'
        }`}
      >
        {isSpeaking ? (
          <>
            <span className="w-5 h-5 flex items-center justify-center shrink-0">
              <span className="w-2.5 h-2.5 bg-red-700 rounded-sm" />
            </span>
            <span>Stop Speaking</span>
          </>
        ) : (
          <>
            <SpeakerIcon className="w-5 h-5 shrink-0" />
            <span>{t('audio.play_button')}</span>
          </>
        )}
      </button>
    </div>
  )
}
