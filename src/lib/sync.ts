import { getPendingRecords, updateStatus, getDB } from './db';
import type { InspectionRecord } from './types';

export const API_ENDPOINT = '/api/inspections';

const MAX_RETRIES = 5;

export interface SyncResult {
  attempted: number;
  succeeded: number;
  failed: number;
  errors: string[];
}

/** Classifies HTTP errors into permanent (don't retry) vs transient (retry). */
function isPermanentError(status: number): boolean {
  // 4xx errors (except 408 Request Timeout and 429 Too Many Requests) are permanent
  return status >= 400 && status < 500 && status !== 408 && status !== 429;
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  let binary = '';
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

async function sendRecord(record: InspectionRecord): Promise<void> {
  const payload: Record<string, unknown> = {
    id: record.id,
    building: record.building,
    floor: record.floor,
    room: record.room,
    category: record.category,
    rating: record.rating,
    notes: record.notes,
    createdAt: record.createdAt,
  };
  if (record.photo) {
    payload.photoBase64 = await blobToBase64(record.photo);
    payload.photoName = record.photoName ?? 'photo.jpg';
  }

  let res: Response;
  try {
    res = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // The server is expected to upsert by `id`, so retried/duplicate
      // deliveries (e.g. a sync interrupted mid-batch) are idempotent.
      body: JSON.stringify(payload),
    });
  } catch {
    // Network error (no response at all) — always transient
    throw new SyncError('Lỗi mạng — không thể kết nối đến server', false);
  }

  if (!res.ok) {
    const permanent = isPermanentError(res.status);
    throw new SyncError(
      `Server trả về lỗi ${res.status}`,
      permanent,
    );
  }
}

class SyncError extends Error {
  constructor(message: string, public readonly permanent: boolean) {
    super(message);
    this.name = 'SyncError';
  }
}

/**
 * Walks every PENDING_SYNC record, one at a time (sequential — not
 * Promise.all) so a flaky connection fails one record instead of firing a
 * burst of parallel requests that could all time out together.
 *
 * Error handling strategy:
 * - Permanent errors (4xx): mark as SYNC_ERROR immediately, continue batch
 * - Transient errors (network/5xx): increment retryCount, keep PENDING_SYNC
 *   if under MAX_RETRIES, otherwise mark SYNC_ERROR. Break batch (connectivity
 *   likely dropped).
 */
export async function syncPendingRecords(): Promise<SyncResult> {
  const pending = await getPendingRecords();
  const result: SyncResult = { attempted: pending.length, succeeded: 0, failed: 0, errors: [] };

  for (const record of pending) {
    await updateStatus(record.id, 'SYNCING');
    try {
      await sendRecord(record);
      await updateStatus(record.id, 'SYNCED');
      // Reset retryCount on success
      const db = await getDB();
      const saved = await db.get('inspections', record.id);
      if (saved) {
        saved.retryCount = 0;
        await db.put('inspections', saved);
      }
      result.succeeded++;
    } catch (err) {
      const syncErr = err instanceof SyncError ? err : null;
      const message = err instanceof Error ? err.message : 'Lỗi đồng bộ không xác định';
      const isPermanent = syncErr?.permanent ?? false;

      const currentRetry = (record.retryCount ?? 0) + 1;

      if (isPermanent || currentRetry >= MAX_RETRIES) {
        // Mark as permanent failure
        await updateStatus(record.id, 'SYNC_ERROR', message);
        // Also update retryCount
        const db = await getDB();
        const saved = await db.get('inspections', record.id);
        if (saved) {
          saved.retryCount = currentRetry;
          await db.put('inspections', saved);
        }
        result.failed++;
        result.errors.push(`${record.id.slice(0, 8)}: ${message}`);

        if (isPermanent) {
          // Permanent error — continue with next record, server won't accept this one
          continue;
        } else {
          // Max retries exceeded on transient error — break batch
          break;
        }
      } else {
        // Transient error, under max retries — keep as PENDING_SYNC
        await updateStatus(record.id, 'PENDING_SYNC', message);
        const db = await getDB();
        const saved = await db.get('inspections', record.id);
        if (saved) {
          saved.retryCount = currentRetry;
          await db.put('inspections', saved);
        }
        result.failed++;
        result.errors.push(`${record.id.slice(0, 8)}: ${message} (lần ${currentRetry}/${MAX_RETRIES})`);
        // Transient error — connectivity likely dropped, stop batch
        break;
      }
    }
  }

  return result;
}
