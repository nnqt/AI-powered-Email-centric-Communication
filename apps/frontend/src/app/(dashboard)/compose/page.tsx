"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";

import apiClient from "@/lib/api";
import { useToast } from "@/components/Toast";

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
      className={`compose-page__toolbar-btn rounded px-2 py-1 text-xs font-medium transition-colors ${
        active
          ? "bg-indigo-100 text-indigo-700"
          : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
      }`}
    >
      {children}
    </button>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ComposePage() {
  const router = useRouter();
  const { showToast, updateToast } = useToast();

  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
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
          "min-h-[280px] px-4 py-3 text-sm text-gray-900 outline-none prose prose-sm max-w-none",
      },
    },
    content: "",
  });

  useEffect(() => {
    toRef.current?.focus();
  }, []);

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
      showToast("Failed to upload attachment.", "error");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSend = async () => {
    const htmlBody = editor?.getHTML() ?? "";
    const plainText = editor?.getText() ?? "";

    if (!to.trim() || !subject.trim() || !plainText.trim()) {
      setError("To, Subject, and Body are required.");
      return;
    }

    setSending(true);
    setError(null);
    const toastId = showToast("Sending email…", "processing");
    try {
      await apiClient.post("/api/emails/send", {
        to: to.trim(),
        subject: subject.trim(),
        htmlBody,
        attachmentIds: attachments.map((a) => a.id),
      });
      updateToast(toastId, "Email sent successfully", "success");
      router.push("/inbox");
    } catch (err: any) {
      const msg =
        err?.response?.data?.error || "Failed to send email. Please try again.";
      setError(msg);
      updateToast(toastId, msg, "error");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="compose-page flex flex-col h-full">
      {/* Topbar */}
      <header className="compose-page__topbar sticky top-0 z-10 flex h-14 items-center justify-between border-b border-gray-200 bg-white px-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="compose-page__back flex items-center gap-1 text-sm text-gray-400 hover:text-gray-700 transition-colors"
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
          <h1 className="text-base font-semibold text-gray-900">New Message</h1>
        </div>
        <button
          type="button"
          onClick={handleSend}
          disabled={sending}
          className="compose-page__send rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60 transition-colors"
        >
          {sending ? "Sending…" : "Send"}
        </button>
      </header>

      {/* Form */}
      <main className="compose-page__form flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-6 py-6">
          <div className="compose-page__card rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            {/* To */}
            <div className="compose-page__field flex items-center border-b border-gray-100 px-4 py-3">
              <label className="w-16 shrink-0 text-xs font-medium text-gray-400 uppercase tracking-wide">
                To
              </label>
              <input
                ref={toRef}
                type="email"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="recipient@example.com"
                className="flex-1 bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-700 placeholder:font-medium"
              />
            </div>

            {/* Subject */}
            <div className="compose-page__field flex items-center border-b border-gray-100 px-4 py-3">
              <label className="w-16 shrink-0 text-xs font-medium text-gray-400 uppercase tracking-wide">
                Subject
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Email subject"
                className="flex-1 bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-700 placeholder:font-medium"
              />
            </div>

            {/* Toolbar */}
            <div className="compose-page__toolbar flex items-center gap-0.5 border-b border-gray-100 bg-gray-50 px-3 py-1.5">
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
              <div className="mx-1 h-4 w-px bg-gray-200" />
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

            {/* Body */}
            <div className="compose-page__body">
              <EditorContent editor={editor} />
            </div>

            {/* Attachment chips */}
            {attachments.length > 0 && (
              <div className="compose-page__attachments flex flex-wrap gap-1.5 border-t border-gray-100 px-4 py-2">
                {attachments.map((att) => (
                  <div
                    key={att.id}
                    className="compose-page__attachment flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-700"
                  >
                    <span className="max-w-[140px] truncate">{att.name}</span>
                    <span className="text-gray-400">
                      ({formatBytes(att.size)})
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setAttachments((prev) =>
                          prev.filter((a) => a.id !== att.id),
                        )
                      }
                      className="ml-0.5 text-gray-400 hover:text-gray-700"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Footer */}
            <div className="compose-page__footer flex items-center justify-between border-t border-gray-100 px-4 py-2">
              {error ? (
                <p className="text-xs text-red-600">{error}</p>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="flex items-center gap-1 rounded text-xs text-gray-400 hover:text-gray-600 disabled:opacity-50"
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
                  {uploading ? "Uploading…" : "Attach file"}
                </button>
              )}
              <span className="text-xs text-gray-400">
                {editor?.storage.characterCount?.characters?.() ?? ""}{" "}
              </span>
            </div>
          </div>
        </div>
      </main>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}
