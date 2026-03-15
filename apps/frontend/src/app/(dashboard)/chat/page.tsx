export default function ChatIndexPage() {
  return (
    <div className="flex h-full flex-col items-center justify-center bg-gray-50 p-8 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-indigo-100 text-indigo-500">
        <svg
          className="h-8 w-8"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
          />
        </svg>
      </div>
      <h3 className="text-lg font-medium text-gray-900">Your Messages</h3>
      <p className="mt-1 text-sm text-gray-500 max-w-sm">
        Select a chat from the sidebar to view the conversation or start messaging.
      </p>
    </div>
  );
}
