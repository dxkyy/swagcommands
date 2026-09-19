import { describe, expect, it, vi } from "vitest";

import handleLegacyCommand from "../../src/event-handler/events/messageCreate/isHuman/legacy-commands";

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
  const command = {
    commandObject: {
      reply,
    },
  };
  const runCommand = vi.fn().mockResolvedValue(response);

  return {
    command,
    instance: {
      commandHandler: {
        commands: new Map([["hello", command]]),
        prefixHandler: {
          get: vi.fn().mockResolvedValue("!"),
        },
        runCommand,
      },
    },
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
});
