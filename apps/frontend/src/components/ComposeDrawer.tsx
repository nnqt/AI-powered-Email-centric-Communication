"use client";

import { useEffect, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";

import apiClient from "@/lib/api";

export interface ComposeDrawerProps {
  open: boolean;
  onClose: () => void;
  initialTo?: string;
  initialSubject?: string;
  initialBody?: string;
  replyToThreadId?: string;
  onSent?: (gmailThreadId: string) => void;
}

interface AttachmentChip {
  id: string;
  name: string;
  size: number;
  mimeType: string;
}

function ToolbarButton({
  onClick,
  active,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      title={title}
      className={`compose-drawer__toolbar-btn rounded px-1.5 py-0.5 text-xs font-medium transition-colors ${
        active
          ? "bg-gray-600 text-white"
          : "text-gray-400 hover:bg-gray-600 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
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
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<AttachmentChip[]>([]);
  const [uploading, setUploading] = useState(false);
  const toRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: "Write your message…" }),
    ],
    editorProps: {
      attributes: {
        class:
          "min-h-[160px] max-h-[300px] overflow-y-auto px-4 py-3 text-sm text-gray-900 outline-none prose prose-sm max-w-none",
      },
    },
    content: "",
  });

  useEffect(() => {
    if (open) {
      setTo(initialTo);
      setSubject(initialSubject);
      setError(null);
      setAttachments([]);
      editor?.commands.setContent(
        initialBody ? `<p>${initialBody.replace(/\n/g, "</p><p>")}</p>` : "",
      );
      setTimeout(() => {
        if (!initialTo) toRef.current?.focus();
      }, 150);
    }
  }, [open, initialTo, initialSubject, initialBody]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (open) document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setUploading(true);
    try {
      for (const file of files) {
        const form = new FormData();
        form.append("file", file);
        const res = await apiClient.post<AttachmentChip>(
          "/api/emails/attachments",
          form,
          { headers: { "Content-Type": "multipart/form-data" } },
        );
        setAttachments((prev) => [...prev, res.data]);
      }
    } catch {
      setError("Failed to upload attachment.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeAttachment = (id: string) =>
    setAttachments((prev) => prev.filter((a) => a.id !== id));

  const handleSend = async () => {
    const htmlBody = editor?.getHTML() ?? "";
    const plainText = editor?.getText() ?? "";

    if (!to.trim() || !subject.trim() || !plainText.trim()) {
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
          htmlBody,
          attachmentIds: attachments.map((a) => a.id),
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

  function formatBytes(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <>
      {open && (
        <div
          className="compose-drawer__overlay fixed inset-0 z-40 bg-black/20"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Compose email"
        className={`compose-drawer fixed bottom-0 right-4 z-50 flex w-full max-w-lg flex-col rounded-t-xl border border-gray-200 bg-white shadow-2xl transition-transform duration-300 ${
          open ? "translate-y-0" : "translate-y-full"
        }`}
        style={{ maxHeight: "80vh" }}
      >
        {/* Header */}
        <div className="compose-drawer__header flex items-center justify-between rounded-t-xl bg-gray-800 px-4 py-2">
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

        {/* To / Subject */}
        <div className="compose-drawer__fields flex flex-col divide-y divide-gray-100">
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
        </div>

        {/* Formatting toolbar */}
        <div className="compose-drawer__toolbar flex items-center gap-0.5 border-y border-gray-700 bg-gray-800 px-3 py-1.5">
          <ToolbarButton
            onClick={() => editor?.chain().focus().toggleBold().run()}
            active={editor?.isActive("bold")}
            title="Bold"
          >
            <strong>B</strong>
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor?.chain().focus().toggleItalic().run()}
            active={editor?.isActive("italic")}
            title="Italic"
          >
            <em>I</em>
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor?.chain().focus().toggleBulletList().run()}
            active={editor?.isActive("bulletList")}
            title="Bullet list"
          >
            ≡
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor?.chain().focus().toggleBlockquote().run()}
            active={editor?.isActive("blockquote")}
            title="Blockquote"
          >
            "
          </ToolbarButton>
          <div className="mx-1 h-4 w-px bg-gray-600" />
          <ToolbarButton
            onClick={() => editor?.chain().focus().undo().run()}
            title="Undo"
          >
            ↩
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor?.chain().focus().redo().run()}
            title="Redo"
          >
            ↪
          </ToolbarButton>
        </div>

        {/* Tiptap editor */}
        <div className="compose-drawer__editor flex-1 overflow-y-auto">
          <EditorContent editor={editor} />
        </div>

        {/* Attachment chips */}
        {attachments.length > 0 && (
          <div className="compose-drawer__attachments flex flex-wrap gap-1.5 border-t border-gray-100 px-4 py-2">
            {attachments.map((att) => (
              <div
                key={att.id}
                className="compose-drawer__attachment flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-700"
              >
                <span className="max-w-[140px] truncate">{att.name}</span>
                <span className="text-gray-400">({formatBytes(att.size)})</span>
                <button
                  type="button"
                  onClick={() => removeAttachment(att.id)}
                  className="ml-0.5 text-gray-400 hover:text-gray-700"
                  aria-label={`Remove ${att.name}`}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="compose-drawer__footer flex items-center justify-between border-t border-gray-100 px-4 py-2">
          <div className="flex items-center gap-2">
            {error ? (
              <p className="text-xs text-red-600">{error}</p>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-1 rounded text-xs text-gray-400 hover:text-gray-700 disabled:opacity-50"
                title="Attach file"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                  />
                </svg>
                {uploading ? "Uploading…" : "Attach"}
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={handleSend}
            disabled={sending}
            className="rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {sending ? "Sending…" : "Send"}
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileChange}
        />
      </div>
    </>
  );
}
