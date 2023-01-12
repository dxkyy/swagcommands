import {
	ApplicationCommandOption,
	ApplicationCommandOptionType,
	PermissionFlagsBits,
} from "discord.js";
import Command from "../Command";
import { ICallback } from "../../types";
import CommandHandler from "../CommandHandler";

export const command = {
	description: "Toggles a command on or off for your guild.",

	type: "SLASH",
	guildOnly: true,
	testOnly: true,

	permissions: [PermissionFlagsBits.Administrator],

	options: [
		{
			name: "command",
			description: "The command to toggle on or off.",
			type: ApplicationCommandOptionType.String,
			required: true,
			autocomplete: true,
		},
	] as ApplicationCommandOption[],

	autocomplete: (_: any, command: Command) => {
		return [...command.instance.commandHandler?.commands.keys()!];
	},

	callback: async ({
		instance,
		guild,
		text: commandName,
		interaction,
	}: ICallback) => {
		const { disabledCommands } = instance.commandHandler as CommandHandler;

		if (disabledCommands.isDisabled(guild.id, commandName)) {
			await disabledCommands.enable(guild.id, commandName);

			interaction.reply(`Command "${commandName}" has been enabled.`);
		} else {
			await disabledCommands.disable(guild.id, commandName);

			interaction.reply(`Command "${commandName}" has been disabled.`);
		}
	},
};
