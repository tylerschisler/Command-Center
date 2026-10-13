import type { JarvisPageContext, JarvisWorkspaceResponse } from "@/domain/jarvis";

export type JsonSchema = Record<string, unknown>;
export interface AiToolDefinition { name: string; description: string; parameters: JsonSchema }
export interface AiToolResult { ok: boolean; data?: unknown; error?: string; mutation?: { action: string; entityType: string; entityId: string; label: string } }
export interface AiProviderRequest {
  prompt: string;
  today: string;
  timeZone: string;
  pageContext: JarvisPageContext;
  priorSubject?: JarvisPageContext;
  tools: AiToolDefinition[];
  executeTool: (name: string, args: unknown) => Promise<AiToolResult> | AiToolResult;
}
export interface AiProviderResult {
  response: JarvisWorkspaceResponse;
  usage: { provider: string; model: string; inputTokens: number; outputTokens: number; requestCount: number };
  executedTools: Array<{ name: string; result: AiToolResult }>;
}

export interface AiProvider {
  readonly name: string;
  readonly model: string;
  executeToolLoop(request: AiProviderRequest): Promise<AiProviderResult>;
  generateStructuredResponse(request: AiProviderRequest): Promise<AiProviderResult>;
  generateNarrative(request: AiProviderRequest): Promise<AiProviderResult>;
}
