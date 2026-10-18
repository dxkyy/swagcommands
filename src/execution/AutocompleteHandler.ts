import { AutocompleteInteraction } from "discord.js";

import CommandHandler from "../command-handler/CommandHandler";
import { AutocompleteError } from "../errors/AutocompleteError";
import { ErrorContext } from "../errors/SwagError";
import SubcommandHandler from "../subcommand-handler/SubcommandHandler";
import type { Awaitable } from "../types";
import { ErrorReporter } from "./ResponseHandler";

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

    const { callback, context } = resolved;

    try {
      const focusedOption = interaction.options.getFocused(true);
      const choices = await callback(focusedOption.name, interaction);

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
        callback: (
          focusedOption: string,
          interaction: AutocompleteInteraction,
        ) => Awaitable<readonly string[]>;
        context: ErrorContext;
      }
    | undefined {
    const command = commandHandler?.commands.get(interaction.commandName);
    const commandAutocomplete = command?.commandObject.autocomplete;
    if (command && commandAutocomplete) {
      return {
        callback: (focusedOption, interaction) =>
          commandAutocomplete(command, focusedOption, interaction),
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
    const optionAutocomplete = option?.optionObject.autocomplete;
    if (!option || !optionAutocomplete) {
      return;
    }

    return {
      callback: (focusedOption, interaction) =>
        optionAutocomplete(subcommand, focusedOption, interaction),
      context: {
        commandName: interaction.commandName,
        invocationKind: "autocomplete",
        subcommandName,
      },
    };
  }
}

export default AutocompleteHandler;
