import { beforeEach, describe, expect, it, vi } from "vitest";

const getServerSession = vi.fn();
const checkRateLimit = vi.fn();
const getGovernedModelsForUser = vi.fn();
const assertUserWithinSoftTokenLimit = vi.fn();
const assertModelAccessForRole = vi.fn();
const assertGovernedModelSessionAccessible = vi.fn();
const prepareOrchestrator = vi.fn();
const buildEffectiveAgentConfig = vi.fn();
const governedOptionsToUiSummaries = vi.fn();
const routeModel = vi.fn();
const resolveModelById = vi.fn();
const validateSendTimeModelPreferences = vi.fn();
const streamChatCompletion = vi.fn();
const logJson = vi.fn();
const captureError = vi.fn();

const db = {
  message: {
    findFirst: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  $transaction: vi.fn(),
};

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

vi.mock("next-auth", () => ({
  getServerSession,
}));

vi.mock("@/lib/rateLimit", () => ({
  checkRateLimit,
}));

vi.mock("@/lib/usage", () => ({
  getGovernedModelsForUser,
  assertUserWithinSoftTokenLimit,
  assertModelAccessForRole,
}));

vi.mock("@/lib/agentModelGovernance", () => ({
  assertGovernedModelSessionAccessible,
}));

vi.mock("@/lib/orchestration/chatOrchestrator", () => ({
  applyFirstTurnTitleFallback: vi.fn(),
  charEstimateFromMessages: vi.fn(() => 42),
  finalizeAssistantMessage: vi.fn(),
  prepareOrchestrator,
}));

vi.mock("@/lib/agentEffectiveConfig", () => ({
  buildEffectiveAgentConfig,
}));

vi.mock("@/lib/modelRouter", () => ({
  governedOptionsToUiSummaries,
  routeModel,
}));

vi.mock("@/lib/models", () => ({
  resolveModelById,
}));

vi.mock("@/lib/openai/client", () => ({
  streamChatCompletion,
}));

vi.mock("@/lib/chatAgentModelRules", () => ({
  chatSendNeedsLongContextHeuristic: vi.fn(() => false),
  validateSendTimeModelPreferences,
}));

vi.mock("@/lib/logger", () => ({
  logJson,
}));

vi.mock("@/lib/sentry", () => ({
  captureError,
}));

vi.mock("@/lib/db", () => ({
  db,
}));

describe("chat send route knowledge telemetry propagation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as any).crypto = {
      randomUUID: () => "turn-1",
    };
    (globalThis as any).ReadableStream = class {
      _source: {
        start?: (controller: { enqueue: (chunk: unknown) => void; close: () => void }) => unknown;
        cancel?: () => unknown;
      };
      constructor(source: {
        start?: (controller: { enqueue: (chunk: unknown) => void; close: () => void }) => unknown;
        cancel?: () => unknown;
      }) {
        this._source = source;
        const controller = {
          enqueue: () => {},
          close: () => {},
        };
        void source.start?.(controller);
      }
      async cancel() {
        await this._source.cancel?.();
      }
    };
    (globalThis as any).Response = class {
      body: unknown;
      headers: Record<string, string>;
      constructor(body: unknown, init?: { headers?: Record<string, string> }) {
        this.body = body;
        this.headers = init?.headers ?? {};
      }
    };
  });

  function setupBaseSendMocks() {
    getServerSession.mockResolvedValue({
      user: { id: "user-1", role: "USER", teamId: null },
    });
    checkRateLimit.mockResolvedValue({ allowed: true });
    getGovernedModelsForUser.mockResolvedValue({
      models: [],
      snapshot: { user: { status: "ok" } },
    });
    assertUserWithinSoftTokenLimit.mockResolvedValue(undefined);
    prepareOrchestrator.mockResolvedValue({
      agent: {
        id: "agent-1",
        name: "Agent One",
        temperature: 0.3,
        maxTokens: 700,
        outputFormat: "markdown",
        inputSchema: {},
      },
      messages: [{ role: "system", content: "system" }],
      knowledgeInjection: {
        totalItems: 3,
        activeItems: 2,
        injectedItems: 2,
        injectedChars: 512,
        truncated: false,
      },
    });
    buildEffectiveAgentConfig.mockReturnValue({
      modelPreferences: {
        preferredModelId: null,
        allowedModelIds: [],
        requiredCapabilities: [],
        fallbackBehavior: "allow-any",
        notes: null,
      },
    });
    governedOptionsToUiSummaries.mockReturnValue([]);
    routeModel.mockReturnValue({
      blocked: false,
      selectedModelId: "openai-gpt-4o-mini",
      suggestedModelId: null,
      mode: "manual",
      taskClass: "general",
      reasonCodes: [],
    });
    resolveModelById.mockReturnValue({
      provider: "openai",
      capabilities: ["text"],
      displayName: "GPT",
    });
    db.message.findFirst.mockResolvedValue(null);
    db.message.update.mockResolvedValue({});
    db.$transaction.mockImplementation(async (cb: any) =>
      cb({
        message: {
          findFirst: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue({ id: "assistant-1" }),
        },
      })
    );
  }

  async function invokeSendRoute(
    payloadOverrides: Partial<{
      sessionId: string;
      agentId: string;
      text: string;
      modelRoutingMode: "manual" | "auto" | "suggested";
      retryOfAssistantMessageId: string;
    }> = {}
  ) {
    const { POST } = await import("../app/api/chat/send/route");
    const req = {
      signal: { aborted: false, addEventListener: vi.fn() },
      async json() {
        return {
          sessionId: "s1",
          agentId: "agent-1",
          text: "Hello",
          modelRoutingMode: "manual",
          ...payloadOverrides,
        };
      },
    };
    return POST(req as any);
  }

  it("emits standardized knowledge_injection telemetry without raw content", async () => {
    setupBaseSendMocks();

    const res = await invokeSendRoute();
    expect(res).toBeDefined();

    expect(logJson).toHaveBeenCalledWith(
      "info",
      expect.objectContaining({
        route: "/api/chat/send",
        status: "knowledge_injection",
        userId: "user-1",
        sessionId: "s1",
        agentId: "agent-1",
        knowledgeInjection: {
          totalItems: 3,
          activeItems: 2,
          injectedItems: 2,
          injectedChars: 512,
          truncated: false,
        },
      })
    );
    const event = logJson.mock.calls.find(
      (entry) => entry[0] === "info" && entry[1]?.status === "knowledge_injection"
    )?.[1] as Record<string, unknown>;
    expect(event).toBeDefined();
    expect(JSON.stringify(event)).not.toContain("Reference Knowledge:");
    expect(JSON.stringify(event)).not.toContain("###");
  });

  it("does not emit knowledge_injection event on blocked routing branch", async () => {
    setupBaseSendMocks();
    routeModel.mockReturnValue({
      blocked: true,
      blockReason: "No compatible model for this request.",
      selectedModelId: null,
      suggestedModelId: null,
      mode: "manual",
      taskClass: "general",
      reasonCodes: ["no_model_available"],
    });

    const res: any = await invokeSendRoute();
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain("No compatible model");
    const knowledgeEvents = logJson.mock.calls.filter(
      (entry) => entry[0] === "info" && entry[1]?.status === "knowledge_injection"
    );
    expect(knowledgeEvents.length).toBe(0);
  });

  it("keeps knowledge_injection telemetry safe in non-abort error branch", async () => {
    setupBaseSendMocks();
    db.message.update
      .mockRejectedValueOnce(new Error("db update failed"))
      .mockResolvedValue({});

    const res: any = await invokeSendRoute();
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain("Something went wrong");

    const knowledgeEvent = logJson.mock.calls.find(
      (entry) => entry[0] === "info" && entry[1]?.status === "knowledge_injection"
    )?.[1] as Record<string, unknown>;
    expect(knowledgeEvent).toBeDefined();
    expect(knowledgeEvent.knowledgeInjection).toEqual({
      totalItems: 3,
      activeItems: 2,
      injectedItems: 2,
      injectedChars: 512,
      truncated: false,
    });

    const errorEvent = logJson.mock.calls.find(
      (entry) => entry[0] === "error" && entry[1]?.route === "/api/chat/send"
    )?.[1] as Record<string, unknown>;
    expect(errorEvent).toBeDefined();
    expect(JSON.stringify(errorEvent)).not.toContain("Reference Knowledge:");
    expect(JSON.stringify(errorEvent)).not.toContain("###");
  });

  it("keeps telemetry safe during stream abort-style teardown", async () => {
    setupBaseSendMocks();
    streamChatCompletion.mockImplementation(async function* stream() {
      throw new Error("client aborted");
    });

    const res: any = await invokeSendRoute();
    expect(res).toBeDefined();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const knowledgeEvents = logJson.mock.calls.filter(
      (entry) => entry[0] === "info" && entry[1]?.status === "knowledge_injection"
    );
    expect(knowledgeEvents.length).toBe(1);
    expect(knowledgeEvents[0][1].knowledgeInjection).toEqual({
      totalItems: 3,
      activeItems: 2,
      injectedItems: 2,
      injectedChars: 512,
      truncated: false,
    });

    const routeErrors = logJson.mock.calls.filter(
      (entry) => entry[0] === "error" && entry[1]?.route === "/api/chat/send"
    );
    expect(routeErrors.length).toBe(0);
    expect(JSON.stringify(knowledgeEvents[0][1])).not.toContain("Reference Knowledge:");
    expect(JSON.stringify(knowledgeEvents[0][1])).not.toContain("###");
  });

  it("keeps telemetry safe on explicit stream cancel callback teardown", async () => {
    setupBaseSendMocks();
    streamChatCompletion.mockImplementation(async function* stream() {
      yield "delta-1";
    });

    const res: any = await invokeSendRoute();
    expect(res).toBeDefined();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await res.body.cancel();

    const knowledgeEvents = logJson.mock.calls.filter(
      (entry) => entry[0] === "info" && entry[1]?.status === "knowledge_injection"
    );
    expect(knowledgeEvents.length).toBe(1);
    expect(knowledgeEvents[0][1].knowledgeInjection).toEqual({
      totalItems: 3,
      activeItems: 2,
      injectedItems: 2,
      injectedChars: 512,
      truncated: false,
    });
    expect(db.message.updateMany).toHaveBeenCalled();

    const routeErrors = logJson.mock.calls.filter(
      (entry) => entry[0] === "error" && entry[1]?.route === "/api/chat/send"
    );
    expect(routeErrors.length).toBe(0);
    expect(JSON.stringify(knowledgeEvents[0][1])).not.toContain("Reference Knowledge:");
    expect(JSON.stringify(knowledgeEvents[0][1])).not.toContain("###");
  });

  it("keeps telemetry and cleanup safe on duplicate stream cancel invocations", async () => {
    setupBaseSendMocks();
    streamChatCompletion.mockImplementation(async function* stream() {
      yield "delta-1";
    });

    const res: any = await invokeSendRoute();
    expect(res).toBeDefined();
    await new Promise((resolve) => setTimeout(resolve, 0));

    await res.body.cancel();
    await res.body.cancel();

    const knowledgeEvents = logJson.mock.calls.filter(
      (entry) => entry[0] === "info" && entry[1]?.status === "knowledge_injection"
    );
    expect(knowledgeEvents.length).toBe(1);
    expect(knowledgeEvents[0][1].knowledgeInjection).toEqual({
      totalItems: 3,
      activeItems: 2,
      injectedItems: 2,
      injectedChars: 512,
      truncated: false,
    });

    // Duplicate cancel is tolerated; cleanup stays idempotent via updateMany semantics.
    expect(db.message.updateMany).toHaveBeenCalled();
    const cleanupCalls = db.message.updateMany.mock.calls.length;
    expect(cleanupCalls).toBeGreaterThanOrEqual(1);

    const routeErrors = logJson.mock.calls.filter(
      (entry) => entry[0] === "error" && entry[1]?.route === "/api/chat/send"
    );
    expect(routeErrors.length).toBe(0);
    expect(JSON.stringify(knowledgeEvents[0][1])).not.toContain("Reference Knowledge:");
    expect(JSON.stringify(knowledgeEvents[0][1])).not.toContain("###");
  });

  it("keeps telemetry and cleanup safe for retry-flagged request with explicit cancel teardown", async () => {
    setupBaseSendMocks();
    streamChatCompletion.mockImplementation(async function* stream() {
      yield "delta-1";
    });
    db.message.findFirst
      .mockResolvedValueOnce({
        id: "assistant-failed-1",
        turnId: "turn-from-failed",
        deliveryStatus: "FAILED",
      })
      .mockResolvedValueOnce(null);

    const res: any = await invokeSendRoute({
      retryOfAssistantMessageId: "assistant-failed-1",
    });
    expect(res).toBeDefined();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await res.body.cancel();

    const knowledgeEvents = logJson.mock.calls.filter(
      (entry) => entry[0] === "info" && entry[1]?.status === "knowledge_injection"
    );
    expect(knowledgeEvents.length).toBe(1);
    expect(knowledgeEvents[0][1].requestKind).toBe("retry");
    expect(knowledgeEvents[0][1].knowledgeInjection).toEqual({
      totalItems: 3,
      activeItems: 2,
      injectedItems: 2,
      injectedChars: 512,
      truncated: false,
    });
    expect(db.message.updateMany).toHaveBeenCalled();

    const routeErrors = logJson.mock.calls.filter(
      (entry) => entry[0] === "error" && entry[1]?.route === "/api/chat/send"
    );
    expect(routeErrors.length).toBe(0);
    expect(JSON.stringify(knowledgeEvents[0][1])).not.toContain("Reference Knowledge:");
    expect(JSON.stringify(knowledgeEvents[0][1])).not.toContain("###");
  });

  it("keeps telemetry safe when stream completes then receives extra cancel teardown", async () => {
    setupBaseSendMocks();
    streamChatCompletion.mockImplementation(async function* stream() {
      yield "delta-1";
      yield "delta-2";
    });

    const res: any = await invokeSendRoute();
    expect(res).toBeDefined();
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Close-ordering edge: stream has completed, then an extra teardown signal arrives.
    await res.body.cancel();

    const knowledgeEvents = logJson.mock.calls.filter(
      (entry) => entry[0] === "info" && entry[1]?.status === "knowledge_injection"
    );
    expect(knowledgeEvents.length).toBe(1);
    expect(knowledgeEvents[0][1].knowledgeInjection).toEqual({
      totalItems: 3,
      activeItems: 2,
      injectedItems: 2,
      injectedChars: 512,
      truncated: false,
    });

    const successEvents = logJson.mock.calls.filter(
      (entry) => entry[0] === "info" && entry[1]?.status === "success"
    );
    expect(successEvents.length).toBe(1);

    // Extra cancel remains safe/idempotent through updateMany semantics.
    expect(db.message.updateMany).toHaveBeenCalled();

    const routeErrors = logJson.mock.calls.filter(
      (entry) => entry[0] === "error" && entry[1]?.route === "/api/chat/send"
    );
    expect(routeErrors.length).toBe(0);
    expect(JSON.stringify(knowledgeEvents[0][1])).not.toContain("Reference Knowledge:");
    expect(JSON.stringify(knowledgeEvents[0][1])).not.toContain("###");
  });

  it("keeps telemetry and cleanup safe for retry-flagged stream completion followed by extra cancel teardown", async () => {
    setupBaseSendMocks();
    streamChatCompletion.mockImplementation(async function* stream() {
      yield "delta-1";
      yield "delta-2";
    });
    db.message.findFirst
      .mockResolvedValueOnce({
        id: "assistant-failed-2",
        turnId: "turn-retry-close",
        deliveryStatus: "FAILED",
      })
      .mockResolvedValueOnce(null);

    const res: any = await invokeSendRoute({
      retryOfAssistantMessageId: "assistant-failed-2",
    });
    expect(res).toBeDefined();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await res.body.cancel();

    const knowledgeEvents = logJson.mock.calls.filter(
      (entry) => entry[0] === "info" && entry[1]?.status === "knowledge_injection"
    );
    expect(knowledgeEvents.length).toBe(1);
    expect(knowledgeEvents[0][1].requestKind).toBe("retry");
    expect(knowledgeEvents[0][1].knowledgeInjection).toEqual({
      totalItems: 3,
      activeItems: 2,
      injectedItems: 2,
      injectedChars: 512,
      truncated: false,
    });

    const successEvents = logJson.mock.calls.filter(
      (entry) => entry[0] === "info" && entry[1]?.status === "success"
    );
    expect(successEvents.length).toBe(1);
    expect(successEvents[0][1].agentId).toBe("agent-1");

    // Post-close cancel remains safe via idempotent updateMany cleanup semantics.
    expect(db.message.updateMany).toHaveBeenCalled();

    const routeErrors = logJson.mock.calls.filter(
      (entry) => entry[0] === "error" && entry[1]?.route === "/api/chat/send"
    );
    expect(routeErrors.length).toBe(0);
    expect(JSON.stringify(knowledgeEvents[0][1])).not.toContain("Reference Knowledge:");
    expect(JSON.stringify(knowledgeEvents[0][1])).not.toContain("###");
  });

  it("keeps telemetry and cleanup safe for retry-flagged near-boundary cancel before stream settles", async () => {
    setupBaseSendMocks();
    streamChatCompletion.mockImplementation(async function* stream() {
      // Small async gap to emulate close/cancel race-like ordering.
      await new Promise((resolve) => setTimeout(resolve, 0));
      yield "delta-race";
    });
    db.message.findFirst
      .mockResolvedValueOnce({
        id: "assistant-failed-race",
        turnId: "turn-retry-race",
        deliveryStatus: "FAILED",
      })
      .mockResolvedValueOnce(null);

    const res: any = await invokeSendRoute({
      retryOfAssistantMessageId: "assistant-failed-race",
    });
    expect(res).toBeDefined();

    // Permutation: cancel immediately, then allow stream task to settle.
    await res.body.cancel();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const knowledgeEvents = logJson.mock.calls.filter(
      (entry) => entry[0] === "info" && entry[1]?.status === "knowledge_injection"
    );
    expect(knowledgeEvents.length).toBe(1);
    expect(knowledgeEvents[0][1].requestKind).toBe("retry");
    expect(knowledgeEvents[0][1].knowledgeInjection).toEqual({
      totalItems: 3,
      activeItems: 2,
      injectedItems: 2,
      injectedChars: 512,
      truncated: false,
    });

    // Cleanup remains safe under retry+race permutation.
    expect(db.message.updateMany).toHaveBeenCalled();
    const routeErrors = logJson.mock.calls.filter(
      (entry) => entry[0] === "error" && entry[1]?.route === "/api/chat/send"
    );
    expect(routeErrors.length).toBe(0);
    expect(JSON.stringify(knowledgeEvents[0][1])).not.toContain("Reference Knowledge:");
    expect(JSON.stringify(knowledgeEvents[0][1])).not.toContain("###");
  });
});
