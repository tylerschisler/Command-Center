import { ZodError } from "zod";
import { NotFoundError, ValidationError } from "@/server/services/service-errors";

export function workErrorResponse(error: unknown): Response {
  if (error instanceof ZodError) return Response.json({ error: error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  if (error instanceof ValidationError) return Response.json({ error: error.message }, { status: 400 });
  if (error instanceof NotFoundError) return Response.json({ error: error.message }, { status: 404 });
  return Response.json({ error: "The request could not be completed." }, { status: 500 });
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  let value: unknown;
  try { value = await request.json(); }
  catch { throw new ValidationError("Malformed JSON input."); }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ValidationError("A JSON object is required.");
  return value as Record<string, unknown>;
}
