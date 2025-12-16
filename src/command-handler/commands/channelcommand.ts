import {
	ApplicationCommandOptionType,
	CommandInteraction,
	MessageFlags,
} from "discord.js";

import Command from "../Command";
import CommandType from "../../util/CommandType";
import { CommandObject, CommandUsage } from "../../../typings";

export default {
	description: "Specifies which commands can be ran inside of which channels",

	type: CommandType.SLASH,
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
			description: "The channel to use for this command",
			required: true,
			type: ApplicationCommandOptionType.Channel,
		},
	],

	autocomplete: (command: Command) => {
		return [...command.instance.commandHandler.commands.keys()];
	},

	callback: async (commandUsage: CommandUsage) => {
		const { instance, guild } = commandUsage;

		if (!instance.isConnectedToDB) {
			return {
				content:
					"This bot is not connected to a database which is required for this command. Please contact the bot owner.",
				flags: MessageFlags.Ephemeral,
			};
		}

		const interaction: CommandInteraction = commandUsage.interaction!;

		// @ts-ignore
		const commandName = interaction.options.getString("command");
		// @ts-ignore
		const channel = interaction.options.getChannel("channel");

		const command = instance.commandHandler.commands.get(
			commandName.toLowerCase()
		);
		if (!command) {
			return {
				content: `The command \`${commandName}\` does not exist.`,
				flags: MessageFlags.Ephemeral,
			};
		}

		const { channelCommands } = instance.commandHandler;

		let availableChannels = [];
		const canRun = (
			await channelCommands.getAvailableChannels(guild!.id, commandName)
		).includes(channel.id);

		if (canRun) {
			availableChannels = await channelCommands.remove(
				guild!.id,
				commandName,
				channel.id
			);
		} else {
			availableChannels = await channelCommands.add(
				guild!.id,
				commandName,
				channel.id
			);
		}

		if (availableChannels.length) {
			const channelNames = availableChannels.map((c: string) => `<#${c}> `);
			return {
				content: `The command \`${commandName}\` is now restricted to the following channels: ${channelNames}.`,
				flags: MessageFlags.Ephemeral,
			};
		}

		return {
			content: `The command \`${commandName}\` is now available to be executed in any channel.`,
			flags: MessageFlags.Ephemeral,
		};
	},
} as CommandObject;
