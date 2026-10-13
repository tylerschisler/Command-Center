export const JARVIS_RESPONSE_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["mode", "title", "summary", "blocks", "actions", "navigation"],
  properties: {
    mode: { type: "string", enum: ["ambient", "action_summary", "workspace"] },
    title: { type: "string" },
    summary: { type: "string" },
    blocks: {
      type: "array", maxItems: 20, items: {
        type: "object", additionalProperties: false, required: ["type", "heading", "text", "metrics", "items"],
        properties: {
          type: { type: "string", enum: ["summary", "metric_group", "prioritized_items", "references", "warning", "recommended_actions", "briefing_section"] },
          heading: { type: "string" }, text: { type: "string" },
          metrics: { type: "array", items: { type: "object", additionalProperties: false, required: ["label", "value"], properties: { label: { type: "string" }, value: { type: "string" } } } },
          items: { type: "array", items: { type: "object", additionalProperties: false, required: ["entityType", "entityId", "label", "detail"], properties: { entityType: { type: "string", enum: ["task", "project", "request", "person", "meeting", "knowledge_page", "briefing"] }, entityId: { type: "string" }, label: { type: "string" }, detail: { type: "string" } } } },
        },
      },
    },
    actions: { type: "array", items: { type: "object", additionalProperties: false, required: ["action", "reference"], properties: { action: { type: "string" }, reference: { type: "object", additionalProperties: false, required: ["entityType", "entityId", "label", "detail"], properties: { entityType: { type: "string", enum: ["task", "project", "request", "person", "meeting", "knowledge_page", "briefing"] }, entityId: { type: "string" }, label: { type: "string" }, detail: { type: "string" } } } } } },
    navigation: { anyOf: [{ type: "null" }, { type: "object", additionalProperties: false, required: ["destination", "entityId", "filter"], properties: { destination: { type: "string", enum: ["home", "my_work", "projects", "waiting_on", "calendar", "people", "knowledge", "settings"] }, entityId: { anyOf: [{ type: "string" }, { type: "null" }] }, filter: { anyOf: [{ type: "string", enum: ["all", "mine", "delegated", "today", "upcoming", "completed", "overdue", "follow_up", "received", "active", "planning"] }, { type: "null" }] } } }] },
  },
} as const;
