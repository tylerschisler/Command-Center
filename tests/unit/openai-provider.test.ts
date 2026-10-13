import { describe, expect, it, vi } from "vitest";
import type OpenAI from "openai";
import { OpenAiProvider } from "@/server/ai/openai-provider";
vi.mock("server-only", () => ({}));

describe("OpenAI provider adapter", () => {
  it("executes a bounded mocked Responses tool loop and parses structured output", async () => {
    const create = vi.fn()
      .mockResolvedValueOnce({ output: [{ type: "function_call", name: "get_today", arguments: "{}", call_id: "call-1" }], output_text: "", usage: { input_tokens: 10, output_tokens: 2 } })
      .mockResolvedValueOnce({ output: [{ type: "message" }], output_text: JSON.stringify({ mode: "workspace", title: "Today", summary: "Grounded local date.", blocks: [], actions: [], navigation: null }), usage: { input_tokens: 8, output_tokens: 9 } });
    const client = { responses: { create } } as unknown as OpenAI;
    const provider = new OpenAiProvider("not-a-real-key", "test-model", 1_000, 0, client);
    const executeTool = vi.fn().mockResolvedValue({ ok: true, data: { date: "2026-10-13" } });
    const result = await provider.executeToolLoop({ prompt: "What day is it?", today: "2026-10-13", timeZone: "America/Chicago", pageContext: null, tools: [{ name: "get_today", description: "date", parameters: { type: "object", properties: {}, additionalProperties: false } }], executeTool });
    expect(executeTool).toHaveBeenCalledWith("get_today", {});
    expect(result.response.title).toBe("Today");
    expect(result.usage).toMatchObject({ inputTokens: 18, outputTokens: 11, requestCount: 2 });
    const secondRequest = create.mock.calls[1][0];
    expect(secondRequest.store).toBe(false);
    expect(JSON.stringify(secondRequest.input)).toContain("UNTRUSTED_APPLICATION_DATA");
  });
});
