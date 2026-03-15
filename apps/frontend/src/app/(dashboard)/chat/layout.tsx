"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { format } from "date-fns";
import { useTelegramChats } from "@/hooks/useTelegramChats";
import { useSocket } from "@/hooks/useSocket";
import { useSession } from "next-auth/react";

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { chats, isLoading, mutate } = useTelegramChats();
  const { data: session } = useSession();
  const userId = (session?.user as any)?.id as string | undefined;

  // Listen for real-time new telegram messages
  useSocket(userId, {
    NEW_TELEGRAM_MESSAGE: (payload) => {
      console.log("[ChatLayout] Realtime update:", payload);
      mutate(); // Reload chats to pull unread count and new last message
    },
  });

  return (
    <div className="flex h-screen bg-white">
      {/* Left Sidebar: Chat List */}
      <aside className="w-80 flex-shrink-0 border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Telegram</h2>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-4 space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex gap-3 animate-pulse">
                  <div className="w-10 h-10 rounded-full bg-gray-200" />
                  <div className="flex-1 space-y-2 py-1">
                    <div className="h-4 bg-gray-200 rounded w-1/2" />
                    <div className="h-3 bg-gray-200 rounded w-3/4" />
                  </div>
                </div>
              ))}
            </div>
          ) : chats.length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-500">
              No chats found. Link your Telegram in Settings or start a conversation.
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {chats.map((chat) => {
                const isActive = pathname === `/chat/${chat.chatId}`;
                const dateRaw = new Date(chat.lastMessageDate);
                const isToday =
                  dateRaw.toDateString() === new Date().toDateString();
                const timeStr = isToday
                  ? format(dateRaw, "HH:mm")
                  : format(dateRaw, "MMM d");

                return (
                  <li key={chat.chatId}>
                    <Link
                      href={`/chat/${chat.chatId}`}
                      className={`flex items-start gap-3 p-3 transition-colors ${
                        isActive
                          ? "bg-indigo-50"
                          : "hover:bg-gray-50"
                      }`}
                    >
                      {/* Avatar placeholder */}
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 font-medium">
                        {chat.title.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <p className="text-sm font-medium text-gray-900 truncate pr-2">
                            {chat.title}
                          </p>
                          <span className="text-xs text-gray-500 shrink-0">
                            {timeStr}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-gray-500 truncate pr-2">
                            {/* We don't have last message snippet stored yet, but could add it. */}
                            {chat.type === "group" ? "Group Chat" : "Private Chat"}
                          </p>
                          {chat.unreadCount > 0 && (
                            <span className="inline-flex items-center justify-center h-5 px-1.5 min-w-[1.25rem] text-[10px] font-bold text-white bg-indigo-600 rounded-full">
                              {chat.unreadCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>

      {/* Right Column: Main Content */}
      <main className="flex-1 min-w-0 flex flex-col">
        {children}
      </main>
    </div>
  );
}
