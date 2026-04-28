import { describe, expect, it, vi, beforeEach } from "vitest";

const requireWorkspaceMemberManagerContext = vi.fn();
const createChatCompletion = vi.fn();
const canManageAgentForActor = vi.fn();
const logJson = vi.fn();

const db = {
  agentConfig: {
    findUnique: vi.fn(),
  },
};

vi.mock("@/lib/adminAuth", () => ({
  requireWorkspaceMemberManagerContext,
}));

vi.mock("@/lib/openai/client", () => ({
  createChatCompletion,
}));

vi.mock("@/lib/agentScope", () => ({
  canManageAgentForActor,
}));

vi.mock("@/lib/logger", () => ({
  logJson,
}));

vi.mock("@/lib/db", () => ({
  db,
}));

vi.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      async json() {
        return body;
      },
    }),
  },
}));

describe("admin agent test route knowledge telemetry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("propagates standardized knowledge injection metadata in logs and response", async () => {
    requireWorkspaceMemberManagerContext.mockResolvedValue({
      workspaceId: "ws-1",
      workspaceRole: "OWNER",
      platformRole: "ADMIN",
      teamId: null,
    });
    canManageAgentForActor.mockReturnValue(true);
    db.agentConfig.findUnique.mockResolvedValue({
      id: "agent-1",
      name: "Helper",
      temperature: 0.4,
      maxTokens: 800,
      systemPrompt: "System prompt",
      outputFormat: "markdown",
      outputSchema: null,
      inputSchema: {},
      knowledgeLinks: [],
    });
    createChatCompletion.mockResolvedValue({ content: "ok" });

    const { POST } = await import("../app/api/admin/agents/[id]/test/route");
    const req = {
      async json() {
        return { prompt: "hi" };
      },
    };

    const res = await POST(req as any, { params: { id: "agent-1" } });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(logJson).toHaveBeenCalledWith(
      "info",
      expect.objectContaining({
        route: "/api/admin/agents/[id]/test",
        status: "knowledge_injection",
        agentId: "agent-1",
        knowledgeInjection: {
          totalItems: expect.any(Number),
          activeItems: expect.any(Number),
          injectedItems: expect.any(Number),
          injectedChars: expect.any(Number),
          truncated: expect.any(Boolean),
        },
      })
    );
    expect(json.result.configSummary).toEqual(
      expect.objectContaining({
        knowledgeCount: expect.any(Number),
        knowledgeTotal: expect.any(Number),
        knowledgeInjectedItems: expect.any(Number),
        knowledgeInjectedChars: expect.any(Number),
        knowledgeTruncated: expect.any(Boolean),
      })
    );
  });

  it("keeps telemetry safe when no active knowledge exists", async () => {
    requireWorkspaceMemberManagerContext.mockResolvedValue({
      workspaceId: "ws-1",
      workspaceRole: "OWNER",
      platformRole: "ADMIN",
      teamId: null,
    });
    canManageAgentForActor.mockReturnValue(true);
    db.agentConfig.findUnique.mockResolvedValue({
      id: "agent-2",
      name: "No Knowledge",
      temperature: 0.4,
      maxTokens: 800,
      systemPrompt: "System prompt",
      outputFormat: "markdown",
      outputSchema: null,
      inputSchema: {
        knowledgeItems: [
          {
            id: "k-1",
            title: "Hidden",
            sourceType: "manual_text",
            content: "secret",
            fileRef: null,
            summary: "",
            tags: [],
            priority: 3,
            appliesTo: "all",
            isActive: false,
            ownerNote: "",
            lastReviewedAt: null,
            processingStatus: "ready",
          },
        ],
      },
      knowledgeLinks: [],
    });
    createChatCompletion.mockResolvedValue({ content: "ok" });

    const { POST } = await import("../app/api/admin/agents/[id]/test/route");
    const req = {
      async json() {
        return { prompt: "hello" };
      },
    };

    const res = await POST(req as any, { params: { id: "agent-2" } });
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.result.configSummary.knowledgeCount).toBe(0);
    expect(json.result.configSummary.knowledgeInjectedItems).toBe(0);
    expect(json.result.configSummary.knowledgeInjectedChars).toBe(0);
    expect(json.result.configSummary.knowledgeTruncated).toBe(false);
  });
});
