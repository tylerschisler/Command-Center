import { JarvisToolController } from "../src/server/jarvis/tool-controller";
import { auditStrictFunctionTools } from "../src/server/ai/strict-tool-schema";

const tools = new JarvisToolController({} as never).tools();
const issues = auditStrictFunctionTools(tools);
if (issues.length) {
  for (const issue of issues) console.error(`${issue.toolName}: ${issue.path} (${issue.code})`);
  process.exitCode = 1;
} else console.log(`Jarvis schema audit passed: ${tools.length} strict function schemas.`);
