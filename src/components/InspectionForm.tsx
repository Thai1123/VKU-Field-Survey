import { useEffect, useRef, useState } from 'react';
import { Geolocation } from '@capacitor/geolocation';

import {
  CATEGORIES,
  createEmptyRecord,
  type Category,
  type InspectionRecord,
} from '../lib/types';

import { saveRecord } from '../lib/db';
import { newId } from '../lib/uuid';
import { requestSync } from '../hooks/useNetworkStatus';
import { PhotoCapture } from './PhotoCapture';
import { showToast } from './Toast';

const STEPS = [
  {
    id: 'location',
    title: 'Vị trí',
    icon: '📍',
    desc: 'Chọn phòng & khu vực',
  },
  {
    id: 'category',
    title: 'Hạng mục',
    icon: '🏷️',
    desc: 'Loại trang thiết bị',
  },
  {
    id: 'rating',
    title: 'Đánh giá',
    icon: '⭐',
    desc: 'Tình trạng & ghi chú',
  },
  {
    id: 'photo',
    title: 'Minh chứng',
    icon: '📷',
    desc: 'Hình ảnh thực tế',
  },
  {
    id: 'review',
    title: 'Xem lại',
    icon: '📋',
    desc: 'Xác nhận & gửi phiếu',
  },
] as const;

const BUILDING_PRESETS = [
  'Khu A',
  'Khu B',
  'Khu C',
  'Khu D',
  'Khu E',
  'Ký túc xá',
  'Thư viện',
  'Nhà đa năng',
];

const FLOOR_PRESETS = [
  'Tầng 1',
  'Tầng 2',
  'Tầng 3',
  'Tầng 4',
  'Tầng 5',
  'Tầng 6',
];

const COMMON_ISSUES: Record<string, string[]> = {
  Hardware: [
    'Mất nguồn PC',
    'Màn hình sọc/mờ',
    'Liệt bàn phím/chuột',
    'Thiếu cáp mạng LAN',
  ],

  Projector: [
    'Không lên hình',
    'Bóng đèn mờ',
    'Hỏng điều khiển',
    'Cáp HDMI chập chờn',
  ],

  AC: [
    'Không mát / Hết gas',
    'Chảy nước dàn lạnh',
    'Kêu to / Rung mạnh',
    'Mất remote',
  ],

  Electrical: [
    'Ổ cắm lỏng / Cháy xém',
    'Đèn LED nhấp nháy',
    'Nhảy Aptomat',
    'Công tắc kẹt',
  ],

  Furniture: [
    'Bàn ghế lung lay/gãy',
    'Mặt bàn vẽ bẩn',
    'Bảng từ bong tróc',
    'Rèm cửa rách',
  ],
};

const CATEGORY_DETAILS: Record<
  Category,
  {
    name: string;
    subtitle: string;
    icon: string;
    color: string;
  }
> = {
  Hardware: {
    name: 'Thiết bị phần cứng',
    subtitle: 'Máy tính, màn hình, chuột, bàn phím, switch',
    icon: '🖥️',
    color: '#0284c7',
  },

  Projector: {
    name: 'Máy chiếu & Trình chiếu',
    subtitle: 'Máy chiếu, màn chiếu, cáp HDMI, giá treo',
    icon: '📽️',
    color: '#8b5cf6',
  },

  AC: {
    name: 'Điều hòa & Làm mát',
    subtitle: 'Máy lạnh, quạt thông gió, remote, dàn nóng',
    icon: '❄️',
    color: '#06b6d4',
  },

  Electrical: {
    name: 'Hệ thống điện & Đèn',
    subtitle: 'Ổ cắm điện, aptomat, công tắc, bóng đèn',
    icon: '⚡',
    color: '#f59e0b',
  },

  Furniture: {
    name: 'Bàn ghế & Nội thất',
    subtitle: 'Bàn học sinh, ghế, bục giảng, bảng viết',
    icon: '🪑',
    color: '#10b981',
  },
};

interface Props {
  isOnline: boolean;
  onSubmitted: () => void;
  editRecord?: InspectionRecord | null;
  onEditCleared?: () => void;
}

export function InspectionForm({
  isOnline,
  onSubmitted,
  editRecord,
  onEditCleared,
}: Props) {
  const [step, setStep] = useState(0);

  const [record, setRecord] = useState<InspectionRecord>(() =>
    createEmptyRecord(newId())
  );

  const [isSubmitting, setIsSubmitting] = useState(false);

  const [showHints, setShowHints] = useState(false);

  // Trạng thái đang lấy GPS
  const [isGettingLocation, setIsGettingLocation] = useState(false);

  const saveTimer = useRef<ReturnType<typeof setTimeout>>();

  // Load record when user clicked "Tiếp tục điền" in queue
  useEffect(() => {
    if (editRecord) {
      setRecord(editRecord);
      setStep(0);
      setShowHints(false);
      onEditCleared?.();
    }
  }, [editRecord, onEditCleared]);

  // Persist draft debounced
  useEffect(() => {
    clearTimeout(saveTimer.current);

    saveTimer.current = setTimeout(() => {
      void saveRecord(record);
    }, 300);

    return () => clearTimeout(saveTimer.current);
  }, [record]);

  function update<K extends keyof InspectionRecord>(
    key: K,
    value: InspectionRecord[K]
  ) {
    setRecord((r) => ({
      ...r,
      [key]: value,
    }));
  }

  /**
   * Lấy vị trí GPS hiện tại
   */
  async function getCurrentLocation() {
    if (isGettingLocation) return;

    setIsGettingLocation(true);

    try {
      showToast('success', 'Đang lấy vị trí hiện tại...');

      // Xin quyền truy cập vị trí
      const permission = await Geolocation.requestPermissions();

      if (
        permission.location !== 'granted' &&
        permission.coarseLocation !== 'granted'
      ) {
        showToast(
          'error',
          'Bạn chưa cấp quyền truy cập vị trí cho ứng dụng.'
        );

        return;
      }

      // Lấy vị trí hiện tại
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      });

      const latitude = position.coords.latitude;
      const longitude = position.coords.longitude;

      // Lưu GPS vào record
      update('latitude', latitude);
      update('longitude', longitude);

      showToast('success', 'Đã lấy vị trí GPS thành công.');
    } catch (error) {
      console.error('Lỗi lấy vị trí GPS:', error);

      showToast(
        'error',
        'Không thể lấy vị trí. Hãy kiểm tra GPS và quyền vị trí.'
      );
    } finally {
      setIsGettingLocation(false);
    }
  }

  function handleAddIssueTag(tag: string) {
    const currentNotes = record.notes
      ? record.notes.trim()
      : '';

    if (currentNotes.includes(tag)) return;

    const newNotes = currentNotes
      ? `${currentNotes}, ${tag}`
      : tag;

    update('notes', newNotes);
  }

  function canAdvance(): boolean {
    switch (step) {
      case 0:
        return !!(
          record.building.trim() &&
          record.floor.trim() &&
          record.room.trim()
        );

      case 1:
        return !!record.category;

      case 2:
        return record.rating > 0;

      default:
        return true;
    }
  }

  function next() {
    if (!canAdvance()) {
      setShowHints(true);
      return;
    }

    setShowHints(false);

    setStep((s) =>
      Math.min(s + 1, STEPS.length - 1)
    );
  }

  function back() {
    setShowHints(false);

    setStep((s) =>
      Math.max(s - 1, 0)
    );
  }

  function jumpToStep(targetStep: number) {
    if (targetStep < step) {
      setShowHints(false);
      setStep(targetStep);
    }
  }

  async function submit() {
    setIsSubmitting(true);

    try {
      const finalRecord: InspectionRecord = {
        ...record,
        status: 'PENDING_SYNC',
        updatedAt: Date.now(),
      };

      await saveRecord(finalRecord);

      if (isOnline) {
        void requestSync();
      }

      showToast(
        'success',
        isOnline
          ? 'Đã gửi khảo sát — đang đồng bộ lên máy chủ VKU'
          : 'Đã lưu vào bộ nhớ thiết bị — sẽ tự động đồng bộ khi có WiFi/4G'
      );

      // Reset form
      setRecord(createEmptyRecord(newId()));

      setStep(0);
      setShowHints(false);

      onSubmitted();
    } finally {
      setIsSubmitting(false);
    }
  }

  const currentCategory = record.category
    ? CATEGORY_DETAILS[record.category as Category]
    : null;

  return (
    <div className="form-wizard">

      {/* Modern Stepper Header */}
      <div className="stepper">
        <div className="stepper__bar">
          <div
            className="stepper__progress"
            style={{
              width: `${((step + 1) / STEPS.length) * 100}%`,
            }}
          />
        </div>

        <div className="stepper__steps">
          {STEPS.map((s, index) => {
            const isDone = index < step;
            const isCurrent = index === step;

            return (
              <button
                key={s.id}
                type="button"
                className={`stepper__step ${
                  isCurrent
                    ? 'stepper__step--active'
                    : ''
                } ${
                  isDone
                    ? 'stepper__step--done'
                    : ''
                }`}
                onClick={() => jumpToStep(index)}
                disabled={index > step}
              >
                <div className="stepper__circle">
                  {isDone ? '✓' : index + 1}
                </div>

                <span className="stepper__title">
                  {s.title}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Step Title Header */}
      <div className="step-header">
        <div className="step-header__badge">
          {STEPS[step].icon} Bước {step + 1} / {STEPS.length}
        </div>

        <h2 className="step-header__title">
          {STEPS[step].title}
        </h2>

        <p className="step-header__desc">
          {STEPS[step].desc}
        </p>
      </div>

      {/* Step Content Card */}
      <div className="step-body">

        {/* ===================================================== */}
        {/* STEP 1: VỊ TRÍ */}
        {/* ===================================================== */}

        {step === 0 && (
          <div className="step-pane">

            {/* Tòa nhà */}
            <div className="form-group">
              <label
                className="form-label"
                htmlFor="building"
              >
                Tòa nhà / Khu vực{' '}
                <span className="text-danger">*</span>
              </label>

              <input
                id="building"
                className="form-input"
                type="text"
                placeholder="Nhập hoặc chọn tòa nhà bên dưới..."
                value={record.building}
                onChange={(e) =>
                  update(
                    'building',
                    e.target.value
                  )
                }
              />

              <div className="preset-chips">
                {BUILDING_PRESETS.map((b) => (
                  <button
                    key={b}
                    type="button"
                    className={`chip ${
                      record.building === b
                        ? 'chip--active'
                        : ''
                    }`}
                    onClick={() =>
                      update('building', b)
                    }
                  >
                    {b}
                  </button>
                ))}
              </div>
            </div>

            {/* Tầng */}
            <div className="form-group">
              <label
                className="form-label"
                htmlFor="floor"
              >
                Tầng lầu{' '}
                <span className="text-danger">*</span>
              </label>

              <input
                id="floor"
                className="form-input"
                type="text"
                placeholder="Nhập hoặc chọn tầng..."
                value={record.floor}
                onChange={(e) =>
                  update(
                    'floor',
                    e.target.value
                  )
                }
              />

              <div className="preset-chips">
                {FLOOR_PRESETS.map((f) => (
                  <button
                    key={f}
                    type="button"
                    className={`chip ${
                      record.floor === f
                        ? 'chip--active'
                        : ''
                    }`}
                    onClick={() =>
                      update('floor', f)
                    }
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {/* Phòng số */}
            <div className="form-group">
              <label
                className="form-label"
                htmlFor="room"
              >
                Phòng số / Vị trí chi tiết{' '}
                <span className="text-danger">*</span>
              </label>

              <div className="input-with-icon">
                <span className="input-icon">
                  🚪
                </span>

                <input
                  id="room"
                  className="form-input"
                  type="text"
                  placeholder="VD: P.204, Hội trường A, Lab 3..."
                  value={record.room}
                  onChange={(e) =>
                    update(
                      'room',
                      e.target.value
                    )
                  }
                />
              </div>
            </div>

            {/* ================================================= */}
            {/* GPS */}
            {/* ================================================= */}

            <div className="form-group">

              <label className="form-label">
                Vị trí GPS
              </label>

              <button
                type="button"
                className="btn btn--outline"
                onClick={getCurrentLocation}
                disabled={isGettingLocation}
              >
                {isGettingLocation ? (
                  <>
                    <span className="spinner" />
                    Đang lấy vị trí...
                  </>
                ) : (
                  <>
                    📍 Lấy vị trí hiện tại
                  </>
                )}
              </button>

              {/* Hiển thị GPS */}
              {record.latitude !== undefined &&
                record.longitude !== undefined && (
                  <div className="location-preview-banner">

                    <span className="location-preview-icon">
                      🌐
                    </span>

                    <div className="location-preview-text">

                      <strong>
                        Đã lấy tọa độ GPS:
                      </strong>

                      <span>
                        Vĩ độ:{' '}
                        {record.latitude.toFixed(6)}
                        {' — '}
                        Kinh độ:{' '}
                        {record.longitude.toFixed(6)}
                      </span>

                    </div>
                  </div>
                )}
            </div>

            {/* Live Location Preview */}
            {(record.building ||
              record.floor ||
              record.room) && (
              <div className="location-preview-banner">

                <span className="location-preview-icon">
                  📍
                </span>

                <div className="location-preview-text">

                  <strong>
                    Vị trí đã định vị:
                  </strong>

                  <span>
                    {[
                      record.building,
                      record.floor,
                      record.room
                        ? `Phòng ${record.room}`
                        : '',
                    ]
                      .filter(Boolean)
                      .join(' • ')}
                  </span>

                </div>
              </div>
            )}
          </div>
        )}

        {/* ===================================================== */}
        {/* STEP 2: HẠNG MỤC */}
        {/* ===================================================== */}

        {step === 1 && (
          <div className="step-pane">

            <div className="category-cards-grid">

              {CATEGORIES.map((cat) => {
                const info =
                  CATEGORY_DETAILS[cat];

                const isSelected =
                  record.category === cat;

                return (
                  <div
                    key={cat}
                    className={`category-card ${
                      isSelected
                        ? 'category-card--selected'
                        : ''
                    }`}
                    onClick={() =>
                      update(
                        'category',
                        cat
                      )
                    }
                  >

                    <div
                      className="category-card__icon-wrap"
                      style={{
                        background: `${info.color}15`,
                        color: info.color,
                      }}
                    >
                      <span className="category-card__emoji">
                        {info.icon}
                      </span>
                    </div>

                    <div className="category-card__info">

                      <div className="category-card__title">
                        {info.name}
                      </div>

                      <div className="category-card__subtitle">
                        {info.subtitle}
                      </div>

                    </div>

                    <div className="category-card__check">

                      <div
                        className={`check-circle ${
                          isSelected
                            ? 'check-circle--checked'
                            : ''
                        }`}
                      >
                        {isSelected && '✓'}
                      </div>

                    </div>

                  </div>
                );
              })}

            </div>
          </div>
        )}

        {/* ===================================================== */}
        {/* STEP 3: ĐÁNH GIÁ */}
        {/* ===================================================== */}

        {step === 2 && (
          <div className="step-pane">

            {/* Rating Stars */}
            <div className="form-group">

              <label className="form-label">
                Mức độ hoạt động / Tình trạng{' '}
                <span className="text-danger">*</span>
              </label>

              <div className="rating-box">

                <div className="rating-stars">

                  {[1, 2, 3, 4, 5].map(
                    (star) => (
                      <button
                        key={star}
                        type="button"
                        className={`rating-star-btn ${
                          record.rating >= star
                            ? 'rating-star-btn--active'
                            : ''
                        }`}
                        onClick={() =>
                          update(
                            'rating',
                            star
                          )
                        }
                        aria-label={`${star} sao`}
                      >
                        ★
                      </button>
                    )
                  )}

                </div>

                {record.rating > 0 ? (
                  <div
                    className={`rating-descriptor rating-descriptor--${record.rating}`}
                  >
                    {record.rating === 1 &&
                      '🚨 1 Sao — Hư hỏng nặng, không thể sử dụng'}

                    {record.rating === 2 &&
                      '⚠️ 2 Sao — Xuống cấp, chập chờn, cần sửa chữa'}

                    {record.rating === 3 &&
                      '🟡 3 Sao — Tạm ổn, đáp ứng một phần'}

                    {record.rating === 4 &&
                      '🟢 4 Sao — Hoạt động tốt, ổn định'}

                    {record.rating === 5 &&
                      '✨ 5 Sao — Rất tốt, như mới hoặc xuất sắc'}
                  </div>
                ) : (
                  <div className="rating-descriptor rating-descriptor--empty">
                    Nhấp vào số sao để đánh giá nhanh hiện trạng
                  </div>
                )}

              </div>
            </div>

            {/* Quick Issue Tags */}
            {record.category &&
              COMMON_ISSUES[
                record.category
              ] && (
                <div className="form-group">

                  <label className="form-label">
                    Gợi ý sự cố thường gặp
                    (bấm để thêm nhanh):
                  </label>

                  <div className="issue-tags-grid">

                    {COMMON_ISSUES[
                      record.category
                    ].map((issue) => (
                      <button
                        key={issue}
                        type="button"
                        className="issue-tag-chip"
                        onClick={() =>
                          handleAddIssueTag(
                            issue
                          )
                        }
                      >
                        + {issue}
                      </button>
                    ))}

                  </div>
                </div>
              )}

            {/* Notes */}
            <div className="form-group">

              <div className="form-label-row">

                <label
                  className="form-label"
                  htmlFor="notes"
                >
                  Mô tả chi tiết lỗi / Hiện trạng
                </label>

                <span className="character-count">
                  {record.notes.length} ký tự
                </span>

              </div>

              <textarea
                id="notes"
                className="form-textarea"
                rows={4}
                placeholder="Ghi chú cụ thể vị trí thiết bị, biểu hiện lỗi, mã tài sản (nếu có)..."
                value={record.notes}
                onChange={(e) =>
                  update(
                    'notes',
                    e.target.value
                  )
                }
              />

            </div>
          </div>
        )}

        {/* ===================================================== */}
        {/* STEP 4: ẢNH */}
        {/* ===================================================== */}

        {step === 3 && (
          <div className="step-pane">

            <PhotoCapture
              photo={record.photo}
              photoName={record.photoName}
              onChange={(blob, name) => {
                update(
                  'photo',
                  blob as InspectionRecord['photo']
                );

                update(
                  'photoName',
                  name as InspectionRecord['photoName']
                );
              }}
            />

          </div>
        )}

        {/* ===================================================== */}
        {/* STEP 5: XEM LẠI */}
        {/* ===================================================== */}

        {step === 4 && (
          <div className="step-pane">

            <div className="audit-ticket">

              <div className="audit-ticket__header">

                <div className="audit-ticket__brand">

                  <div className="audit-ticket__logo">
                    VKU
                  </div>

                  <div>

                    <h4 className="audit-ticket__title">
                      PHIẾU KHẢO SÁT CƠ SỞ VẬT CHẤT
                    </h4>

                    <span className="audit-ticket__id">
                      Mã phiếu:{' '}
                      {record.id
                        .slice(0, 13)
                        .toUpperCase()}
                    </span>

                  </div>

                </div>

                <div className="audit-ticket__date">
                  {new Date().toLocaleDateString(
                    'vi-VN',
                    {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    }
                  )}
                </div>

              </div>

              <div className="audit-ticket__body">

                <div className="audit-grid">

                  <div className="audit-grid__item">

                    <span className="audit-grid__label">
                      📍 Tòa nhà & Tầng
                    </span>

                    <span className="audit-grid__value">
                      {record.building || '—'} /{' '}
                      {record.floor || '—'}
                    </span>

                  </div>

                  <div className="audit-grid__item">

                    <span className="audit-grid__label">
                      🚪 Phòng
                    </span>

                    <span className="audit-grid__value font-bold text-primary">
                      {record.room
                        ? `Phòng ${record.room}`
                        : '—'}
                    </span>

                  </div>

                  <div className="audit-grid__item">

                    <span className="audit-grid__label">
                      🏷️ Hạng mục
                    </span>

                    <span className="audit-grid__value">
                      {currentCategory
                        ? `${currentCategory.icon} ${currentCategory.name}`
                        : '—'}
                    </span>

                  </div>

                  <div className="audit-grid__item">

                    <span className="audit-grid__label">
                      ⭐ Đánh giá
                    </span>

                    <span className="audit-grid__value text-warning font-bold">
                      {'★'.repeat(
                        record.rating
                      )}
                      {'☆'.repeat(
                        5 - record.rating
                      )}{' '}
                      ({record.rating}/5)
                    </span>

                  </div>

                </div>

                {/* GPS trong phiếu xem lại */}
                {record.latitude !== undefined &&
                  record.longitude !== undefined && (
                    <div className="audit-notes-box">

                      <div className="audit-notes-title">
                        📍 Vị trí GPS
                      </div>

                      <div className="audit-notes-content">
                        Vĩ độ:{' '}
                        {record.latitude.toFixed(6)}
                        {' — '}
                        Kinh độ:{' '}
                        {record.longitude.toFixed(6)}
                      </div>

                    </div>
                  )}

                {/* Notes */}
                {record.notes && (
                  <div className="audit-notes-box">

                    <div className="audit-notes-title">
                      Ghi chú hiện trạng:
                    </div>

                    <div className="audit-notes-content">
                      "{record.notes}"
                    </div>

                  </div>
                )}

                {/* Photo */}
                <div className="audit-photo-summary">

                  <span className="audit-photo-label">
                    📷 Ảnh minh chứng:
                  </span>

                  <span className="audit-photo-status">
                    {record.photo
                      ? '✓ Đã đính kèm ảnh kiểm định'
                      : 'Chưa đính kèm ảnh'}
                  </span>

                </div>

              </div>

              {/* Connection status */}
              <div className="audit-ticket__footer">

                <span>
                  Trạng thái kết nối hiện tại:
                </span>

                <span
                  className={`net-tag ${
                    isOnline
                      ? 'net-tag--online'
                      : 'net-tag--offline'
                  }`}
                >
                  {isOnline
                    ? '● Trực tuyến (Gửi tức thì)'
                    : '○ Ngoại tuyến (Lưu hàng đợi)'}
                </span>

              </div>

            </div>
          </div>
        )}

      </div>

      {/* ===================================================== */}
      {/* VALIDATION */}
      {/* ===================================================== */}

      {showHints && !canAdvance() && (
        <div className="validation-alert">

          <span className="validation-alert__icon">
            ⚠️
          </span>

          <span>
            {step === 0 &&
              'Vui lòng điền đủ Tòa nhà, Tầng và Phòng số để tiếp tục.'}

            {step === 1 &&
              'Vui lòng chọn một hạng mục thiết bị kiểm tra.'}

            {step === 2 &&
              'Vui lòng chọn mức độ đánh giá (từ 1 đến 5 sao).'}
          </span>

        </div>
      )}

      {/* ===================================================== */}
      {/* WIZARD NAVIGATION */}
      {/* ===================================================== */}

      <div className="wizard-actions">

        {step > 0 && (
          <button
            type="button"
            className="btn btn--outline"
            onClick={back}
          >
            ← Quay lại
          </button>
        )}

        {step < STEPS.length - 1 ? (
          <button
            type="button"
            className="btn btn--primary btn--flex"
            onClick={next}
          >
            Tiếp tục sang{' '}
            {STEPS[step + 1].title} →
          </button>
        ) : (
          <button
            type="button"
            className="btn btn--primary btn--flex btn--lg"
            disabled={isSubmitting}
            onClick={submit}
          >
            {isSubmitting ? (
              <>
                <span className="spinner" />
                Đang lưu dữ liệu...
              </>
            ) : isOnline ? (
              '🚀 Xác nhận & Gửi phiếu khảo sát'
            ) : (
              '📥 Lưu vào hàng đợi ngoại tuyến'
            )}
          </button>
        )}

      </div>

    </div>
  );
}