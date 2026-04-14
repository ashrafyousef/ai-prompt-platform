export type UiSession = {
  id: string;
  title: string;
  updatedAt: string;
};

export type UiMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
  imageUrls?: string[];
};

export type UiAgent = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  category: string | null;
  starterPrompts: string[];
};
