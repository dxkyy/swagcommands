import { Client } from "discord.js";
import mongoose from "mongoose";

import CommandHandler from "./command-handler/CommandHandler";
import EventHandler from "./event-handler/EventHandler";
import SWAG, { Events, Options, Validations } from "../typings";
import Cooldowns from "./util/Cooldowns";
import DefaultCommands from "./util/DefaultCommands";
import FeaturesHandler from "./util/FeaturesHandler";
import { Logger } from "./logger/structures/Logger";
import SubcommandHandler from "./subcommand-handler/SubcommandHandler";

export const logger = new Logger();

class SWAGCommands {
	private _client!: Client;
	private _defaultPrefix!: string;
	private _testServers!: string[];
	private _botOwners!: string[];
	private _cooldowns: Cooldowns | undefined;
	private _disabledDefaultCommands!: DefaultCommands[];
	private _validations!: Validations;
	private _commandHandler: CommandHandler | undefined;
	private _subcommandHandler: SubcommandHandler | undefined;
	private _eventHandler!: EventHandler;
	private _isConnectedToDB = false;

	constructor(options: Options) {
		this.init(options);
	}

	private async init(options: Options) {
		let {
			client,
			mongoUri,
			commandsDir,
			subcommandsDir,
			featuresDir,
			defaultPrefix = "!",
			testServers = [],
			botOwners = [],
			cooldownConfig,
			disabledDefaultCommands = [],
			events = {},
			validations = {},
		} = options;

		if (!client) {
			throw new Error("A client is required.");
		}

		if (mongoUri) {
			await this.connectToMongo(mongoUri);
		}

		// Add the bot owner's ID
		if (botOwners.length === 0) {
			await client.application?.fetch();
			const ownerId = client.application?.owner?.id;
			if (ownerId && botOwners.indexOf(ownerId) === -1) {
				botOwners.push(ownerId);
			}
		}

		this._client = client;
		this._defaultPrefix = defaultPrefix;
		this._testServers = testServers;
		this._botOwners = botOwners;
		this._disabledDefaultCommands = disabledDefaultCommands;
		this._validations = validations;

		this._cooldowns = new Cooldowns((this as unknown) as SWAG, {
			errorMessage: "Please wait {TIME} before doing that again.",
			botOwnersBypass: false,
			dbRequired: 300, // 5 minutes
			...cooldownConfig,
		});

		if (commandsDir) {
			this._commandHandler = new CommandHandler(
				(this as unknown) as SWAG,
				commandsDir,
				client
			);
		}

		if (subcommandsDir) {
			this._subcommandHandler = new SubcommandHandler(
				(this as unknown) as SWAG,
				subcommandsDir,
				client
			);
		}

		if (featuresDir) {
			new FeaturesHandler((this as unknown) as SWAG, featuresDir, client);
		}

		this._eventHandler = new EventHandler(
			(this as unknown) as SWAG,
			events as Events,
			client
		);
	}

	public get client(): Client {
		return this._client;
	}

	public get defaultPrefix(): string {
		return this._defaultPrefix;
	}

	public get testServers(): string[] {
		return this._testServers;
	}

	public get botOwners(): string[] {
		return this._botOwners;
	}

	public get cooldowns(): Cooldowns | undefined {
		return this._cooldowns;
	}

	public get disabledDefaultCommands(): DefaultCommands[] {
		return this._disabledDefaultCommands;
	}

	public get commandHandler(): CommandHandler | undefined {
		return this._commandHandler;
	}

	public get subcommandHandler(): SubcommandHandler | undefined {
		return this._subcommandHandler;
	}

	public get eventHandler(): EventHandler {
		return this._eventHandler;
	}

	public get validations(): Validations {
		return this._validations;
	}

	public get isConnectedToDB(): boolean {
		return this._isConnectedToDB;
	}

	private async connectToMongo(mongoUri: string) {
		await mongoose.connect(mongoUri, {
			keepAlive: true,
		});

		this._isConnectedToDB = true;
	}
}

export default SWAGCommands;
