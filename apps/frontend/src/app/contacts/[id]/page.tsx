"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { formatDistanceToNow } from "date-fns";

import { useContactDetail, useContactTimeline } from "@/hooks/useContacts";
import { useToast } from "@/components/Toast";
import apiClient from "@/lib/api";

export default function ContactDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session, status } = useSession();
  const { showToast } = useToast();

  const contactId = params.id as string;
  const { contact, isLoading, isError, mutate } = useContactDetail(contactId);
  const { threads, isLoading: timelineLoading } = useContactTimeline(contactId);

  const [enriching, setEnriching] = useState(false);

  const handleEnrich = async () => {
    setEnriching(true);
    try {
      await apiClient.post(`/api/contacts/${contactId}/enrich`);
      await mutate();
      showToast("Contact enriched with AI", "success");
    } catch {
      showToast("Enrichment failed", "error");
    } finally {
      setEnriching(false);
    }
  };

  if (status === "loading" || isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-500">Loading…</p>
      </main>
    );
  }

  if (status === "unauthenticated") {
    router.replace("/");
    return null;
  }

  if (isError || !contact) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-sm text-red-500">Contact not found.</p>
      </main>
    );
  }

  const initials = contact.name
    ? contact.name
        .split(" ")
        .map((w) => w[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : contact.email[0].toUpperCase();

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <button
            type="button"
            onClick={() => router.push("/contacts")}
            className="text-sm text-gray-500 hover:text-gray-900"
          >
            ← Contacts
          </button>
          <button
            type="button"
            onClick={handleEnrich}
            disabled={enriching}
            className="rounded-md border border-purple-300 bg-purple-50 px-3 py-1.5 text-sm font-medium text-purple-700 hover:bg-purple-100 disabled:opacity-50"
          >
            {enriching ? "Enriching…" : "✦ Enrich with AI"}
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-6 space-y-6">
        {/* Contact card */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xl font-semibold text-indigo-700">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-semibold text-gray-900">
                {contact.name ?? contact.email}
              </h1>
              {contact.name && (
                <p className="text-sm text-gray-500">{contact.email}</p>
              )}
              <div className="mt-2 flex flex-wrap gap-2">
                {contact.org && (
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                    🏢 {contact.org}
                  </span>
                )}
                {contact.language && (
                  <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700">
                    🌐 {contact.language}
                  </span>
                )}
                {contact.aiEnriched && (
                  <span className="rounded-full bg-purple-50 px-3 py-1 text-xs font-medium text-purple-700">
                    ✦ AI Enriched
                  </span>
                )}
              </div>
              {contact.alternateEmails.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs text-gray-500">
                    Also known as: {contact.alternateEmails.join(", ")}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Thread timeline */}
        <div>
          <h2 className="mb-3 text-sm font-semibold text-gray-700 uppercase tracking-wider">
            Communication Timeline
          </h2>
          {timelineLoading ? (
            <p className="text-sm text-gray-500">Loading threads…</p>
          ) : threads.length === 0 ? (
            <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
              <p className="text-sm text-gray-500">
                No emails with this contact yet.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {threads.map((thread: any) => (
                <div
                  key={thread._id}
                  role="button"
                  tabIndex={0}
                  onClick={() => router.push(`/threads/${thread.id}`)}
                  onKeyDown={(e) =>
                    e.key === "Enter" && router.push(`/threads/${thread.id}`)
                  }
                  className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 hover:bg-gray-50 transition-colors"
                >
                  <div
                    className="mt-0.5 flex h-2 w-2 shrink-0 rounded-full bg-indigo-500 opacity-0 data-[unread=true]:opacity-100"
                    data-unread={!thread.isRead}
                  />
                  <div className="min-w-0 flex-1">
                    <p
                      className={`truncate text-sm ${!thread.isRead ? "font-semibold text-gray-900" : "text-gray-700"}`}
                    >
                      {thread.subject ?? "(no subject)"}
                    </p>
                    {thread.snippet && (
                      <p className="truncate text-xs text-gray-500 mt-0.5">
                        {thread.snippet}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 text-xs text-gray-400">
                    {thread.lastMessageDate
                      ? formatDistanceToNow(new Date(thread.lastMessageDate), {
                          addSuffix: true,
                        })
                      : ""}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
