import type { AiProvider, AiProviderRequest, AiProviderResult, AiToolResult } from "./ai-provider";
import type { JarvisReference, JarvisWorkspaceResponse } from "@/domain/jarvis";

function reference(entityType: JarvisReference["entityType"], item: Record<string, unknown>, detail = "") : JarvisReference { return { entityType, entityId: String(item.id), label: String(item.title ?? item.name ?? item.displayName ?? "Item"), detail }; }
export class DeterministicFakeAiProvider implements AiProvider {
  readonly name = "Fake"; readonly model = "deterministic-test-provider";
  generateStructuredResponse(request: AiProviderRequest) { return this.executeToolLoop(request); }
  generateNarrative(request: AiProviderRequest) { return this.executeToolLoop(request); }
  async executeToolLoop(request: AiProviderRequest): Promise<AiProviderResult> {
    const prompt = request.prompt.toLocaleLowerCase(); const executedTools: Array<{ name: string; result: AiToolResult }> = [];
    const call = async (name: string, args: unknown) => { const result = await request.executeTool(name, args); executedTools.push({ name, result }); return result; };
    let response: JarvisWorkspaceResponse;
    if (prompt.includes("delete everything")) {
      const result = await call("delete_everything", {}); response = this.basic("workspace", "Action blocked", result.error ?? "That action is not permitted.", "warning");
    } else if (prompt.includes("create a task") && prompt.includes("soc report")) {
      const result = await call("create_task", { title: "Review the SOC report", dueDate: "tomorrow" }); response = this.mutationResponse(result, "Task created");
    } else if (prompt.includes("add a task") && request.pageContext?.entityType === "project") {
      const result = await call("create_task", { title: "Follow up", dueDate: "tomorrow" }); response = this.mutationResponse(result, "Project task created");
    } else if (prompt.includes("waiting on") && prompt.includes("sarah")) {
      const people = await call("search_people", { query: "Sarah", limit: 10 }); const matches = (people.data as Array<Record<string, unknown>> | undefined) ?? [];
      if (matches.length > 1) response = this.basic("workspace", "Clarification needed", "I found more than one person named Sarah. Choose the intended person before I retrieve requests.", "warning");
      else { const result = await call("search_requests", { query: "Sarah", limit: 10 }); const items = (result.data as Array<Record<string, unknown>> | undefined) ?? []; response = { mode: "workspace", title: "Waiting on Sarah", summary: `${items.length} matching request(s).`, blocks: [{ type: "references", heading: "Open requests", text: "Grounded in local Request records.", metrics: [], items: items.map((item) => reference("request", item, String(item.status ?? ""))) }], actions: [], navigation: null }; }
    } else if ((prompt.includes("administrator users") || prompt.includes("admin users")) && request.pageContext?.entityType === "knowledge_page") {
      const result = await call("update_knowledge_page", { appendContent: "Administrator users require a separate export.", changeDescription: "Added administrator export requirement via Jarvis" }); response = this.mutationResponse(result, "Knowledge updated");
    } else if (prompt.includes("weekly review")) {
      const result = await call("generate_briefing", { type: "weekly" }); const briefing = ((result.data as { briefing?: Record<string, unknown> } | undefined)?.briefing ?? {}) as Record<string, unknown>;
      response = { mode: "workspace", title: "Weekly Review", summary: "Generated from deterministic Phase 6 facts.", blocks: [{ type: "briefing_section", heading: "Fact-grounded review", text: String(briefing.renderedContent ?? "No briefing content."), metrics: [], items: briefing.id ? [reference("briefing", briefing, "Deterministic facts persisted before narrative")] : [] }], actions: [], navigation: null };
    } else if (prompt.includes("focus")) {
      const result = await call("get_command_center", {}); const focus = ((result.data as { focus?: Array<Record<string, unknown>> } | undefined)?.focus ?? []);
      response = { mode: "workspace", title: "Today’s Focus", summary: "Priorities are grounded in the deterministic Command Center ranking.", blocks: [{ type: "prioritized_items", heading: "Recommended focus", text: "Ranked from persisted work and transparent risk factors.", metrics: [], items: focus.map((item) => reference(String(item.entityType) as JarvisReference["entityType"], item, Array.isArray(item.reasons) ? item.reasons.join(" · ") : "")) }], actions: [], navigation: null };
    } else {
      response = this.basic("workspace", "Jarvis Workspace", "I need a more specific request or matching local context.", "summary");
    }
    return { response, usage: { provider: this.name, model: this.model, inputTokens: 0, outputTokens: 0, requestCount: 1 }, executedTools };
  }
  private basic(mode: "ambient" | "action_summary" | "workspace", title: string, summary: string, type: "summary" | "warning"): JarvisWorkspaceResponse { return { mode, title, summary, blocks: [{ type, heading: title, text: summary, metrics: [], items: [] }], actions: [], navigation: null }; }
  private mutationResponse(result: AiToolResult, title: string): JarvisWorkspaceResponse {
    if (!result.ok || !result.mutation) return this.basic("workspace", "Action not completed", result.error ?? "The action failed safely.", "warning");
    const mutation = result.mutation; const ref = { entityType: mutation.entityType as JarvisReference["entityType"], entityId: mutation.entityId, label: mutation.label, detail: mutation.action };
    return { mode: "ambient", title, summary: `${mutation.label} was updated through the application service.`, blocks: [], actions: [{ action: mutation.action, reference: ref }], navigation: null };
  }
}
