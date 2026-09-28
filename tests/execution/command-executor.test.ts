import { describe, expect, it, vi } from "vitest";

import CommandExecutor from "../../src/execution/CommandExecutor";
import ResponseHandler from "../../src/execution/ResponseHandler";
import { PreconditionExecutionError } from "../../src/errors/PreconditionExecutionError";
import { Precondition } from "../../src/preconditions/Precondition";
import { PreconditionStore } from "../../src/preconditions/PreconditionStore";
import { PreconditionContainerArray } from "../../src/preconditions/containers/PreconditionContainerArray";
import Subcommand from "../../src/subcommand-handler/Subcommand";
import SubcommandOption from "../../src/subcommand-handler/SubcommandOption";
import CommandType from "../../src/util/CommandType";

const createInteraction = () => ({
  channel: {},
  commandName: "admin",
  deferReply: vi.fn().mockResolvedValue(undefined),
  deferred: false,
  editReply: vi.fn().mockResolvedValue(undefined),
  guild: { id: "guild-id" },
  member: {},
  replied: false,
  reply: vi.fn().mockResolvedValue(undefined),
  user: { id: "user-id" },
});

const createMessage = () => ({
  author: { id: "user-id" },
  channel: {
    isSendable: vi.fn(() => true),
    send: vi.fn().mockResolvedValue(undefined),
    sendTyping: vi.fn().mockResolvedValue(undefined),
  },
  guild: { id: "guild-id" },
  member: {},
  reply: vi.fn().mockResolvedValue(undefined),
});

const createExecutor = () => {
  const reportError = vi.fn().mockResolvedValue(undefined);
  const handlePreconditionFailure = vi.fn().mockResolvedValue(undefined);
  const responseHandler = new ResponseHandler({ reportError });
  const instance: any = {
    client: {},
    handlePreconditionFailure,
    reportError,
    responseHandler,
  };

  return {
    executor: new CommandExecutor(instance),
    handlePreconditionFailure,
    instance,
    reportError,
  };
};

const createContainer = (
  instance: any,
  name: string,
  run: (...args: any[]) => any,
) => {
  class TestPrecondition extends Precondition {
    public override chatInputRun = run;
  }

  const store = new PreconditionStore();
  store.register(new TestPrecondition(instance, name));
  return new PreconditionContainerArray(store, [name]);
};

const emptyContainer = () =>
  new PreconditionContainerArray(new PreconditionStore());

const createSubcommand = (
  instance: any,
  callback: any,
  rootPreconditions = emptyContainer(),
  optionPreconditions = emptyContainer(),
  deferReply = false,
) => {
  const option = new SubcommandOption(
    instance,
    "ban",
    { callback, deferReply },
    optionPreconditions,
  );
  new Subcommand(
    instance,
    "admin",
    { description: "Administration", type: CommandType.SLASH },
    [option],
    rootPreconditions,
  );
  return option;
};

describe("central command execution", () => {
  it("runs root and option preconditions before the callback", async () => {
    const order: string[] = [];
    const response = { content: "Done" };
    const callback = vi.fn(async () => {
      order.push("callback");
      return response;
    });
    const interaction = createInteraction();
    const { executor, instance } = createExecutor();
    const root = createContainer(instance, "Root", () => {
      order.push("root");
      return { success: true };
    });
    const option = createContainer(instance, "Option", () => {
      order.push("option");
      return { success: true };
    });
    const command = createSubcommand(instance, callback, root, option);

    await executor.executeSubcommand(
      command,
      ["user-id"],
      null,
      interaction as never,
    );

    expect(order).toEqual(["root", "option", "callback"]);
    expect(interaction.reply).toHaveBeenCalledWith(response);
  });

  it("stops before option preconditions, deferral, and callback when the root denies", async () => {
    const callback = vi.fn();
    const optionRun = vi.fn().mockReturnValue({ success: true });
    const interaction = createInteraction();
    const { executor, instance } = createExecutor();
    const root = createContainer(instance, "Root", () => ({
      failure: { identifier: "DENIED", preconditionName: "Root" },
      success: false,
    }));
    const option = createContainer(instance, "Option", optionRun);
    const command = createSubcommand(instance, callback, root, option, true);

    await executor.executeSubcommand(command, [], null, interaction as never);

    expect(optionRun).not.toHaveBeenCalled();
    expect(interaction.deferReply).not.toHaveBeenCalled();
    expect(callback).not.toHaveBeenCalled();
  });

  it("sends a response returned by the precondition failure hook", async () => {
    const interaction = createInteraction();
    const { executor, handlePreconditionFailure, instance } = createExecutor();
    const failure = {
      identifier: "DENIED",
      message: "No access",
      preconditionName: "Access",
    };
    handlePreconditionFailure.mockResolvedValue({ content: "No access" });
    const option = createContainer(instance, "Access", () => ({
      failure,
      success: false,
    }));
    const command = createSubcommand(instance, vi.fn(), emptyContainer(), option);

    await executor.executeSubcommand(command, [], null, interaction as never);

    expect(handlePreconditionFailure).toHaveBeenCalledWith(
      expect.objectContaining({ command, failure }),
    );
    expect(interaction.reply).toHaveBeenCalledWith({ content: "No access" });
  });

  it("reports thrown preconditions with their full command context", async () => {
    const interaction = createInteraction();
    const { executor, instance, reportError } = createExecutor();
    const option = createContainer(instance, "Access", () => {
      throw new Error("database unavailable");
    });
    const command = createSubcommand(instance, vi.fn(), emptyContainer(), option);

    await executor.executeSubcommand(command, [], null, interaction as never);

    expect(reportError).toHaveBeenCalledOnce();
    expect(reportError.mock.calls[0][0]).toBeInstanceOf(PreconditionExecutionError);
    expect(reportError.mock.calls[0][0]).toMatchObject({
      code: "SWAG_PRECONDITION_EXECUTION_FAILED",
      context: {
        commandName: "admin",
        invocationKind: "interaction",
        preconditionName: "Access",
        subcommandName: "ban",
      },
    });
  });

  it("does not commit a stateful precondition when a later check fails", async () => {
    const { executor, instance } = createExecutor();
    const commit = vi.fn(() => ({ success: true as const }));
    const stateful = new Precondition(instance, "Stateful");
    stateful.chatInputRun = () => stateful.ok();
    stateful.chatInputCommit = commit;
    const denied = new Precondition(instance, "Denied");
    denied.chatInputRun = () =>
      denied.error({ identifier: "DENIED", message: "Denied" });
    const store = new PreconditionStore();
    store.register(stateful).register(denied);
    const root = new PreconditionContainerArray(store, [
      "Stateful",
      "Denied",
    ]);
    const callback = vi.fn();
    const command = createSubcommand(instance, callback, root);

    await executor.executeSubcommand(
      command,
      [],
      null,
      createInteraction() as never,
    );

    expect(commit).not.toHaveBeenCalled();
    expect(callback).not.toHaveBeenCalled();
  });

  it("executes message subcommands with leaf response settings", async () => {
    const response = { content: "Banned" };
    const callback = vi.fn().mockResolvedValue(response);
    const message = createMessage();
    const { executor, instance } = createExecutor();
    const option = new SubcommandOption(
      instance,
      "ban",
      {
        callback,
        deferReply: true,
        reply: false,
      },
      emptyContainer(),
    );
    new Subcommand(
      instance,
      "admin",
      {
        deferReply: false,
        reply: true,
        type: CommandType.BOTH,
      },
      [option],
      emptyContainer(),
    );

    await executor.executeSubcommand(
      option,
      ["user-id", "spam"],
      message as never,
      null,
    );

    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({
        args: ["user-id", "spam"],
        interaction: null,
        message,
        text: "user-id spam",
        user: message.author,
      }),
    );
    expect(message.channel.sendTyping).toHaveBeenCalledOnce();
    expect(message.channel.send).toHaveBeenCalledWith(response);
    expect(message.reply).not.toHaveBeenCalled();
  });

  it("inherits message response settings from the subcommand root", async () => {
    const callback = vi.fn().mockResolvedValue("Done");
    const message = createMessage();
    const { executor, instance } = createExecutor();
    const option = new SubcommandOption(
      instance,
      "ban",
      { callback },
      emptyContainer(),
    );
    new Subcommand(
      instance,
      "admin",
      {
        deferReply: true,
        reply: true,
        type: CommandType.LEGACY,
      },
      [option],
      emptyContainer(),
    );

    await executor.executeSubcommand(option, [], message as never, null);

    expect(message.channel.sendTyping).toHaveBeenCalledOnce();
    expect(message.reply).toHaveBeenCalledWith("Done");
    expect(message.channel.send).not.toHaveBeenCalled();
  });

  it("ignores subcommand invocations outside the root command type", async () => {
    const { executor, instance } = createExecutor();
    const slashCallback = vi.fn();
    const slash = createSubcommand(instance, slashCallback);

    await executor.executeSubcommand(
      slash,
      [],
      createMessage() as never,
      null,
    );

    const legacyCallback = vi.fn();
    const legacy = new SubcommandOption(
      instance,
      "ban",
      { callback: legacyCallback },
      emptyContainer(),
    );
    new Subcommand(
      instance,
      "admin",
      { type: CommandType.LEGACY },
      [legacy],
      emptyContainer(),
    );
    await executor.executeSubcommand(
      legacy,
      [],
      null,
      createInteraction() as never,
    );

    expect(slashCallback).not.toHaveBeenCalled();
    expect(legacyCallback).not.toHaveBeenCalled();
  });
});
