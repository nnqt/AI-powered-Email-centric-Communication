"use client";

import { useSession } from "next-auth/react";
import { useEffect, useRef } from "react";

import apiClient from "@/lib/api";
import { ThreadList } from "@/features/inbox/ThreadList";
import { useToast } from "@/components/Toast";
import { useSocket, useBackgroundSync } from "@/hooks/useSocket";
import { useSWRConfig } from "swr";

export default function InboxPage() {
  const { data: session, status } = useSession();
  const { showToast, updateToast } = useToast();
  const { mutate } = useSWRConfig();

  const userId = (session?.user as any)?.id as string | undefined;
  const autoSyncFired = useRef(false);

  // Auto-sync on first authenticated load — show processing toast
  useEffect(() => {
    if (status !== "authenticated" || autoSyncFired.current) return;
    autoSyncFired.current = true;
    const toastId = showToast("Syncing inbox…", "processing");
    apiClient
      .post("/api/emails/sync")
      .then((res) => {
        const synced = res.data?.syncedMessages ?? 0;
        updateToast(
          toastId,
          `Synced ${synced} email${synced !== 1 ? "s" : ""}`,
          "success",
        );
      })
      .catch(() => updateToast(toastId, "Sync failed", "error"));
  }, [status]);

  const revalidateThreads = () =>
    mutate(
      (key: unknown) =>
        typeof key === "string" && key.startsWith("/api/threads"),
      undefined,
      { revalidate: true },
    );

  useSocket(userId, {
    EMAIL_SYNCED: (payload: { count: number; hasMore: boolean }) => {
      revalidateThreads();
    },
    NEW_THREAD: () => revalidateThreads(),
    EMAIL_SENT: () => revalidateThreads(),
  });

  useBackgroundSync(revalidateThreads, 60_000, status === "authenticated");

  return (
    <div className="inbox-page flex flex-col h-full">
      {/* Topbar */}
      <header className="inbox-page__topbar sticky top-0 z-10 flex h-14 items-center border-b border-gray-200 bg-white px-6">
        <h1 className="text-base font-semibold text-gray-900">Inbox</h1>
      </header>

      {/* Thread list */}
      <main className="inbox-page__content flex-1 overflow-y-auto px-6 py-4">
        <ThreadList />
      </main>
    </div>
  );
}
