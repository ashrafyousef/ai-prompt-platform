"use client";

import ReactMarkdown from "react-markdown";
import { UiMessage } from "@/lib/types";

type Props = {
  messages: UiMessage[];
  onRegenerate: (messageId: string) => void;
  onEdit: (messageId: string, currentText: string) => void;
};

export function MessageList({ messages, onRegenerate, onEdit }: Props) {
  return (
    <div className="flex-1 space-y-4 overflow-auto bg-white p-4 text-gray-900">
      {messages.map((message) => (
        <div
          key={message.id}
          className={`rounded-lg p-3 text-gray-900 ${
            message.role === "user" ? "ml-auto max-w-2xl bg-blue-50" : "mr-auto max-w-3xl bg-gray-100"
          }`}
        >
          <ReactMarkdown>{message.content}</ReactMarkdown>
          {message.role === "assistant" ? (
            <div className="mt-2 flex gap-3 text-xs text-gray-700">
              <button className="font-medium hover:text-gray-900" onClick={() => navigator.clipboard.writeText(message.content)}>Copy</button>
              <button className="font-medium hover:text-gray-900" onClick={() => onRegenerate(message.id)}>Regenerate</button>
            </div>
          ) : null}
          {message.role === "user" ? (
            <div className="mt-2 text-xs text-gray-700">
              <button className="font-medium hover:text-gray-900" onClick={() => onEdit(message.id, message.content)}>Edit</button>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
