import { ChatClient } from "@/components/chat/ChatClient";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

export default function ChatPage() {
  return (
    <ProtectedRoute>
      <ChatClient />
    </ProtectedRoute>
  );
}
