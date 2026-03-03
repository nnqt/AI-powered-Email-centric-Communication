"use client";

import { useSession, signIn } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import apiClient from "@/lib/api";
import { SyncButton } from "@/components/SyncButton";
import { ThreadList } from "@/features/inbox/ThreadList";
import { useToast } from "@/components/Toast";
import { ComposeDrawer } from "@/components/ComposeDrawer";
import { useSocket, useBackgroundSync } from "@/hooks/useSocket";
import { useSWRConfig } from "swr";

export default function Home() {
  const { data: session, status } = useSession();
  const { showToast } = useToast();
  const router = useRouter();
  const [composeOpen, setComposeOpen] = useState(false);
  const { mutate } = useSWRConfig();

  const userId = (session?.user as any)?.id as string | undefined;
  const autoSyncFired = useRef(false);

  // Auto-sync on first authenticated load
  useEffect(() => {
    if (status !== "authenticated" || autoSyncFired.current) return;
    autoSyncFired.current = true;
    apiClient.post("/api/emails/sync").catch(() => {});
  }, [status]);

  const revalidateThreads = () =>
    mutate(
      (key: unknown) =>
        typeof key === "string" && key.startsWith("/api/threads"),
      undefined,
      { revalidate: true },
    );

  // Realtime: refresh thread list when server pushes events
  useSocket(userId, {
    EMAIL_SYNCED: (payload: { count: number; hasMore: boolean }) => {
      revalidateThreads();
      if (payload.count > 0) {
        showToast(
          `Synced ${payload.count} email${payload.count !== 1 ? "s" : ""}`,
          "success",
        );
      }
    },
    NEW_THREAD: () => {
      revalidateThreads();
    },
    EMAIL_SENT: () => {
      revalidateThreads();
    },
  });

  // Polling fallback: silently revalidate every 60 s in case socket events are missed
  useBackgroundSync(revalidateThreads, 60_000, status === "authenticated");

  useEffect(() => {
    if (session?.expires) {
      // showToast("Your session has expired. Please sign in again.", "error");
    }
  }, [session, showToast]);

  if (status === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-gray-600">Loading...</p>
      </main>
    );
  }

  if (status === "unauthenticated") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="rounded-lg bg-white p-8 shadow-md">
          <h1 className="mb-4 text-xl font-semibold text-gray-900">
            Welcome to Email Timeline
          </h1>
          <p className="mb-6 text-sm text-gray-600">
            Sign in with Google to sync your inbox and see a contact-centric
            email timeline.
          </p>
          <button
            type="button"
            onClick={() => signIn("google")}
            className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
          >
            Continue with Google
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-5xl px-4 py-8">
        <header className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Inbox</h1>
            <p className="text-sm text-gray-600">
              {session?.user?.name ? `Signed in as ${session.user.name}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => router.push("/contacts")}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              Contacts
            </button>
            <button
              type="button"
              onClick={() => setComposeOpen(true)}
              className="flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
            >
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
                  clipRule="evenodd"
                />
              </svg>
              Compose
            </button>
            <SyncButton />
          </div>
        </header>

        <section>
          <ThreadList />
        </section>
      </div>

      <ComposeDrawer open={composeOpen} onClose={() => setComposeOpen(false)} />
    </main>
  );
}
