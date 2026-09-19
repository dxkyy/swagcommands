import { MessageFlags } from "discord.js";
import { describe, expect, it, vi } from "vitest";

import handleSlashCommand from "../../src/event-handler/events/interactionCreate/isCommand/slash-commands";

const createInteraction = () => ({
  commandName: "hello",
  deferReply: vi.fn().mockResolvedValue(undefined),
  deferred: false,
  editReply: vi.fn().mockResolvedValue(undefined),
  isCommand: vi.fn().mockReturnValue(true),
  options: {
    data: [],
  },
  replied: false,
  reply: vi.fn().mockResolvedValue(undefined),
});

const createInstance = (response: unknown, deferReply?: unknown) => {
  const command = {
    commandObject: {
      deferReply,
    },
  };
  const runCommand = vi.fn().mockResolvedValue(response);

  return {
    command,
    instance: {
      commandHandler: {
        commands: new Map([["hello", command]]),
        runCommand,
      },
    },
    runCommand,
  };
};

describe("interaction command responses", () => {
  it.each([
    "Hello world",
    { content: "Hello world" },
    {
      embeds: [{ description: "Hello world" }],
      components: [],
      files: [],
    },
  ])("passes a returned Discord.js response through unchanged", async (response) => {
    const interaction = createInteraction();
    const { instance } = createInstance(response);

    await handleSlashCommand(interaction as never, instance as never);

    expect(interaction.reply).toHaveBeenCalledOnce();
    expect(interaction.reply).toHaveBeenCalledWith(response);
    expect(interaction.editReply).not.toHaveBeenCalled();
  });

  it("does not respond when the callback returns undefined", async () => {
    const interaction = createInteraction();
    const { instance } = createInstance(undefined);

    await handleSlashCommand(interaction as never, instance as never);

    expect(interaction.reply).not.toHaveBeenCalled();
    expect(interaction.editReply).not.toHaveBeenCalled();
  });

  it("edits the original response after deferring", async () => {
    const response = {
      content: "Finished",
      embeds: [{ description: "The complete response" }],
    };
    const interaction = createInteraction();
    const { instance } = createInstance(response, true);

    await handleSlashCommand(interaction as never, instance as never);

    expect(interaction.deferReply).toHaveBeenCalledOnce();
    expect(interaction.editReply).toHaveBeenCalledWith(response);
    expect(interaction.reply).not.toHaveBeenCalled();
  });

  it("uses the v2 defer options when creating an ephemeral response", async () => {
    const interaction = createInteraction();
    const { instance } = createInstance(
      { content: "Only you can see this" },
      { ephemeral: true },
    );

    await handleSlashCommand(interaction as never, instance as never);

    expect(interaction.deferReply).toHaveBeenCalledWith({
      flags: MessageFlags.Ephemeral,
    });
  });
});
