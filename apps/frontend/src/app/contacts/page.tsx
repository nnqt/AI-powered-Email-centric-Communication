"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useContacts, ContactDTO } from "@/hooks/useContacts";
import { useToast } from "@/components/Toast";
import apiClient from "@/lib/api";

interface MergeSuggestion {
  source_id: string;
  target_id: string;
  source_email: string;
  target_email: string;
  confidence: number;
  reason: string;
}

function ContactRow({
  contact,
  onClick,
}: {
  contact: ContactDTO;
  onClick: () => void;
}) {
  const initials = contact.name
    ? contact.name
        .split(" ")
        .map((w) => w[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : contact.email[0].toUpperCase();

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
      className="flex cursor-pointer items-center gap-4 rounded-lg px-4 py-3 hover:bg-gray-50 transition-colors"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700">
        {initials}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-gray-900">
          {contact.name ?? contact.email}
        </p>
        {contact.name && (
          <p className="truncate text-xs text-gray-500">{contact.email}</p>
        )}
      </div>
      <div className="flex shrink-0 gap-2">
        {contact.org && (
          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
            {contact.org}
          </span>
        )}
        {contact.language && (
          <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-700">
            {contact.language}
          </span>
        )}
        {contact.aiEnriched && (
          <span className="rounded-full bg-purple-50 px-2 py-0.5 text-xs text-purple-700">
            AI ✓
          </span>
        )}
      </div>
    </div>
  );
}

export default function ContactsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { showToast } = useToast();
  const {
    contacts,
    total,
    hasNext,
    isLoading,
    mutate,
    skip,
    goToNext,
    goToPrev,
  } = useContacts(30);

  const [newEmail, setNewEmail] = useState("");
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  // Merge suggestions state
  const [suggestions, setSuggestions] = useState<MergeSuggestion[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [mergingIds, setMergingIds] = useState<Set<string>>(new Set());

  const handleCheckDuplicates = async () => {
    setLoadingSuggestions(true);
    try {
      const res = await apiClient.get<{ suggestions: MergeSuggestion[] }>(
        "/api/contacts/merge-suggestions",
      );
      setSuggestions(res.data.suggestions);
      if (res.data.suggestions.length === 0) {
        showToast("No duplicate contacts found", "success");
      }
    } catch {
      showToast("Failed to check duplicates", "error");
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const handleMerge = async (suggestion: MergeSuggestion) => {
    const key = `${suggestion.source_id}-${suggestion.target_id}`;
    setMergingIds((prev) => new Set(prev).add(key));
    try {
      await apiClient.post("/api/contacts/merge", {
        sourceId: suggestion.source_id,
        targetId: suggestion.target_id,
      });
      setSuggestions((prev) =>
        prev.filter(
          (s) =>
            !(
              s.source_id === suggestion.source_id &&
              s.target_id === suggestion.target_id
            ),
        ),
      );
      await mutate();
      showToast("Contacts merged", "success");
    } catch {
      showToast("Merge failed", "error");
    } finally {
      setMergingIds((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  const handleDismiss = (suggestion: MergeSuggestion) => {
    const key = `${suggestion.source_id}-${suggestion.target_id}`;
    setDismissedIds((prev) => new Set(prev).add(key));
  };

  const visibleSuggestions = suggestions.filter(
    (s) => !dismissedIds.has(`${s.source_id}-${s.target_id}`),
  );

  if (status === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-gray-500">Loading…</p>
      </main>
    );
  }

  if (status === "unauthenticated") {
    router.replace("/");
    return null;
  }

  const handleCreate = async () => {
    if (!newEmail.trim()) return;
    setCreating(true);
    try {
      await apiClient.post("/api/contacts", { email: newEmail.trim() });
      setNewEmail("");
      setShowCreate(false);
      await mutate();
      showToast("Contact added", "success");
    } catch {
      showToast("Failed to add contact", "error");
    } finally {
      setCreating(false);
    }
  };

  const page = Math.floor(skip / 30) + 1;
  const totalPages = Math.ceil(total / 30);

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.push("/")}
              className="text-sm text-gray-500 hover:text-gray-900"
            >
              ← Inbox
            </button>
            <h1 className="text-lg font-semibold text-gray-900">Contacts</h1>
            <span className="text-sm text-gray-500">{total} total</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCheckDuplicates}
              disabled={loadingSuggestions}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            >
              {loadingSuggestions ? "Checking…" : "🔍 Check duplicates"}
            </button>
            <button
              type="button"
              onClick={() => setShowCreate((v) => !v)}
              className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
            >
              + Add Contact
            </button>
          </div>
        </div>

        {/* Create form */}
        {showCreate && (
          <div className="mx-auto max-w-4xl border-t border-gray-100 px-4 py-3">
            <div className="flex gap-2">
              <input
                type="email"
                placeholder="email@example.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                className="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <button
                type="button"
                onClick={handleCreate}
                disabled={creating || !newEmail.trim()}
                className="rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {creating ? "Adding…" : "Add"}
              </button>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="rounded-md border border-gray-300 px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* List */}
      <div className="mx-auto max-w-4xl px-4 py-4">
        {/* Merge suggestion banner */}
        {visibleSuggestions.length > 0 && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <h2 className="mb-3 text-sm font-semibold text-amber-800">
              🔀 Possible duplicate contacts ({visibleSuggestions.length})
            </h2>
            <div className="space-y-2">
              {visibleSuggestions.map((s) => {
                const key = `${s.source_id}-${s.target_id}`;
                const isMerging = mergingIds.has(key);
                return (
                  <div
                    key={key}
                    className="flex items-center justify-between rounded-md border border-amber-200 bg-white px-4 py-2 gap-4"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-900">
                        {s.source_email}{" "}
                        <span className="text-gray-400">→</span>{" "}
                        {s.target_email}
                      </p>
                      <p className="truncate text-xs text-gray-500 mt-0.5">
                        {s.reason} &nbsp;·&nbsp; confidence:{" "}
                        {Math.round(s.confidence * 100)}%
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        onClick={() => handleMerge(s)}
                        disabled={isMerging}
                        className="rounded-md bg-amber-600 px-3 py-1 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50"
                      >
                        {isMerging ? "Merging…" : "Merge"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDismiss(s)}
                        className="rounded-md border border-gray-300 px-3 py-1 text-xs text-gray-600 hover:bg-gray-50"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        <div className="rounded-lg border border-gray-200 bg-white divide-y divide-gray-100">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <p className="text-sm text-gray-500">Loading contacts…</p>
            </div>
          ) : contacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-sm font-medium text-gray-700">
                No contacts yet
              </p>
              <p className="mt-1 text-xs text-gray-500">
                Contacts are automatically created when you sync emails.
              </p>
            </div>
          ) : (
            contacts.map((c) => (
              <ContactRow
                key={c._id}
                contact={c}
                onClick={() => router.push(`/contacts/${c._id}`)}
              />
            ))
          )}
        </div>

        {/* Pagination */}
        {total > 30 && (
          <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
            <span>
              {skip + 1}–{Math.min(skip + contacts.length, total)} of {total}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={goToPrev}
                disabled={skip === 0}
                className="rounded border border-gray-300 px-3 py-1 hover:bg-gray-50 disabled:opacity-40"
              >
                ← Newer
              </button>
              <button
                type="button"
                onClick={goToNext}
                disabled={!hasNext}
                className="rounded border border-gray-300 px-3 py-1 hover:bg-gray-50 disabled:opacity-40"
              >
                Older →
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
