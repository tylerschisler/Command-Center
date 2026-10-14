import { describe, expect, it } from "vitest";
import { z } from "zod";
import { TASK_STATUSES } from "@/domain/work";
import type { AiToolDefinition, JsonSchema } from "@/server/ai/ai-provider";
import {
  auditStrictFunctionTools,
  normalizeOptionalNullArguments,
  toStrictFunctionSchema,
} from "@/server/ai/strict-tool-schema";
import { JarvisToolController } from "@/server/jarvis/tool-controller";

const tools = new JarvisToolController({} as never).tools();

function record(value: unknown): Record<string, unknown> {
  expect(value).toBeTruthy();
  expect(typeof value).toBe("object");
  expect(Array.isArray(value)).toBe(false);
  return value as Record<string, unknown>;
}

function property(toolName: string, propertyName: string) {
  const tool = tools.find((candidate) => candidate.name === toolName);
  expect(tool, `Missing tool ${toolName}`).toBeDefined();
  return record(record(tool!.parameters.properties)[propertyName]);
}

function permitsNull(schema: unknown): boolean {
  const value = record(schema);
  if (value.type === "null" || (Array.isArray(value.type) && value.type.includes("null"))) return true;
  return Array.isArray(value.anyOf) && value.anyOf.some(permitsNull);
}

function findBranch(schema: unknown, type: string) {
  const value = record(schema);
  if (value.type === type) return value;
  const branch = Array.isArray(value.anyOf) ? value.anyOf.find((candidate) => record(candidate).type === type) : undefined;
  expect(branch, `Missing ${type} branch`).toBeDefined();
  return record(branch);
}

describe("Jarvis OpenAI function schemas", () => {
  it("audits every exported tool against the supported strict subset", () => {
    expect(tools).toHaveLength(35);
    expect(new Set(tools.map((tool) => tool.name)).size).toBe(tools.length);
    expect(auditStrictFunctionTools(tools)).toEqual([]);
  });

  it("requires every property, closes every nested object, and removes defaults", () => {
    const serialized = JSON.stringify(tools);
    expect(serialized).not.toContain('"default"');
    expect(serialized).not.toContain('"$schema"');

    function visit(schema: unknown) {
      const value = record(schema);
      if (value.type === "object") {
        const properties = record(value.properties);
        expect(value.additionalProperties).toBe(false);
        expect(value.required).toEqual(Object.keys(properties));
        Object.values(properties).forEach(visit);
      }
      if (value.items && typeof value.items === "object") visit(value.items);
      if (Array.isArray(value.anyOf)) value.anyOf.forEach(visit);
      if (value.$defs && typeof value.$defs === "object") Object.values(record(value.$defs)).forEach(visit);
    }

    tools.forEach((tool) => visit(tool.parameters));
  });

  it("keeps conceptual optionals required and nullable without weakening enums or arrays", () => {
    expect(permitsNull(property("search_tasks", "status"))).toBe(true);
    expect(permitsNull(property("create_task", "description"))).toBe(true);
    expect(permitsNull(property("create_task", "ownerId"))).toBe(true);

    const status = findBranch(property("search_tasks", "status"), "string");
    expect(status.enum).toEqual(TASK_STATUSES);

    const participants = findBranch(property("create_meeting", "participantIds"), "array");
    expect(participants.maxItems).toBe(50);
    expect(record(participants.items)).toMatchObject({ type: "string", format: "uuid" });
  });

  it("normalizes nested objects and object array items recursively", () => {
    const strict = toStrictFunctionSchema({
      type: "object",
      properties: {
        options: {
          type: "object",
          properties: { label: { type: "string" } },
        },
        entries: {
          type: "array",
          items: {
            type: "object",
            properties: { state: { type: "string", enum: ["open", "closed"] } },
          },
        },
      },
    });
    const synthetic: AiToolDefinition[] = [{ name: "synthetic", description: "test", parameters: strict }];
    expect(auditStrictFunctionTools(synthetic)).toEqual([]);

    const options = findBranch(record(record(strict.properties).options), "object");
    expect(options).toMatchObject({ required: ["label"], additionalProperties: false });
    expect(permitsNull(record(options.properties).label)).toBe(true);

    const entries = findBranch(record(record(strict.properties).entries), "array");
    expect(record(entries.items)).toMatchObject({ required: ["state"], additionalProperties: false });
  });

  it("reports the offending tool and path for unsupported or non-strict schemas", () => {
    const invalid: AiToolDefinition[] = [{
      name: "bad_nested_tool",
      description: "test",
      parameters: {
        type: "object",
        properties: {
          nested: { type: "object", properties: { value: { type: "string" } }, required: [] },
          choice: { allOf: [{ type: "string" }] },
        },
        required: ["nested", "choice"],
        additionalProperties: false,
      },
    }];

    expect(auditStrictFunctionTools(invalid)).toEqual(expect.arrayContaining([
      { toolName: "bad_nested_tool", path: "parameters.properties.nested", code: "additional_properties_must_be_false" },
      { toolName: "bad_nested_tool", path: "parameters.properties.nested.properties.value", code: "property_not_required" },
      { toolName: "bad_nested_tool", path: "parameters.properties.choice.allOf", code: "unsupported_keyword" },
    ]));
  });

  it("maps strict null placeholders back to existing Zod optional semantics", () => {
    const source = z.toJSONSchema(z.object({
      description: z.string().default("default description"),
      ownerId: z.string().uuid().optional().nullable(),
    }), { io: "input" }) as JsonSchema;

    expect(normalizeOptionalNullArguments({ description: null, ownerId: null }, source)).toEqual({ ownerId: null });
  });
});
