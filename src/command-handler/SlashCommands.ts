import {
	ApplicationCommandOption,
	ApplicationCommandOptionType,
	Client,
} from "discord.js";
import { Logger } from "../lib/structures/Logger";
import Command from "./Command";

class SlashCommands {
	_client;
	_logger;
	constructor(client: Client) {
		this._client = client;
		this._logger = new Logger();
	}

	async getCommands(guildId?: string) {
		let commands;

		if (guildId) {
			const guild = await this._client.guilds.fetch(guildId);
			commands = guild.commands;
		} else {
			commands = this._client.application?.commands;
		}

		// @ts-ignore
		await commands?.fetch();

		return commands;
	}

	areOptionsDifferent(
		options: ApplicationCommandOption[],
		existingOptions: any[]
	) {
		for (let a = 0; a < options.length; ++a) {
			const option = options[a];
			const existing = existingOptions[a];

			if (
				option.name !== existing.name ||
				option.type !== existing.type ||
				option.description !== existing.description
			) {
				return true;
			}
		}

		return false;
	}

	async create(
		name: string,
		description: string,
		options: ApplicationCommandOption[],
		guildId?: string
	) {
		const commands = await this.getCommands(guildId);
		if (!commands) {
			throw new Error(`Could not find commands for guild ${guildId}`);
		}

		const existingCommand = commands.cache.find((cmd) => cmd.name === name);
		if (existingCommand) {
			const {
				description: existingDescription,
				options: existingOptions,
			} = existingCommand;

			if (
				description !== existingDescription ||
				options.length !== existingOptions.length ||
				this.areOptionsDifferent(options, existingOptions)
			) {
				this._logger.info(`Updating the command "${name}"`);

				await commands.edit(existingCommand.id, {
					description,
					options,
				});
			}
			return;
		}

		await commands.create({
			name,
			description,
			options,
		});
	}

	async delete(commandName: string, guildId?: string) {
		const commands = await this.getCommands(guildId);

		const existingCommand = commands?.cache.find(
			(cmd) => cmd.name === commandName
		);
		if (!existingCommand) {
			return;
		}

		await existingCommand.delete();
	}

	createOptions({ expectedArgs = "", minArgs = 0 }) {
		const options: any[] = [];

		if (expectedArgs) {
			const split = expectedArgs
				.substring(1, expectedArgs.length - 1)
				.split(/[>\]] [<\[]/);

			for (let a = 0; a < split.length; ++a) {
				const arg = split[a];

				options.push({
					name: arg.toLowerCase().replace(/\s+/g, "-"),
					description: arg,
					type: ApplicationCommandOptionType.String,
					required: a < minArgs,
				});
			}
		}

		return options;
	}
}

export default SlashCommands;
