import { z } from "zod";

const schema = z.object({
  DATABASE_PATH: z.string().min(1).default("./data/command-center.db"),
  BACKUP_DIRECTORY: z.string().min(1).default("./data/backups"),
  RECOVERY_MATERIAL_PATH: z.string().min(1).default("./data/recovery.ccrecovery"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  OPENAI_API_KEY: z.string().trim().optional().transform((value) => value || undefined),
  OPENAI_MODEL: z.string().trim().optional().transform((value) => value || undefined),
  OPENAI_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(120_000).default(20_000),
  OPENAI_MAX_RETRIES: z.coerce.number().int().min(0).max(2).default(1),
  COMMAND_CENTER_FAKE_AI: z.enum(["true", "false"]).default("false").transform((value) => value === "true"),
});

export type Environment = z.infer<typeof schema>;

export function getEnvironment(source: NodeJS.ProcessEnv = process.env): Environment {
  return schema.parse(source);
}
