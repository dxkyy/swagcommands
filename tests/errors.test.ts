import { describe, expect, it, vi } from "vitest";

import SWAG from "../src/SWAG";
import { CommandDefinitionError } from "../src/errors/CommandDefinitionError";
import { CommandExecutionError } from "../src/errors/CommandExecutionError";
import { InteractionResponseError } from "../src/errors/InteractionResponseError";
import { SwagError } from "../src/errors/SwagError";

describe("structured framework errors", () => {
  it("exposes stable metadata and preserves the original cause", () => {
    const cause = new Error("Discord request failed");
    const error = new InteractionResponseError(cause, {
      commandName: "hello",
      invocationKind: "interaction",
    });

    expect(error).toBeInstanceOf(SwagError);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("InteractionResponseError");
    expect(error.code).toBe("SWAG_INTERACTION_RESPONSE_FAILED");
    expect(error.phase).toBe("response");
    expect(error.cause).toBe(cause);
    expect(error.context).toEqual({
      commandName: "hello",
      invocationKind: "interaction",
    });
    expect(Object.isFrozen(error.context)).toBe(true);
  });

  it("provides command definition and execution error categories", () => {
    const definitionError = new CommandDefinitionError("Invalid command", {
      filePath: "/commands/invalid.ts",
    });
    const cause = new Error("Callback failed");
    const executionError = new CommandExecutionError(cause, {
      commandName: "hello",
    });

    expect(definitionError).toMatchObject({
      code: "SWAG_COMMAND_DEFINITION_INVALID",
      phase: "validation",
    });
    expect(executionError).toMatchObject({
      cause,
      code: "SWAG_COMMAND_EXECUTION_FAILED",
      phase: "execution",
    });
  });

  it("sends reported errors to the configured hook", async () => {
    const onError = vi.fn().mockResolvedValue(undefined);
    const instance = Object.create(SWAG.prototype) as {
      _options: { onError: typeof onError };
      reportError(error: SwagError): Promise<void>;
    };
    instance._options = { onError };
    const error = new CommandExecutionError(new Error("Callback failed"), {
      commandName: "hello",
      invocationKind: "interaction",
    });

    await instance.reportError(error);

    expect(onError).toHaveBeenCalledWith(error, error.context);
  });
});
