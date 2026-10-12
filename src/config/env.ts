import { z } from "zod";

const schema = z.object({
  DATABASE_PATH: z.string().min(1).default("./data/command-center.db"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export type Environment = z.infer<typeof schema>;

export function getEnvironment(source: NodeJS.ProcessEnv = process.env): Environment {
  return schema.parse(source);
}
