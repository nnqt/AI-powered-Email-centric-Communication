"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
} from "react";

export type ToastType = "success" | "error" | "info" | "warning" | "processing";

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  /** Show a toast. Returns the toast id (useful for updating later). */
  showToast: (message: string, type?: ToastType) => string;
  /**
   * Replace a processing toast with a result toast (success/error/info/warning).
   * Auto-dismisses after 4 s.
   */
  updateToast: (
    id: string,
    message: string,
    type: Exclude<ToastType, "processing">,
  ) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  // track dismiss timers so processing toasts can be cancelled
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    delete timers.current[id];
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType = "info"): string => {
      const id = Math.random().toString(36).substring(7);
      setToasts((prev) => [...prev, { id, message, type }]);
      // processing toasts do NOT auto-dismiss
      if (type !== "processing") {
        timers.current[id] = setTimeout(() => removeToast(id), 5000);
      }
      return id;
    },
    [removeToast],
  );

  const updateToast = useCallback(
    (id: string, message: string, type: Exclude<ToastType, "processing">) => {
      // cancel any existing timer
      if (timers.current[id]) {
        clearTimeout(timers.current[id]);
        delete timers.current[id];
      }
      setToasts((prev) =>
        prev.map((t) => (t.id === id ? { ...t, message, type } : t)),
      );
      timers.current[id] = setTimeout(() => removeToast(id), 4000);
    },
    [removeToast],
  );

  return (
    <ToastContext.Provider value={{ showToast, updateToast }}>
      {children}
      <div className="toast-container fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`toast min-w-[300px] rounded-lg px-4 py-3 shadow-lg flex items-center gap-3 toast--${toast.type} ${
              toast.type === "success"
                ? "bg-green-50 text-green-800 border border-green-200"
                : toast.type === "error"
                  ? "bg-red-50 text-red-800 border border-red-200"
                  : toast.type === "warning"
                    ? "bg-yellow-50 text-yellow-800 border border-yellow-200"
                    : toast.type === "processing"
                      ? "bg-gray-800 text-gray-100 border border-gray-700"
                      : "bg-blue-50 text-blue-800 border border-blue-200"
            }`}
          >
            {/* Icon */}
            <span className="shrink-0">
              {toast.type === "processing" ? (
                <svg
                  className="h-4 w-4 animate-spin text-gray-300"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              ) : toast.type === "success" ? (
                <svg
                  className="h-4 w-4 text-green-500"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              ) : toast.type === "error" ? (
                <svg
                  className="h-4 w-4 text-red-500"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              ) : toast.type === "warning" ? (
                <svg
                  className="h-4 w-4 text-yellow-500"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
              ) : (
                <svg
                  className="h-4 w-4 text-blue-500"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </span>
            <div className="toast__body flex-1">
              <p className="text-sm font-medium">{toast.message}</p>
            </div>
            {toast.type !== "processing" && (
              <button
                onClick={() => removeToast(toast.id)}
                className="toast__close shrink-0 text-current opacity-50 hover:opacity-100"
              >
                ✕
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return context;
}
