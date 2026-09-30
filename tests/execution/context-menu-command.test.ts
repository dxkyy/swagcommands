import { ApplicationCommandType, MessageFlags } from "discord.js";
import { describe, expect, it, vi } from "vitest";

import ContextMenuCommand from "../../src/context-menu-handler/ContextMenuCommand";
import ContextMenuCommandHandler from "../../src/context-menu-handler/ContextMenuCommandHandler";
import handleContextMenu from "../../src/event-handler/events/interactionCreate/isContextMenuCommand/context-menu";
import CommandExecutor from "../../src/execution/CommandExecutor";
import ResponseHandler from "../../src/execution/ResponseHandler";
import { Precondition } from "../../src/preconditions/Precondition";
import { PreconditionStore } from "../../src/preconditions/PreconditionStore";
import { PreconditionContainerArray } from "../../src/preconditions/containers/PreconditionContainerArray";

const createInteraction = (
  type: ApplicationCommandType.User | ApplicationCommandType.Message,
) => {
  const targetUser = { id: "target-user" };
  const targetMember = { id: "target-member" };
  const targetMessage = { id: "target-message" };
  return {
    channel: { id: "channel-id" },
    commandName: "Inspect",
    commandType: type,
    deferReply: vi.fn().mockResolvedValue(undefined),
    deferred: false,
    editReply: vi.fn().mockResolvedValue(undefined),
    guild: { id: "guild-id" },
    isContextMenuCommand: vi.fn(() => true),
    isMessageContextMenuCommand: vi.fn(
      () => type === ApplicationCommandType.Message,
    ),
    isUserContextMenuCommand: vi.fn(
      () => type === ApplicationCommandType.User,
    ),
    member: { id: "invoking-member" },
    replied: false,
    reply: vi.fn().mockResolvedValue(undefined),
    targetMember,
    targetMessage,
    targetUser,
    user: { id: "invoking-user" },
  };
};

const createInstance = () => {
  const reportError = vi.fn().mockResolvedValue(undefined);
  const handlePreconditionFailure = vi.fn().mockResolvedValue(undefined);
  const instance: any = {
    client: {},
    handlePreconditionFailure,
    reportError,
  };
  instance.responseHandler = new ResponseHandler(instance);
  return { handlePreconditionFailure, instance, reportError };
};

describe("context-menu command execution", () => {
  it("executes user commands with target data, preconditions, and responses", async () => {
    const order: string[] = [];
    const { instance } = createInstance();
    class Guard extends Precondition {
      public contextMenuRun(usage: any) {
        order.push(`guard:${usage.targetUser.id}`);
        return this.ok();
      }

      public contextMenuCommit(usage: any) {
        order.push(`commit:${usage.targetUser.id}`);
        return this.ok();
      }
    }
    const store = new PreconditionStore();
    store.register(new Guard(instance, "Guard"));
    const callback = vi.fn(async (usage) => {
      order.push(`callback:${usage.targetUser.id}`);
      return { content: "User inspected" };
    });
    const command = new ContextMenuCommand(
      instance,
      "Inspect",
      {
        callback,
        deferReply: { ephemeral: true },
        type: ApplicationCommandType.User,
      },
      new PreconditionContainerArray(store, ["Guard"]),
    );
    const interaction = createInteraction(ApplicationCommandType.User);

    await new CommandExecutor(instance).executeContextMenuCommand(
      command,
      interaction as never,
    );

    expect(order).toEqual([
      "guard:target-user",
      "commit:target-user",
      "callback:target-user",
    ]);
    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({
        args: [],
        interaction,
        targetMember: interaction.targetMember,
        targetUser: interaction.targetUser,
        text: "",
        user: interaction.user,
      }),
    );
    expect(interaction.deferReply).toHaveBeenCalledWith({
      flags: MessageFlags.Ephemeral,
    });
    expect(interaction.editReply).toHaveBeenCalledWith({
      content: "User inspected",
    });
  });

  it("executes message commands with the targeted message", async () => {
    const { instance } = createInstance();
    const callback = vi.fn().mockResolvedValue("Message inspected");
    const command = new ContextMenuCommand(
      instance,
      "Inspect",
      { callback, type: ApplicationCommandType.Message },
      new PreconditionContainerArray(new PreconditionStore()),
    );
    const interaction = createInteraction(ApplicationCommandType.Message);

    await new CommandExecutor(instance).executeContextMenuCommand(
      command,
      interaction as never,
    );

    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({
        interaction,
        targetMessage: interaction.targetMessage,
      }),
    );
    expect(interaction.reply).toHaveBeenCalledWith("Message inspected");
  });

  it("stops before deferral and callbacks when a precondition denies", async () => {
    const { handlePreconditionFailure, instance } = createInstance();
    class Guard extends Precondition {
      public contextMenuRun() {
        return this.error({ identifier: "DENIED", message: "No access" });
      }
    }
    const store = new PreconditionStore();
    store.register(new Guard(instance, "Guard"));
    const callback = vi.fn();
    const command = new ContextMenuCommand(
      instance,
      "Inspect",
      {
        callback,
        deferReply: true,
        type: ApplicationCommandType.User,
      },
      new PreconditionContainerArray(store, ["Guard"]),
    );
    const interaction = createInteraction(ApplicationCommandType.User);

    await new CommandExecutor(instance).executeContextMenuCommand(
      command,
      interaction as never,
    );

    expect(handlePreconditionFailure).toHaveBeenCalledWith(
      expect.objectContaining({ command }),
    );
    expect(interaction.deferReply).not.toHaveBeenCalled();
    expect(callback).not.toHaveBeenCalled();
  });

  it("ignores an interaction whose target type does not match the definition", async () => {
    const { instance } = createInstance();
    const callback = vi.fn();
    const command = new ContextMenuCommand(
      instance,
      "Inspect",
      { callback, type: ApplicationCommandType.User },
      new PreconditionContainerArray(new PreconditionStore()),
    );

    await new CommandExecutor(instance).executeContextMenuCommand(
      command,
      createInteraction(ApplicationCommandType.Message) as never,
    );

    expect(callback).not.toHaveBeenCalled();
  });

  it("routes context-menu interactions by both name and type", async () => {
    const userCommand = {};
    const messageCommand = {};
    const getCommand = vi.fn((name, type) =>
      name === "Inspect" && type === ApplicationCommandType.User
        ? userCommand
        : messageCommand,
    );
    const runCommand = vi.fn().mockResolvedValue(undefined);
    const instance = {
      contextMenuCommandHandler: { getCommand, runCommand },
    };
    const userInteraction = createInteraction(ApplicationCommandType.User);
    const messageInteraction = createInteraction(ApplicationCommandType.Message);

    await handleContextMenu(userInteraction as never, instance as never);
    await handleContextMenu(messageInteraction as never, instance as never);

    expect(runCommand).toHaveBeenNthCalledWith(
      1,
      userCommand,
      userInteraction,
    );
    expect(runCommand).toHaveBeenNthCalledWith(
      2,
      messageCommand,
      messageInteraction,
    );
  });

  it("does not route non-context-menu interactions", async () => {
    const runCommand = vi.fn();
    const getCommand = vi.fn();
    const interaction = createInteraction(ApplicationCommandType.User);
    interaction.isContextMenuCommand.mockReturnValue(false);

    await handleContextMenu(interaction as never, {
      contextMenuCommandHandler: { getCommand, runCommand },
    } as never);

    expect(getCommand).not.toHaveBeenCalled();
    expect(runCommand).not.toHaveBeenCalled();
  });
});
