import { useState, useRef, useCallback, useEffect } from 'react'

export function useCamera() {
  const videoRef              = useRef<HTMLVideoElement>(null)
  const streamRef             = useRef<MediaStream | null>(null)
  const mountedRef            = useRef(true)
  const [isReady,     setIsReady]     = useState(false)
  const [error,       setError]       = useState<string | null>(null)
  const [facingMode,  setFacingMode]  = useState<'environment' | 'user'>('environment')

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
  }, [])

  const startCamera = useCallback(async () => {
    if (!mountedRef.current) return
    setError(null)
    setIsReady(false)
    stopStream()

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: facingMode }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      })
      if (!mountedRef.current) { stream.getTracks().forEach(t => t.stop()); return }

      streamRef.current = stream
      const video = videoRef.current
      if (!video) return
      video.srcObject = stream

      try { await video.play() } catch (playErr) {
        if ((playErr as Error).name === 'AbortError') return
        throw playErr
      }
      if (mountedRef.current) setIsReady(true)
    } catch (err) {
      if (!mountedRef.current || (err as Error).name === 'AbortError') return
      const name = (err as Error).name
      if (name === 'NotAllowedError') {
        setError('Kamera-Zugriff verweigert. Bitte in den Browser-Einstellungen erlauben.')
      } else if (name === 'NotFoundError') {
        setError('Keine Kamera gefunden.')
      } else {
        setError(`Kamera-Fehler: ${(err as Error).message}`)
      }
    }
  }, [facingMode, stopStream])

  const stopCamera = useCallback(() => {
    stopStream()
    if (mountedRef.current) setIsReady(false)
  }, [stopStream])

  const takePhoto = useCallback((): string | null => {
    const video = videoRef.current
    if (!video || !isReady) return null
    const canvas  = document.createElement('canvas')
    canvas.width  = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')!.drawImage(video, 0, 0)
    return canvas.toDataURL('image/jpeg', 0.92)
  }, [isReady])

  const flipCamera = useCallback(() => {
    setFacingMode(prev => prev === 'environment' ? 'user' : 'environment')
  }, [])

  useEffect(() => { startCamera() }, [facingMode]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => stopStream(), [stopStream])

  return { videoRef, isReady, error, facingMode, startCamera, stopCamera, takePhoto, flipCamera }
}
