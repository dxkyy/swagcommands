import { describe, expect, it, vi } from "vitest";

import { MessageResponseError } from "../../src/errors/MessageResponseError";
import Command from "../../src/command-handler/Command";
import CommandExecutor from "../../src/execution/CommandExecutor";
import ResponseHandler from "../../src/execution/ResponseHandler";
import handleLegacyCommand from "../../src/event-handler/events/messageCreate/isHuman/legacy-commands";
import CommandType from "../../src/util/CommandType";
import { PreconditionStore } from "../../src/preconditions/PreconditionStore";
import { PreconditionContainerArray } from "../../src/preconditions/containers/PreconditionContainerArray";

const createMessage = () => ({
  author: {
    bot: false,
    id: "user-id",
  },
  channel: {
    isSendable: vi.fn().mockReturnValue(true),
    send: vi.fn().mockResolvedValue(undefined),
    sendTyping: vi.fn().mockResolvedValue(undefined),
  },
  content: "!hello",
  guild: {
    id: "guild-id",
  },
  member: {},
  reply: vi.fn().mockResolvedValue(undefined),
});

const createInstance = (response: unknown, reply = false) => {
  const reportError = vi.fn().mockResolvedValue(undefined);
  const responseHandler = new ResponseHandler({ reportError });
  const instance: any = {
    client: {},
    reportError,
    responseHandler,
  };
  const callback = vi.fn().mockResolvedValue(response);
  const command = new Command(
    instance,
    "hello",
    {
      callback,
      reply,
      type: CommandType.LEGACY,
    },
    new PreconditionContainerArray(new PreconditionStore()),
  );
  const executor = new CommandExecutor(instance);
  const prefixes = {
    get: vi.fn().mockResolvedValue("!"),
  };
  const runCommand = vi.fn(
    (executedCommand, args, message, interaction) =>
      executor.executeCommand(executedCommand, args, message, interaction),
  );
  instance.commandHandler = {
    commands: new Map([["hello", command]]),
    prefixHandler: prefixes,
    runCommand,
  };

  return {
    callback,
    command,
    instance,
    reportError,
    runCommand,
  };
};

describe("message command responses", () => {
  it.each([
    "Hello world",
    { content: "Hello world" },
    {
      embeds: [{ description: "Hello world" }],
      components: [],
      files: [],
    },
  ])("passes a returned Discord.js response to channel.send unchanged", async (response) => {
    const message = createMessage();
    const { instance } = createInstance(response);

    await handleLegacyCommand(message as never, instance as never);

    expect(message.channel.send).toHaveBeenCalledOnce();
    expect(message.channel.send).toHaveBeenCalledWith(response);
    expect(message.reply).not.toHaveBeenCalled();
  });

  it("passes a returned response to message.reply when reply is enabled", async () => {
    const response = {
      content: "Hello world",
      allowedMentions: {
        repliedUser: false,
      },
    };
    const message = createMessage();
    const { instance } = createInstance(response, true);

    await handleLegacyCommand(message as never, instance as never);

    expect(message.reply).toHaveBeenCalledWith(response);
    expect(message.channel.send).not.toHaveBeenCalled();
  });

  it("does not respond when the callback returns undefined", async () => {
    const message = createMessage();
    const { instance } = createInstance(undefined);

    await handleLegacyCommand(message as never, instance as never);

    expect(message.reply).not.toHaveBeenCalled();
    expect(message.channel.send).not.toHaveBeenCalled();
  });

  it("reports channel response failures without changing the payload", async () => {
    const failure = new Error("Missing access");
    const response = {
      content: "Hello world",
      files: [{ attachment: Buffer.from("file") }],
    };
    const message = createMessage();
    message.channel.send.mockRejectedValue(failure);
    const { instance, reportError } = createInstance(response);

    await handleLegacyCommand(message as never, instance as never);

    expect(message.channel.send).toHaveBeenCalledWith(response);
    expect(reportError).toHaveBeenCalledOnce();
    expect(reportError.mock.calls[0][0]).toBeInstanceOf(MessageResponseError);
    expect(reportError.mock.calls[0][0]).toMatchObject({
      cause: failure,
      code: "SWAG_MESSAGE_RESPONSE_FAILED",
      context: {
        commandName: "hello",
        invocationKind: "message",
      },
    });
  });
});
