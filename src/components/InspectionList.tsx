import { useState, useMemo, useEffect } from 'react';
import type { InspectionRecord, SyncStatus } from '../lib/types';
import { deleteRecord, resetForRetry } from '../lib/db';
import { showToast } from './Toast';

interface Props {
  records: InspectionRecord[];
  isOnline: boolean;
  isSyncing: boolean;
  onSyncNow: () => void;
  onRefresh: () => void;
  onEditDraft?: (record: InspectionRecord) => void;
}

const STATUS_CONFIG: Record<
  SyncStatus,
  { label: string; icon: string; badgeClass: string; borderClass: string }
> = {
  DRAFT: {
    label: 'Bản nháp',
    icon: '📝',
    badgeClass: 'badge--draft',
    borderClass: 'card--draft',
  },
  PENDING_SYNC: {
    label: 'Chờ đồng bộ',
    icon: '⏳',
    badgeClass: 'badge--pending',
    borderClass: 'card--pending',
  },
  SYNCING: {
    label: 'Đang gửi...',
    icon: '🔄',
    badgeClass: 'badge--syncing',
    borderClass: 'card--syncing',
  },
  SYNCED: {
    label: 'Đã đồng bộ',
    icon: '✓',
    badgeClass: 'badge--synced',
    borderClass: 'card--synced',
  },
  SYNC_ERROR: {
    label: 'Lỗi đồng bộ',
    icon: '⚠️',
    badgeClass: 'badge--error',
    borderClass: 'card--error',
  },
};

const CATEGORY_ICONS: Record<string, string> = {
  Hardware: '🖥️ Phần cứng',
  Projector: '📽️ Máy chiếu',
  AC: '❄️ Điều hòa',
  Electrical: '⚡ Điện & Đèn',
  Furniture: '🪑 Bàn ghế',
};

function formatRecordTitle(r: InspectionRecord): string {
  if (!r.building.trim() && !r.floor.trim() && !r.room.trim()) {
    return 'Bản nháp chưa đặt tên';
  }
  const parts: string[] = [];
  if (r.building) parts.push(r.building);
  if (r.floor) parts.push(r.floor);
  if (r.room) parts.push(`Phòng ${r.room}`);
  return parts.join(' • ');
}

export function InspectionList({
  records,
  isOnline,
  isSyncing,
  onSyncNow,
  onRefresh,
  onEditDraft,
}: Props) {
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [activePhotoUrl, setActivePhotoUrl] = useState<string | null>(null);

  // Counters
  const counts = useMemo(() => {
    return {
      all: records.length,
      pending: records.filter((r) => r.status === 'PENDING_SYNC').length,
      synced: records.filter((r) => r.status === 'SYNCED').length,
      error: records.filter((r) => r.status === 'SYNC_ERROR').length,
      draft: records.filter((r) => r.status === 'DRAFT').length,
    };
  }, [records]);

  // Filtered list
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      // Status filter
      if (filterStatus !== 'ALL' && r.status !== filterStatus) {
        return false;
      }
      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const titleMatch = formatRecordTitle(r).toLowerCase().includes(q);
        const notesMatch = r.notes?.toLowerCase().includes(q);
        const catMatch = r.category?.toLowerCase().includes(q);
        const idMatch = r.id.toLowerCase().includes(q);
        return titleMatch || notesMatch || catMatch || idMatch;
      }
      return true;
    });
  }, [records, filterStatus, searchQuery]);

  async function handleDelete(id: string) {
    await deleteRecord(id);
    setConfirmDeleteId(null);
    showToast('info', 'Đã xóa bản ghi khỏi thiết bị');
    onRefresh();
  }

  async function handleRetry(id: string) {
    await resetForRetry(id);
    showToast('info', 'Đã chuyển sang hàng chờ để thử đồng bộ lại');
    onRefresh();
  }

  async function handleCleanEmptyDrafts() {
    const emptyDrafts = records.filter(
      (r) => r.status === 'DRAFT' && !r.building && !r.floor && !r.room && !r.notes
    );
    for (const d of emptyDrafts) {
      await deleteRecord(d.id);
    }
    showToast('info', `Đã dọn dẹp ${emptyDrafts.length} bản nháp trống`);
    onRefresh();
  }

  const emptyDraftsCount = records.filter(
    (r) => r.status === 'DRAFT' && !r.building && !r.floor && !r.room && !r.notes
  ).length;

  return (
    <div className="queue-container">
      {/* KPI Stats Row */}
      <div className="kpi-grid">
        <div className="kpi-card" onClick={() => setFilterStatus('ALL')}>
          <div className="kpi-card__number">{counts.all}</div>
          <div className="kpi-card__label">Tổng phiếu</div>
        </div>
        <div
          className="kpi-card kpi-card--pending"
          onClick={() => setFilterStatus('PENDING_SYNC')}
        >
          <div className="kpi-card__number">{counts.pending}</div>
          <div className="kpi-card__label">Chờ đồng bộ</div>
        </div>
        <div
          className="kpi-card kpi-card--synced"
          onClick={() => setFilterStatus('SYNCED')}
        >
          <div className="kpi-card__number">{counts.synced}</div>
          <div className="kpi-card__label">Đã lên Server</div>
        </div>
        <div
          className={`kpi-card ${counts.error > 0 ? 'kpi-card--error' : ''}`}
          onClick={() => setFilterStatus('SYNC_ERROR')}
        >
          <div className="kpi-card__number">{counts.error}</div>
          <div className="kpi-card__label">Cần xử lý</div>
        </div>
      </div>

      {/* Main Action Bar */}
      <div className="queue-header-actions">
        <div className="queue-header-title">
          <h3>Hàng đợi & Lịch sử</h3>
          <span className="queue-header-sub">Quản lý đồng bộ dữ liệu ngoại tuyến</span>
        </div>
        <button
          type="button"
          className="btn btn--primary btn--sync"
          disabled={!isOnline || counts.pending === 0 || isSyncing}
          onClick={onSyncNow}
        >
          {isSyncing ? (
            <>
              <span className="spinner" /> Đang đồng bộ...
            </>
          ) : (
            <>
              <span>⚡</span> Đồng bộ ngay ({counts.pending})
            </>
          )}
        </button>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="filter-toolbar">
        <div className="search-box">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            className="search-input"
            placeholder="Tìm theo phòng, tòa nhà, ghi chú..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              className="search-clear"
              onClick={() => setSearchQuery('')}
            >
              ✕
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="status-pills">
          <button
            type="button"
            className={`status-pill ${filterStatus === 'ALL' ? 'status-pill--active' : ''}`}
            onClick={() => setFilterStatus('ALL')}
          >
            Tất cả ({counts.all})
          </button>
          <button
            type="button"
            className={`status-pill ${
              filterStatus === 'PENDING_SYNC' ? 'status-pill--active' : ''
            }`}
            onClick={() => setFilterStatus('PENDING_SYNC')}
          >
            ⏳ Chờ gửi ({counts.pending})
          </button>
          <button
            type="button"
            className={`status-pill ${filterStatus === 'SYNCED' ? 'status-pill--active' : ''}`}
            onClick={() => setFilterStatus('SYNCED')}
          >
            ✓ Đã gửi ({counts.synced})
          </button>
          {counts.error > 0 && (
            <button
              type="button"
              className={`status-pill status-pill--danger ${
                filterStatus === 'SYNC_ERROR' ? 'status-pill--active' : ''
              }`}
              onClick={() => setFilterStatus('SYNC_ERROR')}
            >
              ⚠️ Lỗi ({counts.error})
            </button>
          )}
          <button
            type="button"
            className={`status-pill ${filterStatus === 'DRAFT' ? 'status-pill--active' : ''}`}
            onClick={() => setFilterStatus('DRAFT')}
          >
            📝 Nháp ({counts.draft})
          </button>
        </div>
      </div>

      {/* Empty Drafts Cleanup Bar */}
      {emptyDraftsCount > 1 && (
        <div className="cleanup-banner">
          <span>Phát hiện {emptyDraftsCount} bản nháp trống chưa điền.</span>
          <button
            type="button"
            className="btn-cleanup"
            onClick={handleCleanEmptyDrafts}
          >
            Dọn dẹp ngay
          </button>
        </div>
      )}

      {/* Records List */}
      {filteredRecords.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__icon">📭</div>
          <h4 className="empty-state__title">Không tìm thấy khảo sát nào</h4>
          <p>
            {searchQuery
              ? 'Thử thay đổi từ khóa tìm kiếm.'
              : 'Hãy tạo phiếu khảo sát mới ở tab bên dưới.'}
          </p>
        </div>
      ) : (
        <div className="records-feed">
          {filteredRecords.map((r) => {
            const statusInfo = STATUS_CONFIG[r.status];
            return (
              <RecordCardItem
                key={r.id}
                record={r}
                statusInfo={statusInfo}
                confirmDeleteId={confirmDeleteId}
                onSetConfirmDeleteId={setConfirmDeleteId}
                onDelete={handleDelete}
                onRetry={handleRetry}
                onEditDraft={onEditDraft}
                onViewPhoto={(url) => setActivePhotoUrl(url)}
              />
            );
          })}
        </div>
      )}

      {/* Full Photo Modal */}
      {activePhotoUrl && (
        <div className="lightbox-backdrop" onClick={() => setActivePhotoUrl(null)}>
          <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
            <img src={activePhotoUrl} alt="Ảnh kiểm tra cơ sở" className="lightbox-img" />
            <button
              type="button"
              className="lightbox-close-btn"
              onClick={() => setActivePhotoUrl(null)}
            >
              ✕ Đóng
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface ItemProps {
  record: InspectionRecord;
  statusInfo: { label: string; icon: string; badgeClass: string; borderClass: string };
  confirmDeleteId: string | null;
  onSetConfirmDeleteId: (id: string | null) => void;
  onDelete: (id: string) => void;
  onRetry: (id: string) => void;
  onEditDraft?: (record: InspectionRecord) => void;
  onViewPhoto: (url: string) => void;
}

function RecordCardItem({
  record,
  statusInfo,
  confirmDeleteId,
  onSetConfirmDeleteId,
  onDelete,
  onRetry,
  onEditDraft,
  onViewPhoto,
}: ItemProps) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!record.photo) {
      setPhotoUrl(null);
      return;
    }
    const url = URL.createObjectURL(record.photo);
    setPhotoUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [record.photo]);

  const isConfirmingDelete = confirmDeleteId === record.id;
  const isDraft = record.status === 'DRAFT';
  const isError = record.status === 'SYNC_ERROR';

  return (
    <div className={`card-item ${statusInfo.borderClass}`}>
      <div className="card-item__header">
        <div className="card-item__main-info">
          <div className="card-item__title">{formatRecordTitle(record)}</div>
          <div className="card-item__sub-row">
            <span className="card-item__id">#{record.id.slice(0, 8)}</span>
            <span className="card-item__time">
              {new Date(record.updatedAt || record.createdAt).toLocaleString('vi-VN', {
                hour: '2-digit',
                minute: '2-digit',
                day: '2-digit',
                month: '2-digit',
              })}
            </span>
          </div>
        </div>

        <span className={`status-badge ${statusInfo.badgeClass}`}>
          <span className="status-badge__icon">{statusInfo.icon}</span>
          {statusInfo.label}
        </span>
      </div>

      {/* Meta tags (Category, Rating) */}
      <div className="card-item__meta-tags">
        {record.category && (
          <span className="meta-tag meta-tag--category">
            {CATEGORY_ICONS[record.category] ?? record.category}
          </span>
        )}
        {record.rating > 0 && (
          <span className="meta-tag meta-tag--rating">
            {'★'.repeat(record.rating)}{'☆'.repeat(5 - record.rating)}
          </span>
        )}
      </div>

      {/* Notes */}
      {record.notes && (
        <div className="card-item__notes">
          <span className="card-item__notes-icon">💬</span>
          <span className="card-item__notes-text">{record.notes}</span>
        </div>
      )}

      {/* Error Callout */}
      {record.lastError && (
        <div className="card-item__error-box">
          <span className="error-icon">⚠️</span>
          <div className="error-text">
            <strong>{record.lastError}</strong>
            {(record.retryCount ?? 0) > 0 && (
              <span className="retry-badge"> (Đã thử {record.retryCount}/5 lần)</span>
            )}
          </div>
        </div>
      )}

      {/* Attached Photo Thumbnail */}
      {photoUrl && (
        <div className="card-item__photo-row">
          <div
            className="photo-thumb"
            onClick={() => onViewPhoto(photoUrl)}
            title="Bấm để phóng to ảnh"
          >
            <img src={photoUrl} alt="Minh chứng" className="photo-thumb__img" />
            <span className="photo-thumb__overlay">🔍 Xem ảnh</span>
          </div>
          <div className="photo-thumb__label">
            <span>Ảnh minh chứng</span>
            <small>{record.photoName || 'inspection.jpg'}</small>
          </div>
        </div>
      )}

      {/* Action Buttons Toolbar */}
      <div className="card-item__footer">
        <div className="card-item__actions-left">
          {isDraft && onEditDraft && (
            <button
              type="button"
              className="action-btn action-btn--edit"
              onClick={() => onEditDraft(record)}
            >
              ✏️ Tiếp tục điền
            </button>
          )}

          {isError && (
            <button
              type="button"
              className="action-btn action-btn--retry"
              onClick={() => onRetry(record.id)}
            >
              🔄 Thử lại ngay
            </button>
          )}
        </div>

        <div className="card-item__actions-right">
          {(isDraft || isError) && (
            <>
              {isConfirmingDelete ? (
                <div className="delete-confirm-group">
                  <span className="delete-confirm-text">Xóa phiếu này?</span>
                  <button
                    type="button"
                    className="action-btn action-btn--danger-solid"
                    onClick={() => onDelete(record.id)}
                  >
                    Đồng ý
                  </button>
                  <button
                    type="button"
                    className="action-btn action-btn--secondary"
                    onClick={() => onSetConfirmDeleteId(null)}
                  >
                    Hủy
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="action-btn action-btn--delete"
                  onClick={() => onSetConfirmDeleteId(record.id)}
                  title="Xóa bản ghi này"
                >
                  🗑️ Xóa
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
