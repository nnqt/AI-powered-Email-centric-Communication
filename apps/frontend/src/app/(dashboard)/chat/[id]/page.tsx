"use client";

import { useState, useRef, useEffect, use } from "react";
import { format } from "date-fns";
import { useTelegramMessages, TelegramMessageDTO } from "@/hooks/useTelegramMessages";
import { useSocket } from "@/hooks/useSocket";
import apiClient from "@/lib/api";
import { useSession } from "next-auth/react";

export default function ChatDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { chat, messages, isLoading, mutate } = useTelegramMessages(id);
  const { data: session } = useSession();
  const userId = (session?.user as any)?.id as string | undefined;

  const [inputText, setInputText] = useState("");
  const [optimisticMessages, setOptimisticMessages] = useState<TelegramMessageDTO[]>([]);
  const [isSending, setIsSending] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Sync DB messages with component state and scroll on load
  useEffect(() => {
    if (!isLoading) {
      setOptimisticMessages(messages);
      messagesEndRef.current?.scrollIntoView();
    }
  }, [messages, isLoading]);

  useSocket(userId, {
    NEW_TELEGRAM_MESSAGE: (payload: any) => {
      // payload: { chatId, message, chat }
      if (payload.chatId === id) {
        mutate(); // SWR will refetch and update DB messages
      }
    },
  });

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isSending) return;

    const tempId = `temp_${Date.now()}`;
    const text = inputText.trim();
    
    // Add optimistic message at the END (since we render chronologically)
    const newOptimisticMsg: TelegramMessageDTO = {
      _id: tempId,
      messageId: tempId,
      chatId: id,
      senderId: "me",
      text,
      date: new Date().toISOString(),
      isOutbound: true,
    };

    setOptimisticMessages((prev) => [...prev, newOptimisticMsg]);
    setInputText("");
    setIsSending(true);

    // Scroll to bottom immediately
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);

    try {
      await apiClient.post("/api/telegram/send", {
        chatId: id,
        text,
      });
      // The socket event will trigger mutate() to replace optimistic with real message
    } catch (err) {
      console.error("Failed to send message", err);
      // Rollback on error
      setOptimisticMessages((prev) => prev.filter((m) => m._id !== tempId));
    } finally {
      setIsSending(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col h-full bg-gray-50">
        <div className="h-16 border-b border-gray-200 bg-white shadow-sm shrink-0 items-center flex px-4 animate-pulse">
           <div className="w-48 h-5 bg-gray-200 rounded" />
        </div>
        <div className="flex-1 p-4 space-y-4">
           <div className="w-1/2 h-16 bg-gray-200 rounded-lg animate-pulse" />
           <div className="w-1/3 h-16 bg-gray-200 rounded-lg animate-pulse ml-auto" />
        </div>
      </div>
    );
  }

  if (!chat) {
    return (
      <div className="flex-1 flex items-center justify-center h-full bg-gray-50 text-gray-500">
        Chat not found
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-gray-50 overflow-hidden relative">
      {/* Header */}
      <header className="h-16 shrink-0 border-b border-gray-200 bg-white shadow-sm z-10 flex items-center px-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 font-medium">
            {chat.title.charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-900">{chat.title}</h2>
            <p className="text-xs text-gray-500 capitalize">
              {chat.type} chat
            </p>
          </div>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {optimisticMessages.map((msg, idx) => {
          const showDate = false; // Could add date header separators here
          
          return (
            <div
              key={msg._id}
              className={`flex flex-col max-w-[75%] ${
                msg.isOutbound ? "ml-auto items-end" : "items-start"
              }`}
            >
              <div
                className={`px-4 py-2 rounded-2xl shadow-sm text-sm ${
                  msg.isOutbound
                    ? "bg-indigo-600 text-white rounded-br-none"
                    : "bg-white border border-gray-200 text-gray-900 rounded-bl-none"
                } ${msg._id.startsWith("temp_") ? "opacity-70" : ""}`}
              >
                <div className="whitespace-pre-wrap break-words">
                  {msg.text || (
                     <span className="italic opacity-80">Media message</span>
                  )}
                </div>
              </div>
              <span className="text-[10px] text-gray-400 mt-1 px-1">
                {format(new Date(msg.date), "HH:mm")}
              </span>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 p-4 bg-white border-t border-gray-200">
        <form onSubmit={handleSend} className="flex gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 block w-full rounded-full border border-gray-300 px-4 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 disabled:bg-gray-50"
            disabled={isSending}
          />
          <button
            type="submit"
            disabled={!inputText.trim() || isSending}
            className="inline-flex items-center justify-center w-10 h-10 rounded-full border border-transparent bg-indigo-600 text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:bg-indigo-400 disabled:cursor-not-allowed transition-colors"
          >
            <svg
              className="h-4 w-4 transform rotate-90"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
}
