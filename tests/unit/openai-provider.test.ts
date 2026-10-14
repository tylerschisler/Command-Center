import { afterEach, describe, expect, it, vi } from "vitest";
import OpenAI from "openai";
import type { AiProviderRequest } from "@/server/ai/ai-provider";
import { OpenAiProvider } from "@/server/ai/openai-provider";
vi.mock("server-only", () => ({}));
afterEach(() => vi.restoreAllMocks());

const request = (executeTool = vi.fn().mockResolvedValue({ ok: true, data: { date: "2026-10-13" } })): AiProviderRequest => ({ prompt: "PRIVATE PROMPT THAT MUST NOT BE LOGGED", today: "2026-10-13", timeZone: "America/Chicago", pageContext: null, tools: [{ name: "get_today", description: "date", parameters: { type: "object", properties: {}, required: [], additionalProperties: false } }], executeTool });
function loggedEntry(output: ReturnType<typeof vi.spyOn>) { return JSON.parse(String(output.mock.calls.at(-1)?.[0])); }

describe("OpenAI provider adapter", () => {
  it("executes a bounded mocked Responses tool loop and parses structured output", async () => {
    const create = vi.fn()
      .mockResolvedValueOnce({ output: [{ type: "function_call", name: "get_today", arguments: "{}", call_id: "call-1" }], output_text: "", usage: { input_tokens: 10, output_tokens: 2 } })
      .mockResolvedValueOnce({ output: [{ type: "message" }], output_text: JSON.stringify({ mode: "workspace", title: "Today", summary: "Grounded local date.", blocks: [], actions: [], navigation: null }), usage: { input_tokens: 8, output_tokens: 9 } });
    const client = { responses: { create } } as unknown as OpenAI;
    const provider = new OpenAiProvider("not-a-real-key", "test-model", 1_000, 0, client);
    const executeTool = vi.fn().mockResolvedValue({ ok: true, data: { date: "2026-10-13" } });
    const result = await provider.executeToolLoop({ prompt: "What day is it?", today: "2026-10-13", timeZone: "America/Chicago", pageContext: null, tools: [{ name: "get_today", description: "date", parameters: { type: "object", properties: {}, required: [], additionalProperties: false } }], executeTool });
    expect(executeTool).toHaveBeenCalledWith("get_today", {});
    expect(result.response.title).toBe("Today");
    expect(result.usage).toMatchObject({ inputTokens: 18, outputTokens: 11, requestCount: 2 });
    const secondRequest = create.mock.calls[1][0];
    expect(secondRequest.store).toBe(false);
    expect(JSON.stringify(secondRequest.input)).toContain("UNTRUSTED_APPLICATION_DATA");
  });

  it("logs only sanitized API metadata for initial OpenAI failures", async () => {
    const output = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const headers = new Headers({ "x-request-id": "req_safe_123" });
    const failure = OpenAI.APIError.generate(429, { error: { type: "rate_limit_error", code: "rate_limit_exceeded", message: "SENSITIVE ERROR BODY" } }, undefined, headers);
    const client = { responses: { create: vi.fn().mockRejectedValue(failure) } } as unknown as OpenAI;
    await expect(new OpenAiProvider("not-a-real-key", "test-model", 1_000, 0, client).executeToolLoop(request())).rejects.toBe(failure);
    expect(loggedEntry(output)).toMatchObject({ model: "test-model", stage: "initial_response", httpStatus: 429, errorType: "rate_limit_error", errorCode: "rate_limit_exceeded", requestId: "req_safe_123" });
    const logged = output.mock.calls.flat().join(" "); expect(logged).not.toContain("PRIVATE PROMPT"); expect(logged).not.toContain("SENSITIVE ERROR BODY"); expect(logged).not.toContain("not-a-real-key");
  });

  it("rejects an incompatible function schema before contacting OpenAI", async () => {
    const output = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const create = vi.fn();
    const client = { responses: { create } } as unknown as OpenAI;
    const invalid = request();
    invalid.tools = [{ name: "broken_tool", description: "broken", parameters: { type: "object", properties: { secret: { type: "string" } }, additionalProperties: false } }];

    await expect(new OpenAiProvider("not-a-real-key", "test-model", 1_000, 0, client).executeToolLoop(invalid)).rejects.toThrow(
      "OpenAI tool schema audit failed for broken_tool at parameters: required_array_missing.",
    );
    expect(create).not.toHaveBeenCalled();
    expect(loggedEntry(output)).toMatchObject({ toolName: "broken_tool", schemaPath: "parameters", schemaIssue: "required_array_missing", model: "test-model" });
    const logged = output.mock.calls.flat().join(" ");
    expect(logged).not.toContain("PRIVATE PROMPT");
    expect(logged).not.toContain("secret");
    expect(logged).not.toContain("not-a-real-key");
  });

  it("distinguishes tool-loop failures from structured response validation", async () => {
    const output = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const toolLoopClient = { responses: { create: vi.fn().mockResolvedValueOnce({ output: [{ type: "function_call", name: "get_today", arguments: "{}", call_id: "call-1" }], output_text: "", usage: null }).mockRejectedValueOnce(new OpenAI.APIConnectionTimeoutError()) } } as unknown as OpenAI;
    await expect(new OpenAiProvider("not-a-real-key", "test-model", 1_000, 0, toolLoopClient).executeToolLoop(request())).rejects.toBeInstanceOf(OpenAI.APIConnectionTimeoutError);
    expect(loggedEntry(output)).toMatchObject({ stage: "tool_loop", httpStatus: null, errorType: "APIConnectionTimeoutError", requestId: null });

    const invalidClient = { responses: { create: vi.fn().mockResolvedValue({ output: [{ type: "message" }], output_text: "not-json", usage: null, _request_id: "req_validation_456" }) } } as unknown as OpenAI;
    await expect(new OpenAiProvider("not-a-real-key", "test-model", 1_000, 0, invalidClient).executeToolLoop(request())).rejects.toBeInstanceOf(SyntaxError);
    expect(loggedEntry(output)).toMatchObject({ stage: "structured_response_validation", httpStatus: 200, errorType: "SyntaxError", errorCode: "structured_response_invalid", requestId: "req_validation_456" });
  });
});
