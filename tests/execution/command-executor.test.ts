import { describe, expect, it, vi } from "vitest";

import CommandExecutor from "../../src/execution/CommandExecutor";
import ResponseHandler from "../../src/execution/ResponseHandler";
import SubcommandOption from "../../src/subcommand-handler/SubcommandOption";
import Subcommand from "../../src/subcommand-handler/Subcommand";
import { PreconditionStore } from "../../src/preconditions/PreconditionStore";
import { PreconditionContainerArray } from "../../src/preconditions/containers/PreconditionContainerArray";

const createInteraction = () => ({
  channel: {},
  commandName: "admin",
  deferred: false,
  editReply: vi.fn().mockResolvedValue(undefined),
  guild: {
    id: "guild-id",
  },
  member: {},
  replied: false,
  reply: vi.fn().mockResolvedValue(undefined),
  user: {
    id: "user-id",
  },
});

const createExecutor = () => {
  const reportError = vi.fn().mockResolvedValue(undefined);
  const responseHandler = new ResponseHandler({ reportError });
  const instance: any = {
    client: {},
    reportError,
    responseHandler,
  };

  return {
    executor: new CommandExecutor(instance),
    instance,
    reportError,
  };
};

const createSubcommand = (instance: any, callback: any) => {
  const option = new SubcommandOption(
    instance,
    "ban",
    {
      callback,
      name: "ban",
    },
    new PreconditionContainerArray(new PreconditionStore()),
  );
  new Subcommand(
    instance,
    "admin",
    { description: "Administration" },
    [option],
    new PreconditionContainerArray(new PreconditionStore()),
  );
  return option;
};

describe("central command execution", () => {
  it("runs subcommand validation, callback, and response in one pipeline", async () => {
    const response = {
      content: "Done",
      embeds: [{ description: "Operation completed" }],
    };
    const callback = vi.fn().mockResolvedValue(response);
    const validation = vi.fn().mockResolvedValue(true);
    const interaction = createInteraction();
    const prefixes = {
      get: vi.fn().mockResolvedValue("!"),
    };
    const { executor, instance } = createExecutor();
    const command = createSubcommand(instance, callback);

    await executor.executeSubcommand(
      command,
      ["user-id"],
      interaction as never,
      [validation],
      prefixes as never,
    );

    expect(prefixes.get).toHaveBeenCalledWith("guild-id");
    expect(validation).toHaveBeenCalledWith(
      command,
      expect.objectContaining({
        args: ["user-id"],
        interaction,
        text: "user-id",
      }),
      "!",
    );
    expect(callback).toHaveBeenCalledOnce();
    expect(interaction.reply).toHaveBeenCalledWith(response);
  });

  it("stops execution when an existing validation denies the command", async () => {
    const callback = vi.fn().mockResolvedValue("should not be sent");
    const validation = vi.fn().mockResolvedValue(false);
    const interaction = createInteraction();
    const { executor, instance } = createExecutor();
    const command = createSubcommand(instance, callback);

    await executor.executeSubcommand(
      command,
      [],
      interaction as never,
      [validation],
      { get: vi.fn().mockResolvedValue("!") } as never,
    );

    expect(callback).not.toHaveBeenCalled();
    expect(interaction.reply).not.toHaveBeenCalled();
    expect(interaction.editReply).not.toHaveBeenCalled();
  });
});
