import {
	ApplicationCommandOption,
	ApplicationCommandOptionType,
} from "discord.js";
import { ICallback } from "../../types";
import Command from "../Command";

export const command = {
	description: "Specifies which commands can be run inside of which channels",

	type: "SLASH",
	testOnly: true,
	guildOnly: true,

	options: [
		{
			name: "command",
			description: "The command to restrict to specific channels",
			required: true,
			type: ApplicationCommandOptionType.String,
			autocomplete: true,
		},
		{
			name: "channel",
			description: "The channel to restrict the command to",
			required: true,
			type: ApplicationCommandOptionType.Channel,
		},
	] as ApplicationCommandOption[],

	autocomplete: (_: any, command: Command) => {
		return [...command.instance.commandHandler?.commands.keys()!];
	},

	callback: async ({ instance, guild, interaction }: ICallback) => {
		const commandName = interaction.options.get("command", true)
			.value as string;
		const channel = interaction.options.get("channel")!.channel!;

		const command = instance.commandHandler?.commands.get(
			commandName.toLowerCase()
		);
		if (!command) return `The command "${commandName}" does not exist.`;

		const { channelCommands } = instance.commandHandler!;

		let availableChannels = [];
		const canRun = (
			await channelCommands.getAvailableChannels(guild.id, commandName)
		).includes(channel.id);

		if (canRun) {
			availableChannels = await channelCommands.remove(
				guild.id,
				commandName,
				channel.id
			);
		} else {
			availableChannels = await channelCommands.add(
				guild.id,
				commandName,
				channel.id
			);
		}

		if (availableChannels.length) {
			const channelNames = availableChannels.map((c: any) => `<#${c}> `);
			return `The command "${commandName}" is now restricted to the following channels: ${channelNames}.`;
		}

		return `The command "${commandName}" is now available to be executed in any channel.`;
	},
};
