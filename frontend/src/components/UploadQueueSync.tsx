import { useEffect } from 'react'
import { useUploadQueue } from '../hooks/useUploadQueue'

/** Lädt offline gespeicherte Belege nach Dropbox hoch – beim Start, wenn wieder online und beim Zurückkehren in die App. */
export function UploadQueueSync() {
  const { processQueue } = useUploadQueue()

  useEffect(() => {
    processQueue()
    const onVisible = () => { if (document.visibilityState === 'visible') processQueue() }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [processQueue])

  return null
}
