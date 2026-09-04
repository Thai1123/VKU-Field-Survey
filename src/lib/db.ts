import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { InspectionRecord, SyncStatus } from './types';

const DB_NAME = 'vku-field-survey';
const DB_VERSION = 1;
const STORE = 'inspections';

interface FieldSurveyDB extends DBSchema {
  inspections: {
    key: string;
    value: InspectionRecord;
    indexes: { 'by-status': string; 'by-updatedAt': number };
  };
}

let dbPromise: Promise<IDBPDatabase<FieldSurveyDB>> | null = null;

/**
 * Single shared DB connection. Both the React app (main thread) and the
 * Service Worker (background sync) open this same database by name, so a
 * record saved offline in the UI is immediately visible to the SW sync
 * routine once connectivity returns — no extra message-passing required.
 */
export function getDB(): Promise<IDBPDatabase<FieldSurveyDB>> {
  if (!dbPromise) {
    dbPromise = openDB<FieldSurveyDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('by-status', 'status');
        store.createIndex('by-updatedAt', 'updatedAt');
      },
    });
  }
  return dbPromise;
}

export async function saveRecord(record: InspectionRecord): Promise<void> {
  const db = await getDB();
  await db.put(STORE, { ...record, updatedAt: Date.now() });
}

export async function getRecord(id: string): Promise<InspectionRecord | undefined> {
  const db = await getDB();
  return db.get(STORE, id);
}

export async function getAllRecords(): Promise<InspectionRecord[]> {
  const db = await getDB();
  const all = await db.getAll(STORE);
  return all.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getRecordsByStatus(status: SyncStatus): Promise<InspectionRecord[]> {
  const db = await getDB();
  return db.getAllFromIndex(STORE, 'by-status', status);
}

export async function getPendingRecords(): Promise<InspectionRecord[]> {
  const db = await getDB();
  const tx = db.transaction(STORE);
  const all = await tx.store.getAll();
  return all.filter((r) => r.status === 'PENDING_SYNC');
}

export async function updateStatus(
  id: string,
  status: SyncStatus,
  lastError?: string,
): Promise<void> {
  const db = await getDB();
  const record = await db.get(STORE, id);
  if (!record) return;
  record.status = status;
  record.updatedAt = Date.now();
  record.lastError = lastError;
  await db.put(STORE, record);
}

export async function deleteRecord(id: string): Promise<void> {
  const db = await getDB();
  await db.delete(STORE, id);
}

/**
 * On app startup, recover any records stuck in SYNCING state
 * (e.g. the app crashed or was closed mid-sync). Move them back
 * to PENDING_SYNC so the next sync cycle picks them up.
 */
export async function recoverStuckSyncing(): Promise<number> {
  const db = await getDB();
  const stuck = await db.getAllFromIndex(STORE, 'by-status', 'SYNCING');
  for (const record of stuck) {
    record.status = 'PENDING_SYNC';
    record.updatedAt = Date.now();
    await db.put(STORE, record);
  }
  return stuck.length;
}

/**
 * Reset a SYNC_ERROR record back to PENDING_SYNC with retryCount = 0
 * so the user can manually re-trigger sync.
 */
export async function resetForRetry(id: string): Promise<void> {
  const db = await getDB();
  const record = await db.get(STORE, id);
  if (!record) return;
  record.status = 'PENDING_SYNC';
  record.retryCount = 0;
  record.lastError = undefined;
  record.updatedAt = Date.now();
  await db.put(STORE, record);
}
