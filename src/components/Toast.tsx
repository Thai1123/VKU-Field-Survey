import { useCallback, useEffect, useRef, useState } from 'react';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: number;
  type: ToastType;
  text: string;
}

let nextId = 0;

/** Global toast emitter — call from anywhere. */
const listeners = new Set<(msg: ToastMessage) => void>();

export function showToast(type: ToastType, text: string) {
  const msg: ToastMessage = { id: nextId++, type, text };
  listeners.forEach((fn) => fn(msg));
}

/** Hook to consume toast messages in a React tree. */
export function useToast() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const add = useCallback((msg: ToastMessage) => {
    setToasts((prev) => [...prev, msg]);
  }, []);

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    listeners.add(add);
    return () => { listeners.delete(add); };
  }, [add]);

  return { toasts, remove };
}

export function ToastContainer() {
  const { toasts, remove } = useToast();

  return (
    <div className="toast-container" aria-live="polite">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDone={() => remove(t.id)} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onDone }: { toast: ToastMessage; onDone: () => void }) {
  const [exiting, setExiting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    timerRef.current = setTimeout(() => {
      setExiting(true);
      setTimeout(onDone, 300); // match CSS transition
    }, 3500);
    return () => clearTimeout(timerRef.current);
  }, [onDone]);

  return (
    <div
      className={`toast toast--${toast.type} ${exiting ? 'toast--exit' : ''}`}
      onClick={() => {
        clearTimeout(timerRef.current);
        setExiting(true);
        setTimeout(onDone, 300);
      }}
      role="status"
    >
      <span className="toast__icon">
        {toast.type === 'success' && '✓'}
        {toast.type === 'error' && '✕'}
        {toast.type === 'info' && 'ℹ'}
      </span>
      <span className="toast__text">{toast.text}</span>
    </div>
  );
}
