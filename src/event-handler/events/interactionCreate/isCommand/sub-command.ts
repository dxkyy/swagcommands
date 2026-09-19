import {
	ApplicationCommandOptionType,
	ChatInputCommandInteraction,
	CommandInteraction,
} from "discord.js";

import SWAG from "../../../../../typings";
import SubommandHandler from "../../../../subcommand-handler/SubcommandHandler";

export default async (
	interaction: ChatInputCommandInteraction,
	instance: SWAG
) => {
	if (!interaction.isCommand()) return;
	const { subcommandHandler } = instance as {
		subcommandHandler: SubommandHandler;
	};

	if (!subcommandHandler) {
		return;
	}

	const { commands } = subcommandHandler;

	const command = commands.get(interaction.commandName);

	if (!command) {
		return;
	}

	let args = interaction.options.data[0].options?.map(({ value }) => {
		return String(value);
	});

	for (const option of interaction.options.data[0].options!) {
		if (option.type === ApplicationCommandOptionType.Subcommand) {
			args = option.options?.map(({ value }) => {
				return String(value);
			});
		}
	}

	const subcommand = command.options.find((option) => {
		return option.commandName === interaction.options.data[0].name;
	});

	if (!subcommand) {
		return;
	}

	const deferReply = subcommand.optionObject.deferReply;
	const responseContext = {
		commandName: command.commandName,
		invocationKind: "interaction" as const,
		subcommandName: subcommand.commandName,
	};

	if (
		deferReply &&
		!(await instance.responseHandler.defer(
			interaction,
			deferReply,
			responseContext
		))
	) {
		return;
	}

	const response = await subcommandHandler.runCommand(
		subcommand,
		args!,
		interaction
	);
	if (response === undefined) {
		return;
	}

	await instance.responseHandler.respondToInteraction(
		interaction,
		response,
		responseContext
	);
};
