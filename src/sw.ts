/// <reference lib="webworker" />

import {
  precacheAndRoute,
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
} from 'workbox-precaching';

import { registerRoute } from 'workbox-routing';

import { syncPendingRecords } from './lib/sync';
import { SYNC_TAG } from './lib/types';

declare let self: ServiceWorkerGlobalScope;

// ===============================
// 1. PRECACHE APP SHELL
// ===============================

precacheAndRoute(self.__WB_MANIFEST);

cleanupOutdatedCaches();

// ===============================
// 2. OFFLINE NAVIGATION FALLBACK
// ===============================

// Khi F5 hoặc truy cập route lúc Offline,
// luôn trả index.html từ cache.
const handler = createHandlerBoundToURL('/index.html');

registerRoute(
  ({ request }) => request.mode === 'navigate',
  handler
);

// ===============================
// 3. SERVICE WORKER LIFECYCLE
// ===============================

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// ===============================
// 4. BACKGROUND SYNC
// ===============================

self.addEventListener('sync', (event: any) => {
  if (event.tag === SYNC_TAG) {
    event.waitUntil(runSyncAndNotify());
  }
});

// ===============================
// 5. MESSAGE FROM APP
// ===============================

self.addEventListener('message', (event) => {
  if (event.data?.type === 'REQUEST_SYNC') {
    event.waitUntil(runSyncAndNotify());
  }
});

// ===============================
// 6. SYNC FUNCTION
// ===============================

async function runSyncAndNotify() {
  const result = await syncPendingRecords();

  const clients = await self.clients.matchAll({
    type: 'window',
  });

  for (const client of clients) {
    client.postMessage({
      type: 'SYNC_COMPLETE',
      result,
    });
  }
}

export function registerBackgroundSync(
  registration: ServiceWorkerRegistration
) {
  return (registration as any).sync?.register(SYNC_TAG);
}

export { SYNC_TAG };