import {
  CommandInteraction,
  InteractionEditReplyOptions,
  InteractionReplyOptions,
  Message,
  MessageCreateOptions,
  MessageFlags,
  MessagePayload,
  MessageReplyOptions,
} from "discord.js";

import { InteractionAlreadyAcknowledgedError } from "../errors/InteractionAlreadyAcknowledgedError";
import { InteractionResponseError } from "../errors/InteractionResponseError";
import { MessageResponseError } from "../errors/MessageResponseError";
import { ErrorContext, SwagError } from "../errors/SwagError";

export interface ErrorReporter {
  reportError(error: SwagError): Promise<void>;
}

export interface DeferOptions {
  ephemeral?: boolean;
}

export type DeferSetting = boolean | DeferOptions;

export type InteractionResponse =
  | string
  | MessagePayload
  | InteractionReplyOptions
  | InteractionEditReplyOptions;

export type MessageResponse =
  | string
  | MessagePayload
  | MessageCreateOptions
  | MessageReplyOptions;

export type CommandResponse = InteractionResponse | MessageResponse;

class ResponseHandler {
  private readonly _deferredInteractions = new WeakSet<object>();
  private readonly _reporter: ErrorReporter;
  private readonly _respondedInteractions = new WeakSet<object>();

  public constructor(reporter: ErrorReporter) {
    this._reporter = reporter;
  }

  public async defer(
    interaction: CommandInteraction,
    setting: DeferSetting,
    context: ErrorContext = {},
  ): Promise<boolean> {
    if (!setting) {
      return true;
    }

    if (
      interaction.deferred ||
      interaction.replied ||
      this._deferredInteractions.has(interaction) ||
      this._respondedInteractions.has(interaction)
    ) {
      await this._reporter.reportError(
        new InteractionAlreadyAcknowledgedError(context),
      );
      return false;
    }

    const ephemeral =
      typeof setting === "object" && setting.ephemeral === true;

    try {
      await interaction.deferReply({
        flags: ephemeral ? MessageFlags.Ephemeral : undefined,
      });
      this._deferredInteractions.add(interaction);
      return true;
    } catch (error) {
      await this._reporter.reportError(
        new InteractionResponseError(error, context),
      );
      return false;
    }
  }

  public async respondToInteraction(
    interaction: CommandInteraction,
    response: InteractionResponse,
    context: ErrorContext = {},
  ): Promise<boolean> {
    const deferred =
      interaction.deferred || this._deferredInteractions.has(interaction);

    if (
      this._respondedInteractions.has(interaction) ||
      (interaction.replied && !deferred)
    ) {
      await this._reporter.reportError(
        new InteractionAlreadyAcknowledgedError(context),
      );
      return false;
    }

    try {
      if (deferred) {
        await interaction.editReply(response as InteractionEditReplyOptions);
      } else {
        await interaction.reply(response as InteractionReplyOptions);
      }
      this._respondedInteractions.add(interaction);
      return true;
    } catch (error) {
      await this._reporter.reportError(
        new InteractionResponseError(error, context),
      );
      return false;
    }
  }

  public async respondToMessage(
    message: Message,
    response: MessageResponse,
    reply: boolean,
    context: ErrorContext = {},
  ): Promise<boolean> {
    try {
      if (reply) {
        await message.reply(response as MessageReplyOptions);
      } else {
        if (!message.channel.isSendable()) {
          throw new Error("The message channel is not sendable.");
        }
        await message.channel.send(response as MessageCreateOptions);
      }
      return true;
    } catch (error) {
      await this._reporter.reportError(new MessageResponseError(error, context));
      return false;
    }
  }

  public async indicateTyping(
    message: Message,
    context: ErrorContext = {},
  ): Promise<boolean> {
    try {
      if (!message.channel.isSendable()) {
        throw new Error("The message channel is not sendable.");
      }
      await message.channel.sendTyping();
      return true;
    } catch (error) {
      await this._reporter.reportError(new MessageResponseError(error, context));
      return false;
    }
  }
}

export default ResponseHandler;
