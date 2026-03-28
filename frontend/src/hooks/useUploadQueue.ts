import { useState, useEffect, useCallback } from 'react'
import {
  addToQueue,
  getAllQueueItems,
  updateQueueItem,
  removeFromQueue,
  type QueueItem,
} from '../lib/db'
import { uploadPdfToDropbox, isDropboxConnected } from '../lib/dropboxClient'

export function useUploadQueue() {
  const [queueItems,   setQueueItems]   = useState<QueueItem[]>([])
  const [isProcessing, setIsProcessing] = useState(false)

  const refreshQueue = useCallback(async () => {
    setQueueItems(await getAllQueueItems())
  }, [])

  const processQueue = useCallback(async () => {
    if (isProcessing || !navigator.onLine || !isDropboxConnected()) return
    setIsProcessing(true)
    try {
      const items   = await getAllQueueItems()
      const pending = items.filter(i => i.status === 'pending' || i.status === 'error')
      for (const item of pending) {
        try {
          await updateQueueItem(item.id!, { status: 'uploading' })
          await refreshQueue()
          await uploadPdfToDropbox(item.pdfBlob, item.fileName, item.folderPath)
          await removeFromQueue(item.id!)
        } catch (err) {
          await updateQueueItem(item.id!, {
            status:    'error',
            retries:   (item.retries ?? 0) + 1,
            lastError: (err as Error).message,
          })
        }
      }
    } finally {
      setIsProcessing(false)
      await refreshQueue()
    }
  }, [isProcessing, refreshQueue])

  const enqueue = useCallback(async (item: { pdfBlob: Blob; fileName: string; folderPath: string }) => {
    const id = await addToQueue(item)
    await refreshQueue()
    if (navigator.onLine && isDropboxConnected()) await processQueue()
    return id
  }, [refreshQueue, processQueue])

  useEffect(() => { refreshQueue() }, [refreshQueue])

  useEffect(() => {
    window.addEventListener('online', processQueue)
    return () => window.removeEventListener('online', processQueue)
  }, [processQueue])

  const pendingCount = queueItems.filter(
    i => i.status === 'pending' || i.status === 'uploading' || i.status === 'error'
  ).length

  return { queueItems, pendingCount, isProcessing, enqueue, processQueue, refreshQueue }
}
