import { MessageFlags } from "discord.js";
import { describe, expect, it, vi } from "vitest";

import { InteractionAlreadyAcknowledgedError } from "../../src/errors/InteractionAlreadyAcknowledgedError";
import { InteractionResponseError } from "../../src/errors/InteractionResponseError";
import ResponseHandler from "../../src/execution/ResponseHandler";
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
    commandName: "hello",
    commandObject: {
      deferReply,
    },
  };
  const runCommand = vi.fn().mockResolvedValue(response);
  const reportError = vi.fn().mockResolvedValue(undefined);
  const responseHandler = new ResponseHandler({ reportError });

  return {
    command,
    instance: {
      commandHandler: {
        commands: new Map([["hello", command]]),
        runCommand,
      },
      responseHandler,
    },
    reportError,
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

  it("reports Discord response failures with command context", async () => {
    const failure = new Error("Unknown interaction");
    const interaction = createInteraction();
    interaction.reply.mockRejectedValue(failure);
    const { instance, reportError } = createInstance({ content: "Hello" });

    await handleSlashCommand(interaction as never, instance as never);

    expect(reportError).toHaveBeenCalledOnce();
    const error = reportError.mock.calls[0][0];
    expect(error).toBeInstanceOf(InteractionResponseError);
    expect(error).toMatchObject({
      cause: failure,
      code: "SWAG_INTERACTION_RESPONSE_FAILED",
      context: {
        commandName: "hello",
        invocationKind: "interaction",
      },
      phase: "response",
    });
  });

  it("reports an already acknowledged interaction instead of replying twice", async () => {
    const interaction = createInteraction();
    interaction.replied = true;
    const { instance, reportError } = createInstance({ content: "Hello" });

    await handleSlashCommand(interaction as never, instance as never);

    expect(interaction.reply).not.toHaveBeenCalled();
    expect(interaction.editReply).not.toHaveBeenCalled();
    expect(reportError).toHaveBeenCalledWith(
      expect.any(InteractionAlreadyAcknowledgedError),
    );
  });
});
