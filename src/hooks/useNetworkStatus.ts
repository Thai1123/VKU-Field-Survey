import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { syncPendingRecords } from '../lib/sync';
import { SYNC_TAG } from '../lib/types';

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    let removeNativeListener: (() => void) | undefined;

    async function handleReconnect() {
      setIsOnline(true);
      await requestSync();
    }
    function handleOffline() {
      setIsOnline(false);
    }

    if (Capacitor.isNativePlatform()) {
      // Native APK: use the real network plugin instead of the WebView's
      // (sometimes unreliable) online/offline events.
      import('@capacitor/network').then(({ Network }) => {
        Network.getStatus().then((s) => setIsOnline(s.connected));
        Network.addListener('networkStatusChange', (status) => {
          if (status.connected) void handleReconnect();
          else handleOffline();
        }).then((handle) => {
          removeNativeListener = () => handle.remove();
        });
      });
    } else {
      window.addEventListener('online', handleReconnect);
      window.addEventListener('offline', handleOffline);
    }

    return () => {
      window.removeEventListener('online', handleReconnect);
      window.removeEventListener('offline', handleOffline);
      removeNativeListener?.();
    };
  }, []);

  return isOnline;
}

/**
 * Ask the Service Worker to register a Background Sync tag. If the browser
 * doesn't support Background Sync (Safari/iOS, some Android WebViews), fall
 * back to running the sync immediately on the main thread — same end result,
 * just without the "retry even if the tab is closed" guarantee.
 */
export async function requestSync(): Promise<void> {
  if ('serviceWorker' in navigator) {
    const registration = await navigator.serviceWorker.ready;
    if ('sync' in registration) {
      try {
        await (registration as any).sync.register(SYNC_TAG);
        return;
      } catch {
        // fall through to immediate sync
      }
    }
  }
  await syncPendingRecords();
}
