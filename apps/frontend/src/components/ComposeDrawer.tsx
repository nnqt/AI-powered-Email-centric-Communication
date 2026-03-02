"use client";

import { useEffect, useRef, useState } from "react";

import apiClient from "@/lib/api";

export interface ComposeDrawerProps {
  open: boolean;
  onClose: () => void;
  /** Pre-filled when replying to a thread */
  initialTo?: string;
  initialSubject?: string;
  initialBody?: string;
  /** Gmail thread ID – when set, the email is sent as a reply */
  replyToThreadId?: string;
  onSent?: (gmailThreadId: string) => void;
}

export function ComposeDrawer({
  open,
  onClose,
  initialTo = "",
  initialSubject = "",
  initialBody = "",
  replyToThreadId,
  onSent,
}: ComposeDrawerProps) {
  const [to, setTo] = useState(initialTo);
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toRef = useRef<HTMLInputElement>(null);

  // Reset fields when drawer opens with new props
  useEffect(() => {
    if (open) {
      setTo(initialTo);
      setSubject(initialSubject);
      setBody(initialBody);
      setError(null);
      // Focus "To" if empty, otherwise focus body
      setTimeout(() => {
        if (!initialTo) {
          toRef.current?.focus();
        }
      }, 150);
    }
  }, [open, initialTo, initialSubject, initialBody]);

  // Close on ESC
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (open) document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  const handleSend = async () => {
    if (!to.trim() || !subject.trim() || !body.trim()) {
      setError("To, Subject, and Body are required.");
      return;
    }
    setSending(true);
    setError(null);
    try {
      const res = await apiClient.post<{ gmailThreadId: string }>(
        "/api/emails/send",
        {
          to: to.trim(),
          subject: subject.trim(),
          body: body.trim(),
          threadId: replyToThreadId || undefined,
        },
      );
      onSent?.(res.data.gmailThreadId);
      onClose();
    } catch (err: any) {
      setError(
        err?.response?.data?.error || "Failed to send email. Please try again.",
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/20"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Drawer */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Compose email"
        className={`fixed bottom-0 right-4 z-50 flex w-full max-w-lg flex-col rounded-t-xl border border-gray-200 bg-white shadow-2xl transition-transform duration-300 ${
          open ? "translate-y-0" : "translate-y-full"
        }`}
        style={{ maxHeight: "75vh" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between rounded-t-xl bg-gray-800 px-4 py-2">
          <span className="text-sm font-medium text-white">
            {replyToThreadId ? "Reply" : "New Message"}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-gray-300 hover:bg-gray-700 hover:text-white"
            aria-label="Close compose"
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>

        {/* Fields */}
        <div className="flex flex-col divide-y divide-gray-100 overflow-y-auto">
          <div className="flex items-center px-4 py-2">
            <label className="w-12 shrink-0 text-xs text-gray-500">To</label>
            <input
              ref={toRef}
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="recipient@example.com"
              className="flex-1 bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400"
            />
          </div>
          <div className="flex items-center px-4 py-2">
            <label className="w-12 shrink-0 text-xs text-gray-500">
              Subject
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject"
              className="flex-1 bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400"
            />
          </div>
          <div className="flex-1 px-4 py-3">
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your message…"
              rows={8}
              className="w-full resize-none bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-gray-100 px-4 py-2">
          {error ? <p className="text-xs text-red-600">{error}</p> : <span />}
          <button
            type="button"
            onClick={handleSend}
            disabled={sending}
            className="rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {sending ? "Sending…" : "Send"}
          </button>
        </div>
      </div>
    </>
  );
}
