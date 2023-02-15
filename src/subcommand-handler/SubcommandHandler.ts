import {
	ApplicationCommandOptionType,
	Client,
	CommandInteraction,
	GuildMember,
	Message,
	MessagePayload,
	TextChannel,
} from "discord.js";
import path from "path";

import getAllFiles from "../util/get-all-files";
import Subcommand from "./Subcommand";
import SubcommandOption from "./SubcommandOption";
import SubSlashCommands from "./SubSlashCommand";
import PrefixHandler from "../command-handler/PrefixHandler";
import SWAG, {
	InternalCooldownConfig,
	SubcommandObject,
	SubcommandOptionObject,
	SubCommandUsage,
} from "../../typings";

class CommandHandler {
	// <commandName, instance of the Command class>
	private _subCommands: Map<string, Subcommand> = new Map();
	private _validations = this.getValidations(
		path.join(__dirname, "validations", "run-time")
	);
	private _instance: SWAG;
	private _client: Client;
	private _commandsDir: string;
	private _slashCommands: SubSlashCommands;
	private _prefixes: PrefixHandler;

	constructor(instance: SWAG, commandsDir: string, client: Client) {
		this._instance = instance;
		this._commandsDir = commandsDir;
		this._slashCommands = new SubSlashCommands(client);
		this._client = client;

		this._validations = [
			...this._validations,
			...this.getValidations(instance.validations?.runtime),
		];

		this.readFiles();
		this._prefixes = new PrefixHandler(instance);
	}

	public get commands() {
		return this._subCommands;
	}

	public get slashCommands() {
		return this._slashCommands;
	}

	private async readFiles() {
		const files = getAllFiles(this._commandsDir, true);
		const validations = [
			...this.getValidations(path.join(__dirname, "validations", "syntax")),
			...this.getValidations(this._instance.validations?.syntax),
		];

		for (let fileData of [...files]) {
			const { filePath } = fileData;
			const split = filePath.split(/[\/\\]/);
			let commandName = split.pop()!;

			const options = getAllFiles(filePath);
			let optionDatas: SubcommandOption[] = [];
			let index = null;

			for (let option of options) {
				const { filePath } = option;
				const split = filePath.split(/[\/\\]/);
				let optionName = split.pop()!;
				optionName = optionName.split(".")[0];

				if (optionName === "index") {
					index = option;
					continue;
				}

				const optionObject: SubcommandOptionObject = option.fileContents;

				const subCommandOption = new SubcommandOption(
					this._instance,
					optionName,
					optionObject
				);
				optionDatas.push(subCommandOption);
			}

			const commandObject: SubcommandObject = require(filePath).default;

			const command = new Subcommand(
				this._instance,
				commandName,
				commandObject,
				optionDatas
			);

			const { description, testOnly, delete: del, deferReply } = commandObject;

			if (del) {
				if (testOnly) {
					for (const guildId of this._instance.testServers) {
						this._slashCommands.delete(command.commandName, guildId);
					}
				} else {
					this._slashCommands.delete(command.commandName);
				}

				continue;
			}

			if (!index)
				for (const validation of validations) {
					validation(command);
				}

			const names = [command.commandName];

			for (const name of names) {
				this._subCommands.set(name, command);
			}

			if (testOnly) {
				for (const guildId of this._instance.testServers) {
					this._slashCommands.create(
						command.commandName,
						description!,
						optionDatas,
						guildId
					);
				}
			} else {
				this._slashCommands.create(
					command.commandName,
					description!,
					optionDatas
				);
			}
		}
	}

	public async runCommand(
		command: SubcommandOption,
		args: string[],
		interaction: CommandInteraction
	): Promise<any> {
		const { callback, cooldowns } = command.optionObject;

		const guild = interaction.guild;
		const member = interaction.member as GuildMember;
		const user = interaction.user;
		const channel = interaction.channel as TextChannel;

		const usage: SubCommandUsage = {
			client: command.instance.client,
			instance: command.instance,
			interaction,
			args,
			text: args.join(" "),
			guild,
			member,
			user: user!,
			channel,
		};

		for (const validation of this._validations) {
			if (!(await validation(command, usage, this._prefixes.get(guild?.id)))) {
				return;
			}
		}

		if (cooldowns) {
			const cooldownUsage: InternalCooldownConfig = {
				cooldownType: cooldowns.type,
				userId: user!.id,
				actionId: `command_${command.commandName}`,
				guildId: guild?.id,
				duration: cooldowns.duration,
				errorMessage: cooldowns.errorMessage,
			};

			const result = this._instance.cooldowns?.canRunAction(cooldownUsage);

			if (typeof result === "string") {
				return result;
			}

			await this._instance.cooldowns?.start(cooldownUsage);

			usage.cancelCooldown = () => {
				this._instance.cooldowns?.cancelCooldown(cooldownUsage);
			};

			usage.updateCooldown = (expires: Date) => {
				this._instance.cooldowns?.updateCooldown(cooldownUsage, expires);
			};
		}

		return await callback(usage);
	}

	private getValidations(folder?: string) {
		if (!folder) {
			return [];
		}

		return getAllFiles(folder).map((fileData) => fileData.fileContents);
	}
}

export default CommandHandler;
