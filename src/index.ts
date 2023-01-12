import CommandHandler from "./command-handler/CommandHandler";
import mongoose from "mongoose";
import { ISWAGCommands } from "./types";
import Cooldowns from "./util/Cooldowns";
import { Logger } from "./lib/structures/Logger";
import EventHandler from "./event-handler/EventHandler";
export const logger = new Logger();

class SWAGCommands {
	_testServers;
	_botOwners;
	_cooldowns;
	_logger = logger;
	_commandHandler;
	_eventHandler;
	_disabledDefaultCommands;
	constructor({
		client,
		commandsDir,
		defaultPrefix = "!",
		mongoUri,
		testServers = [],
		botOwners = [],
		cooldownConfig,
		disabledDefaultCommands = [],
		events,
	}: ISWAGCommands) {
		if (!client) {
			throw new Error("A client is required.");
		}

		this._testServers = testServers;
		this._botOwners = botOwners;
		this._cooldowns = new Cooldowns((this as unknown) as SWAGCommands, {
			errorMessage: "Please wait {TIME} before doing that again.",
			botOwnersBypass: false,
			dbRequired: 300, // 5 minutes
			...cooldownConfig,
		});
		this._disabledDefaultCommands = disabledDefaultCommands.map((cmd) =>
			cmd.toLowerCase()
		);

		if (mongoUri) {
			this.connectToMongo(mongoUri);
		}

		if (commandsDir) {
			this._commandHandler = new CommandHandler(
				this,
				commandsDir,
				client,
				defaultPrefix
			);
		}
		if (events?.dir) {
			this._eventHandler = new EventHandler(this, events, client);
		}
	}

	get testServers() {
		return this._testServers;
	}

	get logger() {
		return this._logger;
	}

	get botOwners() {
		return this._botOwners;
	}

	get cooldowns() {
		return this._cooldowns;
	}

	get disabledDefaultCommands() {
		return this._disabledDefaultCommands;
	}

	get commandHandler() {
		return this._commandHandler;
	}

	get eventHandler() {
		return this._eventHandler;
	}

	connectToMongo(mongoUri: string) {
		mongoose.connect(mongoUri, { keepAlive: true });
	}
}

export default SWAGCommands;
