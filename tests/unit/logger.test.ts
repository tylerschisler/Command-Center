import { afterEach, describe, expect, it, vi } from "vitest";
import { logger } from "@/server/logging/logger";

afterEach(() => vi.restoreAllMocks());

describe("logger secret redaction", () => {
  it("does not emit values attached to secret-bearing context keys", () => {
    const output = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const secret = "this-value-must-never-be-logged";
    logger.error("Encryption operation failed", {
      databaseKey: secret,
      backupToken: secret,
      recoveryCredential: secret,
      errorType: "TestError",
    });
    expect(output).toHaveBeenCalledOnce();
    const logged = output.mock.calls.flat().join(" ");
    expect(logged).not.toContain(secret);
    expect(logged).toContain("[REDACTED]");
  });
});
