import { useCallback, useEffect, useState } from 'react';
import { useNetworkStatus, requestSync } from './hooks/useNetworkStatus';
import { getAllRecords, recoverStuckSyncing } from './lib/db';
import { syncPendingRecords } from './lib/sync';
import type { InspectionRecord } from './lib/types';
import { InspectionForm } from './components/InspectionForm';
import { InspectionList } from './components/InspectionList';
import { ToastContainer, showToast } from './components/Toast';

type Tab = 'form' | 'queue';

export default function App() {
  const isOnline = useNetworkStatus();
  const [tab, setTab] = useState<Tab>('form');
  const [records, setRecords] = useState<InspectionRecord[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [editRecord, setEditRecord] = useState<InspectionRecord | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

  const refresh = useCallback(() => {
    void getAllRecords().then(setRecords);
  }, []);

  // Startup: recover stuck records and fetch latest data
  useEffect(() => {
    recoverStuckSyncing().then((count) => {
      if (count > 0) {
        showToast('info', `Đã phục hồi ${count} bản ghi bị gián đoạn khi đồng bộ`);
      }
      refresh();
    });
  }, [refresh]);

  // Listen to ServiceWorker background sync events
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    function onMessage(event: MessageEvent) {
      if (event.data?.type === 'SYNC_COMPLETE') {
        const result = event.data.result;
        if (result) {
          if (result.succeeded > 0) {
            showToast('success', `Đồng bộ thành công ${result.succeeded} bản ghi lên máy chủ`);
          }
          if (result.failed > 0) {
            showToast('error', `Có ${result.failed} bản ghi đồng bộ không thành công`);
          }
          setLastSyncTime(new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }));
        }
        refresh();
      }
    }
    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, [refresh]);

  async function handleSyncNow() {
    setIsSyncing(true);
    try {
      const result = await syncPendingRecords();
      if (result.succeeded > 0) {
        showToast('success', `Đã gửi ${result.succeeded} bản ghi lên máy chủ thành công!`);
        setLastSyncTime(new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }));
      }
      if (result.failed > 0) {
        showToast('error', `Thất bại ${result.failed} bản ghi — có thể do mất mạng đột ngột.`);
      }
      if (result.attempted === 0) {
        showToast('info', 'Tất cả dữ liệu đã được đồng bộ mới nhất');
      }
    } catch {
      showToast('error', 'Lỗi không xác định trong quá trình đồng bộ');
    } finally {
      setIsSyncing(false);
      refresh();
    }
  }

  useEffect(() => {
    if (isOnline) void requestSync().then(refresh);
  }, [isOnline, refresh]);

  function handleEditDraft(record: InspectionRecord) {
    setEditRecord(record);
    setTab('form');
  }

  const pendingCount = records.filter((r) => r.status === 'PENDING_SYNC').length;
  const errorCount = records.filter((r) => r.status === 'SYNC_ERROR').length;
  const totalActionNeeded = pendingCount + errorCount;

  return (
    <div className="app-shell">
      {/* Top Header */}
      <header className="app-header">
        <div className="app-header__brand">
          <div className="app-header__logo">
            <span className="app-header__logo-text">VKU</span>
          </div>
          <div className="app-header__titles">
            <h1 className="app-header__name">Field Survey</h1>
            <span className="app-header__tagline">Kiểm định cơ sở vật chất</span>
          </div>
        </div>

        <div className="app-header__right">
          <div className={`network-pill ${isOnline ? 'network-pill--online' : 'network-pill--offline'}`}>
            <span className="network-pill__dot" />
            <span className="network-pill__text">
              {isOnline ? 'Trực tuyến' : 'Ngoại tuyến'}
            </span>
          </div>

          {lastSyncTime && (
            <span className="last-sync-time" title="Lần đồng bộ thành công gần nhất">
              🕒 {lastSyncTime}
            </span>
          )}
        </div>
      </header>

      {/* Main Body */}
      <main className="main-viewport">
        {tab === 'form' ? (
          <InspectionForm
            isOnline={isOnline}
            onSubmitted={refresh}
            editRecord={editRecord}
            onEditCleared={() => setEditRecord(null)}
          />
        ) : (
          <InspectionList
            records={records}
            isOnline={isOnline}
            isSyncing={isSyncing}
            onSyncNow={handleSyncNow}
            onRefresh={refresh}
            onEditDraft={handleEditDraft}
          />
        )}
      </main>

      {/* Modern Bottom Navigation */}
      <nav className="dock-nav">
        <button
          type="button"
          className={`dock-nav__item ${tab === 'form' ? 'dock-nav__item--active' : ''}`}
          onClick={() => setTab('form')}
        >
          <div className="dock-nav__icon-wrap">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </div>
          <span className="dock-nav__label">Khảo sát mới</span>
        </button>

        <button
          type="button"
          className={`dock-nav__item ${tab === 'queue' ? 'dock-nav__item--active' : ''}`}
          onClick={() => setTab('queue')}
        >
          <div className="dock-nav__icon-wrap">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              <line x1="12" y1="11" x2="12" y2="17" />
              <line x1="9" y1="14" x2="15" y2="14" />
            </svg>
            {totalActionNeeded > 0 && (
              <span className={`dock-nav__badge ${errorCount > 0 ? 'dock-nav__badge--danger' : ''}`}>
                {totalActionNeeded}
              </span>
            )}
          </div>
          <span className="dock-nav__label">Hàng đợi</span>
        </button>
      </nav>

      {/* Global Toast notifications */}
      <ToastContainer />
    </div>
  );
}
