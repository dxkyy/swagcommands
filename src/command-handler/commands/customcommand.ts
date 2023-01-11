import {
	ApplicationCommandOption,
	ApplicationCommandOptionType,
	CommandInteractionOptionResolver,
	PermissionFlagsBits,
} from "discord.js";
import { ICallback } from "../../types";

export const command = {
	description: "Creates a custom command",
	minArgs: 1,
	expectedArgs: "<option> [...args]",

	permissions: [PermissionFlagsBits.Administrator],

	options: [
		{
			name: "create",
			description: "Create a new custom command",
			type: ApplicationCommandOptionType.Subcommand,
			options: [
				{
					name: "command-name",
					description: "command name",
					required: true,
					type: ApplicationCommandOptionType.String,
				},
				{
					name: "description",
					description: "description",
					required: true,
					type: ApplicationCommandOptionType.String,
				},
				{
					name: "response",
					description: "response",
					required: true,
					type: ApplicationCommandOptionType.String,
				},
			],
		},
		{
			name: "delete",
			description: "Delete a custom command",
			type: ApplicationCommandOptionType.Subcommand,
			options: [
				{
					name: "command-name",
					description: "command name",
					required: true,
					type: ApplicationCommandOptionType.String,
				},
			],
		},
	] as ApplicationCommandOption[],

	type: "SLASH",
	guildOnly: true,
	testOnly: true,

	callback: async ({ instance, guild, interaction }: ICallback) => {
		const options = interaction.options.data[0];
		const option = options.name;
		const args = options.options?.map((option) => option.value) as string[];

		if (option === "create") {
			const [commandName, description, response] = args;

			await instance.commandHandler?.customCommands.create(
				guild.id,
				commandName,
				description,
				response
			);

			return `Custom command "${commandName}" has been created!`;
		} else if (option === "delete") {
			const [commandName] = args;

			await instance.commandHandler?.customCommands.delete(
				guild.id,
				commandName
			);

			return `Custom command "${commandName}" has been deleted!`;
		}
	},
};
