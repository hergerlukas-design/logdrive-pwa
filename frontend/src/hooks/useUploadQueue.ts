import { useState, useEffect, useCallback, useRef } from 'react'
import {
  addToQueue,
  getAllQueueItems,
  getPendingItems,
  resetStaleUploads,
  withQueueLock,
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

  const processingRef = useRef(false)

  const processQueue = useCallback(async () => {
    if (processingRef.current || !navigator.onLine || !isDropboxConnected()) return
    processingRef.current = true
    setIsProcessing(true)
    try {
      await withQueueLock(async () => {
        await resetStaleUploads()
        for (const item of await getPendingItems()) {
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
      })
    } finally {
      processingRef.current = false
      setIsProcessing(false)
      await refreshQueue()
    }
  }, [refreshQueue])

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
