export type Category =
  | 'Hardware'
  | 'Projector'
  | 'AC'
  | 'Electrical'
  | 'Furniture';

export const CATEGORIES: Category[] = [
  'Hardware',
  'Projector',
  'AC',
  'Electrical',
  'Furniture',
];

export type SyncStatus =
  | 'DRAFT'
  | 'PENDING_SYNC'
  | 'SYNCING'
  | 'SYNCED'
  | 'SYNC_ERROR';

export const SYNC_TAG = 'vku-sync-inspections';

/**
 * A single facility inspection record.
 * `id` is a client-generated UUID so the server can dedupe/upsert safely
 * even if the same record is sent more than once (e.g. a retried sync).
 */
export interface InspectionRecord {
  id: string;

  building: string;
  floor: string;
  room: string;

  // GPS location
  latitude?: number;
  longitude?: number;

  category: Category | '';
  rating: number; // 1-5, 0 = not yet set

  notes: string;

  photo?: Blob;
  photoName?: string;

  createdAt: number;
  updatedAt: number;

  status: SyncStatus;
  retryCount: number;
  lastError?: string;
}

export function createEmptyRecord(id: string): InspectionRecord {
  const now = Date.now();

  return {
    id,

    building: '',
    floor: '',
    room: '',

    // Chưa lấy GPS
    latitude: undefined,
    longitude: undefined,

    category: '',
    rating: 0,

    notes: '',

    createdAt: now,
    updatedAt: now,

    status: 'DRAFT',
    retryCount: 0,
  };
}