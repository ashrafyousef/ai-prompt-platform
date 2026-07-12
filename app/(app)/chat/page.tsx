import { ChatClient } from "@/components/chat/ChatClient";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { Suspense } from "react";

export default function ChatPage() {
  return (
    <ProtectedRoute>
      <Suspense
        fallback={
          <main className="flex min-h-screen items-center justify-center bg-white text-gray-900 dark:bg-zinc-950 dark:text-zinc-100">
            <p className="text-sm text-zinc-500">Loading chat...</p>
          </main>
        }
      >
        <ChatClient />
      </Suspense>
    </ProtectedRoute>
  );
}
