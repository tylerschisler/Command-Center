import type { AiToolDefinition, JsonSchema } from "./ai-provider";

const SUPPORTED_KEYWORDS = new Set([
  "type", "description", "enum", "const", "properties", "required", "additionalProperties",
  "items", "anyOf", "$defs", "$ref", "minLength", "maxLength", "pattern", "format",
  "minimum", "maximum", "multipleOf", "minItems", "maxItems",
]);

export type ToolSchemaAuditIssue = { toolName: string; path: string; code: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function permitsNull(schema: unknown): boolean {
  if (!isRecord(schema)) return false;
  if (schema.type === "null" || (Array.isArray(schema.type) && schema.type.includes("null"))) return true;
  return Array.isArray(schema.anyOf) && schema.anyOf.some(permitsNull);
}

function normalizeNode(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizeNode);
  if (!isRecord(value)) return value;
  const normalized: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    if (key === "$schema" || key === "default") continue;
    normalized[key] = normalizeNode(child);
  }
  if (normalized.type === "object") {
    const properties = isRecord(normalized.properties) ? normalized.properties : {};
    const originallyRequired = new Set(Array.isArray(normalized.required) ? normalized.required.filter((item): item is string => typeof item === "string") : []);
    for (const [name, property] of Object.entries(properties)) {
      if (!originallyRequired.has(name) && !permitsNull(property)) properties[name] = { anyOf: [property, { type: "null" }] };
    }
    normalized.properties = properties;
    normalized.required = Object.keys(properties);
    normalized.additionalProperties = false;
  }
  return normalized;
}

export function toStrictFunctionSchema(schema: JsonSchema): JsonSchema {
  return normalizeNode(schema) as JsonSchema;
}

function auditNode(toolName: string, value: unknown, path: string, issues: ToolSchemaAuditIssue[]) {
  if (!isRecord(value)) return;
  for (const key of Object.keys(value)) {
    if (!SUPPORTED_KEYWORDS.has(key)) issues.push({ toolName, path: `${path}.${key}`, code: "unsupported_keyword" });
  }
  if (value.type === "object") {
    if (value.additionalProperties !== false) issues.push({ toolName, path, code: "additional_properties_must_be_false" });
    const properties = isRecord(value.properties) ? value.properties : {};
    const required = Array.isArray(value.required) ? value.required : null;
    if (!required) issues.push({ toolName, path, code: "required_array_missing" });
    else {
      for (const name of Object.keys(properties)) {
        if (!required.includes(name)) issues.push({ toolName, path: `${path}.properties.${name}`, code: "property_not_required" });
      }
    }
  }
  if (isRecord(value.properties)) {
    for (const [name, property] of Object.entries(value.properties)) auditNode(toolName, property, `${path}.properties.${name}`, issues);
  }
  if (isRecord(value.items)) auditNode(toolName, value.items, `${path}.items`, issues);
  if (Array.isArray(value.anyOf)) value.anyOf.forEach((branch, index) => auditNode(toolName, branch, `${path}.anyOf[${index}]`, issues));
  if (isRecord(value.$defs)) {
    for (const [name, definition] of Object.entries(value.$defs)) auditNode(toolName, definition, `${path}.$defs.${name}`, issues);
  }
}

export function auditStrictFunctionTools(tools: AiToolDefinition[]): ToolSchemaAuditIssue[] {
  const issues: ToolSchemaAuditIssue[] = [];
  for (const tool of tools) {
    if (tool.parameters.type !== "object") issues.push({ toolName: tool.name, path: "parameters", code: "root_must_be_object" });
    auditNode(tool.name, tool.parameters, "parameters", issues);
  }
  return issues;
}

export function normalizeOptionalNullArguments(raw: unknown, sourceSchema: JsonSchema): unknown {
  if (!isRecord(raw) || sourceSchema.type !== "object" || !isRecord(sourceSchema.properties)) return raw;
  const normalized = { ...raw };
  const required = new Set(Array.isArray(sourceSchema.required) ? sourceSchema.required.filter((item): item is string => typeof item === "string") : []);
  for (const [name, property] of Object.entries(sourceSchema.properties)) {
    if (normalized[name] === null && !required.has(name) && !permitsNull(property)) delete normalized[name];
    else if (normalized[name] !== undefined && isRecord(property)) normalized[name] = normalizeOptionalNullArguments(normalized[name], property);
  }
  return normalized;
}
