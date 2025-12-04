"use client";

import { useSession, signIn } from "next-auth/react";

import { SyncButton } from "../components/SyncButton";
import { ThreadList } from "../features/inbox/ThreadList";

export default function Home() {
  const { data: session, status } = useSession();

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
          <SyncButton />
        </header>

        <section>
          <ThreadList />
        </section>
      </div>
    </main>
  );
}
