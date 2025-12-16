import {
	ApplicationCommandOption,
	ApplicationCommandOptionType,
	Client,
} from "discord.js";
import { Logger } from "../logger/structures/Logger";
import SubcommandOption from "../subcommand-handler/SubcommandOption";
const logger = new Logger();

class SubSlashCommands {
	private _client: Client;

	constructor(client: Client) {
		this._client = client;
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
		options: SubcommandOption[],
		guildId?: string
	) {
		const commands = await this.getCommands(guildId);
		if (!commands) {
			throw new Error(`Could not find commands for guild ${guildId}`);
		}

		const actualOptions: ApplicationCommandOption[] = [];

		for (const option of options) {
			const object = option.optionObject;
			const os: any[] = object.options || [];

			if (
				os.find((o: any) => o.type === ApplicationCommandOptionType.Subcommand)
			) {
				actualOptions.push({
					name: object.name,
					description: object.description!,
					type: ApplicationCommandOptionType.SubcommandGroup,
					options: os,
				});

				continue;
			}

			actualOptions.push({
				name: object.name,
				description: object.description!,
				type: ApplicationCommandOptionType.Subcommand,
				options: os,
			});

			continue;
		}

		const existingCommand = commands.cache.find((cmd) => cmd.name === name);
		if (existingCommand) {
			const {
				description: existingDescription,
				options: existingOptions,
			} = existingCommand;

			if (
				description !== existingDescription ||
				actualOptions.length !== existingOptions.length ||
				this.areOptionsDifferent(actualOptions, existingOptions)
			) {
				logger.info(`Updating the command "${name}"`);

				await commands.edit(existingCommand.id, {
					description,
					options: actualOptions as any,
				});
			}
			return;
		}

		await commands.create({
			name,
			description,
			options: actualOptions as any,
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

	createOptions({
		expectedArgs = "",
		minArgs = 0,
	}): ApplicationCommandOption[] {
		const options: ApplicationCommandOption[] = [];

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

export default SubSlashCommands;
