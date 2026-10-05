import Dexie from 'dexie'

export interface QueueItem {
  id?:        number
  pdfBlob:    Blob
  fileName:   string
  folderPath: string
  status:     'pending' | 'uploading' | 'done' | 'error'
  createdAt:  string
  retries:    number
  lastError?: string
}

class LogDriveDB extends Dexie {
  queue!: Dexie.Table<QueueItem, number>

  constructor() {
    super('LogDriveDB')
    this.version(1).stores({ queue: '++id, status, createdAt' })
  }
}

const db = new LogDriveDB()

export async function addToQueue(item: Omit<QueueItem, 'id' | 'status' | 'createdAt' | 'retries'>): Promise<number> {
  return db.queue.add({ ...item, status: 'pending', createdAt: new Date().toISOString(), retries: 0 })
}

export async function getPendingItems(): Promise<QueueItem[]> {
  return db.queue.where('status').anyOf(['pending', 'error']).sortBy('createdAt')
}

/** Setzt Einträge zurück, deren Upload abgebrochen wurde (App geschlossen oder neu geladen). */
export async function resetStaleUploads(): Promise<number> {
  return db.queue.where('status').equals('uploading').modify({ status: 'pending' })
}

/**
 * Führt `fn` nur aus, wenn kein anderer Tab gerade die Warteschlange abarbeitet.
 * Solange wir die Sperre halten, kann ein Eintrag im Status 'uploading' nur hängengeblieben sein.
 */
export async function withQueueLock(fn: () => Promise<void>): Promise<void> {
  if (!('locks' in navigator)) return fn()
  await navigator.locks.request('logdrive-upload-queue', { ifAvailable: true }, async lock => {
    if (lock) await fn()
  })
}

export async function updateQueueItem(id: number, changes: Partial<QueueItem>): Promise<number> {
  return db.queue.update(id, changes)
}

export async function removeFromQueue(id: number): Promise<void> {
  return db.queue.delete(id)
}

export async function getAllQueueItems(): Promise<QueueItem[]> {
  return db.queue.orderBy('createdAt').reverse().toArray()
}

export default db
