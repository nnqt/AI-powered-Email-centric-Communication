"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";

import apiClient from "@/lib/api";
import { useThreads } from "@/hooks/useThreads";
import { useToast } from "@/components/Toast";

export function SyncButton() {
  const { status } = useSession();
  const { mutate } = useThreads();
  const { showToast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [nextPageToken, setNextPageToken] = useState<string | undefined>();

  const disabled = status !== "authenticated" || isLoading;

  // Check sync status on mount
  useEffect(() => {
    const checkSyncStatus = async () => {
      if (status === "authenticated") {
        try {
          const response = await apiClient.get("/api/emails/sync");
          setHasMore(response.data.hasMore);
          setNextPageToken(response.data.nextPageToken);
        } catch (error) {
          // Ignore errors on status check
        }
      }
    };
    checkSyncStatus();
  }, [status]);

  const handleClick = async (isRetry = false) => {
    if (disabled) return;
    setIsLoading(true);

    try {
      const response = await apiClient.post("/api/emails/sync", {
        pageToken: nextPageToken,
      });
      await mutate();

      const syncedCount = response.data?.syncedMessages || 0;
      const newHasMore = response.data?.hasMore || false;
      const newPageToken = response.data?.nextPageToken;

      setHasMore(newHasMore);
      setNextPageToken(newPageToken);

      const moreText = newHasMore ? " (more available)" : "";
      showToast(
        `Successfully synced ${syncedCount} message${
          syncedCount !== 1 ? "s" : ""
        }${moreText}`,
        "success"
      );
      setRetryCount(0);
    } catch (error: any) {
      // Auth errors are handled by interceptor (auto sign out)
      if (error.isAuthError) {
        showToast(
          error.message || "Session expired. Please sign in again.",
          "error"
        );
        return;
      }

      // Network or server errors - allow retry
      const errorMessage =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        "Failed to sync emails";

      showToast(errorMessage, "error");

      // Increment retry count
      if (!isRetry) {
        setRetryCount((prev) => prev + 1);
      }

      // Auto retry once after 2 seconds if network error
      if (retryCount === 0 && !error.response) {
        showToast("Retrying in 2 seconds...", "info");
        setTimeout(() => {
          handleClick(true);
        }, 2000);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const buttonText = isLoading
    ? "Syncing..."
    : hasMore
    ? "Sync More Emails"
    : "Sync Inbox";

  return (
    <button
      type="button"
      onClick={() => handleClick(false)}
      disabled={disabled}
      className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-400 transition-colors"
      title={hasMore ? "Fetch older emails from Gmail" : "Sync latest emails"}
    >
      {buttonText}
    </button>
  );
}
