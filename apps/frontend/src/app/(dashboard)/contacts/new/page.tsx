"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import apiClient from "@/lib/api";
import { useToast } from "@/components/Toast";

export default function NewContactPage() {
  const router = useRouter();
  const { showToast, updateToast } = useToast();

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [org, setOrg] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setSubmitting(true);
    setError(null);
    const toastId = showToast("Adding contact…", "processing");
    try {
      const res = await apiClient.post<{ _id?: string; id?: string }>(
        "/api/contacts",
        {
          email: email.trim().toLowerCase(),
          name: name.trim() || undefined,
          org: org.trim() || undefined,
        },
      );
      const id = res.data._id ?? res.data.id;
      updateToast(toastId, `Contact added`, "success");
      router.push(id ? `/contacts/${id}` : "/contacts");
    } catch (err: any) {
      const msg =
        err?.response?.data?.error ||
        "Failed to add contact. Check the email and try again.";
      setError(msg);
      updateToast(toastId, msg, "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="new-contact flex flex-col h-full">
      {/* Topbar */}
      <header className="new-contact__topbar sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-gray-200 bg-white px-6">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-700 transition-colors"
        >
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>
        <h1 className="text-base font-semibold text-gray-900">Add Contact</h1>
      </header>

      <main className="new-contact__content flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto max-w-md">
          <form onSubmit={handleSubmit} className="new-contact__form space-y-4">
            <div className="new-contact__card rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden divide-y divide-gray-100">
              {/* Email — required */}
              <div className="new-contact__field flex items-center px-4 py-3">
                <label
                  htmlFor="new-email"
                  className="w-24 shrink-0 text-xs font-medium text-gray-400 uppercase tracking-wide"
                >
                  Email *
                </label>
                <input
                  id="new-email"
                  type="email"
                  required
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="contact@example.com"
                  className="flex-1 bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-300"
                />
              </div>

              {/* Name — optional */}
              <div className="new-contact__field flex items-center px-4 py-3">
                <label
                  htmlFor="new-name"
                  className="w-24 shrink-0 text-xs font-medium text-gray-400 uppercase tracking-wide"
                >
                  Name
                </label>
                <input
                  id="new-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Display name (optional)"
                  className="flex-1 bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-300"
                />
              </div>

              {/* Org — optional */}
              <div className="new-contact__field flex items-center px-4 py-3">
                <label
                  htmlFor="new-org"
                  className="w-24 shrink-0 text-xs font-medium text-gray-400 uppercase tracking-wide"
                >
                  Organization
                </label>
                <input
                  id="new-org"
                  type="text"
                  value={org}
                  onChange={(e) => setOrg(e.target.value)}
                  placeholder="Acme Corp (optional)"
                  className="flex-1 bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-300"
                />
              </div>
            </div>

            {error && (
              <p className="new-contact__error text-xs text-red-600">{error}</p>
            )}

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={submitting || !email.trim()}
                className="new-contact__submit flex-1 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60 transition-colors"
              >
                {submitting ? "Adding…" : "Add Contact"}
              </button>
              <button
                type="button"
                onClick={() => router.back()}
                className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
