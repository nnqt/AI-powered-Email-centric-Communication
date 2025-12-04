"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";

import apiClient from "../lib/api";
import { useThreads } from "../hooks/useThreads";

export function SyncButton() {
  const { status } = useSession();
  const { mutate } = useThreads();
  const [isLoading, setIsLoading] = useState(false);

  const disabled = status !== "authenticated" || isLoading;

  const handleClick = async () => {
    if (disabled) return;
    setIsLoading(true);
    try {
      await apiClient.post("/api/emails/sync");
      await mutate();
    } catch (error) {
      console.error("Failed to sync emails", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-400"
    >
      {isLoading ? "Syncing..." : "Sync Inbox"}
    </button>
  );
}
