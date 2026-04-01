"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import useSWR, { useSWRConfig } from "swr";

import apiClient from "@/lib/api";
import type { ContactCategory, ContactDTO } from "@/hooks/useContacts";
import { useToast } from "@/components/Toast";

interface MergeSuggestion {
  source_id: string;
  target_id: string;
  source_email: string;
  target_email: string;
  source_display_name?: string;
  target_display_name?: string;
  confidence: number;
  reason: string;
  strategy?: "verified_anchor" | "selected_anchor" | "default";
  target_is_verified?: boolean;
}

const ALL_CATEGORIES: ContactCategory[] = [
  "colleague",
  "customer",
  "other",
  "spam",
];

const CATEGORY_CHIP_STYLE: Record<ContactCategory, string> = {
  colleague: "bg-blue-50 text-blue-700 ring-blue-200",
  customer: "bg-green-50 text-green-700 ring-green-200",
  other: "bg-amber-50 text-amber-700 ring-amber-200",
  spam: "bg-red-50 text-red-600 ring-red-200",
  unknown: "bg-cyan-50 text-cyan-700 ring-cyan-200",
};

type UnverifiedResponse = { contacts: ContactDTO[]; total: number };
type MergeSuggestionsResponse = { suggestions: MergeSuggestion[] };
type BatchMergeResponse = {
  applied: number;
  failed: number;
  errors: Array<{ sourceId: string; targetId: string; reason: string }>;
};

function mergeKey(s: Pick<MergeSuggestion, "source_id" | "target_id">) {
  return `${s.source_id}-${s.target_id}`;
}

function normalizeStagedMerges(items: MergeSuggestion[]): MergeSuggestion[] {
  const bySource = new Map<string, MergeSuggestion>();
  for (const item of items) {
    bySource.set(item.source_id, item);
  }

  const resolveFinalTarget = (sourceId: string) => {
    const visited = new Set<string>();
    let current = sourceId;
    let target = bySource.get(current)?.target_id;
    let finalMeta = bySource.get(current);
    while (target && bySource.has(target) && !visited.has(target)) {
      visited.add(target);
      finalMeta = bySource.get(current);
      current = target;
      target = bySource.get(current)?.target_id;
    }

    if (!target) {
      const fallback = bySource.get(sourceId);
      return {
        targetId: sourceId,
        targetEmail: fallback?.target_email,
        targetDisplayName: fallback?.target_display_name,
      };
    }

    const lastHop = bySource.get(current) ?? finalMeta;
    return {
      targetId: target,
      targetEmail: lastHop?.target_email,
      targetDisplayName: lastHop?.target_display_name,
    };
  };

  const collapsed = items
    .map((item) => {
      const resolved = resolveFinalTarget(item.source_id);
      return {
        ...item,
        target_id: resolved.targetId,
        target_email: resolved.targetEmail || item.target_email,
        target_display_name:
          resolved.targetDisplayName || item.target_display_name,
      };
    })
    .filter((item) => item.source_id !== item.target_id);

  const deduped = new Map<string, MergeSuggestion>();
  for (const item of collapsed) {
    const key = mergeKey(item);
    if (!deduped.has(key)) deduped.set(key, item);
  }
  return Array.from(deduped.values());
}

function anchorSuggestionToContact(
  suggestion: MergeSuggestion,
  anchorContactId?: string,
): MergeSuggestion {
  if (!anchorContactId) {
    return suggestion;
  }

  if (suggestion.source_id === anchorContactId) {
    return {
      ...suggestion,
      source_id: suggestion.target_id,
      target_id: anchorContactId,
      source_email: suggestion.target_email,
      target_email: suggestion.source_email,
      source_display_name: suggestion.target_display_name,
      target_display_name: suggestion.source_display_name,
      strategy: "selected_anchor",
      target_is_verified: suggestion.target_is_verified,
    };
  }

  if (suggestion.target_id === anchorContactId) {
    return {
      ...suggestion,
      strategy: "selected_anchor",
      target_is_verified: suggestion.target_is_verified,
    };
  }

  return suggestion;
}

function ContactQueueItem({
  contact,
  selected,
  onClick,
}: {
  contact: ContactDTO;
  selected: boolean;
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
    <button
      type="button"
      onClick={onClick}
      className={`verify-hub__queue-item w-full rounded-lg border px-3 py-2 text-left transition-colors ${
        selected
          ? "border-indigo-300 bg-indigo-50"
          : "border-gray-200 bg-white hover:bg-gray-50"
      }`}
    >
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700">
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
      </div>
    </button>
  );
}

export default function ContactsVerifyHubPage() {
  const router = useRouter();
  const { status } = useSession();
  const { mutate: mutateGlobal } = useSWRConfig();
  const { showToast, updateToast } = useToast();

  const { data: unverifiedData, isLoading: unverifiedLoading, mutate: mutateUnverified } = useSWR<UnverifiedResponse>(
    "/api/contacts?unverified=true&limit=200",
    async (url: string) => {
      const res = await apiClient.get<UnverifiedResponse>(url);
      return res.data;
    },
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    },
  );

  const contacts = unverifiedData?.contacts ?? [];
  const [selectedContactId, setSelectedContactId] = useState<string>("");
  const effectiveSelectedContactId = selectedContactId || contacts[0]?._id || "";
  const suggestionKey = effectiveSelectedContactId
    ? `/api/contacts/merge-suggestions?selectedContactId=${effectiveSelectedContactId}`
    : "/api/contacts/merge-suggestions";

  const { data: suggestionData, isLoading: suggestionLoading, mutate: mutateSuggestions } = useSWR<MergeSuggestionsResponse>(
    suggestionKey,
    async (url: string) => {
      const res = await apiClient.get<MergeSuggestionsResponse>(url);
      return res.data;
    },
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    },
  );

  const suggestions = suggestionData?.suggestions ?? [];

  const [dismissedSuggestionKeys, setDismissedSuggestionKeys] = useState<Set<string>>(new Set());
  const [nameDraft, setNameDraft] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<Set<ContactCategory>>(new Set());
  const [saving, setSaving] = useState(false);
  const [stagedMerges, setStagedMerges] = useState<MergeSuggestion[]>([]);
  const [autoRefreshing, setAutoRefreshing] = useState(false);

  const selectedContact = useMemo(() => {
    const fallback = contacts[0];
    const found = contacts.find((c) => c._id === selectedContactId);
    return found ?? fallback ?? null;
  }, [contacts, selectedContactId]);

  useEffect(() => {
    if (!selectedContactId && contacts[0]?._id) {
      setSelectedContactId(contacts[0]._id);
    }
  }, [contacts, selectedContactId]);

  const stagedMergeKeys = useMemo(
    () => new Set(stagedMerges.map((s) => mergeKey(s))),
    [stagedMerges],
  );
  const stagedMergeSourceIds = useMemo(
    () => new Set(stagedMerges.map((s) => s.source_id)),
    [stagedMerges],
  );

  const selectedAnchorId = useMemo(() => {
    if (!selectedContact) return null;
    const prioritized = suggestions.find(
      (s) =>
        s.source_id === selectedContact._id &&
        s.target_is_verified,
    );
    return prioritized?.target_id ?? null;
  }, [selectedContact, suggestions]);

  const selectedContactSuggestions = useMemo(() => {
    if (!selectedContact) return [];
    return suggestions.filter((s) => {
      const key = mergeKey(s);
      if (dismissedSuggestionKeys.has(key)) return false;
      if (stagedMergeSourceIds.has(s.source_id)) return false;
      if (stagedMergeKeys.has(key)) return false;
      if (s.source_id === selectedContact._id || s.target_id === selectedContact._id) {
        return true;
      }
      if (selectedAnchorId && s.target_id === selectedAnchorId) {
        return true;
      }
      return false;
    });
  }, [dismissedSuggestionKeys, selectedContact, selectedAnchorId, stagedMergeKeys, stagedMergeSourceIds, suggestions]);

  const pendingCount = contacts.length;

  // Sync editor state whenever selected contact changes.
  useEffect(() => {
    if (!selectedContact) return;
    setNameDraft(selectedContact.name ?? "");
    const baseCats = selectedContact.categories?.length
      ? selectedContact.categories
      : selectedContact.category && selectedContact.category !== "unknown"
        ? [selectedContact.category]
        : [];
    setSelectedCategories(new Set(baseCats));
  }, [selectedContact]);

  useEffect(() => {
    if (!selectedContact) return;

    let cancelled = false;

    const refreshForSelectedContact = async () => {
      setAutoRefreshing(true);
      try {
        const [enrichRes] = await Promise.all([
          apiClient.post<{ contact: ContactDTO }>(
            `/api/contacts/${selectedContact._id}/enrich`,
          ),
          mutateSuggestions(async () => {
            const res = await apiClient.get<MergeSuggestionsResponse>(
              `/api/contacts/merge-suggestions?selectedContactId=${selectedContact._id}`,
            );
            return res.data;
          }, { revalidate: false }),
        ]);

        if (cancelled) return;

        const updated = enrichRes.data.contact;
        const autoCategories = updated.categories?.length
          ? updated.categories
          : updated.categoryAiSuggestion
            ? [updated.categoryAiSuggestion]
            : [];
        if (autoCategories.length > 0) {
          setSelectedCategories(new Set(autoCategories));
        }

        if (updated.name?.trim()) {
          setNameDraft(updated.name.trim());
        }

        await mutateUnverified();
      } catch {
        // Silent auto-refresh to avoid noisy toasts while browsing queue.
      } finally {
        if (!cancelled) {
          setAutoRefreshing(false);
        }
      }
    };

    void refreshForSelectedContact();

    return () => {
      cancelled = true;
    };
  }, [selectedContact?._id, mutateSuggestions, mutateUnverified]);

  const toggleCategory = (cat: ContactCategory) => {
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const handleSaveAndVerify = async () => {
    if (!selectedContact) return;

    const trimmedName = nameDraft.trim();
    const payload: Record<string, unknown> = {};

    if (trimmedName !== (selectedContact.name ?? "")) {
      payload.name = trimmedName || undefined;
    }

    const categories = Array.from(selectedCategories);
    if (categories.length > 0) {
      payload.categories = categories;
      payload.category = categories[0];
      payload.categorySource = "user";
      payload.categoryAiSuggestion = null;
    }

    const hasContactUpdates = Object.keys(payload).length > 0;
    const hasStagedMerges = stagedMerges.length > 0;
    if (!hasContactUpdates && !hasStagedMerges) return;

    const toastId = showToast("Saving contact review...", "processing");
    setSaving(true);
    try {
      if (hasContactUpdates) {
        await apiClient.patch(`/api/contacts/${selectedContact._id}`, payload);
      }

      let mergeResult: BatchMergeResponse | null = null;
      if (hasStagedMerges) {
        // Keep the merge direction captured at queue-time.
        // Re-anchoring here can flip source/target when the selected contact changes
        // before Save, which makes the wrong contact remain in Needs Review.
        const normalizedQueue = normalizeStagedMerges(stagedMerges);
        const res = await apiClient.post<BatchMergeResponse>(
          "/api/contacts/merge/batch",
          {
            merges: normalizedQueue.map((s) => ({
              sourceId: s.source_id,
              targetId: s.target_id,
            })),
          },
        );
        mergeResult = res.data;

        if (mergeResult.failed > 0) {
          const failedKeys = new Set(
            mergeResult.errors.map((e) => `${e.sourceId}-${e.targetId}`),
          );
          setStagedMerges((prev) =>
            prev.filter((s) => failedKeys.has(mergeKey(s))),
          );
        } else {
          setStagedMerges([]);
        }
      }

      await Promise.all([
        mutateSuggestions(async () => {
          const res = await apiClient.get<MergeSuggestionsResponse>(
            `/api/contacts/merge-suggestions?selectedContactId=${selectedContact._id}`,
          );
          return res.data;
        }, { revalidate: false }),
        mutateUnverified(),
        mutateGlobal((key: string) => typeof key === "string" && key.startsWith("/api/contacts")),
      ]);

      if (mergeResult && mergeResult.failed > 0) {
        updateToast(
          toastId,
          `Saved. Merged ${mergeResult.applied}, ${mergeResult.failed} failed`,
          "info",
        );
      } else if (mergeResult) {
        updateToast(toastId, `Saved. Merged ${mergeResult.applied} contact(s)`, "success");
      } else {
        updateToast(toastId, "Contact review saved", "success");
      }
    } catch {
      updateToast(toastId, "Failed to save contact", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleStageMerge = (suggestion: MergeSuggestion) => {
    const stagedSuggestion =
      suggestion.strategy === "verified_anchor" || suggestion.target_is_verified
        ? suggestion
        : anchorSuggestionToContact(suggestion, selectedContact?._id);
    const originalKey = mergeKey(suggestion);
    const key = mergeKey(stagedSuggestion);
    setDismissedSuggestionKeys((prev) => {
      const next = new Set(prev);
      next.delete(originalKey);
      next.delete(key);
      return next;
    });
    setStagedMerges((prev) => {
      if (prev.some((s) => s.source_id === stagedSuggestion.source_id)) return prev;
      if (prev.some((s) => mergeKey(s) === key)) return prev;
      return normalizeStagedMerges([...prev, stagedSuggestion]);
    });
  };

  const handleRemoveStagedMerge = (key: string) => {
    setStagedMerges((prev) => prev.filter((s) => mergeKey(s) !== key));
  };

  if (status === "loading") {
    return (
      <div className="flex min-h-full items-center justify-center py-20">
        <p className="text-sm text-gray-500">Loading…</p>
      </div>
    );
  }

  if (status === "unauthenticated") {
    router.replace("/");
    return null;
  }

  return (
    <div className="verify-hub flex h-full flex-col">
      <header className="verify-hub__topbar sticky top-0 z-10 flex h-14 items-center justify-between border-b border-gray-200 bg-white px-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push("/contacts")}
            className="text-sm text-gray-500 hover:text-gray-800"
          >
            Contacts
          </button>
          <span className="text-gray-300">/</span>
          <h1 className="text-base font-semibold text-gray-900">Verify Hub</h1>
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
            {pendingCount}
          </span>
        </div>
      </header>

      <main className="verify-hub__content flex flex-1 gap-4 overflow-hidden px-6 py-4">
        <section className="verify-hub__queue w-80 shrink-0 overflow-y-auto rounded-xl border border-gray-200 bg-gray-50 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Needs Review ({pendingCount})
          </p>
          {unverifiedLoading ? (
            <p className="py-8 text-center text-sm text-gray-500">Loading queue…</p>
          ) : contacts.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-500">All contacts verified.</p>
          ) : (
            <div className="space-y-2">
              {contacts.map((contact) => (
                <ContactQueueItem
                  key={contact._id}
                  contact={contact}
                  selected={selectedContact?._id === contact._id}
                  onClick={() => setSelectedContactId(contact._id)}
                />
              ))}
            </div>
          )}
        </section>

        <section className="verify-hub__panel min-w-0 flex-1 overflow-y-auto rounded-xl border border-gray-200 bg-white p-4">
          {!selectedContact ? (
            <p className="text-sm text-gray-500">Select a contact to start verifying.</p>
          ) : (
            <div className="space-y-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Contact</p>
                <p className="mt-1 text-sm text-gray-900">{selectedContact.email}</p>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Display Name
                </label>
                <input
                  type="text"
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  placeholder="Enter contact name"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-black focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <div className="mb-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Category Verify</p>
                </div>
                {autoRefreshing && (
                  <p className="mb-2 text-xs text-indigo-500">
                    Auto-checking AI suggestion and duplicate candidates...
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  {ALL_CATEGORIES.map((cat) => {
                    const selected = selectedCategories.has(cat);
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => toggleCategory(cat)}
                        className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset transition-all ${
                          selected
                            ? `${CATEGORY_CHIP_STYLE[cat]} ring-2`
                            : "bg-gray-50 text-gray-600 ring-gray-200 hover:bg-gray-100"
                        }`}
                      >
                        {cat}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Duplicate / Similar Candidates
                </p>
                {suggestionLoading ? (
                  <p className="text-sm text-gray-500">Loading suggestions…</p>
                ) : selectedContactSuggestions.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-4 text-sm text-gray-500">
                    No duplicate candidates for this contact.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {selectedContactSuggestions.map((s) => {
                      const key = mergeKey(s);
                      const isQueued = stagedMergeKeys.has(key);
                      return (
                        <div key={key} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
                          <p className="text-sm font-medium text-amber-900">
                            {s.source_display_name || s.source_email} <span className="text-amber-500">→</span> {s.target_display_name || s.target_email}
                          </p>
                          {s.source_display_name && s.source_display_name !== s.source_email && (
                            <p className="mt-0.5 text-xs text-amber-700">From: {s.source_email}</p>
                          )}
                          {s.target_display_name && s.target_display_name !== s.target_email && (
                            <p className="mt-0.5 text-xs text-amber-700">Into: {s.target_email}</p>
                          )}
                          <p className="mt-0.5 text-xs text-amber-700">
                            {s.reason} · confidence {Math.round(s.confidence * 100)}%
                          </p>
                          {s.strategy === "verified_anchor" && (
                            <p className="mt-1 text-[11px] font-medium text-emerald-700">
                              Merge into verified contact
                            </p>
                          )}
                          {s.strategy === "selected_anchor" && (
                            <p className="mt-1 text-[11px] font-medium text-indigo-700">
                              Merge into current contact
                            </p>
                          )}
                          <div className="mt-2 flex gap-2">
                            <button
                              type="button"
                              onClick={() => handleStageMerge(s)}
                              disabled={isQueued}
                              className="rounded-md bg-amber-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50"
                            >
                              {isQueued ? "Queued" : "Add to Save Queue"}
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setDismissedSuggestionKeys((prev) => new Set(prev).add(key))
                              }
                              className="rounded-md border border-gray-300 px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-100"
                            >
                              Dismiss
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Pending Merges ({stagedMerges.length})
                </p>
                {stagedMerges.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-4 text-sm text-gray-500">
                    No merges queued. Add candidates above, then Save to apply.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {stagedMerges.map((s) => {
                      const key = mergeKey(s);
                      return (
                        <div key={key} className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2.5">
                          <p className="text-sm font-medium text-indigo-900">
                            {s.source_display_name || s.source_email} <span className="text-indigo-500">→</span> {s.target_display_name || s.target_email}
                          </p>
                          {s.source_display_name && s.source_display_name !== s.source_email && (
                            <p className="mt-0.5 text-xs text-indigo-700">From: {s.source_email}</p>
                          )}
                          {s.target_display_name && s.target_display_name !== s.target_email && (
                            <p className="mt-0.5 text-xs text-indigo-700">Into: {s.target_email}</p>
                          )}
                          <p className="mt-0.5 text-xs text-indigo-700">
                            Will merge when you click Save
                          </p>
                          <button
                            type="button"
                            onClick={() => handleRemoveStagedMerge(key)}
                            className="mt-2 rounded-md border border-indigo-300 px-2.5 py-1 text-xs text-indigo-700 hover:bg-indigo-100"
                          >
                            Remove
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="border-t border-gray-100 pt-4">
                <button
                  type="button"
                  onClick={handleSaveAndVerify}
                  disabled={saving}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
