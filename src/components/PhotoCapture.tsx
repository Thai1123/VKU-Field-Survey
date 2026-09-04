import { useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';

interface Props {
  photo?: Blob;
  photoName?: string;
  onChange: (blob: Blob | undefined, name?: string) => void;
}

export function PhotoCapture({ photo, photoName, onChange }: Props) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileUploadRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!photo) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(photo);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  async function captureNative() {
    try {
      const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');
      const shot = await Camera.getPhoto({
        quality: 75,
        resultType: CameraResultType.Uri,
        source: CameraSource.Camera,
      });
      if (!shot.webPath) return;
      const blob = await fetch(shot.webPath).then((r) => r.blob());
      onChange(blob, `VKU-IMG-${Date.now()}.jpg`);
    } catch {
      // User cancelled camera
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      onChange(file, file.name);
    }
  }

  function handleRemove() {
    onChange(undefined, undefined);
  }

  const isNative = Capacitor.isNativePlatform();
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="photo-section">
      {previewUrl ? (
        <div className="photo-card photo-card--has-image">
          <div className="photo-card__preview-wrapper">
            <img className="photo-card__preview" src={previewUrl} alt="Ảnh minh chứng hiện trạng" />
            <div className="photo-card__watermark">
              <span>📍 VKU Field Audit</span>
              <span>{new Date().toLocaleDateString('vi-VN')}</span>
            </div>
          </div>

          <div className="photo-card__meta">
            <div className="photo-card__meta-info">
              <span className="photo-card__filename">{photoName || 'inspection-photo.jpg'}</span>
              {photo && <span className="photo-card__filesize">{formatSize(photo.size)}</span>}
            </div>
            <button
              type="button"
              className="photo-card__delete-btn"
              onClick={handleRemove}
              title="Xóa ảnh này"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
              Xóa ảnh
            </button>
          </div>

          <div className="photo-card__action-row">
            <button
              type="button"
              className="btn btn--outline btn--sm"
              onClick={isNative ? captureNative : () => fileInputRef.current?.click()}
            >
              📷 Chụp lại
            </button>
            <button
              type="button"
              className="btn btn--outline btn--sm"
              onClick={() => fileUploadRef.current?.click()}
            >
              📁 Chọn ảnh khác
            </button>
          </div>
        </div>
      ) : (
        <div className="photo-card photo-card--empty">
          <div className="photo-card__empty-icon">
            <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
          </div>
          <h4 className="photo-card__empty-title">Chụp hoặc tải ảnh minh chứng</h4>
          <p className="photo-card__empty-subtitle">
            Khuyến khích chụp góc rộng hiển thị rõ tem tài sản hoặc khu vực lỗi
          </p>

          <div className="photo-card__buttons">
            <button
              type="button"
              className="btn btn--primary"
              onClick={isNative ? captureNative : () => fileInputRef.current?.click()}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
              Mở Camera chụp ngay
            </button>
            <button
              type="button"
              className="btn btn--outline"
              onClick={() => fileUploadRef.current?.click()}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
              </svg>
              Tải từ thư viện ảnh
            </button>
          </div>
        </div>
      )}

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
      <input
        ref={fileUploadRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
    </div>
  );
}
