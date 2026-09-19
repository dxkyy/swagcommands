import { describe, expect, it, vi } from "vitest";

import Command from "../../src/command-handler/Command";
import { AutocompleteError } from "../../src/errors/AutocompleteError";
import AutocompleteHandler from "../../src/execution/AutocompleteHandler";
import Subcommand from "../../src/subcommand-handler/Subcommand";
import SubcommandOption from "../../src/subcommand-handler/SubcommandOption";
import CommandType from "../../src/util/CommandType";

const createInteraction = (commandName = "search", value = "re") => {
  const interaction = {
    commandName,
    options: {
      data: [] as Array<{ name: string }>,
      getFocused: vi.fn().mockReturnValue({ name: "query", value }),
    },
    respond: vi.fn(),
    responded: false,
  };
  interaction.respond.mockImplementation(async () => {
    interaction.responded = true;
  });
  return interaction;
};

const createHandler = () => {
  const reportError = vi.fn().mockResolvedValue(undefined);
  return {
    handler: new AutocompleteHandler({ reportError }),
    reportError,
  };
};

describe("autocomplete execution", () => {
  it("filters, limits, and responds with autocomplete choices", async () => {
    const autocomplete = vi
      .fn()
      .mockResolvedValue(Array.from({ length: 30 }, (_, index) => `result-${index}`));
    const command = new Command({} as never, "search", {
      autocomplete,
      callback: vi.fn(),
      type: CommandType.SLASH,
    });
    const interaction = createInteraction();
    const { handler, reportError } = createHandler();

    await handler.execute(
      interaction as never,
      { commands: new Map([["search", command]]) } as never,
    );

    expect(autocomplete).toHaveBeenCalledWith(command, "query", interaction);
    expect(interaction.respond).toHaveBeenCalledOnce();
    expect(interaction.respond.mock.calls[0][0]).toHaveLength(25);
    expect(interaction.respond.mock.calls[0][0][0]).toEqual({
      name: "result-0",
      value: "result-0",
    });
    expect(reportError).not.toHaveBeenCalled();
  });

  it("safely ignores unknown commands without a subcommand handler", async () => {
    const interaction = createInteraction("unknown");
    const { handler, reportError } = createHandler();

    await handler.execute(
      interaction as never,
      { commands: new Map() } as never,
    );

    expect(interaction.respond).not.toHaveBeenCalled();
    expect(reportError).not.toHaveBeenCalled();
  });

  it("resolves autocomplete callbacks on subcommands", async () => {
    const autocomplete = vi.fn().mockResolvedValue(["ban", "block"]);
    const option = new SubcommandOption({} as never, "user", {
      autocomplete,
      callback: vi.fn(),
      name: "user",
    });
    const command = new Subcommand(
      {} as never,
      "admin",
      { description: "Administration" },
      [option],
    );
    const interaction = createInteraction("admin", "b");
    interaction.options.data = [{ name: "user" }];
    const { handler } = createHandler();

    await handler.execute(
      interaction as never,
      undefined,
      { commands: new Map([["admin", command]]) } as never,
    );

    expect(autocomplete).toHaveBeenCalledWith(command, "query", interaction);
    expect(interaction.respond).toHaveBeenCalledWith([
      { name: "ban", value: "ban" },
      { name: "block", value: "block" },
    ]);
  });

  it("reports callback failures and sends an empty response", async () => {
    const cause = new Error("Lookup failed");
    const command = new Command({} as never, "search", {
      autocomplete: vi.fn().mockRejectedValue(cause),
      callback: vi.fn(),
      type: CommandType.SLASH,
    });
    const interaction = createInteraction();
    const { handler, reportError } = createHandler();

    await handler.execute(
      interaction as never,
      { commands: new Map([["search", command]]) } as never,
    );

    expect(interaction.respond).toHaveBeenCalledWith([]);
    expect(reportError).toHaveBeenCalledOnce();
    expect(reportError.mock.calls[0][0]).toBeInstanceOf(AutocompleteError);
    expect(reportError.mock.calls[0][0]).toMatchObject({
      cause,
      code: "SWAG_AUTOCOMPLETE_FAILED",
      context: {
        commandName: "search",
        invocationKind: "autocomplete",
      },
      phase: "autocomplete",
    });
  });

  it("reports response failures and retries with an empty response", async () => {
    const cause = new Error("Discord request failed");
    const command = new Command({} as never, "search", {
      autocomplete: vi.fn().mockResolvedValue(["result"]),
      callback: vi.fn(),
      type: CommandType.SLASH,
    });
    const interaction = createInteraction();
    interaction.respond
      .mockRejectedValueOnce(cause)
      .mockImplementationOnce(async () => {
        interaction.responded = true;
      });
    const { handler, reportError } = createHandler();

    await handler.execute(
      interaction as never,
      { commands: new Map([["search", command]]) } as never,
    );

    expect(interaction.respond).toHaveBeenCalledTimes(2);
    expect(interaction.respond).toHaveBeenLastCalledWith([]);
    expect(reportError).toHaveBeenCalledWith(
      expect.objectContaining({
        cause,
        code: "SWAG_AUTOCOMPLETE_FAILED",
      }),
    );
  });
});
