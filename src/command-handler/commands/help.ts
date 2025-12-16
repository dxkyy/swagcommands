import {
	ApplicationCommandOptionType,
	EmbedBuilder,
	MessageFlags,
} from "discord.js";
import CommandType from "../../util/CommandType";

import { CommandObject } from "../../../typings";

export default {
	description: "Shows a list of all commands",
	type: CommandType.BOTH,
	expectedArgs: "<command>",
	guildOnly: true,

	options: [
		{
			name: "command",
			description: "The command to show information about",
			type: ApplicationCommandOptionType.String,
		},
	],

	callback: async ({ message, interaction, instance, args, guild }) => {
		const { commandHandler } = instance;
		const { prefixHandler, commands } = commandHandler;
		const prefix = prefixHandler.get(guild?.id);

		const commandNames = new Map(
			[...commands].map(([name, command]) => [command.commandName, command])
		);

		if (args.length === 0) {
			const commandNamesString = [...commandNames.keys()]
				.map((name) => `**${prefix}${name}**\n`)
				.join("");

			const embed = new EmbedBuilder()
				.setTitle("Help")
				.setDescription(commandNamesString)
				.setFooter({
					text: "Use /help <command> to get more information about a command",
				})
				.setColor("Random");

			return {
				embeds: [embed],
			};
		}

		const name = args[0].toLowerCase();
		const command = commandNames.get(name);

		if (!command) {
			if (message) {
				return {
					content: `The command \`${name}\` does not exist.`,
				};
			} else {
				return {
					content: `The command \`${name}\` does not exist.`,
					flags: MessageFlags.Ephemeral,
				};
			}
		}

		const { description, expectedArgs, aliases } = command.commandObject;

		const usage = `${prefix}${name} ${expectedArgs || ""}`;
		const aliasesString = aliases ? aliases.join(", ") : "None";

		const embed = new EmbedBuilder()
			.setTitle(`Help: ${name}`)
			.addFields([
				{
					name: "Description",
					value: description,
					inline: false,
				},
				{
					name: "Usage",
					value: usage,
					inline: false,
				},
				{
					name: "Aliases",
					value: aliasesString,
					inline: false,
				},
			])
			.setColor("Random");

		return {
			embeds: [embed],
		};
	},
} as CommandObject;
