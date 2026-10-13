import { readJson, workErrorResponse } from "@/app/api/work-response";
import { JarvisUnavailableError } from "@/server/services/jarvis-service";
import { createJarvisRuntime } from "@/server/services/jarvis-runtime";

export async function GET() {
  try { const runtime = createJarvisRuntime(); return Response.json({ status: runtime.settings.status(), permissions: runtime.jarvis.permissions() }); }
  catch (error) { return workErrorResponse(error); }
}

export async function POST(request: Request) {
  try { return Response.json(await createJarvisRuntime().jarvis.run(await readJson(request))); }
  catch (error) {
    if (error instanceof JarvisUnavailableError) return Response.json({ error: error.message }, { status: 503 });
    const known = workErrorResponse(error); if (known.status < 500) return known;
    return Response.json({ error: "Jarvis could not complete the request. Core Command Center features remain available." }, { status: 502 });
  }
}
