import {
	Client,
	Events,
	Message,
	InteractionType,
	Interaction,
} from "discord.js";
import path from "path";
import SWAGCommands from "..";
import getAllFiles from "../util/get-all-files";
import Command from "./Command";
import SlashCommands from "./SlashCommands";

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

	async readFiles() {
		const files = getAllFiles(this._commandsDir);
		const validations = this.getValidations("syntax");

		for (const file of files) {
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

			if (del) {
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
		const { callback, type } = command.commandObject;

		if (message && type === "SLASH") return;

		const usage = {
			message,
			interaction,
			args,
			text: args.join(" "),
			guild: message ? message.guild : interaction.guild,
			member: message ? message.member : interaction.member,
			user: message ? message.author : interaction.user,
		};

		for (const validation of this._validations) {
			if (!validation.validation(command, usage, this._prefix)) return;
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

	getValidations(folder: string) {
		const validations = getAllFiles(
			path.join(__dirname, `./validations/${folder}`)
		).map((filePath) => require(filePath));

		return validations;
	}
}

export default CommandHandler;
