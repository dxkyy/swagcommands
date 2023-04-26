import { AutocompleteInteraction } from "discord.js";

import SWAG from "../../../../../typings";

export default async (interaction: AutocompleteInteraction, instance: SWAG) => {
	const { commandHandler, subcommandHandler } = instance;
	if (!commandHandler) {
		return;
	}

	const { commands } = commandHandler;
	const subcommands = subcommandHandler.commands;
	let command = commands.get(interaction.commandName);
	if (!command) {
		command = subcommands.get(interaction.commandName);
		if (!command) {
			return;
		}
	}

	let { autocomplete } = command.commandObject;
	if (!autocomplete) {
		const subcommand = command.options.find((option: any) => {
			return option.commandName === interaction.options.data[0].name;
		});

		if (!subcommand) {
			return;
		}

		autocomplete = subcommand.optionObject.autocomplete;
		if (!autocomplete) {
			return;
		}
	}

	const focusedOption = interaction.options.getFocused(true);
	const choices = await autocomplete(command, focusedOption.name, interaction);

	const filtered = choices
		.filter((choice: string) =>
			choice.toLowerCase().startsWith(focusedOption.value.toLowerCase())
		)
		.slice(0, 25);

	await interaction.respond(
		filtered.map((choice: string) => ({
			name: choice,
			value: choice,
		}))
	);
};
