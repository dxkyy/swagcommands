import {
	Client,
	Events,
	Message,
	InteractionType,
	Interaction,
	CommandInteraction,
	CacheType,
	AutocompleteInteraction,
} from "discord.js";
import path from "path";
import SWAGCommands from "..";
import getAllFiles from "../util/get-all-files";
import Command from "./Command";
import SlashCommands from "./SlashCommands";
import { cooldownTypes, cooldownTypesType } from "../util/Cooldowns";

class CommandHandler {
	// <commandName, commandObject>
	_commands = new Map();
	_validations = this.getValidations("run-time");

	_instance: SWAGCommands;
	_commandsDir;
	_slashCommands;
	_prefix;
	_client;

	constructor(
		instance: SWAGCommands,
		commandsDir: string,
		client: Client,
		prefix: string
	) {
		this._instance = instance;
		this._commandsDir = commandsDir;
		this._slashCommands = new SlashCommands(client);
		this._prefix = prefix;
		this._client = client;
		this.readFiles();
		this.messageListener(client);
		this.interactionListener(client);
	}

	get commands() {
		return this._commands;
	}

	async readFiles() {
		const files = getAllFiles(this._commandsDir);
		const defaultCommands = getAllFiles(path.join(__dirname, "./commands"));
		const validations = this.getValidations("syntax");

		for (const file of [...files, ...defaultCommands]) {
			const commandObject = require(file).command;

			let commandName = file
				.split(/[/\\]/)
				.pop()
				?.split(".")[0];

			const command = new Command(this._instance, commandName!, commandObject);

			const {
				testOnly,
				description,
				type,
				delete: del,
				aliases = [],
				init = () => {},
			} = commandObject;

			if (
				del ||
				this._instance.disabledDefaultCommands.includes(
					commandName!.toLowerCase()
				)
			) {
				if (type === "SLASH" || type === "BOTH") {
					if (testOnly) {
						for (const guildId of this._instance.testServers) {
							this._slashCommands.delete(command.commandName, guildId);
						}
					} else {
						this._slashCommands.delete(command.commandName);
					}
				}
				continue;
			}

			for (const validation of validations) {
				validation.validation(command);
			}

			await init(this._client, this._instance);

			const names = [command.commandName, ...aliases];

			for (const name of names) {
				this._commands.set(name, command);
			}

			if (type === "SLASH" || type === "BOTH") {
				const options =
					commandObject.options ||
					this._slashCommands.createOptions(commandObject);

				if (testOnly) {
					for (const guildId of this._instance.testServers) {
						this._slashCommands.create(
							command.commandName,
							description,
							options,
							guildId
						);
					}
				} else {
					this._slashCommands.create(command.commandName, description, options);
				}
			}
		}
	}

	async runCommand(
		command: Command,
		args: string[],
		message: Message,
		interaction: Interaction
	) {
		const { callback, type, cooldowns } = command.commandObject;

		if (message && type === "SLASH") return;

		const guild = message ? message.guild : interaction.guild;
		const member = message ? message.member : interaction.member;
		const user = message ? message.author : interaction.user;

		const usage = {
			instance: command.instance,
			message,
			interaction,
			args,
			text: args.join(" "),
			guild,
			member,
			user,
		} as any;

		for (const validation of this._validations) {
			if (!(await validation.validation(command, usage, this._prefix))) return;
		}

		if (cooldowns) {
			let cooldownType: cooldownTypesType = "global";
			for (const type of cooldownTypes) {
				if (cooldowns[type]) {
					cooldownType = type as cooldownTypesType;
					break;
				}
			}
			const cooldownUsage = {
				cooldownType,
				userId: user.id,
				actionId: `command_${command.commandName}`,
				guildId: guild?.id,
				duration: cooldowns[cooldownType],
				errorMessage: cooldowns.errorMessage,
			};

			const result = this._instance.cooldowns.canRunAction(cooldownUsage);
			if (typeof result === "string") return result;

			await this._instance.cooldowns.start(cooldownUsage);

			usage.cancelCooldown = () => {
				this._instance.cooldowns.cancelCooldown(cooldownUsage);
			};

			usage.updateCooldown = (expires: Date) => {
				this._instance.cooldowns.updateCooldown(cooldownUsage, expires);
			};
		}

		return await callback(usage);
	}

	async messageListener(client: Client) {
		client.on(Events.MessageCreate, async (message: Message) => {
			const { content } = message;

			if (!content.startsWith(this._prefix)) return;

			const args = content.split(/\s+/);
			const commandName = args
				.shift()
				?.substring(this._prefix.length)
				.toLowerCase();

			const command = this._commands.get(commandName) as Command;
			if (!command) return;

			const { reply, deferReply } = command.commandObject;

			if (deferReply) message.channel.sendTyping();

			const response = await this.runCommand(
				command,
				args,
				message,
				undefined!
			);
			if (!response) return;

			if (reply) message.reply(response).catch(() => {});
			else message.channel.send(response).catch(() => {});
		});
	}

	async interactionListener(client: Client) {
		client.on("interactionCreate", async (interaction) => {
			if (interaction.type === InteractionType.ApplicationCommandAutocomplete) {
				await this.handleAutocomplete(interaction);
				return;
			}

			if (interaction.type !== InteractionType.ApplicationCommand) return;

			const args = interaction.options.data.map(({ value }) => {
				return String(value);
			});

			const command = this._commands.get(interaction.commandName) as Command;
			if (!command) return;

			const { deferReply } = command.commandObject;

			if (deferReply)
				await interaction.deferReply({ ephemeral: deferReply === "ephemeral" });

			const response = await this.runCommand(command, args, null!, interaction);
			if (!response) return;

			if (deferReply) interaction.editReply(response).catch(() => {});
			else interaction.reply(response).catch(() => {});
		});
	}

	async handleAutocomplete(interaction: AutocompleteInteraction) {
		const command = this._commands.get(interaction.commandName) as Command;
		if (!command) return;

		const { autocomplete } = command.commandObject;
		if (!autocomplete) return;

		const focusedOption = interaction.options.getFocused(true);
		const choices = await autocomplete(
			interaction,
			command,
			focusedOption.name
		);

		const filtered = choices
			.filter((choice: string) =>
				choice.toLowerCase().startsWith(focusedOption.value.toLowerCase())
			)
			.slice(0, 25);

		await interaction.respond(
			filtered.map((choice: string) => ({
				name: choice,
				value: choice,
			}))
		);
	}

	getValidations(folder: string) {
		const validations = getAllFiles(
			path.join(__dirname, `./validations/${folder}`)
		).map((filePath) => require(filePath));

		return validations;
	}
}

export default CommandHandler;
