import { ApplicationCommandOptionType, CommandInteraction } from "discord.js";

import SWAG from "../../../../../typings";
import SubommandHandler from "../../../../subcommand-handler/SubcommandHandler";

export default async (interaction: CommandInteraction, instance: SWAG) => {
	const { subcommandHandler } = instance as {
		subcommandHandler: SubommandHandler;
	};

	if (!subcommandHandler) {
		return;
	}

	const { commands } = subcommandHandler;

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

	const command = commands.get(interaction.commandName);

	if (!command) {
		return;
	}

	const subcommand = command.options.find((option) => {
		return option.commandName === interaction.options.data[0].name;
	});

	if (!subcommand) {
		return;
	}

	const deferReply = subcommand.optionObject.deferReply;

	if (deferReply) {
		await interaction.deferReply({
			ephemeral: deferReply === "ephemeral",
		});
	}

	const response = await subcommandHandler.runCommand(
		subcommand,
		args!,
		interaction
	);
	if (!response) {
		return;
	}

	if (deferReply) {
		interaction.editReply(response).catch(() => {});
	} else {
		interaction.reply(response).catch(() => {});
	}
};
