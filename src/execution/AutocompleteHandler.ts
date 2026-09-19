import { AutocompleteInteraction } from "discord.js";

import Command from "../command-handler/Command";
import CommandHandler from "../command-handler/CommandHandler";
import { AutocompleteError } from "../errors/AutocompleteError";
import { ErrorContext } from "../errors/SwagError";
import Subcommand from "../subcommand-handler/Subcommand";
import SubcommandHandler from "../subcommand-handler/SubcommandHandler";
import { ErrorReporter } from "./ResponseHandler";

type AutocompleteCommand = Command | Subcommand;
type AutocompleteCallback = (
  command: AutocompleteCommand,
  focusedOption: string,
  interaction: AutocompleteInteraction,
) => unknown | Promise<unknown>;

class AutocompleteHandler {
  private readonly _reporter: ErrorReporter;

  public constructor(reporter: ErrorReporter) {
    this._reporter = reporter;
  }

  public async execute(
    interaction: AutocompleteInteraction,
    commandHandler?: CommandHandler,
    subcommandHandler?: SubcommandHandler,
  ): Promise<void> {
    const resolved = this.resolve(
      interaction,
      commandHandler,
      subcommandHandler,
    );
    if (!resolved) {
      return;
    }

    const { callback, command, context } = resolved;

    try {
      const focusedOption = interaction.options.getFocused(true);
      const choices = await callback(
        command,
        focusedOption.name,
        interaction,
      );

      if (!Array.isArray(choices)) {
        throw new TypeError("Autocomplete callbacks must return an array.");
      }
      if (!choices.every((choice) => typeof choice === "string")) {
        throw new TypeError(
          "Autocomplete callbacks must return an array of strings.",
        );
      }

      const value = String(focusedOption.value).toLowerCase();
      const response = choices
        .filter((choice) => choice.toLowerCase().startsWith(value))
        .slice(0, 25)
        .map((choice) => ({ name: choice, value: choice }));

      await interaction.respond(response);
    } catch (error) {
      const errors = [new AutocompleteError(error, context)];

      if (!interaction.responded) {
        try {
          await interaction.respond([]);
        } catch (responseError) {
          errors.push(new AutocompleteError(responseError, context));
        }
      }

      for (const autocompleteError of errors) {
        await this._reporter.reportError(autocompleteError);
      }
    }
  }

  private resolve(
    interaction: AutocompleteInteraction,
    commandHandler?: CommandHandler,
    subcommandHandler?: SubcommandHandler,
  ):
    | {
        callback: AutocompleteCallback;
        command: AutocompleteCommand;
        context: ErrorContext;
      }
    | undefined {
    const command = commandHandler?.commands.get(interaction.commandName);
    if (command?.commandObject.autocomplete) {
      return {
        callback: command.commandObject.autocomplete as AutocompleteCallback,
        command,
        context: {
          commandName: interaction.commandName,
          invocationKind: "autocomplete",
        },
      };
    }

    const subcommand = subcommandHandler?.commands.get(interaction.commandName);
    if (!subcommand) {
      return;
    }

    const subcommandName = interaction.options.data[0]?.name;
    const option = subcommand.options.find(
      (candidate) => candidate.commandName === subcommandName,
    );
    if (!option?.optionObject.autocomplete) {
      return;
    }

    return {
      callback: option.optionObject.autocomplete as AutocompleteCallback,
      command: subcommand,
      context: {
        commandName: interaction.commandName,
        invocationKind: "autocomplete",
        subcommandName,
      },
    };
  }
}

export default AutocompleteHandler;
