"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { useSession } from "next-auth/react";
import { useSWRConfig } from "swr";

import apiClient from "@/lib/api";
import { useToast } from "@/components/Toast";

interface SyncStatus {
  hasMore: boolean;
  nextPageToken?: string;
  syncComplete: boolean;
  lastSyncedAt?: string;
}

export default function InboxSyncPage() {
  const router = useRouter();
  const { status } = useSession();
  const { showToast, updateToast } = useToast();
  const { mutate } = useSWRConfig();

  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncedMessages, setSyncedMessages] = useState<number | null>(null);
  const [lastRunAt, setLastRunAt] = useState<Date | null>(null);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetchStatus();
  }, [status]);

  const fetchStatus = async () => {
    try {
      const res = await apiClient.get<SyncStatus>("/api/emails/sync");
      setSyncStatus(res.data);
    } catch {
      // ignore
    }
  };

  const revalidateThreads = () =>
    mutate(
      (key: unknown) =>
        typeof key === "string" && key.startsWith("/api/threads"),
      undefined,
      { revalidate: true },
    );

  const handleSync = async () => {
    if (syncing) return;
    setSyncing(true);
    setSyncedMessages(null);
    const toastId = showToast(
      syncStatus?.hasMore ? "Syncing older emails…" : "Syncing inbox…",
      "processing",
    );
    try {
      const res = await apiClient.post<{
        syncedMessages: number;
        hasMore: boolean;
        nextPageToken?: string;
      }>("/api/emails/sync", {
        pageToken: syncStatus?.nextPageToken,
      });

      const count = res.data.syncedMessages ?? 0;
      setSyncedMessages(count);
      setLastRunAt(new Date());
      setSyncStatus((prev) => ({
        ...(prev ?? { syncComplete: false }),
        hasMore: res.data.hasMore,
        nextPageToken: res.data.nextPageToken,
      }));

      revalidateThreads();
      updateToast(
        toastId,
        `Synced ${count} message${count !== 1 ? "s" : ""}${res.data.hasMore ? " · more available" : ""}`,
        "success",
      );
    } catch (err: any) {
      const msg =
        err?.response?.data?.error ||
        err?.message ||
        "Sync failed. Please try again.";
      updateToast(toastId, msg, "error");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="inbox-sync flex flex-col h-full">
      {/* Topbar */}
      <header className="inbox-sync__topbar sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-gray-200 bg-white px-6">
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
        <h1 className="text-base font-semibold text-gray-900">Sync Emails</h1>
      </header>

      <main className="inbox-sync__content flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto max-w-xl space-y-4">
          {/* Status card */}
          <div className="inbox-sync__status-card rounded-xl border border-gray-200 bg-white shadow-sm p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-sm font-semibold text-gray-800">
                  Gmail Sync
                </h2>
                <p className="mt-1 text-xs text-gray-500">
                  Pull latest emails from your Gmail account into EmailHub.
                </p>
              </div>
              {/* Status indicator */}
              <div className="flex items-center gap-1.5">
                <span
                  className={`h-2 w-2 rounded-full ${
                    syncStatus?.syncComplete
                      ? "bg-green-400"
                      : "bg-amber-400 animate-pulse"
                  }`}
                />
                <span className="text-xs text-gray-500">
                  {syncStatus === null
                    ? "Checking…"
                    : syncStatus.syncComplete
                      ? "Up to date"
                      : "More to sync"}
                </span>
              </div>
            </div>

            {/* Info rows */}
            <div className="mt-4 space-y-2 rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 text-xs text-gray-600">
              {syncStatus?.hasMore && (
                <div className="flex items-center justify-between">
                  <span>Older emails available</span>
                  <span className="font-medium text-amber-700">Yes</span>
                </div>
              )}
              {lastRunAt && (
                <div className="flex items-center justify-between">
                  <span>Last synced (this session)</span>
                  <span className="font-medium text-gray-800">
                    {formatDistanceToNow(lastRunAt, { addSuffix: true })}
                  </span>
                </div>
              )}
              {syncedMessages !== null && (
                <div className="flex items-center justify-between">
                  <span>Messages synced (last run)</span>
                  <span className="font-semibold text-indigo-700">
                    {syncedMessages}
                  </span>
                </div>
              )}
            </div>

            {/* Sync button */}
            <button
              type="button"
              onClick={handleSync}
              disabled={syncing || status !== "authenticated"}
              className="inbox-sync__btn mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60 transition-colors"
            >
              {syncing ? (
                <>
                  <svg
                    className="h-4 w-4 animate-spin"
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
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Syncing…
                </>
              ) : syncStatus?.hasMore ? (
                <>
                  <svg
                    className="h-4 w-4"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Sync More Emails
                </>
              ) : (
                <>
                  <svg
                    className="h-4 w-4"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Sync Inbox
                </>
              )}
            </button>
          </div>

          {/* Info note */}
          <p className="inbox-sync__note text-xs text-gray-400 text-center px-2">
            EmailHub syncs in batches of 50 threads. Run Sync multiple times to
            import older emails. New emails arrive automatically via background
            sync every 60 s.
          </p>
        </div>
      </main>
    </div>
  );
}
